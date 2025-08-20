# Veetr

Veetr provides open source software and hardware for tracking wind speed, direction, speed over ground, GPS tracking, heading, heel and other data in real time during a sail. Great fit for daysailers or weekendsailers.

## Quick Start ⚡

### 1. Setup Development Environment
```bash
git clone https://github.com/escopecz/veetr.git
cd veetr
code veetr.code-workspace
```

### 2. Install Task Buttons Extension
Install the **Task Buttons** extension in VS Code for one-click development.

### 3. Use Task Buttons
Look for these buttons in your VS Code status bar:
- **🌐 Web Dev** - Start React development server
- **⚡ FW Build** - Build ESP32 firmware  
- **📤 FW Upload** - Upload firmware to ESP32
- **📺 Monitor** - Open serial monitor

### 4. Alternative Commands
```bash
# Web development
cd web && npm install && npm run dev

# Firmware development  
pio run                    # Build
pio run --target upload    # Upload to ESP32
pio device monitor         # Serial monitor
```

## Project Structure

```
veetr/
├── web/                     # React/TypeScript web dashboard
├── firmware/                # ESP32 firmware source code
├── docs/                    # Detailed documentation
├── platformio.ini           # PlatformIO configuration
├── package.json             # Root workspace configuration
└── .vscode/                 # VS Code tasks and settings
```

## Features

- 🛰️ **Real-time GPS Data** - Speed, course, position, satellite count
- 💨 **Wind Monitoring** - Apparent and true wind speed/direction
- ⚖️ **Heel Angle** - Precise boat tilt monitoring
- 🧭 **Compass Heading** - Real-time boat heading
- 📱 **Web Dashboard** - Modern responsive interface
- 🔗 **BLE Connectivity** - Direct ESP32 to browser communication
- ⚙️ **Task Buttons** - One-click build and deployment

## Technology Stack

### Web Dashboard:
- **React 18** + TypeScript + Vite
- **Tailwind CSS** for styling
- **Web Bluetooth API** for BLE communication

### ESP32 Firmware:
- **Arduino Framework** via PlatformIO
- **NimBLE** for Bluetooth Low Energy
- **GPS, IMU, Wind sensors** via UART/I2C/RS485

## Documentation

For detailed information, see the [docs/](./docs/) directory:

- **[Setup Guide](./docs/SETUP.md)** - Complete installation and configuration
- **[Firmware Update Guide](./docs/FIRMWARE_UPDATE.md)** - How to update ESP32 firmware
- **[Hardware Guide](./docs/HARDWARE.md)** - ESP32 wiring and sensor setup
- **[PlatformIO Guide](./docs/PLATFORMIO.md)** - Firmware development details
- **[Storage Architecture](./docs/STORAGE.md)** - Data storage and persistence
- **[Version Management](./docs/VERSION_MANAGEMENT.md)** - Release and versioning workflow

## Development Workflow

1. **🌐 Start Web Dev Server** - Click button or `cd web && npm run dev`
2. **⚡ Build Firmware** - Click button or `pio run`
3. **📤 Upload to ESP32** - Click button or `pio run --target upload` 
4. **📺 Monitor Serial** - Click button or `pio device monitor`
5. **🔗 Test BLE Connection** - Open dashboard and connect to ESP32

## Browser Support

- ✅ **Chrome, Edge, Opera** - Full Web Bluetooth support
- ❌ **Firefox, Safari** - No Web Bluetooth support yet

## License

MIT License - see [LICENSE](./LICENSE) for details.
