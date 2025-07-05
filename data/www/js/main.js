// Main JavaScript for Luna Sailing Dashboard

// DOM Elements
const settingsToggle = document.getElementById('settings-toggle');
const settingsPanel = document.getElementById('settings-panel');
const settingsClose = document.getElementById('settings-close');
const themeSelect = document.getElementById('theme-select');
const viewSelect = document.getElementById('view-select');

// Initialize the dashboard
function initDashboard() {
    // Initialize settings from local storage
    initializeSettings();
    
    // Update copyright year dynamically
    updateCopyrightYear();
    
    // Set up event listeners
    setupEventListeners();

    // Listen for regatta distance updates from BLE
    if (typeof window.getBLEState === 'function') {
        // BLE connection will handle regatta updates through the dashboard update mechanism
        console.log('BLE state functions available');
    }
    
    // Debug: Check if BLE functions are available
    console.log('BLE functions available:', {
        getBLEState: typeof window.getBLEState,
        initBLE: typeof initBLE
    });
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
}

// Set up event listeners
function setupEventListeners() {
    // Regatta Start buttons (event-driven feedback)
    const regattaButtons = [
        { btnId: 'regatta-set-port', action: 'regattaSetPort', errorMsg: 'regatta port set command.' },
        { btnId: 'regatta-set-starboard', action: 'regattaSetStarboard', errorMsg: 'regatta starboard set command.' }
    ];
    // Map action to button for event-driven re-enabling
    const regattaBtnMap = {};
    regattaButtons.forEach(({ btnId, action, errorMsg }) => {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        regattaBtnMap[action] = btn;
        btn.addEventListener('click', () => {
            if (!window.getBLEState || typeof window.getBLEState !== 'function') {
                alert('Error: BLE not properly initialized. Please reload the page and try again.');
                return;
            }
            const bleState = window.getBLEState();
            if (!bleState.device || !bleState.isConnected) {
                alert('Error: Not connected to device. Please wait for connection and try again.');
                return;
            }
            try {
                // Send BLE command
                console.log(`[UI] Sending ${action} over BLE`);
                bleState.sendCommand({ action: action });
                btn.textContent = 'Set!';
                btn.disabled = true;
            } catch (error) {
                alert('Error: Failed to send ' + errorMsg);
                console.error('[UI] Failed to send ' + action + ':', error);
            }
        });
    });

    // Listen for regatta distance updates and button feedback from BLE
    if (typeof window.getBLEState === 'function') {
        // BLE data updates will be handled through the dashboard update mechanism
        // Button feedback will be implemented when BLE characteristics are set up
        console.log('BLE regatta feedback system ready');
    }
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
    
    // Listen for system theme changes if in auto mode
    if (window.matchMedia) {
        const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        darkModeMediaQuery.addEventListener('change', () => {
            if (themeSelect.value === 'auto') {
                applyTheme('auto');
            }
        });
    }

    // Heel angle reset button
    const resetHeelAngleButton = document.getElementById('reset-heel-angle');
    if (resetHeelAngleButton) {
        resetHeelAngleButton.addEventListener('click', () => {
            console.log('[UI] Reset Heel Angle button clicked');
            if (!window.getBLEState || typeof window.getBLEState !== 'function') {
                alert('Error: BLE not properly initialized. Please reload the page and try again.');
                return;
            }
            const bleState = window.getBLEState();
            if (!bleState.device || !bleState.isConnected) {
                alert('Error: Not connected to device. Please wait for connection and try again.');
                return;
            }
            if (!confirm('Set the current heel angle as zero? Make sure the boat is at rest and in the desired reference position.')) {
                return;
            }
            try {
                console.log('[UI] Sending resetHeelAngle over BLE');
                bleState.sendCommand({ action: 'resetHeelAngle' });
                resetHeelAngleButton.textContent = 'Resetting...';
                resetHeelAngleButton.disabled = true;
                setTimeout(() => {
                    resetHeelAngleButton.textContent = 'Reset Heel Angle';
                    resetHeelAngleButton.disabled = false;
                }, 3000);
            } catch (error) {
                alert('Error: Failed to send reset command.');
                console.error('[UI] Failed to send resetHeelAngle:', error);
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
}

// Apply view mode
function applyViewMode(viewMode) {
    document.body.className = document.body.className.replace(/view-\w+/g, '');
    document.body.classList.add(`view-${viewMode}`);

    const historySection = document.getElementById('history-data');
    if (!historySection) return; // Prevent error if element is missing

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
