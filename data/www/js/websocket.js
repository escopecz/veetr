// WebSocket connection and data handling for Luna Sailing Dashboard

// WebSocket connection
let socket;
let isConnected = false;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const reconnectInterval = 3000; // 3 seconds
const connectionStatus = document.getElementById('connection-status');

// Expose WebSocket state globally for other scripts
window.getWebSocketState = function() {
    return {
        socket: socket,
        isConnected: isConnected,
        readyState: socket ? socket.readyState : WebSocket.CLOSED
    };
};

// Initialize WebSocket connection
function initWebSocket() {
    // Get the host from the current URL
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws`;
    
    console.log('Connecting to WebSocket:', wsUrl);
    connectionStatus.textContent = 'Connecting...';
    connectionStatus.className = 'connecting';
    
    socket = new WebSocket(wsUrl);
    
    // WebSocket event listeners
    socket.onopen = onSocketOpen;
    socket.onclose = onSocketClose;
    socket.onerror = onSocketError;
    socket.onmessage = onSocketMessage;
}

// Handle WebSocket open event
function onSocketOpen() {
    console.log('WebSocket connection established');
    connectionStatus.textContent = 'Connected';
    connectionStatus.className = 'connected';
    isConnected = true;
    reconnectAttempts = 0;
    
    // Subscribe to data updates
    socket.send(JSON.stringify({
        action: 'subscribe',
        refreshRate: getRefreshRate()
    }));
}

// Handle WebSocket close event
function onSocketClose() {
    console.log('WebSocket connection closed');
    connectionStatus.textContent = 'Disconnected';
    connectionStatus.className = 'disconnected';
    isConnected = false;
    
    // Attempt to reconnect
    if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        console.log(`Attempting to reconnect (${reconnectAttempts}/${maxReconnectAttempts})...`);
        setTimeout(initWebSocket, reconnectInterval);
    } else {
        console.log('Max reconnect attempts reached');
        connectionStatus.textContent = 'Offline';
    }
}

// Handle WebSocket error event
function onSocketError(error) {
    console.error('WebSocket error:', error);
}

// Handle WebSocket message event
function onSocketMessage(event) {
    try {
        const data = JSON.parse(event.data);
        
        // Handle WiFi restart notification
        if (data.action === 'wifiRestart') {
            handleWiFiRestart(data);
        } else if (data.action === 'factoryReset') {
            handleFactoryReset(data);
        } else {
            updateDashboard(data);
        }
    } catch (error) {
        console.error('Error parsing WebSocket message:', error);
    }
}

// Get the current refresh rate setting
function getRefreshRate() {
    const refreshRateInput = document.getElementById('refresh-rate');
    return parseFloat(refreshRateInput.value);
}

// Update refresh rate when changed
function updateRefreshRate() {
    if (isConnected) {
        socket.send(JSON.stringify({
            action: 'updateSettings',
            refreshRate: getRefreshRate()
        }));
    }
}

// Update WiFi settings
function updateWiFiSettings(ssid, password) {
    if (isConnected) {
        socket.send(JSON.stringify({
            action: 'updateWiFi',
            ssid: ssid,
            password: password
        }));
        console.log('WiFi settings sent to ESP32');
    } else {
        console.error('Cannot update WiFi settings - not connected to WebSocket');
        alert('Cannot update WiFi settings - not connected to device');
    }
}

// Handle WiFi restart notification
function handleWiFiRestart(data) {
    console.log('WiFi is restarting with new settings:', data);
    
    // Show user notification
    const newSSID = data.ssid;
    const security = data.security;
    
    // Create notification message
    let message = `WiFi settings applied successfully!\n\n`;
    message += `New Network: ${newSSID}\n`;
    message += `Security: ${security}\n\n`;
    
    if (newSSID !== getCurrentSSID()) {
        message += `⚠️ Network name has changed!\n\n`;
        message += `To continue using the dashboard:\n`;
        message += `1. Disconnect from current WiFi\n`;
        message += `2. Connect to "${newSSID}"\n`;
        message += `3. Reload this page\n\n`;
        message += `The page will close in 5 seconds.`;
        
        alert(message);
        
        // Close the page after 5 seconds
        setTimeout(() => {
            window.close();
        }, 5000);
    } else {
        message += `You may be temporarily disconnected while WiFi restarts.`;
        alert(message);
    }
    
    // Update connection status
    connectionStatus.textContent = 'WiFi Restarting';
    connectionStatus.className = 'connecting';
    
    // Stop trying to reconnect for a while to let WiFi restart
    reconnectAttempts = maxReconnectAttempts;
    
    // Reset reconnection after 10 seconds
    setTimeout(() => {
        reconnectAttempts = 0;
        if (!isConnected) {
            initWebSocket();
        }
    }, 10000);
}

// Handle factory reset notification
function handleFactoryReset(data) {
    console.log('Factory reset performed');
    
    // Show user notification
    let message = `🔄 Factory Reset Complete!\n\n`;
    message += `All settings have been restored to defaults:\n`;
    message += `• Network: Luna_Sailing (open network)\n`;
    message += `• All sensor data cleared\n`;
    message += `• WiFi password removed\n\n`;
    message += `⚠️ Security Warning:\n`;
    message += `The network is now open (no password).\n`;
    message += `Configure a secure password through Settings.\n\n`;
    message += `The page will reload automatically.`;
    
    alert(message);
    
    // Clear any stored WiFi settings
    localStorage.removeItem('wifiSSID');
    localStorage.removeItem('wifiPassword');
    
    // Update connection status
    connectionStatus.textContent = 'Factory Reset - Reloading';
    connectionStatus.className = 'connecting';
    
    // Reload the page after a short delay
    setTimeout(() => {
        window.location.reload();
    }, 3000);
}

// Get current SSID from localStorage
function getCurrentSSID() {
    return localStorage.getItem('wifiSSID') || 'Luna_Sailing';
}

// Update the dashboard with received data
function updateDashboard(data) {
    // Update speed data
    // Show N/A if GPS speed is too low or invalid
    const SPEED_THRESHOLD = 0.5; // knots
    let displaySpeed = null;
    if (data.gpsSpeed !== undefined && data.gpsSpeed !== null && !isNaN(data.gpsSpeed)) {
        if (data.gpsSpeed >= SPEED_THRESHOLD) {
            displaySpeed = data.gpsSpeed;
            document.getElementById('speed-value').textContent = data.gpsSpeed.toFixed(1);
        } else {
            displaySpeed = null;
            document.getElementById('speed-value').textContent = 'N/A';
        }
    } else if (data.speed !== undefined && data.speed !== null && !isNaN(data.speed)) {
        if (data.speed >= SPEED_THRESHOLD) {
            displaySpeed = data.speed;
            document.getElementById('speed-value').textContent = data.speed.toFixed(1);
        } else {
            displaySpeed = null;
            document.getElementById('speed-value').textContent = 'N/A';
        }
    } else {
        document.getElementById('speed-value').textContent = 'N/A';
    }
    if (data.speedMax !== undefined && data.speedMax !== null && !isNaN(data.speedMax)) {
        document.getElementById('speed-max').textContent = data.speedMax.toFixed(1);
    } else {
        document.getElementById('speed-max').textContent = 'N/A';
    }
    if (data.speedAvg !== undefined && data.speedAvg !== null && !isNaN(data.speedAvg)) {
        document.getElementById('speed-avg').textContent = data.speedAvg.toFixed(1);
    } else {
        document.getElementById('speed-avg').textContent = 'N/A';
    }
    // Pass max and avg to the gauge update function, use 0 if displaySpeed is null
    updateSpeedGauge(displaySpeed !== null ? displaySpeed : 0, data.speedMax, data.speedAvg);

    // Show satellite count in the top right of the speed widget
    if (data.gpsSatellites !== undefined) {
        const satElem = document.getElementById('satellite-count');
        if (satElem) {
            satElem.textContent = `🛰️ ${data.gpsSatellites}`;
            satElem.title = `${data.gpsSatellites} satellites`;
        }
    }
    
    // Update wind data
    if (data.windSpeed !== undefined && data.windSpeed !== null && !isNaN(data.windSpeed)) {
        document.getElementById('wind-speed-value').textContent = data.windSpeed.toFixed(1);
    } else {
        document.getElementById('wind-speed-value').textContent = 'N/A';
    }
    if (data.windDirection !== undefined && data.windDirection !== null && !isNaN(data.windDirection)) {
        document.getElementById('wind-dir-value').textContent = data.windDirection.toFixed(0);
    } else {
        document.getElementById('wind-dir-value').textContent = 'N/A';
    }
    // Update true wind data if available
    if (data.trueWindSpeed !== undefined && data.trueWindSpeed !== null && !isNaN(data.trueWindSpeed)) {
        document.getElementById('true-wind-speed-value').textContent = data.trueWindSpeed.toFixed(1);
    } else {
        document.getElementById('true-wind-speed-value').textContent = 'N/A';
    }
    if (data.trueWindDirection !== undefined && data.trueWindDirection !== null && !isNaN(data.trueWindDirection)) {
        document.getElementById('true-wind-dir-value').textContent = data.trueWindDirection.toFixed(0);
    } else {
        document.getElementById('true-wind-dir-value').textContent = 'N/A';
    }
    // Pass wind speed and max/avg values to the update function, including true wind data
    updateWindDirection(
        data.windDirection,
        data.windSpeed,
        data.windSpeedMax,
        data.windSpeedAvg,
        data.trueWindSpeed,
        data.trueWindDirection
    );
    
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
    
    // Update charts with historical data
    if (data.history) {
        updateCharts(data.history);
    }
}

// Initialize WebSocket on page load
document.addEventListener('DOMContentLoaded', () => {
    initWebSocket();
    
    // Set up refresh rate change listener
    const refreshRateInput = document.getElementById('refresh-rate');
    const refreshRateValue = document.getElementById('refresh-rate-value');
    
    refreshRateInput.addEventListener('input', () => {
        refreshRateValue.textContent = refreshRateInput.value;
    });
    
    refreshRateInput.addEventListener('change', updateRefreshRate);
    
    // Listen for service worker messages for reconnection
    if (navigator.serviceWorker) {
        navigator.serviceWorker.addEventListener('message', event => {
            if (event.data === 'RECONNECT' && !isConnected) {
                initWebSocket();
            }
        });
    }
    
    // Notify service worker when online
    window.addEventListener('online', () => {
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage('ONLINE');
        }
        if (!isConnected) {
            initWebSocket();
        }
    });
});
