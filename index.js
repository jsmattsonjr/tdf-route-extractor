#!/usr/bin/env node

/**
 * Tour de France Route Extractor
 * Extracts official route data and converts to GPX
 * 
 * Usage: node index.js <stage-number>
 * Example: node index.js 6
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

class TDFRouteExtractor {
  constructor() {
    // Updated to use the working URL pattern from user's success
    this.baseUrl = 'https://services9.arcgis.com/euYKeqX7FwwgASW5/arcgis/rest/services/TDF25/FeatureServer/2/query';
    this.pointsUrl = 'https://services9.arcgis.com/euYKeqX7FwwgASW5/arcgis/rest/services/TDF25/FeatureServer/0/query';
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

  buildPointsUrl(params) {
    const queryString = Object.entries(params)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');

    return `${this.pointsUrl}?${queryString}`;
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

  async fetchStageWaypoints(stageNumber) {
    const params = {
      f: 'geojson',
      where: `Etape='${stageNumber}'`,
      outFields: '*',
      returnGeometry: 'true'
    };

    const url = this.buildPointsUrl(params);
    console.log(`🚩 Fetching waypoints for Stage ${stageNumber}...`);
    
    try {
      const data = await this.fetchGeoJSON(url);
      const waypoints = {
        start: null,
        finish: null,
        climbs: [],
        sprints: [],
        other: []
      };

      if (data.features) {
        for (const feature of data.features) {
          const props = feature.properties;
          const snippet = props.Snippet;
          const coords = feature.geometry.coordinates;
          
          const waypoint = {
            name: props.Name,
            type: snippet,
            coordinates: coords,
            distance: props.Distance,
            date: props.Date,
            description: props.Texte
          };

          if (snippet === 'Départ réel') {
            waypoints.start = waypoint;
          } else if (snippet === 'Arrivée' || (snippet && snippet.startsWith('Arrivée/'))) {
            waypoints.finish = waypoint;
          } else if (snippet && snippet.includes('Catégorie') && !snippet.startsWith('Arrivée/')) {
            waypoints.climbs.push(waypoint);
          } else if (snippet === 'Sprint') {
            waypoints.sprints.push(waypoint);
          } else {
            waypoints.other.push(waypoint);
          }
        }
      }

      console.log(`🚩 Found ${data.features?.length || 0} waypoints for Stage ${stageNumber}`);
      console.log(`   📍 Start: ${waypoints.start ? waypoints.start.name : 'Not found'}`);
      console.log(`   🏁 Finish: ${waypoints.finish ? waypoints.finish.name : 'Not found'}`);
      console.log(`   ⛰️  Climbs: ${waypoints.climbs.length}`);
      console.log(`   🏃 Sprints: ${waypoints.sprints.length}`);

      return waypoints;
    } catch (error) {
      console.error(`❌ Failed to fetch waypoints for Stage ${stageNumber}:`, error.message);
      return null;
    }
  }

  async processFeature(feature, options) {
    const properties = feature.properties || {};
    const stageName = properties.Name || `Stage ${properties.Etape || 'Unknown'}`;
    const stageNumber = properties.Etape || 'Unknown';

    console.log(`📍 Processing: ${stageName}`);

    if (!feature.geometry || !feature.geometry.coordinates) {
      throw new Error(`No geometry data found for ${stageName}`);
    }

    // Fetch official waypoints for this stage
    const waypoints = await this.fetchStageWaypoints(stageNumber);

    // Handle MultiLineString by selecting the LineString with the most coordinates
    let coordinates = feature.geometry.coordinates;
    const geometryType = feature.geometry.type;

    if (geometryType === 'MultiLineString') {
      console.log(`🔀 Found MultiLineString with ${coordinates.length} LineStrings`);

      // Try to connect LineStrings, fallback to longest if no connections
      coordinates = this.connectLineStrings(coordinates, stageName, waypoints);
    } else if (geometryType === 'LineString') {
      console.log(`📏 Found LineString with ${coordinates.length} coordinates`);
      
      // Validate direction for single LineString using waypoints
      if (waypoints && waypoints.start && waypoints.finish) {
        coordinates = this.validateRouteDirection(coordinates, waypoints);
      }
    } else {
      throw new Error(`Unsupported geometry type: ${geometryType}`);
    }

    // Convert coordinates from Web Mercator to WGS84
    const convertedCoordinates = this.convertWebMercatorToWGS84(coordinates);

    console.log(`🔄 Converted ${convertedCoordinates.length} coordinates to GPS format`);

    // Generate GPX
    const gpxContent = this.createGPX(convertedCoordinates, stageName, properties);

    // Save to file
    const filename = this.generateFilename(stageName, stageNumber, options.output);
    const filepath = this.saveGPX(gpxContent, filename);

    return {
      stage: stageNumber,
      name: stageName,
      coordinates: convertedCoordinates.length,
      distance: properties.Distance,
      file: filepath,
      properties,
      geometryType: geometryType
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

  calculateDistance(point1, point2) {
    const [x1, y1] = point1;
    const [x2, y2] = point2;
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  }

  calculateGPSDistance(point1, point2) {
    const [lat1, lon1] = point1;
    const [lat2, lon2] = point2;
    
    const R = 6378137.0; // WGS84 equatorial radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return (R * c) / 1000; // Distance in kilometers
  }

  findConnectableLineStrings(lineStrings, maxDistance = 10) {
    const connectable = [];
    const significant = lineStrings.filter(ls => ls.length > 100).sort((a, b) => b.length - a.length);
    
    console.log(`🔍 Analyzing ${significant.length} significant LineStrings for connections`);
    
    for (let i = 0; i < significant.length; i++) {
      for (let j = i + 1; j < significant.length; j++) {
        const ls1 = significant[i];
        const ls2 = significant[j];
        
        const ls1Start = ls1[0];
        const ls1End = ls1[ls1.length - 1];
        const ls2Start = ls2[0];
        const ls2End = ls2[ls2.length - 1];
        
        const distances = [
          { type: 'start-start', distance: this.calculateDistance(ls1Start, ls2Start) },
          { type: 'start-end', distance: this.calculateDistance(ls1Start, ls2End) },
          { type: 'end-start', distance: this.calculateDistance(ls1End, ls2Start) },
          { type: 'end-end', distance: this.calculateDistance(ls1End, ls2End) }
        ];
        
        const closeConnection = distances.find(d => d.distance <= maxDistance);
        if (closeConnection) {
          connectable.push({
            index1: i,
            index2: j,
            lineString1: ls1,
            lineString2: ls2,
            connection: closeConnection,
            totalLength: ls1.length + ls2.length
          });
        }
      }
    }
    
    return connectable;
  }

  connectLineStrings(lineStrings, stageName, waypoints = null) {
    const connectable = this.findConnectableLineStrings(lineStrings);
    
    if (connectable.length === 0) {
      console.log('🚫 No connectable LineStrings found, using longest');
      const longest = lineStrings.reduce((longest, current) => 
        current.length > longest.length ? current : longest
      );
      
      // Validate direction for longest LineString using waypoints
      if (waypoints && waypoints.start && waypoints.finish) {
        return this.validateRouteDirection(longest, waypoints);
      }
      
      return longest;
    }
    
    const bestConnection = connectable.reduce((best, current) => 
      current.totalLength > best.totalLength ? current : best
    );
    
    console.log(`🔗 Connecting LineStrings: ${bestConnection.lineString1.length} + ${bestConnection.lineString2.length} coordinates`);
    console.log(`🔗 Connection type: ${bestConnection.connection.type} (${bestConnection.connection.distance.toFixed(2)}m apart)`);
    
    let connected = [];
    const ls1 = bestConnection.lineString1;
    const ls2 = bestConnection.lineString2;
    
    switch (bestConnection.connection.type) {
      case 'start-start':
        connected = [...ls1.slice().reverse(), ...ls2.slice(1)];
        break;
      case 'start-end':
        connected = [...ls2, ...ls1.slice(1)];
        break;
      case 'end-start':
        connected = [...ls1, ...ls2.slice(1)];
        break;
      case 'end-end':
        connected = [...ls1, ...ls2.slice().reverse().slice(1)];
        break;
    }
    
    console.log(`🔗 Connected route: ${connected.length} total coordinates`);
    
    // Validate route direction using official waypoints
    if (waypoints && waypoints.start && waypoints.finish) {
      const routeStart = this.convertWebMercatorToWGS84([connected[0]])[0];
      const routeEnd = this.convertWebMercatorToWGS84([connected[connected.length - 1]])[0];
      const officialStart = [waypoints.start.coordinates[1], waypoints.start.coordinates[0]]; // lon,lat to lat,lon
      const officialFinish = [waypoints.finish.coordinates[1], waypoints.finish.coordinates[0]];
      
      console.log(`🧭 Official: ${waypoints.start.name} (${officialStart[0].toFixed(4)}°N,${officialStart[1].toFixed(4)}°E) → ${waypoints.finish.name} (${officialFinish[0].toFixed(4)}°N,${officialFinish[1].toFixed(4)}°E)`);
      console.log(`🧭 Route:    ${routeStart[0].toFixed(4)}°N,${routeStart[1].toFixed(4)}°E → ${routeEnd[0].toFixed(4)}°N,${routeEnd[1].toFixed(4)}°E`);
      
      // Calculate distances to determine if route is in correct direction
      const distanceStartToStart = this.calculateGPSDistance(routeStart, officialStart);
      const distanceEndToFinish = this.calculateGPSDistance(routeEnd, officialFinish);
      const distanceStartToFinish = this.calculateGPSDistance(routeStart, officialFinish);
      const distanceEndToStart = this.calculateGPSDistance(routeEnd, officialStart);
      
      const forwardScore = distanceStartToStart + distanceEndToFinish;
      const backwardScore = distanceStartToFinish + distanceEndToStart;
      
      console.log(`🧭 Direction check: Forward=${forwardScore.toFixed(2)}km, Backward=${backwardScore.toFixed(2)}km`);
      
      if (backwardScore < forwardScore) {
        console.log('🔄 Route appears to be backwards, reversing...');
        connected = connected.slice().reverse();
        
        const newRouteStart = this.convertWebMercatorToWGS84([connected[0]])[0];
        const newRouteEnd = this.convertWebMercatorToWGS84([connected[connected.length - 1]])[0];
        console.log(`🧭 Reversed: ${newRouteStart[0].toFixed(4)}°N,${newRouteStart[1].toFixed(4)}°E → ${newRouteEnd[0].toFixed(4)}°N,${newRouteEnd[1].toFixed(4)}°E`);
      } else {
        console.log('✅ Route direction appears correct');
      }
    } else if (stageName.includes('>')) {
      const [start, end] = stageName.split('>').map(s => s.trim());
      console.log(`🧭 Stage direction: ${start} → ${end}`);
      
      const firstPoint = this.convertWebMercatorToWGS84([connected[0]])[0];
      const lastPoint = this.convertWebMercatorToWGS84([connected[connected.length - 1]])[0];
      
      console.log(`🧭 Route: ${firstPoint[1].toFixed(4)}°E,${firstPoint[0].toFixed(4)}°N → ${lastPoint[1].toFixed(4)}°E,${lastPoint[0].toFixed(4)}°N`);
    }
    
    return connected;
  }

  validateRouteDirection(coordinates, waypoints) {
    const routeStart = this.convertWebMercatorToWGS84([coordinates[0]])[0];
    const routeEnd = this.convertWebMercatorToWGS84([coordinates[coordinates.length - 1]])[0];
    const officialStart = [waypoints.start.coordinates[1], waypoints.start.coordinates[0]]; // lon,lat to lat,lon
    const officialFinish = [waypoints.finish.coordinates[1], waypoints.finish.coordinates[0]];
    
    console.log(`🧭 Official: ${waypoints.start.name} (${officialStart[0].toFixed(4)}°N,${officialStart[1].toFixed(4)}°E) → ${waypoints.finish.name} (${officialFinish[0].toFixed(4)}°N,${officialFinish[1].toFixed(4)}°E)`);
    console.log(`🧭 Route:    ${routeStart[0].toFixed(4)}°N,${routeStart[1].toFixed(4)}°E → ${routeEnd[0].toFixed(4)}°N,${routeEnd[1].toFixed(4)}°E`);
    
    // Calculate distances to determine if route is in correct direction
    const distanceStartToStart = this.calculateGPSDistance(routeStart, officialStart);
    const distanceEndToFinish = this.calculateGPSDistance(routeEnd, officialFinish);
    const distanceStartToFinish = this.calculateGPSDistance(routeStart, officialFinish);
    const distanceEndToStart = this.calculateGPSDistance(routeEnd, officialStart);
    
    const forwardScore = distanceStartToStart + distanceEndToFinish;
    const backwardScore = distanceStartToFinish + distanceEndToStart;
    
    console.log(`🧭 Direction check: Forward=${forwardScore.toFixed(2)}km, Backward=${backwardScore.toFixed(2)}km`);
    
    if (backwardScore < forwardScore) {
      console.log('🔄 Route appears to be backwards, reversing...');
      const reversed = coordinates.slice().reverse();
      
      const newRouteStart = this.convertWebMercatorToWGS84([reversed[0]])[0];
      const newRouteEnd = this.convertWebMercatorToWGS84([reversed[reversed.length - 1]])[0];
      console.log(`🧭 Reversed: ${newRouteStart[0].toFixed(4)}°N,${newRouteStart[1].toFixed(4)}°E → ${newRouteEnd[0].toFixed(4)}°N,${newRouteEnd[1].toFixed(4)}°E`);
      
      return reversed;
    } else {
      console.log('✅ Route direction appears correct');
      return coordinates;
    }
  }

  createGPX(coordinates, stageName, properties) {
    const { Distance, Type, Date, Heure, Cols } = properties;

    let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="tdf-route-extractor" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${stageName}</name>
    <desc>Tour de France 2025 - ${stageName}</desc>`;

    if (Distance) {
      gpx += `
    <keywords>Tour de France, ${stageName}, ${Distance}km</keywords>`;
    }

    gpx += `
  </metadata>
  <trk>
    <name>${stageName}</name>`;

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
    <name>${climbName}</name>
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
  node index.js <stage-number>     Extract specific stage
  node index.js --all              Extract all stages
  node index.js --list             List available stages

OPTIONS:
  --output, -o <path>     Output directory (default: current directory)
  --help, -h              Show this help message

EXAMPLES:
  node index.js 6                  Extract Stage 6
  node index.js 4 --output ./gpx   Extract Stage 4 to ./gpx/
  node index.js --all -o ./routes  Extract all stages to ./routes/
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
        console.log(`  Stage ${result.stage}: ${result.name} (${result.coordinates} points, ${result.geometryType}) → ${result.file}`);
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
        console.log('Usage: node index.js <stage-number>');
        console.log('Or use: node index.js --help');
        process.exit(1);
      }

      const results = await extractor.extractStage(stageNumber, options);

      console.log('\n🎉 Extraction complete!');
      results.forEach(result => {
        console.log(`✅ Stage ${result.stage}: ${result.name}`);
        console.log(`   📏 Distance: ${result.distance}km`);
        console.log(`   📍 Coordinates: ${result.coordinates} points`);
        console.log(`   🗺️  Geometry: ${result.geometryType}`);
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
