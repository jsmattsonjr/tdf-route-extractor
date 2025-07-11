# 🚴‍♂️ Tour de France Route Extractor

Extract official Tour de France 2025 route data and convert to GPX format for GPS devices with intelligent rolling start elimination and precise waypoint alignment.

## Features

- ✅ **Official Route Data**: Extracts from Tour de France ArcGIS services
- ✅ **Intelligent Rolling Start Elimination**: Automatically aligns routes with official start waypoints
- ✅ **Point Projection**: Projects start waypoints onto routes when no nearby trackpoints exist
- ✅ **Official Waypoints**: Includes precise start, finish, climb, and sprint waypoints
- ✅ **Route Direction Validation**: Ensures routes follow correct start→finish direction
- ✅ **Multi-geometry Support**: Handles both LineString and MultiLineString routes
- ✅ **Coordinate Conversion**: Converts Web Mercator to GPS (WGS84) coordinates
- ✅ **GPX Compatibility**: Works with Garmin, Wahoo, Strava, and most GPS devices

## Installation

```bash
git clone https://github.com/jmattson/tdf-route-extractor.git
cd tdf-route-extractor
npm install  # Optional: only needed for testing
```

## Usage

```bash
# Extract a specific stage
node index.js 6

# Extract all stages
node index.js --all

# List available stages
node index.js --list

# Extract to specific directory
node index.js 6 --output ./routes/

# Preserve original route start (skip rolling start elimination)
node index.js 6 --keep-rolling-start
```

## Options

| Option | Description |
|--------|-------------|
| `<stage-number>` | Extract specific stage (1-21) |
| `--all` | Extract all 21 stages |
| `--list` | List all available stages |
| `--output, -o <path>` | Output directory (default: current directory) |
| `--keep-rolling-start` | Skip rolling start elimination (preserve original route start) |
| `--help, -h` | Show help message |

## Rolling Start Elimination

By default, the extractor automatically eliminates "rolling starts" to align routes with official start waypoints:

### How it works:
1. **3-meter search**: Looks for existing trackpoints within 3 meters of the official start waypoint
2. **Point projection**: If none found, projects the start waypoint onto the route linestring
3. **Trackpoint removal**: Removes all trackpoints before the true start location
4. **Perfect alignment**: Results in 0-meter distance from official start waypoint

### Example (Stage 2):
- **Without elimination** (`--keep-rolling-start`): 7,802 trackpoints, 5,872m from official start
- **With elimination** (default): 7,263 trackpoints, 0m from official start

Use `--keep-rolling-start` if you prefer to preserve the original route data unchanged.

## Output

Creates GPX files with format: `TDF2025_Stage06_BAYEUX_VIRE_NORMANDIE.gpx`

### GPX Content:
- **Route tracks**: GPS coordinates for the entire stage route
- **Official waypoints**: Precise start, finish, climb, and sprint locations
- **Stage metadata**: Distance, type, date, start time
- **Climb details**: Individual waypoints with elevation categories
- **Sprint points**: Intermediate sprint locations

### Compatibility:
Compatible with Garmin, Wahoo, Strava, and most GPS devices/apps that support GPX 1.1 format.

## Programmatic Usage

```javascript
const TDFRouteExtractor = require('./index.js');
const extractor = new TDFRouteExtractor();

// Extract specific stage
const results = await extractor.extractStage(6);
console.log('Stage extracted:', results[0].file);

// Extract with options
const results2 = await extractor.extractStage(2, { 
  output: './gpx/', 
  keepRollingStart: true 
});

// Extract all stages
const allResults = await extractor.extractAllStages({ output: './routes/' });
console.log(`Extracted ${allResults.length} stages`);
```

## Technical Details

### Data Source
- **Primary**: Tour de France ArcGIS FeatureServer (`services9.arcgis.com`)
- **Route data**: LineString and MultiLineString geometries in Web Mercator (EPSG:102100)
- **Waypoints**: Point geometries with official start, finish, climb, and sprint locations
- **Fallback strategies**: Multiple API request patterns for reliability

### Coordinate Systems
- **Input**: Web Mercator (EPSG:102100) from ArcGIS services
- **Output**: WGS84 GPS coordinates (latitude/longitude)
- **Precision**: 6 decimal places (~1 meter accuracy)
- **Validation**: France geographic bounds (lat: 41-52°N, lon: -5-10°E)

### Route Processing
1. **Geometry handling**: Converts MultiLineString to connected LineString when possible
2. **Direction validation**: Uses finish waypoint to ensure correct route direction
3. **Rolling start elimination**: 3-meter proximity search + point projection fallback
4. **Waypoint integration**: Merges official waypoints with route tracks

### Performance
- **Compression**: Handles gzip, brotli, and deflate response encoding
- **Error handling**: Graceful fallbacks for API timeouts and data issues
- **Logging**: Detailed progress and validation information

## Testing

```bash
# Run test suite
npm test

# Test specific functionality
node test.js
```

Tests validate:
- API connectivity and authentication
- Coordinate conversion accuracy
- GPX file generation
- Rolling start elimination

## License

MIT

## Contributing

Contributions welcome! Please ensure all tests pass and follow the existing code style.

## Credits

Co-authored by Jim Mattson and Claude (Anthropic)
