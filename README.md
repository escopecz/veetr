# Veetr

Veetr provides open source software and hardware for tracking wind speed, direction, speed over ground, GPS tracking, heading, heel and other data in real time during a sail. Great fit for day-sailers or weekend-sailers.

## Features
- Real-time measurements of:
    - **SOG** (Speed Over Ground) using GPS
    - **AWS** (Apparent Wind Speed) using the wind sensor
    - **AWA** (Apparent Wind Angle) using the wind sensor
    - **TWS** (True Wind Speed) calculated from SOG, AWS, and AWA
    - **TWA** (True Wind Angle) calculated from SOG and AWA
    - **Heel** (Heeling angle) using the 9-axis sensor
    - **HDG** (Heading angle to magnetic north) using the 9-axis sensor
- **OTA** (Over The Air) updates of the firmware. The app will allow you to update the firmware of the device when a new version is available
- The [app](https://escopecz.github.io/veetr) is a PWA (Progressive Web App). It means you can use it in your browser, you can install it on your desktop as a real app. The advantage is that it is always up to date after refresh. No need for app stores and their limitations
- The [app](https://escopecz.github.io/veetr) is also **responsive**. It looks great on any screen size and orientation
- There is also **light and dark mode** for sunny days and night passages
- Up to **4 devices** can connect at the same time
- Regatta starting procedure allows you to pin 2 places and the app will tell you how far you are from the line between the 2 points. It allows you to be as close to the starting line as possible without worrying about being over.

## Why Veetr?
- **Open source software** - free firmware and app to use, install, host yourself and/or modify
- **Open hardware** - get the necessary boards from Aliexpress yourself if you want to avoid additional fees
- **3D printed case** - print it yourself or with your nerdy friend
- **Cheap** compared to other projects - you can get the electronic components for $250 (price from 2025-09-02)
- Your boat doesn't need any electronics inside. You can power it with any powerbank with USB-C cable.
- **Low power consumption**: A 10Ah powerbank can power the device with 1-second refresh rate for around 24 hours
- **No moving parts**: The wind meter is ultrasonic. Very precise and works nicely even in small wind speeds
- **Lightweight**: The wind sensor dimensions are 66x64 mm and weighs 89 grams.
- **Quality sensors**: This project is cheap but still uses high-quality sensors. It could have been even cheaper but it would compromise on quality.
- **Security**: The Bluetooth device is discoverable only when you press a physical button for 5 minutes. No one else will be able to connect otherwise.

## Technology Stack

### Web Dashboard:
- **React 18** + TypeScript + Vite
- **Progressive Web App** for mobile installation
- **Web Bluetooth API** for BLE communication

### ESP32 Firmware:
- **Arduino Framework** via PlatformIO
- **NimBLE** for Bluetooth Low Energy
- **GPS, IMU, Wind sensors** via UART/I2C/RS485

## Documentation

For detailed information, see the [docs/](./docs/) directory:

- **[Setup Guide](./docs/SETUP.md)** - Step-by-step user setup for sailors
- **[Development Guide](./docs/DEVELOPMENT.md)** - Developer workflow and contribution guide
- **[Hardware Guide](./docs/HARDWARE.md)** - ESP32 wiring and sensor specifications
- **[Compliance & Certifications](./docs/COMPLIANCE.md)** - FCC, CE, IC regulatory compliance
- **[Firmware Update Guide](./docs/FIRMWARE_UPDATE.md)** - How to update ESP32 firmware
- **[PlatformIO Guide](./docs/PLATFORMIO.md)** - Firmware development details
- **[Storage Architecture](./docs/STORAGE.md)** - Data storage and persistence
- **[Version Management](./docs/VERSION_MANAGEMENT.md)** - Release and versioning workflow

## License

MIT License - see [LICENSE](./LICENSE) for details.
