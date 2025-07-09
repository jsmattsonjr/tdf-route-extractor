# 🚴‍♂️ Tour de France Route Extractor

Extract **official Tour de France route data** and convert it to GPX format for use with GPS devices, cycling computers, and navigation apps.

## Features

- ✅ **Official data source** - Extracts from Tour de France's official ArcGIS services
- ✅ **Accurate coordinates** - Converts Web Mercator to GPS (WGS84) format
- ✅ **Complete route details** - Includes stage info, distances, climbs, and waypoints
- ✅ **GPX format** - Compatible with Garmin, Wahoo, Strava, and all GPS devices
- ✅ **All stages** - Extract individual stages or all 21 stages at once
- ✅ **CLI tool** - Simple command-line interface with npx

## Installation

### Clone and Run Locally
```bash
git clone https://github.com/jmattson/tdf-route-extractor.git
cd tdf-route-extractor
npm install
```

### Run the Tool
```bash
# Extract Stage 6 (Bayeux > Vire)
node index.js 6

# Extract Stage 4 (Amiens > Rouen) 
node index.js 4

# Extract all stages
node index.js --all

# Extract to specific directory
node index.js 6 --output ./my-routes/
```

### After Publishing to npm
Once published, you can use npx:
```bash
npx tdf-route-extractor 6
```

## Usage

### Extract Single Stage
```bash
# Extract Stage 6
node index.js 6

# Output:
# 🚴‍♂️ Extracting Tour de France 2025 Stage 6...
# 📡 Fetching data from official source...
# ✅ Found 1 route feature(s)
# 📍 Processing: BAYEUX > VIRE NORMANDIE
# 🔄 Converted 118 coordinates to GPS format
# 💾 Saved: TDF2025_Stage06_BAYEUX_VIRE_NORMANDIE.gpx
# 🎉 Extraction complete!
```

### Extract All Stages
```bash
node index.js --all --output ./tdf2025-routes/
```

### List Available Stages
```bash
node index.js --list

# Output:
# 🚴‍♂️ Tour de France 2025 Stages:
#   Stage 1: LILLE > LILLE (184.9km, Plat) - 05/07
#   Stage 2: LAUWIN-PLANQUE > BOULOGNE-SUR-MER (169.4km, Plat) - 06/07
#   Stage 3: VALENCIENNES > DUNKIRK (166.3km, Plat) - 07/07
#   Stage 4: AMIENS > ROUEN (174.2km, Accidentée) - 08/07
#   ...
```

## Options

| Option | Description | Example |
|--------|-------------|---------|
| `<stage-number>` | Extract specific stage (1-21) | `node index.js 6` |
| `--all` | Extract all 21 stages | `node index.js --all` |
| `--list` | List all available stages | `node index.js --list` |
| `--output, -o` | Output directory | `node index.js 6 -o ./routes/` |
| `--help, -h` | Show help message | `node index.js --help` |

## Output Format

### GPX File Structure
```xml
<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="tdf-route-extractor">
  <metadata>
    <n>BAYEUX > VIRE NORMANDIE</n>
    <desc>Tour de France 2025 - BAYEUX > VIRE NORMANDIE</desc>
    <keywords>Tour de France, BAYEUX > VIRE NORMANDIE, 201.5km</keywords>
  </metadata>
  <trk>
    <n>BAYEUX > VIRE NORMANDIE</n>
    <desc>Distance: 201.5km Type: Accidentée Date: 10/07 Start: 12:45</desc>
    <trkseg>
      <trkpt lat="49.276832" lon="-0.703161"></trkpt>
      <trkpt lat="49.276891" lon="-0.702847"></trkpt>
      <!-- ... more track points ... -->
    </trkseg>
  </trk>
  <!-- Waypoints for climbs -->
  <wpt lat="49.123456" lon="-0.654321">
    <n>Côte du Mont Pinçon</n>
    <desc>Côte du Mont Pinçon - 5,6 km de montée à 3.7% - Catégorie 3</desc>
    <type>climb</type>
  </wpt>
</gpx>
```

### File Naming
Files are automatically named with the format:
```
TDF2025_Stage<NUMBER>_<STAGE_NAME>.gpx
```

Examples:
- `TDF2025_Stage06_BAYEUX_VIRE_NORMANDIE.gpx`
- `TDF2025_Stage04_AMIENS_ROUEN.gpx`

## Using the GPX Files

### Garmin Devices
1. Copy GPX files to `/Garmin/NewFiles/` folder
2. Safely disconnect device
3. Files will appear in "Courses" on your device

### Wahoo Devices
1. Upload to Wahoo app or website
2. Sync to your device

### Strava
1. Upload GPX file to Strava
2. Use "Create Route" feature

### Other Apps
Compatible with: RideWithGPS, Komoot, Zwift, TrainerRoad, and most cycling apps.

## Programmatic Usage

You can also use this as a Node.js module:

```javascript
const TDFRouteExtractor = require('tdf-route-extractor');

const extractor = new TDFRouteExtractor();

// Extract Stage 6
extractor.extractStage(6)
  .then(results => {
    console.log('Stage extracted:', results[0].file);
  })
  .catch(error => {
    console.error('Error:', error.message);
  });

// Extract all stages
extractor.extractAllStages({ output: './routes' })
  .then(results => {
    console.log(`Extracted ${results.length} stages`);
  });
```

## Data Source

This tool extracts data from the **official Tour de France ArcGIS services**:
- Source: `services9.arcgis.com/ZzrLAJKKrt4UDBeuTf/arcgis/rest/services/TDF25FeatureServer`
- Format: GeoJSON with Web Mercator coordinates (EPSG:3857)
- Accuracy: Official race route data used by organizers

## Coordinate Conversion

Routes are automatically converted from Web Mercator (EPSG:3857) to GPS coordinates (WGS84):
- **Input**: Web Mercator projected coordinates
- **Output**: Latitude/Longitude in decimal degrees
- **Precision**: 6 decimal places (~1 meter accuracy)

## Troubleshooting

### No data found for stage
```bash
❌ No route data found for stage 4. Check stage number or try without filters.
```
**Solution**: Verify the stage number (1-21) or try `--list` to see available stages.

### Network errors
```bash
❌ Network error: getaddrinfo ENOTFOUND
```
**Solution**: Check your internet connection and try again.

### Permission errors
```bash
❌ Error: EACCES: permission denied
```
**Solution**: Use `--output` to specify a writable directory or run with appropriate permissions.

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/new-feature`
5. Submit a Pull Request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Disclaimer

This tool extracts publicly available route data from official Tour de France sources. Use responsibly and respect the terms of service of data providers.

---

**🚴‍♂️ Happy cycling!** Use these official routes to experience the Tour de France yourself!
