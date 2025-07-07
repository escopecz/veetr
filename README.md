# Luna Sailing Dashboard

A modern React-based sailing dashboard with Bluetooth Low Energy (BLE) connectivity for real-time sailing data monitoring.

## Features

- 🛰️ **Real-time GPS Speed** - Monitor vessel speed with satellite count
- 💨 **Wind Data** - Apparent and true wind speed/direction with visual compass
- ⚖️ **Heel Angle** - Real-time tilt monitoring with visual gauge
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

The ESP32 sends compact JSON data:
```json
{
  "gSpd": 1.2,    // GPS Speed (knots)
  "gSat": 8,      // GPS Satellites
  "wSpd": 15.3,   // Wind Speed (knots)
  "wDir": 45,     // Wind Direction (degrees)
  "tilt": -5.2    // Heel Angle (degrees, negative = port)
}
```

## Development

Built with:
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Web Bluetooth API** for BLE connectivity
- **CSS Grid** and **Flexbox** for responsive layout

## License

MIT License - see LICENSE file for details.
