# Data Storage - Veetr

Documentation for data storage, persistence, and logging in the Veetr system.

## Storage Architecture

### 🌐 Web Dashboard Storage

The web dashboard uses browser-based storage for user preferences and session data:

#### Local Storage:
- **Connection settings** - Previously paired BLE devices
- **User preferences** - Dashboard layout, units, themes
- **Calibration data** - Wind direction offset, magnetic declination
- **Session state** - Last known device connection

#### Session Storage:
- **Real-time data buffer** - Recent sailing data for smooth animations
- **Chart data** - Historical data points for graphs and trends
- **Connection status** - Current BLE connection state

#### Implementation:
```typescript
// Location: web/src/utils/storage.ts
// Location: web/src/hooks/useSailingStorage.ts
```

### ⚡ ESP32 Firmware Storage

The ESP32 uses EEPROM/NVS (Non-Volatile Storage) for persistent configuration:

#### EEPROM Storage:
- **Device configuration** - Sensor calibration values
- **Network settings** - WiFi credentials (if used)
- **BLE settings** - Device name, pairing information
- **Sensor offsets** - Wind direction calibration, compass deviation

#### Flash Storage:
- **Firmware updates** - OTA update staging area
- **Log buffer** - Error logs and debug information
- **Historical data** - Trip logs, max values, statistics

#### Implementation:
```cpp
// Location: firmware/src/main.cpp
// Uses: Preferences library for NVS access
```

## Data Flow

### Real-time Data:
1. **ESP32 sensors** → **BLE transmission** → **Web dashboard**
2. **Web storage** for immediate display and short-term buffering
3. **No persistent logging** of real-time data (by design)

### Configuration Data:
1. **Web interface** → **BLE commands** → **ESP32 storage**
2. **ESP32 EEPROM** preserves settings across power cycles
3. **Web localStorage** caches settings for faster UI response

## Storage Limits

### Web Dashboard:
- **LocalStorage**: ~5-10MB per domain (browser dependent)
- **SessionStorage**: ~5-10MB per tab session
- **IndexedDB**: Available for future expansion (large data sets)

### ESP32 Firmware:
- **NVS Partition**: 16KB (configurable in platformio.ini)
- **SPIFFS**: 1.5MB available for file storage
- **EEPROM**: 512 bytes (compatibility mode)

## Data Privacy

### Local-Only Storage:
- **No cloud storage** - all data remains on device
- **No telemetry** - no data transmitted to external servers
- **BLE only** - direct device-to-device communication

### Data Retention:
- **Real-time data**: Cleared on page refresh
- **Settings**: Persist until manually cleared
- **Logs**: Rotate automatically when storage fills

## Configuration Management

### Calibration Data:
```typescript
interface CalibrationSettings {
  windDirectionOffset: number;    // Degrees to add to wind direction
  magneticDeclination: number;    // Local magnetic declination
  heelCalibration: number;        // Heel angle zero point
  compassDeviation: number[];     // Compass deviation table
}
```

### Device Settings:
```cpp
struct DeviceConfig {
  char deviceName[32];           // BLE device name
  uint16_t updateRate;           // Data update rate (ms)
  bool gpsEnabled;               // GPS module enable/disable
  bool imuEnabled;               // IMU module enable/disable
  float sensorOffsets[8];        // Various sensor calibration offsets
};
```

## Backup and Restore

### Web Dashboard:
- **Export settings**: Download JSON file with all preferences
- **Import settings**: Upload JSON file to restore configuration
- **Reset to defaults**: Clear all localStorage data

### ESP32 Firmware:
- **Factory reset**: Clear all NVS storage via BLE command
- **Backup via BLE**: Read all settings through web interface
- **Restore via BLE**: Write settings from web interface

## Future Enhancements

### Planned Storage Features:
- **Trip logging**: Store sailing sessions with GPS tracks
- **Performance analytics**: Historical speed/wind data analysis
- **Cloud sync**: Optional backup to user's cloud storage
- **Export formats**: GPX, CSV, JSON data export

### Technical Improvements:
- **Data compression**: Efficient storage of time-series data
- **Automatic cleanup**: Smart storage management and rotation
- **Encryption**: Secure storage of sensitive configuration data
- **Versioning**: Configuration migration for firmware updates

## Implementation Files

### Web Dashboard:
- `web/src/utils/storage.ts` - Storage utilities and helpers
- `web/src/hooks/useSailingStorage.ts` - React hook for sailing data storage
- `web/src/context/BLEContext.tsx` - BLE connection and data management

### ESP32 Firmware:
- `firmware/src/main.cpp` - Main firmware with storage functions
- Storage libraries: `Preferences`, `SPIFFS`, `ArduinoJson`

This storage architecture ensures reliable data persistence while maintaining user privacy and device performance.