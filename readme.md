# Luna Sailing Dashboard

A sailing vessel monitoring system built with ESP32, providing real-time data on vessel speed, wind conditions, and tilt angle through a modern web application that connects via Bluetooth Low Energy (BLE).

## 🚨 Architecture Update

**This project has been migrated from WiFi Access Point to BLE (Bluetooth Low Energy) connectivity:**

- **OLD:** ESP32 hosted WiFi Access Point + WebSocket server + web files on SPIFFS
- **NEW:** ESP32 BLE server + externally hosted web app + Web Bluetooth API connection

**Key Changes:**
- Web application is now hosted externally (GitHub Pages, Netlify, etc.) over HTTPS
- ESP32 no longer needs to host web files or run a WiFi Access Point
- Connection is via Bluetooth Low Energy using Web Bluetooth API
- Significantly reduced memory usage and improved power efficiency
- Browser support limited to Chrome, Edge, Opera (no Safari/iOS support)

## Features

- Real-time monitoring of sailing data:
  - Vessel speed (via GPS)
  - Wind speed and direction (via ultrasonic sensor)
  - Vessel heel/tilt angle (via accelerometer)
- Progressive Web App (PWA) dashboard:
  - Installable on mobile devices
  - Works offline (interface only)
  - Responsive design for all screen sizes
  - Hosted externally (GitHub Pages or any HTTPS hosting)
- Bluetooth Low Energy (BLE) connectivity:
  - Direct connection between web app and ESP32
  - No WiFi network required
  - Low power consumption
  - Secure pairing
- Real-time data updates via BLE notifications
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
       - ArduinoJson
       - Adafruit ADXL345
       - TinyGPS++
       - ModbusMaster
     - Click "Add to Project" and select your project
   
   - Or through the CLI:
     ```bash
     pio pkg install --library "bblanchon/ArduinoJson"
     pio pkg install --library "adafruit/Adafruit ADXL345"
     pio pkg install --library "mikalhart/TinyGPSPlus"
     pio pkg install --library "4-20ma/ModbusMaster"
     ```

4. **Build the firmware**
   - In VS Code, click on the PlatformIO icon in the sidebar
   - Select "Project Tasks" > "Build" or use the VS Code task
   - Wait for the build to complete
   - Check the terminal output for any errors

5. **Connect ESP32 to your computer**
   - Use a micro-USB cable to connect the ESP32 to your computer
   - Check that the board is recognized:
     - Windows: Check Device Manager under "Ports (COM & LPT)"
     - macOS: Run `ls /dev/cu.*` in Terminal
     - Linux: Run `ls /dev/ttyUSB*` in Terminal

6. **Upload the firmware to ESP32**
   - In VS Code, select "Project Tasks" > "Upload" or use the VS Code task
   - If you encounter upload issues:
     - Press and hold the BOOT button on the ESP32 while initiating the upload
     - Release the BOOT button after the upload begins
   - Wait for the upload to complete (you should see "Success" in the terminal)

7. **Restart the ESP32**
   - Press the RST (Reset) button on the ESP32 or
   - Disconnect and reconnect the USB cable

### Connecting to the Dashboard

#### Web Application Access

The Luna Sailing Dashboard web application is hosted externally (not on the ESP32) to provide better performance and reliability. You can access it at:

**Live Dashboard:** [https://yourusername.github.io/luna-dashboard](https://yourusername.github.io/luna-dashboard)

*Note: Replace the URL above with your actual hosted dashboard URL*

#### Connecting via Bluetooth Low Energy (BLE)

1. **Power on the ESP32**
   - If using USB: Connect to a computer or power bank
   - If using external power: Connect to the boat's power supply

2. **Wait for system initialization**
   - The ESP32 needs about 10-15 seconds to boot up and start the BLE server
   - The ESP32 will advertise as "Luna_Sailing" and be discoverable by BLE devices

3. **Access the web dashboard**
   - Open a BLE-compatible browser (Chrome, Edge, or Opera on desktop/Android)
   - Navigate to the dashboard URL (hosted externally)
   - The dashboard must be served over HTTPS for Web Bluetooth API to work

4. **Connect to the ESP32**
   - Click the "Connect to Luna Sailing" button in the dashboard
   - Your browser will show a device selection dialog
   - Select "Luna_Sailing" from the list of available devices
   - Click "Pair" or "Connect"
   - The connection status will change to "Connected via BLE"

5. **Verify the connection**
   - Once connected, you should see real-time data updating in the dashboard
   - Check that the data is updating (approximately once per second)
   - Satellite count should be visible if GPS is connected
   - Sensor values should respond to actual changes in movement, wind, etc.

#### Browser Compatibility

**Supported Browsers with Web Bluetooth API:**
- **Chrome** (Desktop: Windows, macOS, Linux; Mobile: Android)
- **Edge** (Desktop: Windows, macOS; Mobile: Android)
- **Opera** (Desktop: Windows, macOS, Linux; Mobile: Android)

**Not Supported:**
- Safari (iOS/macOS) - Does not support Web Bluetooth API
- Firefox - Limited or no Web Bluetooth support
- Most iOS browsers - iOS restricts Web Bluetooth API

**Recommended Setup:**
- Android device with Chrome browser
- Windows/macOS/Linux desktop with Chrome or Edge
- Ensure the dashboard is served over HTTPS

#### Troubleshooting Connection Issues

- **Can't find the Luna_Sailing BLE device**
  - Make sure the ESP32 is powered on and fully booted (wait 15-20 seconds)
  - Try restarting the ESP32 by pressing the reset button
  - Move closer to the ESP32 - BLE range is typically 10-30 meters in open space
  - Ensure you're using a supported browser (Chrome, Edge, or Opera)
  - Check that Bluetooth is enabled on your device

- **Browser shows "Bluetooth not supported" error**
  - Make sure you're using Chrome, Edge, or Opera (not Safari or Firefox)
  - Ensure the dashboard is served over HTTPS (required for Web Bluetooth API)
  - Try updating your browser to the latest version
  - On Android, ensure location services are enabled (required for BLE scanning)

- **Dashboard loads but BLE connection fails**
  - Check that your device's Bluetooth is turned on
  - Try clearing your browser cache and cookies
  - Restart your browser completely
  - Try connecting from a different device
  - Check the browser console (F12) for error messages

- **Connected but no data appears**
  - Check the BLE connection status indicator in the dashboard
  - Refresh the page and try reconnecting
  - If using real sensors, verify they are properly connected to the ESP32
  - Check the ESP32 serial monitor output for any error messages
  - Try restarting the ESP32

- **iOS/Safari compatibility issues**
  - Unfortunately, iOS Safari does not support Web Bluetooth API
  - Use an Android device or desktop browser instead
  - Consider using a third-party iOS browser that might support Web Bluetooth (limited options)

- **Data updates are slow or intermittent**
  - This may be due to BLE connection quality or interference
  - Move closer to the ESP32
  - Remove sources of 2.4GHz interference (WiFi, microwaves, etc.)
  - Try restarting both the ESP32 and reconnecting from the browser

### Installing as a PWA

The Luna Sailing Dashboard is designed as a Progressive Web App (PWA), which means you can install it on your device for easier access and a more app-like experience. Once installed, you can launch it directly from your home screen without opening a browser and navigating to the URL.

**Important:** The PWA must be served over HTTPS to enable installation and Web Bluetooth API functionality.

#### On iPhone/iPad (Safari)

**Note:** While you can install the PWA on iOS, Web Bluetooth is not supported in Safari, so you'll need to use an Android device or desktop browser for BLE connectivity.

1. Open the dashboard URL in Safari (the externally hosted HTTPS version)
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

### Configuring WiFi Settings

The Luna Sailing Dashboard allows you to change the WiFi Access Point settings directly through the web interface, making it easy to customize your network name and password without modifying code.

#### Accessing WiFi Settings

1. **Connect to the dashboard** using the WiFi network (default: "Luna_Sailing" with no password - open network)
2. **Navigate to Settings** by clicking the gear icon in the top-right corner of the dashboard
3. **Scroll to the WiFi Access Point section** in the settings panel

#### Changing WiFi Credentials

1. **Network Name (SSID)**:
   - Enter your desired network name (1-32 characters)
   - Avoid special characters that might cause compatibility issues
   - Consider using a name that identifies your vessel or purpose

2. **Password**:
   - Enter a secure password (8-63 characters for WPA2 security)
   - Use a mix of letters, numbers, and symbols for better security
   - Avoid dictionary words or easily guessable passwords

3. **Apply Settings**:
   - Click the "Apply WiFi Settings" button
   - Review the security warning dialog that appears
   - Confirm your changes by clicking "Confirm"

#### What Happens During WiFi Update

1. **Validation**: The system validates your input for proper length and format
2. **Confirmation**: A dialog explains what will happen and asks for confirmation
3. **Settings Storage**: New credentials are saved to the ESP32's flash memory
4. **Network Restart**: The ESP32 restarts its WiFi Access Point with new settings
5. **Client Notification**: Connected devices receive a notification about the restart
6. **Automatic Disconnection**: All devices will be disconnected from the old network

#### Reconnecting After WiFi Changes

After applying new WiFi settings:

1. **Wait for restart**: Allow 10-15 seconds for the ESP32 to restart with new settings
2. **Disconnect from old network**: Your device will automatically disconnect from the old network
3. **Connect to new network**: 
   - Look for the new network name in your WiFi settings
   - Connect using the new password you configured
4. **Navigate to dashboard**: Open your browser and go to `http://192.168.4.1`
5. **Verify connection**: Ensure the dashboard loads and data is updating

#### Security Considerations

- **Default Security**: The system starts with an **open WiFi network (no password)** for initial setup convenience
- **Immediate Configuration Recommended**: Change to a secure password as soon as possible after initial setup
- **Password Strength**: Use strong passwords to prevent unauthorized access to your sailing data
- **Network Visibility**: WiFi networks are visible to anyone in range - choose appropriate names
- **Regular Updates**: Consider changing passwords periodically, especially if multiple people have access
- **Guest Access**: You can create simpler passwords for temporary guests and change them later

#### Troubleshooting WiFi Settings

**Settings not applying**:
- Ensure both SSID and password meet the length requirements
- Check that you confirmed the changes in the dialog
- Try refreshing the page and attempting again

**Can't reconnect after changing settings**:
- Wait a full 30 seconds for the ESP32 to fully restart
- Check your device's WiFi settings to ensure you're connecting to the correct network
- Verify you're using the new password, not the old one
- Try "forgetting" the old network on your device if it keeps trying to connect with old credentials

**Lost access to settings**:
- If you can't remember the new credentials, you can:
  1. **Use Factory Reset**: Hold the BOOT button on the ESP32 for 5 seconds to reset to defaults
  2. **View via Serial Monitor**: Connect the ESP32 to your computer via USB and use the serial monitor to view the current credentials at startup
  3. **Reflash Firmware**: Upload fresh firmware to reset to default credentials

**Settings reverting to defaults**:
- This may indicate a problem with flash memory storage
- Try power cycling the ESP32 completely (disconnect power for 10 seconds)
- If the problem persists, consider reflashing the firmware

#### Default Credentials

If you need to reset to factory defaults:
- **Default SSID**: `Luna_Sailing`
- **Default Password**: None (open network)

These defaults are restored when:
- Fresh firmware is uploaded without previous settings
- Flash memory is cleared or corrupted
- Factory reset is performed using the BOOT button (hold for 5 seconds)

**Note**: Factory reset functionality is now implemented using the ESP32's BOOT button. Hold the BOOT button for 5 seconds to reset all settings to defaults.

### Factory Reset

The Luna Sailing Dashboard includes a hardware-based factory reset feature that can restore all settings to their default values without requiring firmware reflashing or computer connection.

#### How to Perform Factory Reset

1. **Locate the BOOT Button**
   - Find the BOOT button on your ESP32 development board
   - This is usually labeled "BOOT" and is typically the smaller button (not the RESET button)
   - On most ESP32 DEVKIT boards, it's located near the USB connector

2. **Perform the Reset**
   - **Press and hold** the BOOT button
   - **Keep holding** for exactly **5 seconds**
   - The built-in LED will start blinking to indicate the button press is detected
   - The LED will blink faster as you approach the 5-second mark
   - **Release** the button after 5 seconds

3. **Visual Feedback**
   - **Initial press**: LED turns on solid
   - **During hold**: LED blinks progressively faster
   - **Factory reset triggered**: LED flashes rapidly 10 times
   - **Reset complete**: LED turns off

4. **What Gets Reset**
   - **WiFi Settings**: Network name returns to "Luna_Sailing", password removed (open network)
   - **Network Security**: Returns to open network (no password required)
   - **Sensor Data**: All historical data and maximum values cleared
   - **Dashboard Settings**: All customizations reset to defaults

#### After Factory Reset

1. **Automatic WiFi Restart**: The ESP32 will automatically restart its WiFi with default settings
2. **Reconnection Required**: 
   - Disconnect from the current WiFi network
   - Look for "Luna_Sailing" network (open, no password)
   - Connect to the new network
   - Navigate to `http://192.168.4.1`
3. **Security Setup**: Immediately configure a secure password through the dashboard settings
4. **Data Collection**: Sensor data collection will resume with fresh/cleared history

#### When to Use Factory Reset

- **Lost WiFi Password**: Can't remember the WiFi credentials you set
- **Network Issues**: WiFi settings got corrupted or causing connection problems
- **Starting Fresh**: Want to clear all data and start with default settings
- **Device Handover**: Preparing the device for someone else to use
- **Troubleshooting**: Eliminating custom settings as a source of problems

#### Troubleshooting Factory Reset

- **Button not responding**: Make sure you're pressing the BOOT button, not the RESET button
- **LED not blinking**: Check that the ESP32 is powered on and the firmware is running
- **Reset not completing**: Ensure you hold the button for the full 5 seconds
- **Still can't connect**: Try power cycling the ESP32 after the reset
- **Settings not cleared**: If problems persist, consider reflashing the firmware

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

- `/src`: Main C++ code for ESP32 (BLE server and sensor management)
- `/data/www`: Web dashboard files (legacy - now hosted externally)
  - `/css`: Stylesheets
  - `/js`: JavaScript files (including BLE connection logic)
  - `/images`: Icons and graphics
- `/include`: Header files
- `/lib`: Libraries

**Note:** The `/data/www` folder contains the web application files for reference and local development, but in the new architecture, these files should be hosted externally (e.g., GitHub Pages) rather than uploaded to the ESP32's filesystem.

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
  - Normal operation (BLE active): ~80-120mA @ 5V (~0.4-0.6W)
  - Deep sleep mode: ~10μA @ 5V (negligible)
  - **Significant improvement**: BLE uses ~50% less power than WiFi Access Point mode
  
- **Sensor Power Requirements**:
  - GPS Module: ~50mA @ 3.3V
  - Accelerometer: ~0.1mA @ 3.3V
  - Wind Sensor: Varies by model, typically 100-300mA @ 5-12V
  
- **Total System**:
  - Typical consumption: ~180-270mA @ 5V (0.9-1.35W)
  - This means a 10Ah power bank can power the system for approximately 30-40 hours

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