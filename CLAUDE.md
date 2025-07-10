# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Testing
- `npm test` - Runs the test suite (test.js) which validates API connectivity and basic functionality
- `node test.js` - Direct test execution that checks stage listing, single stage extraction, and coordinate conversion

### Running the CLI
- `npm start` - Runs the main CLI application
- `node index.js` - Direct execution of the CLI tool
- `node index.js <stage-number>` - Run with stage number (1-21)
- `node index.js --all` - Extract all Tour de France stages
- `node index.js --list` - List available stages without extraction

## Project Architecture

### Core Components

**TDFRouteExtractor Class (index.js)**
- Main application class that handles Tour de France route data extraction
- Fetches GeoJSON data from ArcGIS services (services9.arcgis.com)
- Implements multiple API request strategies for reliability
- Converts Web Mercator (EPSG:102100) coordinates to WGS84 GPS format
- Generates GPX files with route tracks and climb waypoints

**Key Methods:**
- `extractStage(stageNumber, options)` - Extract specific stage with fallback strategies
- `extractAllStages(options)` - Extract all 21 stages
- `convertWebMercatorToWGS84(coordinates)` - Coordinate system conversion
- `createGPX(coordinates, stageName, properties)` - GPX file generation
- `fetchGeoJSON(url)` - HTTP client with compression support (gzip, brotli, deflate)

### Data Flow
1. CLI parses command-line arguments
2. TDFRouteExtractor builds ArcGIS REST API URLs with query parameters
3. Fetches GeoJSON data using multiple fallback strategies
4. Filters features by stage number if specified
5. Converts Web Mercator coordinates to WGS84
6. Generates GPX XML with tracks and waypoints
7. Saves files with naming pattern: `TDF2025_Stage<N>_<STAGE_NAME>.gpx`

### API Integration
- **Data Source**: Official Tour de France ArcGIS FeatureServer
- **Base URL**: `https://services9.arcgis.com/euYKeqX7FwwgASW5/arcgis/rest/services/TDF25/FeatureServer/2/query`
- **Authentication**: Uses browser-like headers to mimic web requests
- **Response Format**: GeoJSON with Web Mercator coordinates
- **Fallback Strategies**: 3 different parameter combinations for reliability

### File Structure
- `index.js` - Main CLI application and TDFRouteExtractor class
- `test.js` - Test suite for API connectivity and functionality
- `package.json` - NPM package configuration with CLI binary setup
- `README.md` - Comprehensive user documentation

### GPX Output Format
- Standard GPX 1.1 format with metadata
- Track segments with GPS coordinates (lat/lon)
- Waypoints for climbs distributed along the route
- Includes stage details: distance, type, date, start time

## Key Implementation Details

### Error Handling
- Multiple API request strategies with graceful fallbacks
- Coordinate validation for France geographic bounds
- HTTP response compression handling (gzip, brotli, deflate)
- Detailed error messages for debugging

### Coordinate Conversion
- Converts from Web Mercator (EPSG:102100) to WGS84
- Validates coordinates within France bounds (lat: 41-52, lon: -5 to 10)
- Precision: 6 decimal places for ~1 meter accuracy

### CLI Features
- Interactive help system with `--help` flag
- Output directory specification with `--output` option
- Stage listing with `--list` flag
- Progress indicators and detailed logging