// WebSocket connection and data handling for Luna Sailing Dashboard

// WebSocket connection
let socket;
let isConnected = false;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const reconnectInterval = 3000; // 3 seconds
const connectionStatus = document.getElementById('connection-status');

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
        updateDashboard(data);
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

// Update the dashboard with received data
function updateDashboard(data) {
    // Update speed data
    if (data.speed !== undefined) {
        document.getElementById('speed-value').textContent = data.speed.toFixed(1);
        document.getElementById('speed-max').textContent = data.speedMax.toFixed(1);
        document.getElementById('speed-avg').textContent = data.speedAvg.toFixed(1);
        updateSpeedGauge(data.speed);
    }
    
    // Update wind data
    if (data.windSpeed !== undefined && data.windDirection !== undefined) {
        document.getElementById('wind-speed-value').textContent = data.windSpeed.toFixed(1);
        document.getElementById('wind-dir-value').textContent = data.windDirection.toFixed(0);
        updateWindDirection(data.windDirection);
    }
    
    // Update tilt data
    if (data.tilt !== undefined) {
        document.getElementById('tilt-value').textContent = Math.abs(data.tilt).toFixed(1);
        document.getElementById('tilt-port-max').textContent = data.tiltPortMax.toFixed(1);
        document.getElementById('tilt-starboard-max').textContent = data.tiltStarboardMax.toFixed(1);
        updateTiltGauge(data.tilt);
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
