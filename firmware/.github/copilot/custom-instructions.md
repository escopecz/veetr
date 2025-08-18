# Repository custom instructions for GitHub Copilot

## Important Note
**ALWAYS READ THE README.MD FILE FIRST** - It contains comprehensive setup instructions, documentation, and usage guidelines for this project. Use it as your primary reference when working on this project.

## About this project
This is a PlatformIO project named "Veetr" focused on embedded systems development for marine applications.

The project provides sailors on small racing vessels with real-time information about vessel performance including:
- Speed Over Ground (SOG) via GPS with intelligent noise filtering
- Apparent Wind Speed (AWS) and Direction (AWD) via ultrasonic sensor
- Vessel heel/tilt angle via accelerometer
- GPS position and satellite status
- BLE connection quality (RSSI)

**Architecture:** ESP32 with BLE connectivity using NimBLE-Arduino library, serving standardized JSON data to external web applications.

**Key Features:**
- Bluetooth Low Energy (BLE) server with multi-client support
- Robust sensor error handling - system continues operation even if sensors fail
- Standardized marine JSON API with proper terminology (SOG, AWS, AWD, etc.)
- 1Hz data transmission with reliable timing
- Power efficient design for extended battery operation
- Progressive Web App (PWA) dashboard hosted externally over HTTPS

## Hardware Dependencies

### Microcontroller/Board
- Board: ESP 32 DEVKIT V1 DOIT
- Processor: Tensilica Xtensa Dual-Core 32-bit LX6 microprocessor
- Clock Speed: Up to 240MHz
- Operating Voltage: 3.3V
- Flash Memory: 4MB
- SRAM: 520 KB
- Connectivity: 
  - Wi-Fi: 802.11 b/g/n (2.4 GHz)
  - Bluetooth: v4.2 (supports BLE and Classic Bluetooth)
- GPIO: 36 pins (34 can be used as GPIO)
- ADC: 12-bit, 18 channels
- DAC: 8-bit, 2 channels
- Communication Interfaces:
  - SPI: 4 interfaces
  - I2C: 2 interfaces
  - I2S: 2 interfaces
  - UART: 3 interfaces
  - CAN: 1 interface
- PWM: 16 channels
- Capacitive Touch Sensors: 10 GPIOs

### PINOUT

```
                    ESP32 DEVKIT V1 DOIT
                   +--------------------+
              3V3 -|3V3              GND|- GND
              EN  -|EN               IO23|- IO23/VSPI_MOSI
              VP  -|IO36/VP         IO22|- IO22/I2C_SCL
              VN  -|IO39/VN         IO1 |- IO1/TX0
              IO34-|IO34            IO3 |- IO3/RX0
              IO35-|IO35            IO21|- IO21/I2C_SDA
              IO32-|IO32            GND |- GND
              IO33-|IO33            IO19|- IO19/VSPI_MISO
              IO25-|IO25            IO18|- IO18/VSPI_CLK
              IO26-|IO26            IO5 |- IO5/VSPI_CS
              IO27-|IO27            IO17|- IO17
              IO14-|IO14/HSPI_CLK   IO16|- IO16
              IO12-|IO12/HSPI_MISO  IO4 |- IO4
              GND -|GND             IO0 |- IO0
              IO13-|IO13/HSPI_MOSI  IO2 |- IO2
              SD2 -|SD2             IO15|- IO15/HSPI_CS
              SD3 -|SD3             SD1 |- SD1
              CMD -|CMD             SD0 |- SD0
              5V  -|5V              CLK |- CLK
                   +--------------------+
                         USB PORT
```

| Pin Category | Pin Numbers | Description |
|--------------|-------------|-------------|
| Power Pins | 3V3, 5V, GND | 3.3V and 5V power outputs, Ground pins |
| ADC Pins | IO32-IO39, IO0-IO5 | Analog-to-Digital Converter |
| DAC Pins | IO25, IO26 | Digital-to-Analog Converter |
| Touch Pins | IO0, IO2, IO4, IO12-IO15, IO27, IO32, IO33 | Capacitive touch sensors |
| SPI Pins | VSPI: IO5(CS), IO18(CLK), IO19(MISO), IO23(MOSI)<br>HSPI: IO15(CS), IO14(CLK), IO12(MISO), IO13(MOSI) | Serial Peripheral Interface |
| I2C Pins | IO21(SDA), IO22(SCL) | Inter-Integrated Circuit |
| UART Pins | UART0: IO1(TX), IO3(RX)<br>UART1: IO9(TX), IO10(RX)<br>UART2: IO16(TX), IO17(RX) | Serial communication |
| PWM Pins | All GPIOs | Pulse Width Modulation (software configurable) |

### Sensors
- **NEO-7M GPS Module**
  - https://www.aliexpress.com/item/1005006495478139.html?spm=a2g0o.order_list.order_list_main.20.21ef18029RavmO
  - Type: u-blox NEO-7M GPS/GNSS
  - Antenna: External with SMA connector
  - Tracking Sensitivity: -162 dBm
  - Position Accuracy: 2.5m CEP (Circular Error Probable)
  - Velocity Accuracy: 0.1m/s
  - Update Rate: Up to 10Hz
  - Power Consumption: ~40mA at 3.3V
  - Communication: UART (TX/RX)
  - Operating Voltage: 3.3V-5V

- **External GPS Antenna**
  - https://www.aliexpress.com/item/1005005449884811.html?spm=a2g0o.order_list.order_list_main.15.21ef18029RavmO
  - Type: Active antenna with 28dBi gain
  - Supported Systems: GPS + GLONASS + BeiDou
  - Connector: SMA/FAKRA with magnetic mount
  - Amplifier: Built-in LNA (Low Noise Amplifier)
  - Waterproof: Yes, for outdoor use
  - Mounting: Magnetic base for external attachment

- **GY-BNO080 9-Axis IMU Sensor**
  - Chip: BNO080 by Hillcrest Labs (now CEVA)
  - Features: 9-axis IMU with sensor fusion
  - Sensors: 3-axis accelerometer, 3-axis gyroscope, 3-axis magnetometer
  - Measurement Range: ±16g (accelerometer), ±2000°/s (gyroscope)
  - Resolution: 16-bit ADC
  - Communication Interface: I2C/SPI (using I2C in this project)
  - Operating Voltage: 3.3V-5V DC
  - Functions: Quaternion output, Euler angles, linear acceleration, gravity vector
  - Applications: Precise orientation detection, motion tracking, heading determination
  - Advantages: Built-in sensor fusion, drift compensation, high accuracy
  - Size: Compact breakout board form factor

- **3.3V UART to RS485 SP3485 Transceiver Module**
  - https://www.aliexpress.com/item/32688467460.html?spm=a2g0o.order_list.order_list_main.5.21ef18029RavmO
  - Chip: SP3485 RS-485 transceiver
  - Communication Type: Half-duplex (one-way at a time)
  - Maximum Transmission Speed: Up to 10Mbps
  - Operating Voltage: 3.3V DC
  - Logic Compatibility: Interoperable with 5.0V logic
  - Connectors: RJ-45, 3.5mm screw terminal, and 0.1" pitch header
  - Control: Driver/Receiver Enable connected to RTS line
  - Common-Mode Input Voltage Range: -7V to +12V
  - Capacity: Allows up to 32 transceivers on the serial bus
  - Protection: Driver Output Short-Circuit Protection
  - Dimensions: 0.9x1.0 inches

- **Ultrasonic Wind Speed and Direction Sensor**
  - https://www.aliexpress.com/item/1005007798498855.html
  - Type: Integrated ultrasonic anemometer
  - Measurement Range: 0-60 m/s (wind speed)
  - Wind Speed Accuracy: ±0.3 m/s or ±3% (whichever is greater)
  - Direction Range: 0-360° (full compass range)
  - Direction Accuracy: ±2°
  - Resolution: 0.1 m/s (wind speed), 1° (direction)
  - Update Rate: 1 Hz (configurable)
  - Communication: RS485 (Modbus RTU protocol)
  - Operating Voltage: 9-24V DC (typical 12V for marine applications)
  - Power Consumption: <50mA at 12V DC
  - Operating Temperature: -40°C to +60°C
  - IP Rating: IP65 or higher (weather-resistant)
  - Modbus Parameters:
    - Default Address: 1
    - Baud Rate: 9600 bps (configurable)
    - Data Format: 8 data bits, 1 stop bit, no parity
  - Register Addresses:
    - 0x0000: Wind Speed (16-bit integer, multiply by 0.1 for m/s)
    - 0x0001: Wind Direction (16-bit integer, in degrees)
    - 0x0002: Status/Error Flags
  - Advantages: No moving parts, high precision, integrated speed and direction

### Pin Assignments

| Component | ESP32 Pin | Function |
| --------- | --------- | -------- |
| GPS Module (NEO-7M) | IO16 (RX2) | Serial Data Input to ESP32 |
| GPS Module (NEO-7M) | IO17 (TX2) | Serial Data Output from ESP32 |
| GPS Module (NEO-7M) | 3.3V | Power Supply |
| GPS Module (NEO-7M) | GND | Ground |
| BNO080 IMU Sensor | IO21 (SDA) | I2C Data |
| BNO080 IMU Sensor | IO22 (SCL) | I2C Clock |
| BNO080 IMU Sensor | 3.3V | Power Supply |
| BNO080 IMU Sensor | GND | Ground |
| RS485 Transceiver | IO25 (TX) | Serial Data Output from ESP32 |
| RS485 Transceiver | IO26 (RX) | Serial Data Input to ESP32 |
| RS485 Transceiver | 5V | Power Supply |
| RS485 Transceiver | GND | Ground |
| Wind Sensor | A+ (RS485) | Connected to RS485 Transceiver A+ |
| Wind Sensor | B- (RS485) | Connected to RS485 Transceiver B- |
| Wind Sensor | 12V | External Power Supply |
| Wind Sensor | GND | Ground |

## Software Architecture Reference

The software architecture has been migrated from WiFi Access Point to BLE connectivity:

### Current Architecture (BLE-based)
- **ESP32:** BLE server using NimBLE-Arduino library
- **Connectivity:** Bluetooth Low Energy with multi-client support
- **Data Format:** Standardized JSON with marine terminology
- **Web App:** Externally hosted (GitHub Pages/Netlify) over HTTPS
- **Client Connection:** Web Bluetooth API for direct ESP32 connection

### Communication Flow
1. **GPS Module** → UART (GPIO 16/17) → ESP32 → JSON over BLE
2. **BNO080 IMU Sensor** → I2C (GPIO 21/22) → ESP32 → JSON over BLE
3. **Wind Sensor** → RS485 → RS485 Transceiver → UART (GPIO 25/26) → ESP32 → JSON over BLE

### BLE Service Configuration
- **Service UUID:** 12345678-1234-1234-1234-123456789abc
- **Characteristic UUID:** 87654321-4321-4321-4321-cba987654321
- **Data Rate:** 1Hz (1000ms intervals)
- **Data Format:** JSON string with standardized marine fields

### JSON API Fields
- **Always Present:** SOG, COG, lat, lon, satellites, hdop, rssi
- **Conditional:** AWS, AWD (wind sensor), heel (BNO080 IMU sensor)
- **Marine Standards:** Uses proper marine terminology and units

### Error Handling
- **Sensor Failures:** Individual sensors can fail without affecting system
- **Missing Sensors:** Detected at startup, graceful degradation
- **I2C/RS485 Errors:** Timeouts prevent blocking, warnings logged periodically
- **BLE Reliability:** Data transmission continues regardless of sensor status

### Power Management
- **BLE Efficiency:** ~50% less power than WiFi approach
- **NimBLE Library:** Optimized for low power consumption
- **Sensor Management:** Failed sensors don't consume retry power

## Coding Preferences
- Prefer C++ style with modern C++11 and newer features
- Follow PlatformIO project structure conventions
- Use descriptive variable names and clear commenting
- Implement robust error handling for sensor failures
- Use appropriate low-power techniques for battery efficiency
- Prefer non-blocking code to maintain system responsiveness
- **BLE Focus:** Use NimBLE-Arduino for efficient BLE communication
- **Marine Standards:** Use proper marine terminology in JSON API (SOG, AWS, AWD, etc.)
- **Sensor Robustness:** Handle missing/failed sensors gracefully
- **Error Handling:** Prevent sensor failures from blocking main loop timing

## Problem-Solving Approach
When generating code for this project, consider:
- Power efficiency for battery-operated marine devices
- Memory constraints of embedded systems
- Real-time performance requirements (1Hz data transmission)
- Error handling for sensor failures without blocking main loop
- Environmental challenges of marine applications
- Interference mitigation for reliable sensor readings
- **BLE Connectivity:** Optimize for low-latency, multi-client BLE communication
- **Marine Environment:** Consider power consumption, waterproofing, and reliability
- **Sensor Integration:** Handle missing sensors gracefully, maintain JSON API consistency
- Prefer running VS Code tasks over CLI commands for building
- **Documentation:** Update README.md when making significant changes to maintain accuracy

## Other Information
This is an embedded systems project for marine applications that requires careful consideration of:

**Hardware Constraints:**
- ESP32 memory limitations and real-time performance requirements
- Battery power efficiency for extended operation
- Environmental challenges of marine conditions

**Software Architecture:**
- **BLE Communication:** Uses NimBLE-Arduino for efficient, low-power BLE server
- **JSON API:** Standardized marine terminology with conditional field presence
- **Error Resilience:** Robust sensor error handling without system interruption
- **Multi-Client Support:** Simultaneous BLE connections to multiple devices

**Current Status:**
- Migrated from WiFi Access Point to BLE connectivity
- Implements standardized JSON API with marine conventions
- Robust sensor error handling with graceful degradation
- Power-optimized for extended battery operation
- 1Hz reliable data transmission regardless of sensor status

**Key Libraries:**
- NimBLE-Arduino for BLE communication
- ArduinoJson for JSON serialization
- TinyGPS++ for GPS parsing
- SparkFun BNO080 library for IMU sensor

Refer to the README.md file for comprehensive implementation details, BLE JSON API documentation, and setup instructions.
