// BLE connection and data handling for Luna Sailing Dashboard

// BLE connection state
let bleDevice = null;
let bleServer = null;
let sensorDataCharacteristic = null;
let commandCharacteristic = null;
let isConnected = false;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const reconnectInterval = 3000; // 3 seconds
const connectionStatus = document.getElementById('connection-status');

// BLE Service and Characteristic UUIDs (must match ESP32)
const SERVICE_UUID = '12345678-1234-1234-1234-123456789abc';
const SENSOR_DATA_UUID = '87654321-4321-4321-4321-cba987654321';
const COMMAND_UUID = '11111111-2222-3333-4444-555555555555';

// Expose BLE state globally for other scripts
window.getBLEState = function() {
    return {
        device: bleDevice,
        isConnected: isConnected,
        sendCommand: sendBLECommand
    };
};

// Initialize BLE connection
async function initBLE() {
    try {
        console.log('Requesting BLE device...');
        connectionStatus.textContent = 'Connecting to BLE...';
        connectionStatus.className = 'connecting';
        
        // Request BLE device with Luna Sailing service
        bleDevice = await navigator.bluetooth.requestDevice({
            filters: [{
                name: 'Luna_Sailing'
            }],
            optionalServices: [SERVICE_UUID]
        });
        
        bleDevice.addEventListener('gattserverdisconnected', onBLEDisconnected);
        
        // Connect to the device
        bleServer = await bleDevice.gatt.connect();
        console.log('BLE device connected');
        
        // Get the service
        const service = await bleServer.getPrimaryService(SERVICE_UUID);
        
        // Get characteristics
        sensorDataCharacteristic = await service.getCharacteristic(SENSOR_DATA_UUID);
        commandCharacteristic = await service.getCharacteristic(COMMAND_UUID);
        
        // Start notifications for sensor data
        await sensorDataCharacteristic.startNotifications();
        sensorDataCharacteristic.addEventListener('characteristicvaluechanged', handleSensorData);
        
        onBLEConnected();
        
    } catch (error) {
        console.error('BLE connection failed:', error);
        connectionStatus.textContent = 'BLE connection failed: ' + error.message;
        connectionStatus.className = 'disconnected';
    }
}

// Handle BLE connection
function onBLEConnected() {
    console.log('BLE connection established');
    connectionStatus.textContent = 'Connected via BLE';
    connectionStatus.className = 'connected';
    isConnected = true;
    reconnectAttempts = 0;
    
    console.log('BLE characteristics ready for data reception');
}

// Handle BLE disconnection
function onBLEDisconnected() {
    console.log('BLE device disconnected');
    connectionStatus.textContent = 'BLE Disconnected';
    connectionStatus.className = 'disconnected';
    isConnected = false;
    bleServer = null;
    sensorDataCharacteristic = null;
    commandCharacteristic = null;
    
    // Attempt to reconnect
    if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        console.log(`Attempting to reconnect (${reconnectAttempts}/${maxReconnectAttempts})...`);
        setTimeout(initBLE, reconnectInterval);
    } else {
        console.log('Max reconnect attempts reached');
        connectionStatus.textContent = 'Offline';
    }
}

// Handle incoming sensor data from ESP32
function handleSensorData(event) {
    try {
        const value = new TextDecoder().decode(event.target.value);
        console.log('[BLE] Raw data received (' + value.length + ' bytes):', value);
        
        // Check if JSON looks truncated
        if (!value.endsWith('}')) {
            console.warn('[BLE] Data appears truncated (no closing brace)');
        }
        
        const data = JSON.parse(value);
        
        console.log('Received sensor data via BLE:', data);
        updateDashboard(data);
        
    } catch (error) {
        console.error('Error parsing BLE sensor data:', error);
        const rawValue = new TextDecoder().decode(event.target.value);
        console.error('Raw data was:', rawValue);
        console.error('Data length:', rawValue.length);
    }
}

// Send command to ESP32 via BLE
async function sendBLECommand(command) {
    if (!isConnected || !commandCharacteristic) {
        console.error('BLE not connected or command characteristic not available');
        return false;
    }
    
    try {
        const commandStr = JSON.stringify(command);
        const encoder = new TextEncoder();
        await commandCharacteristic.writeValue(encoder.encode(commandStr));
        console.log('BLE command sent:', command);
        return true;
    } catch (error) {
        console.error('Error sending BLE command:', error);
        return false;
    }
}

// Get the current refresh rate setting
function getRefreshRate() {
    const refreshRateInput = document.getElementById('refresh-rate');
    return parseFloat(refreshRateInput.value);
}

// Update the dashboard with received data (handles compact JSON keys)
function updateDashboard(data) {
    console.log('[DEBUG] Raw data received:', data);
    
    // Map compact keys to original names for compatibility
    const mappedData = {
        speed: data.spd || 0,
        speedMax: data.spdMax || 0,
        speedAvg: data.spdAvg || 0,
        windSpeed: data.wSpd || 0,
        windSpeedMax: data.wSpdMax || 0,
        windSpeedAvg: data.wSpdAvg || 0,
        windDirection: data.wDir || 0,
        trueWindSpeed: data.twSpd || 0,
        trueWindSpeedMax: data.twSpdMax || 0,
        trueWindSpeedAvg: data.twSpdAvg || 0,
        trueWindDirection: data.twDir || 0,
        tilt: data.tilt || 0,
        tiltPortMax: data.tiltPMax || 0,
        tiltStarboardMax: data.tiltSMax || 0,
        deadWindAngle: data.deadWind || 40,
        gpsSpeed: data.gSpd || 0,
        gpsSatellites: data.gSat || 0
    };
    
    console.log('[DEBUG] Mapped data:', mappedData);
    
    // Use original update logic with mapped data
    updateDashboardOriginal(mappedData);
}

// Original dashboard update function (renamed)
function updateDashboardOriginal(data) {
    console.log('[DEBUG] updateDashboardOriginal called with:', data);
    
    // Update speed data
    // Show N/A if GPS speed is too low or invalid
    const SPEED_THRESHOLD = 0.5; // knots
    let displaySpeed = null;
    
    console.log('[DEBUG] GPS Speed:', data.gpsSpeed, 'Speed:', data.speed);
    
    if (data.gpsSpeed !== undefined && data.gpsSpeed !== null && !isNaN(data.gpsSpeed)) {
        if (data.gpsSpeed >= SPEED_THRESHOLD) {
            displaySpeed = data.gpsSpeed;
            const speedElement = document.getElementById('speed-value');
            if (speedElement) {
                speedElement.textContent = data.gpsSpeed.toFixed(1);
                console.log('[DEBUG] Updated speed-value element to:', data.gpsSpeed.toFixed(1));
            } else {
                console.error('[DEBUG] speed-value element not found!');
            }
        } else {
            displaySpeed = null;
            const speedElement = document.getElementById('speed-value');
            if (speedElement) {
                speedElement.textContent = 'N/A';
            }
        }
    } else if (data.speed !== undefined && data.speed !== null && !isNaN(data.speed)) {
        if (data.speed >= SPEED_THRESHOLD) {
            displaySpeed = data.speed;
            const speedElement = document.getElementById('speed-value');
            if (speedElement) {
                speedElement.textContent = data.speed.toFixed(1);
                console.log('[DEBUG] Updated speed-value element to:', data.speed.toFixed(1));
            } else {
                console.error('[DEBUG] speed-value element not found!');
            }
        } else {
            displaySpeed = null;
            const speedElement = document.getElementById('speed-value');
            if (speedElement) {
                speedElement.textContent = 'N/A';
            }
        }
    } else {
        const speedElement = document.getElementById('speed-value');
        if (speedElement) {
            speedElement.textContent = 'N/A';
        }
    }
    
    if (data.speedMax !== undefined && data.speedMax !== null && !isNaN(data.speedMax)) {
        const speedMaxElement = document.getElementById('speed-max');
        if (speedMaxElement) {
            speedMaxElement.textContent = data.speedMax.toFixed(1);
        }
    } else {
        const speedMaxElement = document.getElementById('speed-max');
        if (speedMaxElement) {
            speedMaxElement.textContent = 'N/A';
        }
    }
    if (data.speedAvg !== undefined && data.speedAvg !== null && !isNaN(data.speedAvg)) {
        const speedAvgElement = document.getElementById('speed-avg');
        if (speedAvgElement) {
            speedAvgElement.textContent = data.speedAvg.toFixed(1);
        }
    } else {
        const speedAvgElement = document.getElementById('speed-avg');
        if (speedAvgElement) {
            speedAvgElement.textContent = 'N/A';
        }
    }
    
    // Pass max and avg to the gauge update function, use 0 if displaySpeed is null
    console.log('[DEBUG] Calling updateSpeedGauge with:', displaySpeed !== null ? displaySpeed : 0, data.speedMax, data.speedAvg);
    
    // Check if the function exists before calling it
    if (typeof updateSpeedGauge === 'function') {
        updateSpeedGauge(displaySpeed !== null ? displaySpeed : 0, data.speedMax, data.speedAvg);
    } else {
        console.error('[DEBUG] updateSpeedGauge function not found!');
    }

    // Show satellite count in the top right of the speed widget
    if (data.gpsSatellites !== undefined) {
        const satElem = document.getElementById('satellite-count');
        if (satElem) {
            satElem.textContent = `🛰️ ${data.gpsSatellites}`;
            satElem.title = `${data.gpsSatellites} satellites`;
        }
    }
    
    // Update wind data
    const windSpeedElement = document.getElementById('wind-speed-value');
    if (windSpeedElement) {
        if (data.windSpeed !== undefined && data.windSpeed !== null && !isNaN(data.windSpeed)) {
            windSpeedElement.textContent = data.windSpeed.toFixed(1);
        } else {
            windSpeedElement.textContent = 'N/A';
        }
    } else {
        console.error('[DEBUG] wind-speed-value element not found!');
    }
    
    // Update true wind data if available
    const trueWindSpeedElement = document.getElementById('true-wind-speed-value');
    if (trueWindSpeedElement) {
        if (data.trueWindSpeed !== undefined && data.trueWindSpeed !== null && !isNaN(data.trueWindSpeed)) {
            trueWindSpeedElement.textContent = data.trueWindSpeed.toFixed(1);
        } else {
            trueWindSpeedElement.textContent = 'N/A';
        }
    } else {
        console.error('[DEBUG] true-wind-speed-value element not found!');
    }
    // Set dead wind angle from ESP32 if present
    if (typeof data.deadWindAngle === 'number' && !isNaN(data.deadWindAngle)) {
        if (typeof window.setDeadWindAngleFromESP === 'function') {
            window.setDeadWindAngleFromESP(data.deadWindAngle);
        }
    }
    // Pass wind speed and max/avg values to the update function, including true wind data
    if (typeof updateWindDirection === 'function') {
        updateWindDirection(
            data.windDirection,
            data.windSpeed,
            data.windSpeedMax,
            data.windSpeedAvg,
            data.trueWindSpeed,
            data.trueWindDirection
        );
    } else {
        console.error('[DEBUG] updateWindDirection function not found!');
    }
    
    // Update tilt data
    // No more tilt-value element, handled by updateTiltGauge
    if (data.tiltPortMax !== undefined && data.tiltPortMax !== null && !isNaN(data.tiltPortMax)) {
        document.getElementById('tilt-port-max').textContent = Math.abs(data.tiltPortMax).toFixed(1);
    } else {
        document.getElementById('tilt-port-max').textContent = 'N/A';
    }
    if (data.tiltStarboardMax !== undefined && data.tiltStarboardMax !== null && !isNaN(data.tiltStarboardMax)) {
        document.getElementById('tilt-starboard-max').textContent = data.tiltStarboardMax.toFixed(1);
    } else {
        document.getElementById('tilt-starboard-max').textContent = 'N/A';
    }
    if (data.tilt !== undefined && data.tilt !== null && !isNaN(data.tilt)) {
        updateTiltGauge(data.tilt);
    } else {
        updateTiltGauge(0); // fallback to 0 if invalid
    }
}

// Initialize BLE on page load
document.addEventListener('DOMContentLoaded', () => {
    // Check if BLE is supported
    if (!navigator.bluetooth) {
        console.error('Web Bluetooth API is not supported in this browser');
        connectionStatus.textContent = 'BLE not supported';
        connectionStatus.className = 'disconnected';
        return;
    }
    
    // Add connect button functionality
    const connectButton = document.createElement('button');
    connectButton.textContent = 'Connect to Luna Sailing';
    connectButton.id = 'ble-connect-button';
    connectButton.addEventListener('click', initBLE);
    
    // Insert connect button after connection status
    connectionStatus.parentNode.insertBefore(connectButton, connectionStatus.nextSibling);
    
    // Set up refresh rate change listener
    const refreshRateInput = document.getElementById('refresh-rate');
    const refreshRateValue = document.getElementById('refresh-rate-value');
    
    if (refreshRateInput && refreshRateValue) {
        refreshRateInput.addEventListener('input', () => {
            refreshRateValue.textContent = refreshRateInput.value;
        });
    }
    
    // Start with ready to connect state
    connectionStatus.textContent = 'Ready to connect';
    connectionStatus.className = 'disconnected';
});
