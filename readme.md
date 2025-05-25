# Luna Sailing Dashboard

A sailing vessel monitoring system built with ESP32, providing real-time data on vessel speed, wind conditions, and tilt angle.

## Features

- Real-time monitoring of sailing data:
  - Vessel speed (via GPS)
  - Wind speed and direction (via ultrasonic sensor)
  - Vessel heel/tilt angle (via accelerometer)
- Progressive Web App (PWA) dashboard:
  - Installable on mobile devices
  - Works offline (interface only)
  - Responsive design for all screen sizes
- WiFi Access Point for direct connection
- Real-time data updates via WebSockets
- Data visualization with gauges and charts

## Hardware Components

- ESP32 DEVKIT V1 DOIT (main controller)
- NEO-7M GPS Module with external antenna
- Ultrasonic Wind Speed and Direction Sensor (RS485)
- GY-291 ADXL345 Digital Three-Axis Acceleration Sensor
- RS485 to UART Converter Module

## Getting Started

### Setup

#### Software Prerequisites

1. **Development Environment**
   - [Visual Studio Code](https://code.visualstudio.com/) (VS Code)
   - [PlatformIO IDE Extension](https://platformio.org/install/ide?install=vscode)
   - [Git](https://git-scm.com/downloads) (optional, for cloning the repository)

2. **Required USB Drivers**
   - For Windows: [CP210x USB to UART Bridge VCP Drivers](https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers)
   - For macOS: Drivers are usually pre-installed
   - For Linux: Usually included in the kernel, but you may need to add your user to the `dialout` group:
     ```bash
     sudo usermod -a -G dialout $USER
     # Log out and log back in for changes to take effect
     ```

#### Hardware Setup

1. **Wire the Sensors to ESP32**
   - **GPS Module (NEO-7M)**
     - VCC → 3.3V on ESP32
     - GND → GND on ESP32
     - TX → GPIO 16 (RX2) on ESP32
     - RX → GPIO 17 (TX2) on ESP32
   
   - **Accelerometer (ADXL345)**
     - VCC → 3.3V on ESP32
     - GND → GND on ESP32
     - SCL → GPIO 22 on ESP32
     - SDA → GPIO 21 on ESP32
   
   - **Wind Sensor (via RS485 converter)**
     - Connect RS485 converter to ESP32:
       - VCC → 5V on ESP32
       - GND → GND on ESP32
       - RX → GPIO 25 (TX) on ESP32
       - TX → GPIO 26 (RX) on ESP32
     - Connect wind sensor to RS485 converter (A to A, B to B)

2. **Power Supply**
   - For testing: USB connection to computer
   - For deployment: 5V power bank or boat's 12V supply with a voltage regulator

#### Software Installation

1. **Clone this repository**
   ```bash
   git clone https://github.com/yourusername/luna.git
   cd luna
   ```
   
   Alternatively, download the ZIP file from GitHub and extract it.

2. **Open the project in VS Code with PlatformIO**
   - Launch VS Code
   - Go to Extensions (Ctrl+Shift+X or Cmd+Shift+X)
   - Search for and install "PlatformIO IDE"
   - Restart VS Code when prompted
   - Open the Luna project folder (File > Open Folder)
   - Wait for PlatformIO to initialize the project (this may take a few minutes)

3. **Install required libraries**
   PlatformIO should automatically install the required libraries based on the `platformio.ini` file. If not, you can install them manually:
   
   - Through PlatformIO Home:
     - Click on the PlatformIO icon in the sidebar
     - Go to "Libraries" and search for each library:
       - AsyncTCP
       - ESPAsyncWebServer
       - ArduinoJson
       - Adafruit ADXL345
       - TinyGPS++
     - Click "Add to Project" and select your project
   
   - Or through the CLI:
     ```bash
     pio pkg install --library "me-no-dev/AsyncTCP"
     pio pkg install --library "me-no-dev/ESPAsyncWebServer"
     pio pkg install --library "bblanchon/ArduinoJson"
     pio pkg install --library "adafruit/Adafruit ADXL345"
     pio pkg install --library "mikalhart/TinyGPSPlus"
     ```

4. **Configure WiFi Settings (Optional)**
   - Open `src/main.cpp`
   - Modify the following lines to change the default WiFi settings:
     ```cpp
     const char* ssid = "Luna_Sailing";     // Change to your desired WiFi name
     const char* password = "lunapassword";  // Change to your desired password
     ```

5. **Build the firmware**
   - In VS Code, click on the PlatformIO icon in the sidebar
   - Select "Project Tasks" > "Build" or use the VS Code task
   - Wait for the build to complete
   - Check the terminal output for any errors

6. **Connect ESP32 to your computer**
   - Use a micro-USB cable to connect the ESP32 to your computer
   - Check that the board is recognized:
     - Windows: Check Device Manager under "Ports (COM & LPT)"
     - macOS: Run `ls /dev/cu.*` in Terminal
     - Linux: Run `ls /dev/ttyUSB*` in Terminal

7. **Upload the firmware to ESP32**
   - In VS Code, select "Project Tasks" > "Upload" or use the VS Code task
   - If you encounter upload issues:
     - Press and hold the BOOT button on the ESP32 while initiating the upload
     - Release the BOOT button after the upload begins
   - Wait for the upload to complete (you should see "Success" in the terminal)

8. **Upload the web application files to ESP32**
   - In VS Code, select "Project Tasks" > "Upload Filesystem Image" or use the VS Code task
   - This will upload all files in the `/data/www` directory to the ESP32's SPIFFS filesystem
   - Wait for the upload to complete

9. **Restart the ESP32**
   - Press the RST (Reset) button on the ESP32 or
   - Disconnect and reconnect the USB cable

### Connecting to the Dashboard

#### Initial Connection

1. **Power on the ESP32**
   - If using USB: Connect to a computer or power bank
   - If using external power: Connect to the boat's power supply

2. **Wait for system initialization**
   - The ESP32 needs about 10-15 seconds to boot up and start the WiFi Access Point
   - If you've enabled status LEDs in the firmware, wait for the indicator showing the system is ready

3. **Connect to the "Luna_Sailing" WiFi network**
   
   **On iPhone/iPad:**
   - Go to Settings > Wi-Fi
   - Wait for "Luna_Sailing" to appear in the list of available networks
   - Tap on "Luna_Sailing" to connect
   - Enter the password (default: "lunapassword")
   - If a "No Internet Connection" warning appears, tap "Use Without Internet"
   - If the network doesn't appear, pull down on the screen to refresh the network list
   
   **On Android:**
   - Go to Settings > Connections > Wi-Fi (or Settings > Wi-Fi, depending on your device)
   - Wait for "Luna_Sailing" to appear in the list of available networks
   - Tap on "Luna_Sailing" to connect
   - Enter the password (default: "lunapassword")
   - If a "This Wi-Fi network has no internet access" message appears, tap "Yes" or "Connect anyway"
   - Some Android devices may automatically switch back to mobile data; if this happens, you may need to disable mobile data temporarily
   
   **On Windows:**
   - Click on the Wi-Fi icon in the taskbar
   - Select "Luna_Sailing" from the list of available networks
   - Click "Connect"
   - Enter the password (default: "lunapassword")
   - If prompted that "There's no internet access", select "Yes" to connect anyway
   - Windows may show a "No internet access" message in the Wi-Fi icon - this is normal
   
   **On macOS:**
   - Click on the Wi-Fi icon in the menu bar
   - Select "Luna_Sailing" from the dropdown list
   - Enter the password (default: "lunapassword")
   - If a warning about no internet access appears, click "Join" or "Continue"
   - macOS may automatically reconnect to other known networks; if this happens, click the Wi-Fi icon and manually select "Luna_Sailing" again

4. **Open the dashboard**
   - Open your web browser and navigate to `http://192.168.4.1`
   - For easier access, you can bookmark this address or add it to your home screen (see "Installing as a PWA" below)
   - If the page doesn't load, try:
     - Refreshing the browser
     - Making sure you're still connected to the "Luna_Sailing" network
     - Checking that you entered the correct address (`http://192.168.4.1`, not https)
     - Waiting a few more seconds for the ESP32 to fully initialize

5. **Verify the connection**
   - Once connected, you should see the dashboard with real-time data
   - Check that the data is updating (approximately once per second)
   - If using simulated data, you'll see the values changing randomly
   - If using real sensors, check that the values respond to actual changes in movement, wind, etc.

#### Troubleshooting Connection Issues

- **Can't find the WiFi network**
  - Make sure the ESP32 is powered on
  - Try restarting the ESP32 by pressing the reset button
  - Move closer to the ESP32 - the range is typically 10-30 meters in open space
  - Check if your device's WiFi is turned on

- **Connected to WiFi but can't access the dashboard**
  - Verify you're navigating to `http://192.168.4.1` (not https)
  - Try clearing your browser cache
  - Try a different browser
  - Restart the ESP32

- **Dashboard loads but no data appears**
  - Check the WebSocket connection (a message will appear if disconnected)
  - Refresh the page
  - If using real sensors, verify they are properly connected
  - Check the serial monitor output for any error messages

### Installing as a PWA

The Luna Sailing Dashboard is designed as a Progressive Web App (PWA), which means you can install it on your device for easier access and a more app-like experience. Once installed, you can launch it directly from your home screen without opening a browser and typing the address.

#### On iPhone/iPad (Safari)

1. Open the dashboard in Safari (navigate to `http://192.168.4.1`)
2. Tap the Share button (rectangle with an arrow pointing up) at the bottom of the screen
3. Scroll down and tap "Add to Home Screen"
4. You can rename the app if you wish
5. Tap "Add" in the top-right corner
6. The Luna app icon will appear on your home screen
7. Tap the icon to launch the app in full-screen mode

#### On Android (Chrome)

1. Open the dashboard in Chrome (navigate to `http://192.168.4.1`)
2. Tap the three-dot menu button in the top-right corner
3. Select "Add to Home screen" or "Install app" (the wording may vary)
4. If prompted, confirm by tapping "Add" or "Install"
5. The Luna app icon will appear on your home screen
6. Tap the icon to launch the app in full-screen mode

#### On Windows (Chrome/Edge)

1. Open the dashboard in Chrome or Edge (navigate to `http://192.168.4.1`)
2. Look for the install icon in the address bar (a computer with a down arrow) or the three-dot menu
3. Click "Install Luna Sailing" or "Install app"
4. Confirm by clicking "Install" in the popup
5. The app will install and can be launched from the Start menu or desktop
6. You can also pin it to the taskbar for quick access

#### On macOS (Chrome)

1. Open the dashboard in Chrome (navigate to `http://192.168.4.1`)
2. Click the three-dot menu in the top-right corner
3. Select "Install Luna Sailing..." or "Create shortcut..."
4. Choose whether to open as a window or tab
5. Click "Install" or "Create"
6. The app will be added to your Applications folder and can be launched from there

#### Benefits of Installing as a PWA

- **Easier Access**: Launch directly from your home screen without typing the URL
- **Full-Screen Experience**: No browser interface elements taking up space
- **Offline Interface**: The basic dashboard UI remains accessible even without connection (though live data requires connection)
- **Automatic Reconnection**: The app will attempt to reconnect to the ESP32 when the connection is available

#### Troubleshooting PWA Installation

- **Install option not appearing**:
  - Make sure you've fully loaded the dashboard page
  - Try refreshing the page
  - Some browsers may require you to visit the site more than once before offering installation
  
- **App not working after installation**:
  - Make sure you're connected to the "Luna_Sailing" WiFi network
  - Try uninstalling and reinstalling the app
  
- **App showing offline mode**:
  - This is normal if you're not connected to the ESP32's WiFi
  - Connect to the "Luna_Sailing" network and reload the app

## Development

### Sensor Calibration and Configuration

#### GPS Module (NEO-7M)

1. **Initial Setup**
   - The GPS module requires a clear view of the sky to acquire a satellite fix
   - For best results, position the antenna horizontally with an unobstructed view
   - Initial satellite acquisition can take 30-90 seconds in ideal conditions, or longer in poor conditions
   - The blue LED on the GPS module will blink when it has a fix

2. **Configuration Options**
   - The GPS update rate is set to 1Hz by default (in `src/sensors/gps.cpp`)
   - To modify GPS settings, you can adjust the following parameters:
     ```cpp
     // Change update rate (default is 1Hz)
     const int GPS_UPDATE_RATE = 1000; // in milliseconds
     
     // Change serial baud rate if needed
     const int GPS_BAUD_RATE = 9600;
     ```

#### Accelerometer (ADXL345)

1. **Calibration Process**
   - The accelerometer needs calibration for accurate tilt measurements
   - To calibrate:
     1. Position the ESP32 and accelerometer in a perfectly level position
     2. Navigate to the dashboard's Settings tab
     3. Click "Calibrate Accelerometer"
     4. Wait for the calibration to complete (about 5 seconds)
     5. The calibration values are stored in the ESP32's flash memory

2. **Manual Calibration**
   - If automatic calibration doesn't provide satisfactory results, you can manually adjust the offset values:
     ```cpp
     // In src/sensors/accelerometer.cpp
     const float X_OFFSET = 0.0;  // Replace with your calibration value
     const float Y_OFFSET = 0.0;  // Replace with your calibration value
     const float Z_OFFSET = 0.0;  // Replace with your calibration value
     ```

3. **Mounting Considerations**
   - Mount the accelerometer with the X-axis aligned with the fore-aft axis of the boat
   - The Y-axis should be aligned with the port-starboard axis
   - The Z-axis should be pointing upward
   - If physical alignment isn't possible, you can adjust the axis orientation in software:
     ```cpp
     // In src/sensors/accelerometer.cpp
     const bool SWAP_X_Y = false;  // Set to true to swap X and Y axes
     const bool INVERT_X = false;  // Set to true to invert X axis readings
     const bool INVERT_Y = false;  // Set to true to invert Y axis readings
     const bool INVERT_Z = false;  // Set to true to invert Z axis readings
     ```

#### Wind Sensor

1. **Calibration**
   - The ultrasonic wind sensor should be calibrated according to manufacturer instructions
   - For most sensors, this involves:
     1. Mounting the sensor in a stable position
     2. Navigating to the dashboard's Settings tab
     3. Clicking "Calibrate Wind Sensor"
     4. Following the on-screen instructions to rotate the sensor
     5. Saving the calibration data

2. **Configuration Options**
   - If using a different model than the default, you may need to adjust the RS485 communication parameters:
     ```cpp
     // In src/sensors/wind.cpp
     const int WIND_SENSOR_ADDRESS = 1;    // Modbus address of the sensor
     const int WIND_UPDATE_RATE = 1000;    // Update rate in milliseconds
     const int WIND_SENSOR_BAUDRATE = 9600; // Baud rate for RS485 communication
     ```

3. **Mounting Position**
   - Mount the wind sensor at the highest practical point for accurate readings
   - Ensure it's away from obstructions that could cause wind shadow or turbulence
   - For powerboats or when running with engines, be aware that exhaust gases can affect readings

### Project Structure

- `/src`: Main C++ code for ESP32
- `/data/www`: Web dashboard files
  - `/css`: Stylesheets
  - `/js`: JavaScript files
  - `/images`: Icons and graphics
- `/include`: Header files
- `/lib`: Libraries

### Building and Uploading

#### Using VS Code Tasks (Recommended)

VS Code with PlatformIO extension provides several tasks that can be executed from the UI:

1. Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (macOS) to open the command palette
2. Type "Tasks: Run Task" and select it
3. Choose one of the following tasks:
   - **Build**: Compiles the firmware
   - **Upload Firmware**: Compiles and uploads the firmware to the ESP32
   - **Upload Filesystem**: Uploads the web files to the ESP32's filesystem
   - **Monitor**: Opens a serial monitor to view ESP32 debug output
   - **Clean**: Cleans the build directory

#### Using PlatformIO CLI

If you prefer the command line, you can use the following commands:

```bash
# Build the project
pio run

# Upload firmware
pio run --target upload

# Upload filesystem (web files)
pio run --target uploadfs

# Monitor serial output
pio device monitor

# Clean build files
pio run --target clean
```

#### Troubleshooting Upload Issues

If you encounter issues when uploading:

1. Make sure the ESP32 is properly connected via USB
2. Check that you have the correct USB driver installed
3. On Windows, check Device Manager to verify the COM port
4. On macOS/Linux, check that you have permission to access the serial port:
   ```bash
   # macOS/Linux
   ls -l /dev/tty*
   sudo chmod 666 /dev/ttyUSB0  # Replace with your port
   ```
5. Try pressing the BOOT button on the ESP32 while initiating the upload

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Power Management and Battery Operation

The Luna Sailing Dashboard is designed to operate efficiently on battery power, making it suitable for extended use on sailing vessels without constant shore power.

### Power Requirements

- **ESP32 Power Consumption**:
  - Normal operation (WiFi AP active): ~160-180mA @ 5V (~0.9W)
  - Deep sleep mode: ~10μA @ 5V (negligible)
  
- **Sensor Power Requirements**:
  - GPS Module: ~50mA @ 3.3V
  - Accelerometer: ~0.1mA @ 3.3V
  - Wind Sensor: Varies by model, typically 100-300mA @ 5-12V
  
- **Total System**:
  - Typical consumption: ~250-350mA @ 5V (1.25-1.75W)
  - This means a 10Ah power bank can power the system for approximately 20-30 hours

### Power Optimization Settings

The firmware includes several power-saving features that can be enabled in the `config.h` file:

```cpp
// Power saving configuration
#define ENABLE_DEEP_SLEEP true       // Enable deep sleep during inactivity
#define SLEEP_AFTER_MINUTES 30       // Minutes of inactivity before sleep
#define ENABLE_LOW_POWER_MODE false  // Reduces functionality for power saving
```

When `ENABLE_DEEP_SLEEP` is set to `true`, the ESP32 will enter deep sleep mode after the specified period of inactivity (no WebSocket connections). It can be woken up by:

1. Pressing the reset button
2. Using an external wake trigger connected to GPIO 33
3. Setting a time-based wake-up (configured in the firmware)

### Battery Connection Options

1. **Direct USB Power Bank**:
   - Simplest solution
   - Connect a standard USB power bank to the ESP32's micro-USB port
   - No additional components required

2. **Boat 12V System**:
   - Requires a 12V to 5V voltage regulator/converter
   - Recommended: Buck converter with at least 1A output capacity
   - Connect the output to the ESP32's 5V and GND pins (not via USB)
   - Consider adding a power switch and fuse for safety

3. **Solar Power Option**:
   - Small 5W-10W solar panel
   - Solar charge controller
   - 3.7V LiPo battery (2000mAh or larger)
   - LiPo to 5V boost converter
   - This setup can provide continuous operation in sunny conditions

### Battery Level Monitoring

The system can monitor power supply voltage if configured:

1. Enable battery monitoring in `config.h`:
   ```cpp
   #define MONITOR_BATTERY true
   #define BATTERY_PIN 34  // ADC pin connected to battery through voltage divider
   ```

2. Set up a voltage divider circuit:
   - For a LiPo battery (max 4.2V): 10kΩ and 20kΩ resistors
   - For a 12V system: 10kΩ and 100kΩ resistors
   - Connect the middle point of the divider to the ADC pin (GPIO 34 by default)

3. The battery level will be displayed on the dashboard
   - Low battery warnings will appear when voltage drops below configured thresholds
   - Critical battery level can trigger automatic shutdown to prevent damage

### Power-Saving Tips

1. **Reduce WiFi Transmit Power**:
   - In `src/main.cpp`, add: `WiFi.setTxPower(WIFI_POWER_7dBm);` 
   - This reduces range but saves significant power

2. **Optimize Sensor Polling Rates**:
   - Increase the interval between sensor readings
   - GPS updates every 5 seconds instead of every second
   - Wind sensor updates every 2-3 seconds

3. **Use the Settings Interface**:
   - The dashboard includes power management settings
   - You can adjust update frequencies and sleep timeouts from the UI
   - Enable "Low Power Mode" for extended operation

## Acknowledgments

- [ESP32 Arduino Core](https://github.com/espressif/arduino-esp32)
- [ESPAsyncWebServer](https://github.com/me-no-dev/ESPAsyncWebServer)
- [Chart.js](https://www.chartjs.org/)
- [ArduinoJson](https://arduinojson.org/)