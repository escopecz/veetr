# Veetr - Development Guide

Development workflow and setup instructions for contributors and developers working on the Veetr project.

## Related Documentation

This development guide is the primary resource for contributors. For specific technical details, also see:

- **[Setup Guide](./SETUP.md)** - User-focused hardware and software setup
- **[Hardware Guide](./HARDWARE.md)** - ESP32 wiring, sensor specifications, and pin assignments
- **[PlatformIO Guide](./PLATFORMIO.md)** - PlatformIO configuration and troubleshooting
- **[Firmware Documentation](../firmware/readme.md)** - ESP32 implementation details and BLE protocol
- **[Version Management](./VERSION_MANAGEMENT.md)** - Release process and automated workflows

## Quick Development Setup ⚡

### 1. Setup Development Environment
```bash
git clone https://github.com/escopecz/veetr.git
cd veetr
code veetr.code-workspace
```

### 2. Use VS Code Tasks
The workspace is configured with tasks for development. Access via:
- **Ctrl+Shift+P** → "Tasks: Run Task" → Select task
- **Terminal** → "Run Task..." menu

Available tasks:
- **Web: Dev Server** - Start React development server
- **Firmware: Build** - Build ESP32 firmware  
- **Firmware: Upload** - Upload firmware to ESP32
- **Firmware: Monitor** - Open serial monitor

### 3. Manual Commands
```bash
# Web development
cd web && npm install && npm run dev

# Firmware development  
pio run                    # Build
pio run --target upload    # Upload to ESP32
pio device monitor         # Serial monitor
```

## Development Workflow

### Daily Development Process:
1. **🌐 Start Web Dev Server** - Run "Web: Dev Server" task or `cd web && npm run dev`
2. **⚡ Build Firmware** - Run "Firmware: Build" task or `pio run`
3. **📤 Upload to ESP32** - Run "Firmware: Upload" task or `pio run --target upload` 
4. **📺 Monitor Serial** - Run "Firmware: Monitor" task or `pio device monitor`
5. **🔘 Activate Discovery** - Press and hold BOOT button (GPIO0) for 1+ seconds
6. **🔗 Test BLE Connection** - Open dashboard and connect to ESP32

### Code Organization

#### Web Application (`/web`)
- **React 18** + TypeScript + Vite
- **Tailwind CSS** for styling
- **Web Bluetooth API** for BLE communication
- **PWA** capabilities for mobile installation

#### ESP32 Firmware (`/firmware`)
- **Arduino Framework** via PlatformIO
- **NimBLE** for Bluetooth Low Energy
- **Sensor Integration**: GPS, IMU, Wind sensors
- **Communication**: UART/I2C/RS485 protocols

### Development Tasks

#### Web Development
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linting
npm run lint

# Format code
npm run format
```

#### Firmware Development
```bash
# Build firmware
pio run

# Upload to ESP32
pio run --target upload

# Monitor serial output
pio device monitor

# Clean build files
pio run --target clean

# Upload filesystem (if needed)
pio run --target uploadfs
```

### Testing Workflow

#### Hardware Testing:
1. Build and upload firmware to ESP32
2. Activate BLE discovery mode (BOOT button)
3. Connect via web dashboard
4. Verify sensor data streams
5. Test configuration commands

#### Web Testing:
1. Start development server
2. Test in Chrome/Edge (Web Bluetooth supported)
3. Verify PWA installation
4. Test responsive design on mobile devices
5. Validate BLE connectivity

### Code Quality

#### Pre-commit Checklist:
- [ ] Code passes TypeScript compilation
- [ ] Firmware builds without errors
- [ ] No console errors in web browser
- [ ] BLE communication works
- [ ] Responsive design validated
- [ ] Documentation updated if needed

#### Standards:
- **TypeScript**: Strict mode enabled
- **ESLint**: Configured for React/TypeScript
- **Prettier**: Code formatting
- **Git**: Conventional commit messages

### Debugging Tips

#### Web Dashboard:
- Use Chrome DevTools for Web Bluetooth debugging
- Check Network tab for PWA service worker issues
- Console shows BLE connection status and errors

#### ESP32 Firmware:
- Serial monitor shows sensor readings and BLE status
- Built-in LED indicates discovery mode status
- Watchdog timer prevents system hangs

#### Common Issues:
- **BLE not found**: Activate discovery mode on ESP32
- **Build errors**: Check PlatformIO installation
- **Web not connecting**: Ensure HTTPS or localhost
- **Sensor errors**: Check wiring and power supply

### Contributing

#### Pull Request Process:
1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Make changes and test thoroughly
4. Commit changes (`git commit -m 'Add amazing feature'`)
5. Push to branch (`git push origin feature/amazing-feature`)
6. Open Pull Request

#### Code Review:
- All code changes require review
- Tests must pass
- Documentation must be updated
- Hardware changes need validation

### Development Environment

#### Recommended VS Code Extensions:
- **PlatformIO IDE** - ESP32 development
- **TypeScript and JavaScript Language Features**
- **Tailwind CSS IntelliSense**
- **Prettier** - Code formatting
- **GitLens** - Git integration
- **Auto Rename Tag** - HTML/JSX editing
- **Bracket Pair Colorizer** - Code readability

#### System Requirements:
- **Node.js** v16+ (for web development)
- **Python** 3.7+ (for PlatformIO)
- **Git** (version control)
- **USB drivers** for ESP32 (platform specific)

This development guide provides everything needed for productive Veetr development!
