#!/usr/bin/env node

/**
 * Tour de France Route Extractor
 * Extracts official route data and converts to GPX
 * 
 * Usage: npx tdf-route-extractor <stage-number>
 * Example: npx tdf-route-extractor 6
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

class TDFRouteExtractor {
  constructor() {
    // Updated to use the working URL pattern from user's success
    this.baseUrl = 'https://services9.arcgis.com/euYKeqX7FwwgASW5/arcgis/rest/services/TDF25/FeatureServer/2/query';
    this.defaultParams = {
      f: 'geojson',
      returnGeometry: 'true',
      spatialRel: 'esriSpatialRelIntersects',
      maxAllowableOffset: '0.07464553541191635',
      outFields: '*',
      outSR: '102100', // Web Mercator
      resultType: 'tile',
      geometryType: 'esriGeometryEnvelope',
      inSR: '102100'
    };
  }

  async extractStage(stageNumber, options = {}) {
    console.log(`🚴‍♂️ Extracting Tour de France 2025 Stage ${stageNumber}...`);

    const params = {
      ...this.defaultParams,
      where: stageNumber ? `Etape=${stageNumber}` : '1=1',
      geometry: JSON.stringify({
        "xmin": -560000,
        "ymin": 5100000,
        "xmax": 1050000,
        "ymax": 6700000,
        "spatialReference": { "wkid": 102100 }
      }),
      quantizationParameters: JSON.stringify({
        "mode": "view",
        "originPosition": "upperLeft",
        "tolerance": 0.07464553541191635,
        "extent": {
          "xmin": -3.0149499989999526,
          "ymin": 42.74294000000003,
          "xmax": 6.7878200000000675,
          "ymax": 51.03431000000006,
          "spatialReference": { "wkid": 4326, "latestWkid": 4326, "vcsWkid": 5773, "latestVcsWkid": 5773 }
        }
      })
    };

    const url = this.buildUrl(params);
    const geoJsonData = await this.fetchGeoJSON(url);

    if (!geoJsonData.features) {
      throw new Error('No features in response');
    }

    // Filter by stage if we got all stages
    let features = geoJsonData.features;
    if (stageNumber && features.length > 1) {
      features = features.filter(f => f.properties.Etape == stageNumber);
    }

    if (features.length === 0) {
      throw new Error(`No features found for stage ${stageNumber}`);
    }

    console.log(`✅ Found ${features.length} feature(s)`);

    // Process the features
    const results = [];
    for (const feature of features) {
      const result = await this.processFeature(feature, options);
      results.push(result);
    }

    return results;
  }

  buildUrl(params) {
    const queryString = Object.entries(params)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');

    return `${this.baseUrl}?${queryString}`;
  }

  fetchGeoJSON(url) {
    return new Promise((resolve, reject) => {
      console.log(`🔗 Full URL: ${url}`);

      // Add browser headers to mimic successful browser request
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': 'https://www.letour.fr/',
          'Origin': 'https://www.letour.fr',
          'Connection': 'keep-alive',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'cross-site'
        }
      };

      https.get(options, (response) => {
        console.log(`📊 Response status: ${response.statusCode}`);
        console.log(`📊 Response headers:`, response.headers);

        if (response.statusCode !== 200) {
          let errorData = '';
          response.on('data', chunk => errorData += chunk);
          response.on('end', () => {
            reject(new Error(`HTTP ${response.statusCode}: ${errorData}`));
          });
          return;
        }

        // Handle compressed responses
        let responseStream = response;
        const encoding = response.headers['content-encoding'];

        if (encoding === 'br') {
          console.log('🔄 Decompressing Brotli data...');
          responseStream = response.pipe(zlib.createBrotliDecompress());
        } else if (encoding === 'gzip') {
          console.log('🔄 Decompressing Gzip data...');
          responseStream = response.pipe(zlib.createGunzip());
        } else if (encoding === 'deflate') {
          console.log('🔄 Decompressing Deflate data...');
          responseStream = response.pipe(zlib.createInflate());
        }

        let data = '';

        responseStream.on('data', chunk => {
          data += chunk;
        });

        responseStream.on('end', () => {
          console.log(`📊 Decompressed data length: ${data.length} characters`);
          console.log(`📊 Raw response (first 200 chars): ${data.substring(0, 200)}...`);

          try {
            const jsonData = JSON.parse(data);

            if (jsonData.error) {
              reject(new Error(`API Error: ${jsonData.error.message || JSON.stringify(jsonData.error)}`));
              return;
            }

            resolve(jsonData);
          } catch (error) {
            reject(new Error(`Failed to parse JSON response: ${error.message}. Raw response: ${data.substring(0, 500)}`));
          }
        });

        responseStream.on('error', (error) => {
          reject(new Error(`Decompression error: ${error.message}`));
        });

      }).on('error', (error) => {
        reject(new Error(`Network error: ${error.message}`));
      });
    });
  }

  async processFeature(feature, options) {
    const properties = feature.properties || {};
    const stageName = properties.Name || `Stage ${properties.Etape || 'Unknown'}`;
    const stageNumber = properties.Etape || 'Unknown';

    console.log(`📍 Processing: ${stageName}`);

    if (!feature.geometry || !feature.geometry.coordinates) {
      throw new Error(`No geometry data found for ${stageName}`);
    }

    // Convert coordinates from Web Mercator to WGS84
    const coordinates = this.convertWebMercatorToWGS84(feature.geometry.coordinates);

    console.log(`🔄 Converted ${coordinates.length} coordinates to GPS format`);

    // Generate GPX
    const gpxContent = this.createGPX(coordinates, stageName, properties);

    // Save to file
    const filename = this.generateFilename(stageName, stageNumber, options.output);
    const filepath = this.saveGPX(gpxContent, filename);

    return {
      stage: stageNumber,
      name: stageName,
      coordinates: coordinates.length,
      distance: properties.Distance,
      file: filepath,
      properties
    };
  }

  convertWebMercatorToWGS84(coordinates) {
    const converted = [];

    for (const [x, y] of coordinates) {
      // Web Mercator (EPSG:102100) to WGS84 conversion
      // Formula for EPSG:3857/102100 to WGS84
      const lon = (x / 20037508.34) * 180;
      const lat = (Math.atan(Math.exp((y / 20037508.34) * Math.PI)) - Math.PI / 4) * 2 * (180 / Math.PI);

      // Validate coordinates are reasonable for France
      if (lon >= -5 && lon <= 10 && lat >= 41 && lat <= 52) {
        converted.push([lon, lat]);
      }
    }

    console.log(`📐 Converted ${converted.length}/${coordinates.length} coordinates to valid France bounds`);
    return converted;
  }

  createGPX(coordinates, stageName, properties) {
    const { Distance, Type, Date, Heure, Cols } = properties;

    let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="tdf-route-extractor" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <n>${stageName}</n>
    <desc>Tour de France 2025 - ${stageName}</desc>`;

    if (Distance) {
      gpx += `
    <keywords>Tour de France, ${stageName}, ${Distance}km</keywords>`;
    }

    gpx += `
  </metadata>
  <trk>
    <n>${stageName}</n>`;

    if (Distance || Type || Date) {
      gpx += `
    <desc>`;
      if (Distance) gpx += `Distance: ${Distance}km `;
      if (Type) gpx += `Type: ${Type} `;
      if (Date) gpx += `Date: ${Date} `;
      if (Heure) gpx += `Start: ${Heure}`;
      gpx += `</desc>`;
    }

    gpx += `
    <trkseg>`;

    coordinates.forEach(([lon, lat]) => {
      gpx += `
      <trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}"></trkpt>`;
    });

    gpx += `
    </trkseg>
  </trk>`;

    // Add climbs as waypoints
    if (Cols) {
      const climbs = Cols.split(/\r?\n/).filter(climb => climb.trim());

      climbs.forEach((climb, index) => {
        // Distribute climbs along the route
        const climbIndex = Math.floor((index + 1) * coordinates.length / (climbs.length + 1));
        if (coordinates[climbIndex]) {
          const [lon, lat] = coordinates[climbIndex];
          const climbName = climb.split(' - ')[0] || `Climb ${index + 1}`;

          gpx += `
  <wpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}">
    <n>${climbName}</n>
    <desc>${climb}</desc>
    <type>climb</type>
  </wpt>`;
        }
      });
    }

    gpx += `
</gpx>`;

    return gpx;
  }

  generateFilename(stageName, stageNumber, outputPath) {
    const safeName = stageName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
    const paddedStageNumber = String(stageNumber).padStart(2, '0');
    const filename = `TDF2025_Stage${paddedStageNumber}_${safeName}.gpx`;

    if (outputPath) {
      return path.join(outputPath, filename);
    }

    return filename;
  }

  saveGPX(content, filename) {
    const outputDir = path.dirname(filename);

    // Create directory if it doesn't exist
    if (outputDir !== '.' && !fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(filename, content, 'utf8');
    console.log(`💾 Saved: ${filename}`);

    return path.resolve(filename);
  }

  async extractAllStages(options = {}) {
    console.log('🚴‍♂️ Extracting all Tour de France 2025 stages...');

    try {
      // Get all stages (no stage filter)
      const params = { ...this.defaultParams, where: '1=1' };
      const url = this.buildUrl(params);

      const geoJsonData = await this.fetchGeoJSON(url);

      if (!geoJsonData.features || geoJsonData.features.length === 0) {
        throw new Error('No route data found');
      }

      console.log(`✅ Found ${geoJsonData.features.length} total stages`);

      const results = [];
      for (const feature of geoJsonData.features) {
        try {
          const result = await this.processFeature(feature, options);
          results.push(result);
        } catch (error) {
          console.error(`❌ Error processing stage: ${error.message}`);
        }
      }

      return results;

    } catch (error) {
      console.error(`❌ Error extracting all stages:`, error.message);
      throw error;
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🚴‍♂️ Tour de France Route Extractor

USAGE:
  npx tdf-route-extractor <stage-number>     Extract specific stage
  npx tdf-route-extractor --all              Extract all stages
  npx tdf-route-extractor --list             List available stages

OPTIONS:
  --output, -o <path>     Output directory (default: current directory)
  --help, -h              Show this help message

EXAMPLES:
  npx tdf-route-extractor 6                  Extract Stage 6
  npx tdf-route-extractor 4 --output ./gpx   Extract Stage 4 to ./gpx/
  npx tdf-route-extractor --all -o ./routes  Extract all stages to ./routes/
    `);
    return;
  }

  const extractor = new TDFRouteExtractor();
  const options = {};

  // Parse options
  const outputIndex = args.findIndex(arg => arg === '--output' || arg === '-o');
  if (outputIndex !== -1 && args[outputIndex + 1]) {
    options.output = args[outputIndex + 1];
  }

  try {
    if (args.includes('--all')) {
      // Extract all stages
      const results = await extractor.extractAllStages(options);

      console.log('\n🎉 Extraction complete!');
      console.log(`📊 Successfully extracted ${results.length} stages:`);

      results.forEach(result => {
        console.log(`  Stage ${result.stage}: ${result.name} (${result.coordinates} points) → ${result.file}`);
      });

    } else if (args.includes('--list')) {
      // List stages (get basic info without full extraction)
      console.log('📋 Fetching stage list...');
      const params = { ...extractor.defaultParams, returnGeometry: 'false', where: '1=1' };
      const url = extractor.buildUrl(params);
      const data = await extractor.fetchGeoJSON(url);

      console.log('\n🚴‍♂️ Tour de France 2025 Stages:');
      data.features
        .sort((a, b) => (a.properties.Etape || 0) - (b.properties.Etape || 0))
        .forEach(feature => {
          const { Etape, Name, Distance, Type, Date } = feature.properties;
          console.log(`  Stage ${Etape}: ${Name} (${Distance}km, ${Type}) - ${Date}`);
        });

    } else {
      // Extract specific stage
      const stageNumber = parseInt(args[0]);

      if (!stageNumber || stageNumber < 1 || stageNumber > 21) {
        console.error('❌ Please provide a valid stage number (1-21)');
        console.log('Usage: npx tdf-route-extractor <stage-number>');
        console.log('Or use: npx tdf-route-extractor --help');
        process.exit(1);
      }

      const results = await extractor.extractStage(stageNumber, options);

      console.log('\n🎉 Extraction complete!');
      results.forEach(result => {
        console.log(`✅ Stage ${result.stage}: ${result.name}`);
        console.log(`   📏 Distance: ${result.distance}km`);
        console.log(`   📍 Coordinates: ${result.coordinates} points`);
        console.log(`   💾 File: ${result.file}`);
      });
    }

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// Export for use as module
module.exports = TDFRouteExtractor;

// Run CLI if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });
}