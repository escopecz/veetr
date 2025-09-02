# Veetr Sailing Dashboard - User Setup Guide

Step-by-step instructions for sailors to get their Veetr sailing dashboard up and running.

## What You Need 🛒

### Required Hardware:
See the **[Hardware Guide](./HARDWARE.md)** for detailed specifications and purchase links.

### Supported Devices:
- **iPhone/iPad**: Must use [Bluefy - Web BLE Browser](https://apps.apple.com/app/bluefy-web-ble-browser/id1492822055) (Safari doesn't support Bluetooth)
- **Android**: Any device with Chrome, Edge, or Opera browser
- **Computer**: Windows, Mac, or Linux with Chrome, Edge, or Opera

## Setup Steps 🔧

### 1. Get Veetr Dashboard App

**Visit the web app**: https://escopecz.github.io/veetr

**Install as a real app (recommended):**

**📱 iPhone/iPad (iOS):**
- **Important**: iOS Safari doesn't support Web Bluetooth
- **Download**: [Bluefy - Web BLE Browser](https://apps.apple.com/app/bluefy-web-ble-browser/id1492822055) from App Store
- **Open**: https://escopecz.github.io/veetr in Bluefy
- Sadly, iOS users will get the worst experience due to the OS limitations. We should fix that with a custom app in the future.

**📱 Android Phone/Tablet:**
- **Open**: Chrome browser (pre-installed)
- **Visit**: https://escopecz.github.io/veetr
- **Install**: Tap menu (⋮) → "Add to Home screen" → "Add"
- **Alternative**: Look for "Install app" banner at bottom of screen

**💻 Windows Computer:**
- **Open**: Chrome or Edge browser
- **Visit**: https://escopecz.github.io/veetr
- **Install**: Click install icon (⊞) in address bar → "Install"
- **Alternative**: Click menu (⋮) → "Install Veetr..."

**💻 Mac Computer:**
- **Open**: Chrome, Edge, or Safari browser
- **Visit**: https://escopecz.github.io/veetr
- **Chrome/Edge**: Click install icon (⊞) in address bar → "Install"
- **Safari**: Click Share → "Add to Dock"

**💻 Linux Computer:**
- **Open**: Chrome, Chromium, or Firefox browser
- **Visit**: https://escopecz.github.io/veetr
- **Chrome/Chromium**: Click install icon (⊞) in address bar → "Install"
- **Firefox**: Click menu → "Install this site as an app"

### 2. Prepare the Veetr device

1. Connect the GPS antenna
2. Connect the BLE (Bluetooth Low Energy) antenna
2. Connect the wind sensor via the JST connector

### 3. Connect to Your Boat 🔗

**First Time Setup:**
1. **Power on the Veetr device** (connect to a powerbank via USB C)
2. **Activate Discovery Mode**: The device is in the discovery mode 5 minutes after start
3. **Check Status**: The built-in blue LED turn on when the discovery mode active. It turns off after 5 minutes for security.
4. **Open Dashboard**: Launch the Veetr app on your device
5. **Connect**: Tap **"Connect"** button
6. **Select Device**: Choose "Veetr" from the Bluetooth list
7. **Start Sailing**: Watch your real-time sailing data! ⛵

**Daily Use:**
- Discovery mode turns off automatically after 5 minutes for security
- Press BOOT button again anytime to reconnect
- You have to connect the device in the app again.

### Calibration

Once your Veetr is connected and showing data, you'll want to calibrate it for accurate readings.

#### **Heel Angle Calibration** ⚖️

You don't have to mount the Veetr device exactly level to the boat. Mount it firmly though so it doesn't move so the calibration actually lasts. It must at the same position every time. Otherwise you'll have to re-calibrate.

**When to calibrate**: When your boat is completely level (flat water, no wind pressure)

1. **Level your boat**: Find calm water or secure the boat level at dock/mooring
2. **Open Settings**: In the Veetr dashboard, go to Settings tab
3. **Calibrate**: Click the "Vessel is level" button
4. **Wait**: Allow 5 seconds for calibration to complete
5. **Done**: The heel angle will now show 0° when your boat is level

**Why important**: Sets the "zero point" so heel angles are accurate relative to your boat's level position.

#### **Wind Direction Calibration** 💨
**When to calibrate**: After mounting the wind sensor

1. **Mount correctly**: Install wind sensor with arrow pointing toward bow (front) of boat

**Why important**: Ensures wind direction readings are relative to your boat's heading.

#### **Compass Calibration** 🧭
**Manual calibration required**: Set your compass north reference for accurate heading readings

1. **Point to North**: Turn your boat so the bow (front) points toward magnetic north
2. **Open Settings**: In the Veetr dashboard, go to Settings tab
3. **Calibrate**: Click "Set Compass North" button
4. **Confirm**: The app will ask for confirmation - press OK
5. **Done**: Your current heading is now set as north (0°)

**Why important**: Sets the magnetic north reference so compass headings are accurate relative to true directions.

#### **GPS Calibration** 🛰️
**Automatic**: GPS requires no calibration
- **External antenna required**: Connect the provided GPS antenna to the Veetr device
- **Antenna positioning**: Mount GPS antenna pointing upward with clear view of sky
- **Avoid obstructions**: Keep away from metal surfaces, masts, and cabin tops that block satellite signals
- **Satellite acquisition**: Allow 1-2 minutes for initial GPS lock after positioning antenna
- **No manual steps**: GPS automatically provides accurate position and speed data

**Understanding GPS Readings in the App:**
- **SAT**: Number of satellites currently connected (4+ needed for good position fix)
- **HDOP**: Horizontal Dilution of Precision - GPS accuracy indicator
  - **1.0-2.0**: Excellent accuracy (±1-3 meters)
  - **2.0-5.0**: Good accuracy (±3-7 meters) 
  - **5.0+**: Poor accuracy (±10+ meters) - reposition external antenna for better sky view
- **LAT/LON**: Your current position coordinates

## Troubleshooting 🔧

### Dashboard Won't Connect:
- ✅ **iPhone/iPad**: Must use [Bluefy browser](https://apps.apple.com/app/bluefy-web-ble-browser/id1492822055), not Safari
- ✅ **Android/Computer**: Use **Chrome, Edge, or Opera** (not Safari/Firefox)
- ✅ Press BOOT button on ESP32 to activate discovery mode
- ✅ Check that ESP32 LED is on (discovery mode active)
- ✅ Try refreshing the dashboard page

### No Sensor Data:
- ✅ Check all sensor wiring connections
- ✅ Verify 5V power supply is connected to wind sensor. The red LED is on when the device is powered up
- ✅ Make sure sensors are properly mounted (wind sensor needs clear 360° view)

### Wind direction is wrong
- ✅ Make sure the wind sensor is mounted by the arrow pointing to the bow of the boat.

### GPS Not Working:
- ✅ GPS is optional and may not be connected yet
- ✅ Check for clear sky view (GPS needs satellite signals)
- ✅ Wait 1-2 minutes for GPS to acquire satellites
