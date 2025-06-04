// Main JavaScript for Luna Sailing Dashboard

// DOM Elements
const settingsToggle = document.getElementById('settings-toggle');
const settingsPanel = document.getElementById('settings-panel');
const settingsClose = document.getElementById('settings-close');
const themeSelect = document.getElementById('theme-select');
const viewSelect = document.getElementById('view-select');
const wifiApplyButton = document.getElementById('wifi-apply');

// Initialize the dashboard
function initDashboard() {
    // Initialize settings from local storage
    initializeSettings();
    
    // Update copyright year dynamically
    updateCopyrightYear();
    
    // Set up event listeners
    setupEventListeners();
    
    // Debug: Check if WebSocket functions are available
    console.log('WebSocket functions available:', {
        updateWiFiSettings: typeof updateWiFiSettings,
        updateRefreshRate: typeof updateRefreshRate,
        initWebSocket: typeof initWebSocket,
        getWebSocketState: typeof window.getWebSocketState
    });
    
    // Additional debug info about WebSocket state
    if (typeof window.getWebSocketState === 'function') {
        const wsState = window.getWebSocketState();
        console.log('WebSocket state:', {
            hasSocket: !!wsState.socket,
            isConnected: wsState.isConnected,
            readyState: wsState.readyState
        });
    }
}

// Initialize settings from local storage
function initializeSettings() {
    // Get saved theme preference
    const savedTheme = localStorage.getItem('theme') || 'light';
    themeSelect.value = savedTheme;
    applyTheme(savedTheme);
    
    // Get saved view mode
    const savedView = localStorage.getItem('viewMode') || 'basic';
    viewSelect.value = savedView;
    applyViewMode(savedView);
    
    // Get saved refresh rate
    const savedRefreshRate = localStorage.getItem('refreshRate') || '1';
    const refreshRateInput = document.getElementById('refresh-rate');
    const refreshRateValue = document.getElementById('refresh-rate-value');
    refreshRateInput.value = savedRefreshRate;
    refreshRateValue.textContent = savedRefreshRate;
    
    // Get saved WiFi settings
    const savedSSID = localStorage.getItem('wifiSSID') || 'Luna_Sailing';
    const wifiSSIDInput = document.getElementById('wifi-ssid');
    wifiSSIDInput.value = savedSSID;
}

// Set up event listeners
function setupEventListeners() {
    // Settings panel toggle
    settingsToggle.addEventListener('click', () => {
        settingsPanel.classList.toggle('hidden');
    });
    
    settingsClose.addEventListener('click', () => {
        settingsPanel.classList.add('hidden');
    });
    
    // Theme selection
    themeSelect.addEventListener('change', () => {
        const theme = themeSelect.value;
        applyTheme(theme);
        localStorage.setItem('theme', theme);
    });
    
    // View mode selection
    viewSelect.addEventListener('change', () => {
        const viewMode = viewSelect.value;
        applyViewMode(viewMode);
        localStorage.setItem('viewMode', viewMode);
    });
    
    // Refresh rate saving
    const refreshRateInput = document.getElementById('refresh-rate');
    refreshRateInput.addEventListener('change', () => {
        localStorage.setItem('refreshRate', refreshRateInput.value);
    });
    
    // WiFi settings
    wifiApplyButton.addEventListener('click', applyWiFiSettings);
    
    // Save WiFi SSID when changed
    const wifiSSIDInput = document.getElementById('wifi-ssid');
    wifiSSIDInput.addEventListener('change', () => {
        localStorage.setItem('wifiSSID', wifiSSIDInput.value);
    });
    
    // Listen for system theme changes if in auto mode
    if (window.matchMedia) {
        const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        darkModeMediaQuery.addEventListener('change', () => {
            if (themeSelect.value === 'auto') {
                applyTheme('auto');
            }
        });
    }
}

// Apply theme
function applyTheme(theme) {
    if (theme === 'auto') {
        // Check system preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.body.classList.add('dark-theme');
        } else {
            document.body.classList.remove('dark-theme');
        }
    } else if (theme === 'dark') {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }
    
    // Update charts theme
    updateChartsTheme();
}

// Apply view mode
function applyViewMode(viewMode) {
    document.body.className = document.body.className.replace(/view-\w+/g, '');
    document.body.classList.add(`view-${viewMode}`);
    
    const historySection = document.getElementById('history-data');
    
    switch (viewMode) {
        case 'basic':
            historySection.style.display = 'none';
            break;
        case 'detailed':
        case 'graphical':
            historySection.style.display = 'grid';
            break;
    }
}

// Send WiFi settings directly to WebSocket
function sendWiFiSettings(ssid, password) {
    // Check if WebSocket is available and connected
    if (typeof window.getWebSocketState !== 'function') {
        console.error('WebSocket state function not available');
        alert('Error: WebSocket not properly initialized. Please reload the page and try again.');
        return;
    }
    
    const wsState = window.getWebSocketState();
    
    if (!wsState.socket) {
        console.error('WebSocket not initialized');
        alert('Error: Not connected to device. Please reload the page and try again.');
        return;
    }
    
    if (wsState.readyState !== WebSocket.OPEN) {
        console.error('WebSocket not connected, state:', wsState.readyState);
        alert('Error: Not connected to device. Please wait for connection and try again.');
        return;
    }
    
    try {
        wsState.socket.send(JSON.stringify({
            action: 'updateWiFi',
            ssid: ssid,
            password: password
        }));
        console.log('WiFi settings sent to ESP32:', { ssid, hasPassword: password.length > 0 });
    } catch (error) {
        console.error('Error sending WiFi settings:', error);
        alert('Error: Failed to send WiFi settings. Please try again.');
    }
}

// Apply WiFi settings
function applyWiFiSettings() {
    const ssidInput = document.getElementById('wifi-ssid');
    const passwordInput = document.getElementById('wifi-password');
    
    const ssid = ssidInput.value.trim();
    const password = passwordInput.value;
    
    // Validate SSID
    if (!ssid || ssid.length === 0) {
        alert('SSID cannot be empty');
        return;
    }
    
    if (ssid.length > 32) {
        alert('SSID cannot be longer than 32 characters');
        return;
    }
    
    // Validate password (if provided)
    if (password.length > 0 && password.length < 8) {
        alert('Password must be at least 8 characters for WPA2 security');
        return;
    }
    
    if (password.length > 63) {
        alert('Password cannot be longer than 63 characters');
        return;
    }
    
    // Confirm the action
    const confirmMessage = password.length > 0 
        ? `Apply WiFi settings?\n\nSSID: ${ssid}\nSecurity: WPA2 with password\n\nThis will restart the WiFi and disconnect all clients.`
        : `Apply WiFi settings?\n\nSSID: ${ssid}\nSecurity: Open (no password)\n\nThis will restart the WiFi and disconnect all clients.`;
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    // Save settings locally
    localStorage.setItem('wifiSSID', ssid);
    
    // Send WiFi settings via WebSocket
    sendWiFiSettings(ssid, password);
    
    // Clear password field for security
    passwordInput.value = '';
    
    // Show feedback
    wifiApplyButton.textContent = 'Applying...';
    wifiApplyButton.disabled = true;
    
    // Reset button after 3 seconds
    setTimeout(() => {
        wifiApplyButton.textContent = 'Apply WiFi Settings';
        wifiApplyButton.disabled = false;
    }, 3000);
}

// Update copyright year in the footer
function updateCopyrightYear() {
    const copyrightYearElement = document.getElementById('copyright-year');
    if (copyrightYearElement) {
        const currentYear = new Date().getFullYear();
        copyrightYearElement.textContent = currentYear;
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initDashboard);
