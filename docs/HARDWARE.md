# Veetr - Hardware Documentation

Technical documentation for the ESP32-based sailing sensor hardware and dashboard integration.

## Hardware Overview

The Veetr uses an ESP32 microcontroller with multiple sensors to provide comprehensive sailing data via Bluetooth Low Energy (BLE) to a web-based dashboard.

## Hardware Components

### 🔧 Main Controller:
- **ESP32 DevKitC WROOM-32U** - Main microcontroller
  - Dual-core 240MHz processor
  - 320KB RAM, 4MB Flash
  - Built-in WiFi and Bluetooth
  - External antenna connector for enhanced marine range
  - Multiple GPIO pins for sensors

### 📡 Sensors:

#### GPS Module:
- **Interface**: UART (Serial)
- **Function**: Position, speed over ground (SOG), course over ground (COG)
- **Library**: TinyGPS++
- **Update Rate**: 1-10Hz configurable

#### IMU Sensor (BNO080):
- **Interface**: I2C
- **Function**: Heel angle, acceleration, compass heading
- **Library**: SparkFun BNO080 Cortex Based IMU
- **Features**: 9-axis sensor fusion, calibration storage

#### Wind Sensor:
- **Interface**: RS485/Modbus
- **Function**: Wind speed and direction
- **Library**: ModbusMaster
- **Protocol**: Modbus RTU over RS485

## System Architecture

### Data Flow:
1. **Sensors** → **ESP32** (collect and process data)
2. **ESP32** → **BLE** (transmit via Bluetooth Low Energy)
3. **BLE** → **Web Dashboard** (display real-time data)
4. **Web Dashboard** → **BLE** → **ESP32** (configuration commands)

### Power Management:
- **Input**: 5V via USB or external power
- **Consumption**: ~200mA typical, ~400mA peak
- **Low Power Mode**: Available for battery operation
- **Battery Monitoring**: ADC input for battery voltage

## Technical Specifications

### ESP32 Configuration:
- **Platform**: Espressif32 v6.4.0+
- **Framework**: Arduino
- **Build Flags**: Size optimized (-Os), PSRAM enabled
- **Memory Usage**: 11.6% RAM, 52.1% Flash

### BLE Configuration:
- **Service**: Custom sailing data service
- **Characteristics**: Wind, GPS, IMU, battery, configuration
- **Connection**: Up to 4 simultaneous connections
- **Range**: ~10-50 meters (enhanced with external antenna)
- **Marine Optimization**: External antenna provides superior performance in marine environments

### Sensor Interfaces:
- **I2C**: IMU sensor (SDA: GPIO21, SCL: GPIO22)
- **UART**: GPS module (RX: GPIO16, TX: GPIO17)
- **RS485**: Wind sensor (DE/RE: GPIO14, RX: GPIO32, TX: GPIO33)
- **Discovery Button**: GPIO0 (Built-in BOOT button)
- **Status LED**: GPIO2 (Built-in LED)

## Installation and Wiring

### ESP32 Pin Connections:
```
ESP32 DevKitC WROOM-32U Pinout:
┌─────────────────────────────┐
│  3V3  [ ][ ] VIN            │
│  GND  [ ][ ] GND            │
│  TX2  [ ][ ] GPIO13         │
│  RX2  [ ][ ] GPIO12         │
│GPIO22 [ ][ ] GPIO14         │ ← I2C SCL (IMU) / RS485 DE/RE
│GPIO21 [ ][ ] GPIO27         │ ← I2C SDA (IMU)
│GPIO17 [ ][ ] GPIO26         │ ← UART TX (GPS)
│GPIO16 [ ][ ] GPIO25         │ ← UART RX (GPS)
│GPIO4  [ ][ ] GPIO33         │                   / RS485 TX
│GPIO0  [ ][ ] GPIO32         │ ← BOOT Button     / RS485 RX
│GPIO2  [ ][ ] GPIO35         │ ← Status LED
│GPIO15 [ ][ ] GPIO34         │
│GPIO8  [ ][ ] GPIO39         │
│GPIO7  [ ][ ] GPIO36         │
│GPIO6  [ ][ ] EN             │
│GPIO5  [ ][ ] 3V3            │
│  GND  [ ][ ] GND            │
└─────────────────────────────┘
```

### Sensor Wiring:

#### IMU Sensor (BNO080):
```
BNO080  →  ESP32
VCC     →  3.3V
GND     →  GND
SDA     →  GPIO21
SCL     →  GPIO22
```

#### GPS Module:
```
GPS     →  ESP32
VCC     →  3.3V or 5V
GND     →  GND
TX      →  GPIO16 (RX2)
RX      →  GPIO17 (TX2)
```

#### Wind Sensor (RS485):
```
RS485   →  ESP32
A+      →  GPIO33 (via RS485 transceiver)
B-      →  GPIO32 (via RS485 transceiver)
DE/RE   →  GPIO14
VCC     →  12V or 24V (sensor dependent)
GND     →  GND
```

## Development Environment

### Build Configuration:
- **Memory**: 38KB RAM, 683KB Flash used
- **Libraries**: All dependencies automatically managed
- **Build Time**: ~16 seconds for full build
- **Upload**: ~10 seconds via USB

### Development Tools:
- **VS Code** with PlatformIO extension
- **Task Buttons** for one-click build/upload
- **Serial Monitor** for debugging
- **Web Dashboard** for testing BLE communication

## Features Implementation

### Real-time Data Streaming:
- **GPS Data**: Position, SOG, COG, satellite count
- **Wind Data**: Apparent wind speed/direction, true wind calculations
- **Heel Data**: Roll, pitch, yaw from IMU sensor fusion
- **System Data**: Battery voltage, connection status, error states

### Device Configuration:
- **Sensor Calibration**: Wind direction offset, magnetic declination
- **Update Rates**: Configurable sensor polling intervals  
- **Device Settings**: BLE name, connection parameters
- **Factory Reset**: Restore all settings to defaults

### Error Handling:
- **Sensor Monitoring**: Automatic detection of failed sensors
- **Graceful Degradation**: Continue operation with available sensors
- **Status Reporting**: Error codes transmitted via BLE
- **Watchdog Timer**: Automatic recovery from system hangs

## Browser Compatibility

### Supported Browsers:
- ✅ **Chrome 56+** - Full Web Bluetooth support
- ✅ **Edge 79+** - Full Web Bluetooth support
- ✅ **Opera 43+** - Full Web Bluetooth support
- ❌ **Firefox** - No Web Bluetooth support yet
- ❌ **Safari** - No Web Bluetooth support

### Web Bluetooth Requirements:
- **HTTPS or localhost** - Required for Web Bluetooth API
- **User gesture** - Connection must be initiated by user action
- **Modern browser** - Chrome-based browsers recommended

## Performance Specifications

### Data Rates:
- **GPS Updates**: 1Hz (configurable up to 10Hz)
- **IMU Updates**: 10Hz (configurable up to 100Hz)  
- **Wind Updates**: 5Hz (configurable up to 20Hz)
- **BLE Transmission**: 10Hz combined data stream

### Power Consumption:
- **Active Mode**: ~200mA @ 5V
- **Peak Load**: ~400mA during BLE transmission
- **Sleep Mode**: ~50μA (future implementation)
- **Battery Life**: 8-12 hours with 2000mAh power bank

### Environmental Specs:
- **Operating Temperature**: -10°C to +60°C
- **Humidity**: 0-95% non-condensing
- **Water Resistance**: IP65 with proper enclosure
- **Vibration**: Marine environment tested

This hardware platform provides a robust foundation for comprehensive sailing data monitoring with modern web-based visualization.
- ❌ **Firefox** - No Web Bluetooth support
- ❌ **Safari** - No Web Bluetooth support

## ESP32 Compatibility

This dashboard is designed to work with the Veetr ESP32 firmware that transmits data via BLE with these characteristics:

- **Service UUID:** `12345678-1234-1234-1234-123456789abc`
- **Data UUID:** `87654321-4321-4321-4321-cba987654321`
- **Command UUID:** `11111111-2222-3333-4444-555555555555`
- **Device Name:** `Veetr`

## Data Format

The ESP32 sends comprehensive sailing data in JSON format:
```json
{
  "SOG": 0,                    // Speed Over Ground (knots)
  "lat": 0,                    // Latitude (decimal degrees)
  "lon": 0,                    // Longitude (decimal degrees)
  "COG": 0,                    // Course Over Ground (degrees)
  "satellites": 0,             // Number of GPS satellites
  "hdop": 99.9,               // Horizontal Dilution of Precision
  "heel": 174.7181854,        // Heel angle (degrees)
  "heading": 330.7838135,     // Compass heading (degrees)
  "accelX": -8.5,             // X-axis acceleration (m/s²)
  "accelY": 0.3828125,        // Y-axis acceleration (m/s²)
  "accelZ": -4.09765625,      // Z-axis acceleration (m/s²)
  "rssi": -26,                // Bluetooth signal strength (dBm)
  "deviceName": "Veetr"  // Device identification
}
```

### BLE Commands

The Veetr supports bidirectional communication via a dedicated command characteristic. This allows web applications to configure device settings and trigger actions remotely.

#### Command Characteristic

- **Characteristic UUID:** `11111111-2222-3333-4444-555555555555`
- **Properties:** Write
- **Data Format:** JSON string encoded as UTF-8

#### Available Commands

**1. Reset Heel Angle (Calibration)**
```json
{
  "action": "resetHeelAngle"
}
```
Calibrates the heel angle sensor by setting the current tilt as the new zero point. Useful for adjusting when the boat is level.

**2. Set Device Name**
```json
{
  "action": "setDeviceName",
  "deviceName": "Veetr_Port_Side"
}
```
Sets the BLE device name used for Bluetooth discovery. This is essential for distinguishing between multiple ESP32 devices. Limited to 1-20 characters, alphanumeric, underscore, hyphen, and space only.

**3. Regatta Line Markers (Future)**
```json
{
  "action": "regattaSetPort"
}
```
```json
{
  "action": "regattaSetStarboard"
}
```
Placeholder commands for future regatta timing functionality.

#### Multi-Device Management

The device name feature is particularly useful for sailing applications with multiple sensors:

- **Fleet Management:** "Veetr_01", "Veetr_02", "Veetr_03"
- **Multi-Hull Boats:** "Veetr_Port", "Veetr_Starboard"
- **Multiple Locations:** "Luna_Mast", "Luna_Cockpit"
- **Development/Testing:** "Luna_Dev", "Luna_Prod"

When you change the device name, the ESP32 immediately restarts its BLE advertising with the new name, making it instantly discoverable under the new identifier.

## BLE Discovery Security Mode

For enhanced security, especially when the device is deployed unattended on a boat, the ESP32 implements a secure discovery mode:

### How It Works:
- **Default State**: BLE advertising is disabled after 5 minutes of operation
- **Discovery Activation**: Press and hold the **BOOT button** (GPIO0) for 1+ seconds
- **Visual Feedback**: The built-in LED (GPIO2) turns on when discovery mode is active
- **Time Limit**: Discovery mode automatically expires after 5 minutes
- **Manual Deactivation**: Press the BOOT button again to turn off discovery mode early

### Usage Instructions:
1. **To Connect from Web Dashboard:**
   - Press and hold the BOOT button on the ESP32 for 1+ seconds
   - Verify the built-in LED turns on (discovery mode active)
   - Open the web dashboard and click "Connect"
   - The ESP32 will appear in the device list for up to 5 minutes
   - Connect to the device normally

2. **Security Benefits:**
   - Prevents unauthorized BLE scanning when device is unattended
   - Ideal for boats moored at marinas or anchored overnight
   - Only advertises BLE when intentionally activated
   - LED provides clear visual confirmation of discovery state

3. **Troubleshooting:**
   - If device doesn't appear in BLE scan: Press the BOOT button to activate discovery
   - If LED doesn't turn on: Check that firmware includes discovery mode feature
   - If discovery expires: Simply press BOOT button again to restart 5-minute window

## Development

Built with:
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Web Bluetooth API** for BLE connectivity
- **CSS Grid** and **Flexbox** for responsive layout

## License

MIT License - see LICENSE file for details.
