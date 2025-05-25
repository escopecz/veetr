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
    
    // Set up event listeners
    setupEventListeners();
    
    // Initialize visualizations
    initGauges();
    initCharts();
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

// Initialize dashboard on page load
document.addEventListener('DOMContentLoaded', initDashboard);
