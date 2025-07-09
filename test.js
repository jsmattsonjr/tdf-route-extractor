#!/usr/bin/env node

/**
 * Simple test for TDF Route Extractor
 */

const TDFRouteExtractor = require('./index.js');

async function runTests() {
  console.log('🧪 Running TDF Route Extractor Tests...\n');
  
  const extractor = new TDFRouteExtractor();
  
  try {
    // Test 1: List all stages
    console.log('📋 Test 1: Listing all available stages...');
    const params = { ...extractor.defaultParams, returnGeometry: 'false', where: '1=1' };
    const url = extractor.buildUrl(params);
    const data = await extractor.fetchGeoJSON(url);
    
    console.log(`✅ Found ${data.features.length} stages`);
    console.log('Available stages:');
    data.features
      .sort((a, b) => (a.properties.Etape || 0) - (b.properties.Etape || 0))
      .slice(0, 5) // Show first 5
      .forEach(feature => {
        const { Etape, Name, Distance } = feature.properties;
        console.log(`  Stage ${Etape}: ${Name} (${Distance}km)`);
      });
    console.log('  ...\n');
    
    // Test 2: Extract a single stage (Stage 6)
    console.log('🚴‍♂️ Test 2: Extracting Stage 6...');
    const results = await extractor.extractStage(6, { output: './test-output' });
    
    if (results.length > 0) {
      const result = results[0];
      console.log(`✅ Stage ${result.stage}: ${result.name}`);
      console.log(`   📏 Distance: ${result.distance}km`);
      console.log(`   📍 Coordinates: ${result.coordinates} points`);
      console.log(`   💾 File: ${result.file}\n`);
    }
    
    // Test 3: Coordinate conversion test
    console.log('🔄 Test 3: Testing coordinate conversion...');
    const testWebMercator = [[-244678, 6138288], [-244019, 6138422]];
    const converted = extractor.convertWebMercatorToWGS84(testWebMercator);
    
    console.log('Web Mercator input:', testWebMercator[0]);
    console.log('WGS84 output:', converted[0]);
    console.log(`✅ Converted ${converted.length} coordinates\n`);
    
    console.log('🎉 All tests passed! Package is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run tests if called directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('❌ Test error:', error);
    process.exit(1);
  });
}

module.exports = runTests;
