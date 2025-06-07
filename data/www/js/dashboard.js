// Speed Chart Management
class SpeedChart {
    constructor(containerId, maxDataPoints = 100) { // 100 points for clean display
        this.container = document.getElementById(containerId);
        this.maxDataPoints = maxDataPoints;
        this.dataPoints = [];
        this.maxSpeed = 15; // Maximum speed for scaling (knots)
        this.barWidth = 3; // Width of each bar in pixels
        
        if (!this.container) {
            console.warn(`Speed chart container ${containerId} not found`);
            return;
        }
        
        this.init();
    }
    
    init() {
        // Clear any existing bars
        this.container.innerHTML = '';
        
        // Handle resize events to update chart when container size changes
        this.resizeHandler = () => {
            this.updateChart();
        };
        
        window.addEventListener('resize', this.resizeHandler);
    }
    
    destroy() {
        // Clean up event listener
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
        }
    }
    
    getMaxBarsForWidth() {
        if (!this.container) return 0;
        
        // Get the computed style to ensure we have the actual rendered width
        const containerWidth = this.container.offsetWidth || this.container.clientWidth;
        
        if (containerWidth <= 0) {
            // Container not yet rendered, try again with a small delay
            setTimeout(() => this.updateChart(), 100);
            return 0;
        }
        
        // With no gaps between bars, calculation is simple: containerWidth / barWidth
        const maxBars = Math.floor(containerWidth / this.barWidth);
        return Math.max(0, maxBars);
    }
    
    addSpeedData(speed) {
        // Add new data point with timestamp
        const dataPoint = {
            speed: speed,
            timestamp: Date.now()
        };
        
        this.dataPoints.push(dataPoint);
        
        // Remove old data points (older than 10 minutes)
        const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
        this.dataPoints = this.dataPoints.filter(point => point.timestamp > tenMinutesAgo);
        
        // Keep only the last maxDataPoints for performance
        if (this.dataPoints.length > this.maxDataPoints) {
            this.dataPoints = this.dataPoints.slice(-this.maxDataPoints);
        }
        
        // Update the visual chart
        this.updateChart();
    }
    
    updateChart() {
        // Clear existing bars
        this.container.innerHTML = '';
        
        if (this.dataPoints.length === 0) return;
        
        // Get maximum number of bars that can fit in the container
        const maxBars = this.getMaxBarsForWidth();
        
        if (maxBars <= 0) {
            console.log('Speed chart: No space for bars, container width:', this.container?.offsetWidth);
            return;
        }
        
        // Take only the most recent data points that fit in the container
        const visibleDataPoints = this.dataPoints.slice(-maxBars);
        
        console.log(`Speed chart: Showing ${visibleDataPoints.length} of ${this.dataPoints.length} bars (max: ${maxBars})`);
        
        // Add bars in reverse order (newest first) because flex-direction: row-reverse
        // This will make the newest bar appear on the right side
        for (let i = visibleDataPoints.length - 1; i >= 0; i--) {
            const point = visibleDataPoints[i];
            const bar = document.createElement('div');
            bar.className = 'speed-chart-bar';
            
            // Set explicit width for flexbox layout
            bar.style.width = `${this.barWidth}px`;
            bar.style.flexShrink = '0'; // Prevent bars from shrinking
            
            // Calculate height as percentage of max speed
            const heightPercent = Math.min((point.speed / this.maxSpeed) * 100, 100);
            bar.style.height = `${heightPercent}%`;
            
            this.container.appendChild(bar);
        }
    }
    
    clear() {
        this.dataPoints = [];
        this.container.innerHTML = '';
    }
}

// Global speed chart instance
let speedChart = null;

// Wind Chart Management
class WindChart {
    constructor(containerId, maxDataPoints = 100) { // 100 points for clean display
        this.container = document.getElementById(containerId);
        this.maxDataPoints = maxDataPoints;
        this.dataPoints = [];
        this.maxWindSpeed = 25; // Maximum wind speed for scaling (knots)
        this.barWidth = 3; // Width of each bar in pixels
        
        if (!this.container) {
            console.warn(`Wind chart container ${containerId} not found`);
            return;
        }
        
        this.init();
    }
    
    init() {
        // Clear any existing bars
        this.container.innerHTML = '';
        
        // Handle resize events to update chart when container size changes
        this.resizeHandler = () => {
            this.updateChart();
        };
        
        window.addEventListener('resize', this.resizeHandler);
    }
    
    destroy() {
        // Clean up event listener
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
        }
    }
    
    getMaxBarsForWidth() {
        if (!this.container) return 0;
        
        // Get the computed style to ensure we have the actual rendered width
        const containerWidth = this.container.offsetWidth || this.container.clientWidth;
        
        if (containerWidth <= 0) {
            // Container not yet rendered, try again with a small delay
            setTimeout(() => this.updateChart(), 100);
            return 0;
        }
        
        // With no gaps between bars, calculation is simple: containerWidth / barWidth
        const maxBars = Math.floor(containerWidth / this.barWidth);
        return Math.max(0, maxBars);
    }
    
    addWindSpeedData(windSpeed) {
        // Add new data point with timestamp
        const dataPoint = {
            windSpeed: windSpeed,
            timestamp: Date.now()
        };
        
        this.dataPoints.push(dataPoint);
        
        // Remove old data points (older than 10 minutes)
        const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
        this.dataPoints = this.dataPoints.filter(point => point.timestamp > tenMinutesAgo);
        
        // Keep only the last maxDataPoints for performance
        if (this.dataPoints.length > this.maxDataPoints) {
            this.dataPoints = this.dataPoints.slice(-this.maxDataPoints);
        }
        
        // Update the visual chart
        this.updateChart();
    }
    
    updateChart() {
        // Clear existing bars
        this.container.innerHTML = '';
        
        if (this.dataPoints.length === 0) return;
        
        // Get maximum number of bars that can fit in the container
        const maxBars = this.getMaxBarsForWidth();
        
        if (maxBars <= 0) {
            console.log('Wind chart: No space for bars, container width:', this.container?.offsetWidth);
            return;
        }
        
        // Take only the most recent data points that fit in the container
        const visibleDataPoints = this.dataPoints.slice(-maxBars);
        
        console.log(`Wind chart: Showing ${visibleDataPoints.length} of ${this.dataPoints.length} bars (max: ${maxBars})`);
        
        // Add bars in reverse order (newest first) because flex-direction: row-reverse
        // This will make the newest bar appear on the right side
        for (let i = visibleDataPoints.length - 1; i >= 0; i--) {
            const point = visibleDataPoints[i];
            const bar = document.createElement('div');
            bar.className = 'wind-chart-bar';
            
            // Set explicit width for flexbox layout
            bar.style.width = `${this.barWidth}px`;
            bar.style.flexShrink = '0'; // Prevent bars from shrinking
            
            // Calculate height as percentage of max wind speed
            const heightPercent = Math.min((point.windSpeed / this.maxWindSpeed) * 100, 100);
            bar.style.height = `${heightPercent}%`;
            
            this.container.appendChild(bar);
        }
    }
    
    clear() {
        this.dataPoints = [];
        this.container.innerHTML = '';
    }
}

// Global wind chart instance
let windChart = null;

// Dashboard display functions for Luna Sailing Dashboard
// Big number displays - no visual gauges

// Update speed display with CSS classes and chart
function updateSpeedGauge(speed, maxSpeed = null, avgSpeed = null) {
    const speedElement = document.getElementById('speed-value');
    if (speedElement) {
        if (speed !== null && speed !== undefined && !isNaN(speed)) {
            speedElement.textContent = speed.toFixed(1);
            speedElement.className = 'big-number ' + 
                (speed > 10 ? 'speed-fast' : speed > 5 ? 'speed-medium' : 'speed-good');
        } else {
            speedElement.textContent = 'N/A';
            speedElement.className = 'big-number speed-good';
        }
    }
    
    // Update max and avg if provided (from server), otherwise let chart handle it
    if (maxSpeed !== null && maxSpeed !== undefined && !isNaN(maxSpeed)) {
        const maxElement = document.getElementById('speed-max');
        if (maxElement) {
            maxElement.textContent = maxSpeed.toFixed(1);
        }
    } else {
        const maxElement = document.getElementById('speed-max');
        if (maxElement) {
            maxElement.textContent = 'N/A';
        }
    }

    if (avgSpeed !== null && avgSpeed !== undefined && !isNaN(avgSpeed)) {
        const avgElement = document.getElementById('speed-avg');
        if (avgElement) {
            avgElement.textContent = avgSpeed.toFixed(1);
        }
    } else {
        const avgElement = document.getElementById('speed-avg');
        if (avgElement) {
            avgElement.textContent = 'N/A';
        }
    }

    // Update the background speed chart
    if (speedChart && speed !== null && speed !== undefined && !isNaN(speed)) {
        speedChart.addSpeedData(speed);
    }

    if (speed !== null && speed !== undefined && !isNaN(speed)) {
        console.log(`Speed updated: ${speed.toFixed(1)} knots`);
    } else {
        console.log('Speed updated: N/A');
    }
}

// Update wind direction display with CSS classes
function updateWindDirection(direction, windSpeed = null, maxWindSpeed = null, avgWindSpeed = null, 
                           trueWindSpeed = null, trueWindDirection = null) {
    // Update apparent wind direction
    const windDirElement = document.getElementById('wind-dir-value');
    if (windDirElement) {
        windDirElement.textContent = direction.toFixed(0);
        windDirElement.className = 'medium-number';
    }
    
    // Make apparent wind SPEED really big with CSS
    const windSpeedElement = document.getElementById('wind-speed-value');
    if (windSpeedElement) {
        windSpeedElement.className = 'big-number wind';
    }
    
    // Update true wind data if provided
    if (trueWindSpeed !== null) {
        const trueWindSpeedElement = document.getElementById('true-wind-speed-value');
        if (trueWindSpeedElement) {
            trueWindSpeedElement.textContent = trueWindSpeed.toFixed(1);
            trueWindSpeedElement.className = 'big-number wind';
        }
    }
    
    if (trueWindDirection !== null) {
        const trueWindDirElement = document.getElementById('true-wind-dir-value');
        if (trueWindDirElement) {
            trueWindDirElement.textContent = trueWindDirection.toFixed(0);
            trueWindDirElement.className = 'medium-number';
        }
        
        // Update true wind compass direction
        const trueWindCompassContainer = document.getElementById('true-wind-direction');
        if (trueWindCompassContainer) {
            trueWindCompassContainer.innerHTML = `
                <div class="compass-direction">
                    ${getCardinalDirection(trueWindDirection)}
                </div>
            `;
        }
    }
    
    // Update max and avg if provided (from server)
    const maxElement = document.getElementById('wind-speed-max');
    if (maxElement) {
        if (maxWindSpeed !== null && maxWindSpeed !== undefined && !isNaN(maxWindSpeed)) {
            maxElement.textContent = maxWindSpeed.toFixed(1);
        } else {
            maxElement.textContent = 'N/A';
        }
    }

    const avgElement = document.getElementById('wind-speed-avg');
    if (avgElement) {
        if (avgWindSpeed !== null && avgWindSpeed !== undefined && !isNaN(avgWindSpeed)) {
            avgElement.textContent = avgWindSpeed.toFixed(1);
        } else {
            avgElement.textContent = 'N/A';
        }
    }
    
    // Update the background wind chart if wind speed is provided
    if (windSpeed !== null && windChart) {
        windChart.addWindSpeedData(windSpeed);
    }
    
    // Update apparent wind compass direction with CSS
    const compassContainer = document.getElementById('wind-direction');
    if (compassContainer) {
        compassContainer.innerHTML = `
            <div class="compass-direction">
                ${getCardinalDirection(direction)}
            </div>
        `;
    }
    
    const windSpeedStr = (windSpeed !== null && windSpeed !== undefined && !isNaN(windSpeed)) ? windSpeed.toFixed(1) : 'N/A';
    const trueWindDirStr = (trueWindDirection !== null && trueWindDirection !== undefined && !isNaN(trueWindDirection)) ? trueWindDirection.toFixed(0) : 'N/A';
    const trueWindSpeedStr = (trueWindSpeed !== null && trueWindSpeed !== undefined && !isNaN(trueWindSpeed)) ? trueWindSpeed.toFixed(1) : 'N/A';
    console.log(`Wind updated - Apparent: ${direction}° (${getCardinalDirection(direction)}) ${windSpeedStr} kts, True: ${trueWindDirStr}° ${trueWindSpeedStr} kts`);
}

// Update tilt display with CSS classes
function updateTiltGauge(tilt) {
    const tiltElement = document.getElementById('tilt-value');
    if (tiltElement) {
        tiltElement.textContent = Math.abs(tilt).toFixed(1);
        tiltElement.className = 'big-number ' + 
            (Math.abs(tilt) > 20 ? 'tilt-danger' : Math.abs(tilt) > 10 ? 'tilt-medium' : 'tilt-good');
    }
    
    // Update the tilt gauge container with side indicator
    const tiltGaugeContainer = document.getElementById('tilt-gauge');
    if (tiltGaugeContainer) {
        const side = tilt < 0 ? 'PORT' : tilt > 0 ? 'STARBOARD' : 'LEVEL';
        const colorClass = Math.abs(tilt) > 20 ? 'tilt-danger' : Math.abs(tilt) > 10 ? 'tilt-medium' : 'tilt-good';
        tiltGaugeContainer.innerHTML = `
            <div class="side-indicator ${colorClass}">
                ${side}
            </div>
        `;
    }
    
    console.log(`Tilt updated: ${tilt.toFixed(1)}° (${tilt < 0 ? 'Port' : tilt > 0 ? 'Starboard' : 'Level'})`);
}

// Helper function to convert degrees to cardinal direction
function getCardinalDirection(degrees) {
    const directions = [
        'N', 'NNE', 'NE', 'ENE',
        'E', 'ESE', 'SE', 'SSE',
        'S', 'SSW', 'SW', 'WSW',
        'W', 'WNW', 'NW', 'NNW'
    ];
    
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
}

// Function to update all charts (stub for compatibility)
function updateCharts(historyData) {
    // Charts disabled for performance
    console.log('Charts update called (charts disabled for performance)');
}

// Function to update charts theme (stub for compatibility)  
function updateChartsTheme() {
    // Charts disabled for performance
    console.log('Charts theme update called (charts disabled for performance)');
}

// Apply CSS classes to make numbers big
function makeBigNumbers() {
    // Apply CSS classes instead of inline styles
    const speedValue = document.getElementById('speed-value');
    if (speedValue) {
        speedValue.className = 'big-number speed-good';
    }
    
    const windSpeedValue = document.getElementById('wind-speed-value');
    if (windSpeedValue) {
        windSpeedValue.className = 'big-number wind';
    }
    
    const trueWindSpeedValue = document.getElementById('true-wind-speed-value');
    if (trueWindSpeedValue) {
        trueWindSpeedValue.className = 'big-number wind';
    }
    
    const windDirValue = document.getElementById('wind-dir-value');
    if (windDirValue) {
        windDirValue.className = 'medium-number';
    }
    
    const trueWindDirValue = document.getElementById('true-wind-dir-value');
    if (trueWindDirValue) {
        trueWindDirValue.className = 'medium-number';
    }
    
    const tiltValue = document.getElementById('tilt-value');
    if (tiltValue) {
        tiltValue.className = 'big-number tilt-good';
    }
}

// Initialize - apply CSS classes and set up containers
document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard display functions initialized - big numbers mode');
    
    // Apply CSS classes to make numbers big
    makeBigNumbers();
    
    // Set up initial container states with CSS classes
    const windDirection = document.getElementById('wind-direction');
    if (windDirection) {
        windDirection.innerHTML = '<div class="compass-direction">---</div>';
    }
    
    const trueWindDirection = document.getElementById('true-wind-direction');
    if (trueWindDirection) {
        trueWindDirection.innerHTML = '<div class="compass-direction">---</div>';
    }
    
    const tiltGauge = document.getElementById('tilt-gauge');
    if (tiltGauge) {
        tiltGauge.innerHTML = '<div class="side-indicator tilt-good">LEVEL</div>';
    }
    
    // Initialize charts with a small delay to ensure containers are rendered
    setTimeout(() => {
        speedChart = new SpeedChart('speed-chart');
        windChart = new WindChart('wind-chart');
        console.log('Speed and wind charts initialized');
    }, 100);
});
