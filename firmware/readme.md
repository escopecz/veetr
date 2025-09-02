# Veetr Sailing Dashboard

A sailing vessel monitoring system built with ESP32, providing real-time data on vessel speed, wind conditions, and tilt angle through a modern web application that connects via Bluetooth Low Energy (BLE).

## 🚨 Architecture Update

**This project has been migrated from WiFi Access Point to BLE (Bluetooth Low Energy) connectivity:**

- **OLD:** ESP32 hosted WiFi Access Point + WebSocket server + web files on SPIFFS
- **NEW:** ESP32 BLE server + externally hosted web app + Web Bluetooth API connection

**Key Changes:**
- Web application is now hosted externally (GitHub Pages, Netlify, etc.) over HTTPS
- ESP32 no longer needs to host web files or run a WiFi Access Point
- Connection is via Bluetooth Low Energy using Web Bluetooth API with NimBLE-Arduino
- Significantly reduced memory usage and improved power efficiency
- Browser support limited to Chrome, Edge, Opera (no Safari/iOS support)
- Standardized JSON API with marine terminology (SOG, AWS, TWS, etc.)
- Robust sensor error handling - system continues to operate even if sensors fail

## Features

- Real-time monitoring of sailing data:
  - Vessel speed over ground (SOG) via GPS with noise filtering
  - Wind speed and direction (AWS/AWD) via ultrasonic sensor
  - Vessel heel/tilt angle via BNO080 IMU sensor (when available)
  - GPS position and satellite information
  - BLE connection strength (RSSI)
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
  - Multi-client support
- Real-time data updates via BLE notifications (1Hz)
- Data visualization with gauges and charts
- Robust sensor error handling - system continues operating even if sensors fail

## BLE JSON API

The Veetr Sailing Dashboard transmits data via BLE notifications using a standardized JSON format with marine terminology. Data is sent approximately every 1 second to all connected BLE clients.

### BLE Service and Characteristics

- **Service UUID:** `12345678-1234-5678-9abc-def123456789`
- **Characteristic UUID:** `87654321-4321-8765-cba9-fedcba987654`
- **Properties:** Read, Notify
- **Data Format:** JSON string encoded as UTF-8

### JSON Data Structure

```json
{
  "SOG": 4.2,
  "COG": 185.5,
  "lat": 37.7749,
  "lon": -122.4194,
  "satellites": 8,
  "hdop": 1.2,
  "AWS": 12.5,
  "AWD": 045,
  "heel": -5.2,
  "HDM": 185.5,
  "accelX": 0.12,
  "accelY": -0.05,
  "accelZ": 9.81,
  "rssi": -65,
  "deviceName": "Luna_Port_Side"
}
```

### Field Definitions

| Field | Type | Unit | Description | Marine Standard |
|-------|------|------|-------------|-----------------|
| `SOG` | float | knots | Speed Over Ground from GPS | ✓ |
| `COG` | float | degrees | Course Over Ground from GPS (0-360°) | ✓ |
| `lat` | float | decimal degrees | GPS Latitude (WGS84) | ✓ |
| `lon` | float | decimal degrees | GPS Longitude (WGS84) | ✓ |
| `satellites` | integer | count | Number of GPS satellites in use | ✓ |
| `hdop` | float | dimensionless | Horizontal Dilution of Precision | ✓ |
| `AWS` | float | knots | Apparent Wind Speed | ✓ |
| `AWD` | integer | degrees | Apparent Wind Direction (0-360°) | ✓ |
| `heel` | float | degrees | Vessel heel angle (+ = starboard, - = port) | ✓ |
| `HDM` | float | degrees | Heading Magnetic from magnetometer (0-360°) | ✓ |
| `accelX` | float | m/s² | Acceleration along X-axis (fore/aft) | ✓ |
| `accelY` | float | m/s² | Acceleration along Y-axis (port/starboard) | ✓ |
| `accelZ` | float | m/s² | Acceleration along Z-axis (up/down) | ✓ |
| `rssi` | integer | dBm | BLE signal strength (more negative = weaker) | - |
| `deviceName` | string | - | BLE device name for multi-device identification | - |

### Field Behavior

**Always Present:**
- `SOG`, `COG`, `lat`, `lon`, `satellites`, `hdop` - GPS data (0 values if no GPS fix)
- `rssi` - BLE signal strength
- `deviceName` - BLE device name for multi-device identification

**Conditionally Present:**
- `AWS` - Only present if wind sensor is connected and working
- `AWD` - Only present if wind sensor is connected and working  
- `heel` - Only present if BNO080 IMU sensor is detected and working
- `HDM` - Only present if BNO080 magnetometer is working and has valid data
- `accelX`, `accelY`, `accelZ` - Only present if BNO080 accelerometer is working and has valid data

### GPS Speed Filtering

The system includes intelligent GPS speed filtering that combines GPS track analysis with accelerometer data to accurately distinguish real vessel movement from GPS noise when stationary or docked.

**How it works:**
1. **GPS Track Analysis:** Collects recent GPS positions and analyzes the vessel's track for distance traveled and bearing changes
2. **Accelerometer Movement Detection:** Analyzes acceleration magnitude variations to detect physical movement independent of GPS
3. **Sensor Fusion:** Combines both GPS and accelerometer data for more accurate movement detection
4. **Quality Check:** Only uses GPS data with ≥4 satellites and HDOP ≤ 3.0
5. **Adaptive Thresholds:** Adjusts noise filtering thresholds based on sensor confidence
6. **Hysteresis:** Different thresholds prevent speed "flickering" between 0 and low values

**Key Features:**
- **Dual-Sensor Validation:** Uses both GPS track analysis and accelerometer data when IMU is available
- **Independent Movement Detection:** Accelerometer provides movement confirmation independent of GPS signal quality
- **Adaptive Filtering:** Lower thresholds when both sensors confirm movement, higher when stationary
- **Graceful Degradation:** Falls back to GPS-only filtering when IMU sensor is not available
- **Responsive:** Quickly detects when vessel starts moving after being stationary

**Enhanced Thresholds (with Accelerometer):**
- **High Confidence Movement:** 0.05 knots (both GPS and accelerometer detect movement)
- **Normal Filtering:** 0.08 knots (mixed signals or IMU unavailable)
- **High Confidence Stationary:** 0.12 knots (both sensors confirm stationary state)
- **Start Moving Hysteresis:** +0.1 knots above respective threshold

**Accelerometer Movement Detection:**
- **Acceleration Variance:** Detects changes in acceleration magnitude indicating movement
- **Magnitude Analysis:** Monitors total acceleration range and standard deviation
- **Validation:** Ensures accelerometer readings are reasonable (gravity present: 8-12 m/s²)
- **Noise Immunity:** Filters false positives from sensor noise or vibrations

**Why This Approach:**
This dual-sensor approach significantly improves accuracy over GPS-only filtering:
- **Eliminates False Positives:** GPS noise won't register as movement without accelerometer confirmation
- **Reduces False Negatives:** Real movement detected by accelerometer even with poor GPS signal
- **Better Sensitivity:** Can detect very slow movement (below GPS noise floor) when accelerometer confirms motion
- **Marine Environment Optimized:** Accounts for wave motion, anchoring, and low-speed maneuvering scenarios

### Error Handling

The system is designed to be robust against sensor failures:

- **Missing GPS:** System continues to operate, GPS fields show default values
- **Missing Wind Sensor:** Wind fields (`AWS`, `AWD`) are omitted from JSON
- **Missing IMU Sensor:** Heel field is omitted from JSON
- **Sensor Failures:** Individual sensor failures don't affect other sensors or BLE transmission
- **BLE Reliability:** JSON is transmitted every 1 second regardless of sensor status

### BLE Commands

The Veetr Sailing Dashboard supports bidirectional communication via a dedicated command characteristic. This allows web applications to configure device settings and trigger actions remotely.

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

- **Fleet Management:** "Veetr_01", "Veetr_02", "Veetr_03"
- **Multi-Hull Boats:** "Veetr_Port", "Veetr_Starboard"
- **Multiple Locations:** "Veetr_Mast", "Veetr_Cockpit"
- **Development/Testing:** "Veetr_Dev", "Veetr_Prod"

When you change the device name, the ESP32 immediately restarts its BLE advertising with the new name, making it instantly discoverable under the new identifier.

### Example Client Code (JavaScript)

```javascript
// Connect to Veetr Sailing BLE device
const device = await navigator.bluetooth.requestDevice({
  filters: [{ name: 'Veetr_Sailing' }],
  optionalServices: ['12345678-1234-5678-9abc-def123456789']
});

const server = await device.gatt.connect();
const service = await server.getPrimaryService('12345678-1234-5678-9abc-def123456789');

// Get sensor data characteristic for reading
const sensorCharacteristic = await service.getCharacteristic('87654321-4321-8765-cba9-fedcba987654');

// Get command characteristic for writing
const commandCharacteristic = await service.getCharacteristic('11111111-2222-3333-4444-555555555555');

// Listen for sensor data notifications
sensorCharacteristic.addEventListener('characteristicvaluechanged', (event) => {
  const value = event.target.value;
  const jsonString = new TextDecoder().decode(value);
  const data = JSON.parse(jsonString);
  
  console.log('Speed:', data.SOG, 'knots');
  console.log('Wind Speed:', data.AWS, 'knots');
  console.log('Heel:', data.heel, 'degrees');
  console.log('Device:', data.deviceName);
  
  // New BNO080 sensor data (if available)
  if (data.HDM !== undefined) {
    console.log('Magnetic Heading:', data.HDM, 'degrees');
  }
  
  if (data.accelX !== undefined) {
    console.log('Acceleration:', {
      x: data.accelX,
      y: data.accelY, 
      z: data.accelZ
    }, 'm/s²');
  }
});

await sensorCharacteristic.startNotifications();

// Send commands to the device
async function setDeviceName(newName) {
  const command = {
    action: "setDeviceName",
    deviceName: newName
  };
  
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(command));
  await commandCharacteristic.writeValue(data);
  
  console.log(`Device name set to: ${newName}`);
}

async function resetHeelAngle() {
  const command = { action: "resetHeelAngle" };
  
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(command));
  await commandCharacteristic.writeValue(data);
  
  console.log('Heel angle reset (calibrated)');
}

// Example usage
await setDeviceName('Luna_Port_Side');
await resetHeelAngle();
```

## Hardware Components

- ESP32 DevKitC WROOM-32U (main controller with external antenna)
- NEO-7M GPS Module with external antenna
- Ultrasonic Wind Speed and Direction Sensor (RS485) - **Auto-detects sensor format**
- GY-BNO080 9-Axis IMU Sensor (I2C)
- RS485 to UART Converter Module

### Wind Sensor Compatibility

The system automatically detects and supports two different ultrasonic wind sensor formats:

- **IEEE754 Format**: 9600 baud, 8E1, registers 0x0001, IEEE 754 float encoding
- **Integer Format**: 4800 baud, 8N1, registers 0x0000, integer×100 encoding

Auto-detection occurs at startup by attempting communication with each format and validating the response data. Once detected, the system locks to the working format for optimal performance.

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
   
   - **BNO080 IMU Sensor**
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
       - SparkFun BNO080 Cortex Based IMU
       - TinyGPS++
       - ModbusMaster
     - Click "Add to Project" and select your project
   
   - Or through the CLI:
     ```bash
     pio pkg install --library "bblanchon/ArduinoJson"
     pio pkg install --library "sparkfun/SparkFun BNO080 Cortex Based IMU"
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

The Veetr Sailing Dashboard web application is hosted externally (not on the ESP32) to provide better performance and reliability. You can access it at:

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

1. Open the dashboard in Chrome (navigate to your hosted dashboard URL)
2. Tap the three-dot menu button in the top-right corner
3. Select "Add to Home screen" or "Install app" (the wording may vary)
4. If prompted, confirm by tapping "Add" or "Install"
5. The Luna app icon will appear on your home screen
6. Tap the icon to launch the app in full-screen mode

#### On Windows (Chrome/Edge)

1. Open the dashboard in Chrome or Edge (navigate to your hosted dashboard URL)
2. Look for the install icon in the address bar (a computer with a down arrow) or the three-dot menu
3. Click "Install Luna Sailing" or "Install app"
4. Confirm by clicking "Install" in the popup
5. The app will install and can be launched from the Start menu or desktop
6. You can also pin it to the taskbar for quick access

#### On macOS (Chrome)

1. Open the dashboard in Chrome (navigate to your hosted dashboard URL)
2. Click the three-dot menu in the top-right corner
3. Select "Install Luna Sailing..." or "Create shortcut..."
4. Choose whether to open as a window or tab
5. Click "Install" or "Create"
6. The app will be added to your Applications folder and can be launched from there

#### Benefits of Installing as a PWA

- **Easier Access**: Launch directly from your home screen without typing the URL
- **Full-Screen Experience**: No browser interface elements taking up space
- **Offline Interface**: The basic dashboard UI remains accessible even without connection (though live data requires BLE connection)
- **Automatic Reconnection**: The app will attempt to reconnect to the ESP32 when BLE connection is available
- **Better Performance**: Installed PWAs often have better performance than browser tabs

#### Troubleshooting PWA Installation

- **Install option not appearing**:
  - Make sure you've fully loaded the dashboard page
  - Try refreshing the page
  - Some browsers may require you to visit the site more than once before offering installation
  - Ensure the site is served over HTTPS
  
- **App not working after installation**:
  - Make sure the ESP32 is powered on and BLE is advertising
  - Try connecting to the ESP32 via BLE from the installed app
  - Check that Bluetooth is enabled on your device
  
- **App showing offline mode**:
  - This is normal if you're not connected to the ESP32 via BLE
  - The app interface remains available, but live data requires BLE connection
  - Connect to the ESP32 via BLE to start receiving data

### BLE Connection and Pairing

The Luna Sailing Dashboard uses Bluetooth Low Energy (BLE) for communication between the ESP32 and client devices. The system is designed to be robust and supports multiple simultaneous connections.

#### BLE Service Information

- **Device Name:** `Luna_Sailing`
- **Service UUID:** `12345678-1234-5678-9abc-def123456789`
- **Characteristic UUID:** `87654321-4321-8765-cba9-fedcba987654`
- **Data Rate:** ~1 Hz (every 1000ms)
- **Data Format:** JSON string with marine terminology

#### Initial Connection Process

1. **Power on the ESP32**
   - Connect to power source (USB or external power)
   - Wait 10-15 seconds for full system initialization
   - The ESP32 will start advertising as "Luna_Sailing"

2. **Activate Discovery Mode**
   - Press and hold the BOOT button (GPIO0) for 1+ seconds
   - The built-in LED (GPIO2) will turn on to indicate discovery mode is active
   - Device becomes discoverable to nearby BLE clients for 5 minutes
   - Range: typically 10-30 meters in open space

3. **Connect from Client Device**
   - Use a BLE-compatible browser or application
   - Search for "Luna_Sailing" in available BLE devices
   - Select device and confirm pairing
   - **Note**: Discovery mode expires after 5 minutes for security
   - Connection establishment takes 2-5 seconds

#### Sensor Initialization Status

The system performs sensor detection during startup:

- **GPS Module:** Always initialized (may take 30-90 seconds for first satellite fix)
- **Wind Sensor:** Automatically detected via RS485 communication
- **IMU Sensor:** Detected via I2C bus scan at startup
- **Missing Sensors:** System continues operation with available sensors only

#### Data Transmission

Once connected, the ESP32 automatically sends JSON data every 1 second:

- **Reliable Timing:** 1Hz transmission regardless of sensor status
- **Error Resilience:** Failed sensors don't interrupt data flow
- **Multi-Client:** Supports multiple simultaneous BLE connections
- **Low Latency:** Minimal delay between sensor reading and transmission

#### BLE Connection Management

**Automatic Reconnection:**
- Client applications should implement automatic reconnection
- ESP32 continues advertising after disconnections
- Previous pairing information is remembered

**Connection Stability:**
- Move closer to ESP32 if connection is unstable
- Avoid obstacles and interference sources
- Battery level affects BLE transmission power

**Multi-Device Support:**
- Multiple phones/tablets can connect simultaneously
- Each client receives independent data stream
- No limit on number of concurrent connections (within BLE stack limits)

#### BLE Discovery Security Mode

For enhanced security when deployed on boats, the ESP32 implements a button-activated discovery mode:

**Default Behavior:**
- BLE advertising is automatically disabled after 5 minutes of operation
- Device becomes "invisible" to BLE scanners for security
- Ideal for unattended deployment on boats in marinas or at anchor

**Manual Discovery Activation:**
- Press and hold the BOOT button (GPIO0) for 1+ seconds
- Built-in LED (GPIO2) turns on to confirm discovery mode is active
- BLE advertising enabled for exactly 5 minutes
- Press BOOT button again to deactivate early if needed

**Security Benefits:**
- Prevents unauthorized BLE scanning when device is unattended
- Perfect for marine environments where device may be left alone for hours/days
- Only advertises when intentionally activated by user
- Visual LED confirmation prevents accidental activation

### BLE Troubleshooting

#### Common BLE Connection Issues

- **Can't find the Luna_Sailing BLE device**
  - **First**: Press and hold the BOOT button (GPIO0) for 1+ seconds to activate discovery mode
  - Verify the built-in LED (GPIO2) turns on (discovery mode active)
  - Make sure the ESP32 is powered on and fully booted (wait 15-20 seconds)
  - Try restarting the ESP32 by pressing the reset button
  - Move closer to the ESP32 - BLE range is typically 10-30 meters in open space
  - Ensure you're using a supported browser (Chrome, Edge, or Opera)
  - Check that Bluetooth is enabled on your device
  - **Remember**: Discovery mode expires after 5 minutes - press BOOT button again if needed

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

#### Sensor-Specific Troubleshooting

- **GPS shows no satellites or zero speed**
  - Ensure GPS antenna has clear view of sky
  - Move away from buildings, trees, or other obstructions
  - GPS requires 30-90 seconds for initial satellite acquisition
  - Check that GPS module is properly connected to pins 16/17

- **Wind data not appearing in JSON**
  - Verify wind sensor is connected to RS485 converter
  - Check RS485 converter connections to ESP32 pins 32/33
  - Ensure wind sensor has proper power supply (typically 12V)
  - Check serial console for auto-detection messages during startup
  - System automatically tries both IEEE754 and integer formats
  - Wind sensor data only appears in JSON when sensor is detected and working
  - If auto-detection fails, verify Modbus address is set to 1 on the sensor

- **Heel angle not appearing in JSON**
  - Verify BNO080 IMU sensor is connected to I2C pins 21/22
  - Check that IMU sensor has proper power supply (3.3V)
  - Heel data only appears in JSON when IMU sensor is detected at startup
  - If IMU sensor fails after startup, heel data will stop appearing

- **JSON missing expected fields**
  - This is normal behavior - fields are omitted if sensors are not available
  - Only GPS fields (SOG, COG, lat, lon, satellites, hdop) and RSSI are always present
  - Wind fields (AWS, AWD) only appear when wind sensor is connected
  - Heel field only appears when IMU sensor is detected and working

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

#### IMU Sensor (BNO080)

1. **Calibration Process**
   - The BNO080 IMU sensor has built-in calibration algorithms that continuously calibrate the sensor
   - For manual calibration reset:
     1. Position the ESP32 and IMU sensor in a perfectly level position
     2. Navigate to the dashboard's Settings tab
     3. Click "Calibrate IMU Sensor"
     4. Wait for the calibration to complete (about 5 seconds)
     5. The calibration values are stored in the ESP32's flash memory

2. **Sensor Fusion Features**
   - The BNO080 provides automatic sensor fusion combining accelerometer, gyroscope, and magnetometer data
   - Built-in drift compensation and noise filtering
   - Quaternion output for precise orientation tracking
   - No manual calibration typically required for basic tilt measurements

3. **Mounting Considerations**
   - Mount the IMU sensor with the X-axis aligned with the fore-aft axis of the boat
   - The Y-axis should be aligned with the port-starboard axis
   - The Z-axis should be pointing upward
   - The BNO080's sensor fusion algorithms can compensate for minor mounting misalignments
   - For best results, mount rigidly to minimize vibration effects

#### Wind Sensor

1. **Auto-Detection**
   - The system automatically detects your wind sensor format at startup
   - Supports both IEEE754 float (9600,8E1) and integer (4800,8N1) formats
   - No manual configuration required - the system tests both formats and locks to the working one
   - Detection status is shown in the serial console during startup

2. **Supported Formats**
   - **IEEE754 Format**: 9600 baud, 8E1, registers 0x0001, speed as IEEE 754 float
   - **Integer Format**: 4800 baud, 8N1, registers 0x0000, speed as integer×100

3. **Calibration**
   - The ultrasonic wind sensor should be calibrated according to manufacturer instructions
   - Most sensors require physical calibration at installation (aligning to boat's centerline)
   - No software calibration is typically needed as readings are absolute
     const int WIND_UPDATE_RATE = 1000;    // Update rate in milliseconds
     const int WIND_SENSOR_BAUDRATE = 9600; // Baud rate for RS485 communication
     ```

3. **Mounting Position**
   - Mount the wind sensor at the highest practical point for accurate readings
   - Ensure it's away from obstructions that could cause wind shadow or turbulence
   - For powerboats or when running with engines, be aware that exhaust gases can affect readings

### Project Structure

- `/src`: Main C++ code for ESP32 (BLE server using NimBLE-Arduino and sensor management)
- `/data/www`: Web dashboard files (legacy - now hosted externally)
  - `/css`: Stylesheets
  - `/js`: JavaScript files (including BLE connection logic)
  - `/images`: Icons and graphics
- `/include`: Header files and sensor documentation
- `/lib`: Libraries
- `/platformio.ini`: Build configuration with NimBLE-Arduino library

**Note:** The `/data/www` folder contains the web application files for reference and local development, but in the new BLE architecture, these files should be hosted externally (e.g., GitHub Pages) rather than uploaded to the ESP32's filesystem.

**Key Code Files:**
- `src/main.cpp`: Main ESP32 firmware with BLE server, sensor management, and JSON API
- Uses NimBLE-Arduino for efficient BLE communication
- Implements robust error handling for missing or failed sensors
- Provides standardized marine JSON API over BLE notifications

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

The Luna Sailing Dashboard is designed to operate efficiently on battery power, making it suitable for extended use on sailing vessels without constant shore power. The migration to BLE significantly improves power efficiency over the previous WiFi-based design.

### Power Requirements

- **ESP32 Power Consumption (BLE Mode)**:
  - Normal operation (BLE active): ~60-80mA @ 5V (~0.3-0.4W)
  - Deep sleep mode: ~10μA @ 5V (negligible)
  - **BLE Advantage**: Uses ~50% less power than WiFi Access Point mode
  - **NimBLE Efficiency**: NimBLE-Arduino library provides additional power savings
  
- **Sensor Power Requirements**:
  - GPS Module: ~50mA @ 3.3V
  - BNO080 IMU Sensor: ~0.5mA @ 3.3V (when present)
  - Wind Sensor: Varies by model, typically 100-300mA @ 5-12V
  
- **Total System**:
  - Typical consumption: ~140-180mA @ 5V (0.7-0.9W)
  - With 10Ah power bank: approximately 40-50 hours of operation
  - **Significant improvement** over WiFi-based design

### Battery Connection Options

1. **Direct USB Power Bank**:
   - Simplest solution for mobile/temporary installations
   - Connect standard USB power bank to ESP32's micro-USB port
   - No additional components required
   - Recommended capacity: 10Ah or higher for multi-day operation

2. **Boat 12V System Integration**:
   - Requires 12V to 5V voltage regulator/converter
   - Recommended: Buck converter with at least 1A output capacity
   - Connect output to ESP32's 5V and GND pins (not via USB)
   - Add power switch and fuse for safety
   - Enables permanent installation with boat's electrical system

3. **Solar Power Option**:
   - Small 5W-10W solar panel
   - Solar charge controller (MPPT preferred)
   - 3.7V LiPo battery (3000mAh or larger recommended)
   - LiPo to 5V boost converter
   - Can provide continuous operation in sunny conditions
   - Ideal for remote installations or extended cruising

### Power-Saving Features

1. **BLE Power Efficiency**:
   - NimBLE-Arduino library optimized for low power consumption
   - Automatic connection interval management
   - Efficient multi-client support without power penalty
   - No WiFi radio power consumption

2. **Sensor Error Handling**:
   - Failed sensors don't cause power-consuming retry loops
   - I2C and RS485 timeouts prevent blocking operations
   - Graceful degradation maintains power efficiency

3. **Optimized Update Intervals**:
   - 1Hz data transmission balances responsiveness with power efficiency
   - GPS and sensor polling optimized for power consumption
   - No continuous polling of failed sensors

### Power Monitoring

The system provides power-related information:

- **BLE RSSI**: Indicates signal strength, which correlates with power consumption
- **Sensor Status**: Missing sensors automatically reduce power consumption
- **Connection Status**: Monitor multiple BLE connections for power impact

### Battery Life Estimates

**With 10Ah USB Power Bank:**
- GPS + BLE only: ~50-60 hours
- GPS + BLE + IMU Sensor: ~45-55 hours  
- GPS + BLE + Wind Sensor: ~30-40 hours
- All sensors active: ~25-35 hours

**With 12V Boat System:**
- Continuous operation with proper sizing
- Recommended: 5A circuit breaker
- Typical load: 0.5-1A @ 12V including sensors

### Power-Saving Tips

1. **Optimize Connection Intervals**:
   - Modern BLE clients can negotiate efficient connection intervals
   - Lower connection intervals increase power consumption
   - 1Hz data rate is optimal balance of responsiveness and efficiency

2. **Sensor Configuration**:
   - Disable unused sensors to save power
   - Wind sensor is typically the highest power consumer
   - GPS power consumption is relatively constant

3. **Installation Considerations**:
   - Good BLE signal strength reduces power consumption
   - Avoid obstacles between ESP32 and client devices
   - Consider ESP32 placement for optimal antenna performance

## Acknowledgments

- [ESP32 Arduino Core](https://github.com/espressif/arduino-esp32)
- [ESPAsyncWebServer](https://github.com/me-no-dev/ESPAsyncWebServer)
- [Chart.js](https://www.chartjs.org/)
- [ArduinoJson](https://arduinojson.org/)