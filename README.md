# 🚴‍♂️ Tour de France Route Extractor

Extract official Tour de France 2025 route data and convert to GPX format for GPS devices.

## Installation

```bash
git clone https://github.com/jmattson/tdf-route-extractor.git
cd tdf-route-extractor
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
```

## Options

| Option | Description |
|--------|-------------|
| `<stage-number>` | Extract specific stage (1-21) |
| `--all` | Extract all 21 stages |
| `--list` | List all available stages |
| `--output, -o` | Output directory |
| `--help, -h` | Show help message |

## Output

Creates GPX files with format: `TDF2025_Stage06_BAYEUX_VIRE_NORMANDIE.gpx`

Files include:
- Route track points with GPS coordinates
- Stage metadata (distance, type, date, start time)
- Waypoints for climbs

Compatible with Garmin, Wahoo, Strava, and most GPS devices/apps.

## Programmatic Usage

```javascript
const TDFRouteExtractor = require('./index.js');
const extractor = new TDFRouteExtractor();

// Extract Stage 6
const results = await extractor.extractStage(6);
console.log('Stage extracted:', results[0].file);
```

## Data Source

Extracts from official Tour de France ArcGIS services with coordinate conversion from Web Mercator to GPS (WGS84).

## License

MIT
