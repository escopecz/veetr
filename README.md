# Luna Sailing Dashboard

A modern React-based sailing dashboard with Bluetooth Low Energy (BLE) connectivity for real-time sailing data monitoring.

## Features

- 🛰️ **Real-time GPS Data** - Monitor vessel speed (SOG), course (COG), position, and satellite count
- 💨 **Wind Data** - Apparent and true wind speed/direction with visual compass
- ⚖️ **Heel Angle** - Precise heel monitoring with visual gauge
- 🧭 **Compass Heading** - Real-time boat heading for navigation
- 📈 **Acceleration Monitoring** - 3-axis acceleration data for boat movement analysis
- ⚙️ **Device Configuration** - Calibrate sensors and configure device settings via BLE
- 🏁 **Regatta Features** - Future support for regatta timing and line markers
- 📱 **Progressive Web App** - Install on mobile devices for offline use
- 🔄 **Live BLE Connection** - Connect directly to ESP32 Luna Sailing device
- 📊 **Modern UI** - Responsive dashboard with glass-morphism design

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **Build for production:**
   ```bash
   npm run build
   ```

4. **Deploy to GitHub Pages:**
   ```bash
   npm run deploy
   ```

## Usage

1. Open the dashboard in a modern web browser (Chrome, Edge, or Opera recommended for Web Bluetooth support)
2. Click "Connect to Luna" to pair with your ESP32 device
3. Monitor real-time sailing data on the dashboard

## Browser Compatibility

- ✅ **Chrome** - Full BLE support
- ✅ **Edge** - Full BLE support  
- ✅ **Opera** - Full BLE support
- ❌ **Firefox** - No Web Bluetooth support
- ❌ **Safari** - No Web Bluetooth support

## ESP32 Compatibility

This dashboard is designed to work with the Luna Sailing ESP32 firmware that transmits data via BLE with these characteristics:

- **Service UUID:** `12345678-1234-1234-1234-123456789abc`
- **Data UUID:** `87654321-4321-4321-4321-cba987654321`
- **Command UUID:** `11111111-2222-3333-4444-555555555555`
- **Device Name:** `Luna_Sailing`

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
  "deviceName": "Luna_Sailing"  // Device identification
}
```

### BLE Commands

The Luna Sailing Dashboard supports bidirectional communication via a dedicated command characteristic. This allows web applications to configure device settings and trigger actions remotely.

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
  "deviceName": "Luna_Port_Side"
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

- **Fleet Management:** "Luna_01", "Luna_02", "Luna_03"
- **Multi-Hull Boats:** "Luna_Port", "Luna_Starboard"
- **Multiple Locations:** "Luna_Mast", "Luna_Cockpit"
- **Development/Testing:** "Luna_Dev", "Luna_Prod"

When you change the device name, the ESP32 immediately restarts its BLE advertising with the new name, making it instantly discoverable under the new identifier.

## Development

Built with:
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Web Bluetooth API** for BLE connectivity
- **CSS Grid** and **Flexbox** for responsive layout

## License

MIT License - see LICENSE file for details.
