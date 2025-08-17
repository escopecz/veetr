# Luna Sailing Dashboard - Setup Guide

Complete setup instructions for the Luna Sailing Dashboard project.

## Prerequisites

### Software Requirements:
- **VS Code** (recommended IDE)
- **Node.js** (v16 or higher)
- **Python** (v3.7 or higher) - for PlatformIO
- **Git** - for version control

### Hardware Requirements:
- **ESP32 DevKit** (DOIT ESP32 DevKit V1 recommended)
- **USB Cable** for programming
- **Sailing sensors** (optional for testing)

## Initial Setup

### 1. Clone Repository
```bash
git clone https://github.com/escopecz/sailing-dashboard.git
cd sailing-dashboard
```

### 2. Open in VS Code
```bash
code sailing-dashboard.code-workspace
```
This opens the multi-folder workspace with proper configuration.

### 3. Install VS Code Extensions
When you open the workspace, VS Code will recommend installing:
- **PlatformIO IDE** - for ESP32 firmware development
- **Task Buttons** - for one-click task execution
- **TypeScript and JavaScript Language Features**
- **Prettier** - code formatting
- **Tailwind CSS IntelliSense**

Click **"Install All"** when prompted.

### 4. Install Dependencies
Click the **🌐 Web Dev** button in the status bar, or run:
```bash
cd web
npm install
```

## Development Setup

### Web Dashboard Development

1. **Start Development Server**:
   - Click **🌐 Web Dev** button in VS Code status bar
   - Or manually: `cd web && npm run dev`

2. **Open Dashboard**: 
   - Navigate to http://localhost:5174
   - Dashboard loads in development mode with hot reload

3. **Build for Production**:
   - Click **🔧 Web Build** button  
   - Or manually: `cd web && npm run build`

### ESP32 Firmware Development

1. **Build Firmware**:
   - Click **⚡ FW Build** button in VS Code status bar
   - Or manually: `pio run`

2. **Upload to ESP32**:
   - Connect ESP32 via USB
   - Click **📤 FW Upload** button
   - Or manually: `pio run --target upload`

3. **Monitor Serial Output**:
   - Click **📺 Monitor** button
   - Or manually: `pio device monitor`

## Task Buttons Setup

The project includes pre-configured task buttons for easy development:

### If Task Buttons Don't Appear:
1. Install **Task Buttons** extension from VS Code marketplace
2. Reload VS Code window: `Cmd+Shift+P` → "Developer: Reload Window"
3. Look for emoji buttons in the status bar: 🌐 🔧 ⚡ 📤 📺

### Alternative Task Access:
- **Command Palette**: `Cmd+Shift+P` → "Tasks: Run Task"
- **Terminal Menu**: Terminal → Run Task...
- **Keyboard Shortcut**: `Cmd+Shift+B` (default build)

## Hardware Setup

### ESP32 Connection:
1. Connect ESP32 to computer via USB
2. Check device appears in serial ports
3. Upload firmware using **📤 FW Upload** button

### Sensor Connections:
- **GPS Module**: UART connection
- **IMU Sensor**: I2C connection  
- **Wind Sensor**: RS485/Modbus connection
- **Power**: 5V or 3.3V depending on sensors

See [docs/README.md](./docs/README.md) for detailed hardware wiring.

## Testing the System

### 1. Upload Firmware
```bash
# Using task button: Click "📤 FW Upload"
# Or manually:
pio run --target upload
```

### 2. Start Web Dashboard
```bash
# Using task button: Click "🌐 Web Dev"  
# Or manually:
cd web && npm run dev
```

### 3. Connect via Bluetooth
1. Open dashboard at http://localhost:5174
2. Click **"Connect to Luna"** button
3. Select ESP32 device from Bluetooth pairing dialog
4. Monitor real-time sailing data

### 4. Monitor Debug Output
```bash
# Using task button: Click "📺 Monitor"
# Or manually:
pio device monitor
```

## Troubleshooting

### Task Buttons Not Visible:
- Install Task Buttons extension
- Reload VS Code window
- Check `.vscode/settings.json` for task button configuration

### ESP32 Upload Issues:
- Check USB cable connection
- Verify correct serial port
- Press reset button during upload if needed

### Web Bluetooth Not Working:
- Use Chrome, Edge, or Opera browser
- Enable Web Bluetooth in browser flags if needed
- Ensure HTTPS or localhost origin

### Build Errors:
- Check Node.js version (v16+)
- Clear node_modules and reinstall: `rm -rf web/node_modules && cd web && npm install`
- For firmware: clean build with `pio run --target clean`

## Next Steps

1. **Customize Dashboard**: Modify React components in `web/src/`
2. **Add Sensors**: Update firmware in `firmware/src/main.cpp`
3. **Configure BLE**: Adjust BLE characteristics in firmware
4. **Deploy**: Build production version and deploy to web server

For detailed development information, see the main [README.md](./README.md).