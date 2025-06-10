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

// Global wind chart instances
let windChart = null;
let trueWindSpeedChart = null;
// Persistent true wind speed history for max/avg
let trueWindSpeedHistory = [];

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
    // Apparent wind speed widget
    const windSpeedElement = document.getElementById('wind-speed-value');
    if (windSpeedElement) {
        if (windSpeed !== null && windSpeed !== undefined && !isNaN(windSpeed)) {
            windSpeedElement.textContent = windSpeed.toFixed(1);
        } else {
            windSpeedElement.textContent = 'N/A';
        }
        windSpeedElement.className = 'big-number wind';
    }

    // Max/Avg for apparent wind
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

    // Apparent wind direction widget
    const windDirElement = document.getElementById('wind-dir-value');
    if (windDirElement) {
        windDirElement.textContent = (direction !== null && direction !== undefined && !isNaN(direction)) ? direction.toFixed(0) : 'N/A';
    }

    const compassContainer = document.getElementById('wind-direction');
    if (compassContainer) {
        // If wind direction is not valid or wind speed is too low, show a question mark
        if (direction === null || direction === undefined || isNaN(direction) || windSpeed === null || windSpeed === undefined || isNaN(windSpeed) || windSpeed < 0.1) {
            // Only replace with question mark if not already present
            if (!compassContainer.querySelector('.wind-arrow-question')) {
                compassContainer.innerHTML = `
                    <div class="wind-arrow-question"><span>?</span></div>
                `;
            }
        } else {
            // Only create the SVG once
            let arrow = compassContainer.querySelector('.wind-arrow-svg');
            let group;
            if (!arrow) {
                compassContainer.innerHTML = `
                    <svg class="wind-arrow-svg" width="120" height="240" viewBox="0 0 64 128">
                        <g class="wind-arrow-group">
                            <polygon points="32,16 20,64 32,48 44,64" fill="#0a4a7c" />
                            <rect x="28" y="64" width="8" height="56" rx="3" fill="#0a4a7c" />
                        </g>
                    </svg>
                `;
                arrow = compassContainer.querySelector('.wind-arrow-svg');
            }
            group = compassContainer.querySelector('.wind-arrow-group');
            if (group) {
                group.setAttribute('style', `transform: rotate(${direction}deg); transform-origin: 32px 64px;`);
            }
        }
    }


    // Chart for apparent wind
    if (windSpeed !== null && windChart) {
        windChart.addWindSpeedData(windSpeed);
    }

    // Chart for true wind and persistent history for max/avg
    if (trueWindSpeed !== null && trueWindSpeedChart && !isNaN(trueWindSpeed)) {
        trueWindSpeedChart.addWindSpeedData(trueWindSpeed);
        trueWindSpeedHistory.push(trueWindSpeed);
    }


    // True wind widget
    const trueWindSpeedElement = document.getElementById('true-wind-speed-value');
    if (trueWindSpeedElement) {
        if (trueWindSpeed !== null && trueWindSpeed !== undefined && !isNaN(trueWindSpeed)) {
            trueWindSpeedElement.textContent = trueWindSpeed.toFixed(1);
        } else {
            trueWindSpeedElement.textContent = 'N/A';
        }
        trueWindSpeedElement.className = 'big-number wind';
    }

    // Max/Avg for true wind (calculate from persistent history)
    const trueMaxElement = document.getElementById('true-wind-speed-max');
    if (trueMaxElement) {
        if (trueWindSpeedHistory.length > 0) {
            const max = Math.max(...trueWindSpeedHistory);
            trueMaxElement.textContent = max.toFixed(1);
        } else {
            trueMaxElement.textContent = '0.0';
        }
    }
    const trueAvgElement = document.getElementById('true-wind-speed-avg');
    if (trueAvgElement) {
        if (trueWindSpeedHistory.length > 0) {
            const avg = trueWindSpeedHistory.reduce((sum, v) => sum + v, 0) / trueWindSpeedHistory.length;
            trueAvgElement.textContent = avg.toFixed(1);
        } else {
            trueAvgElement.textContent = '0.0';
        }
    }

    const trueWindDirElement = document.getElementById('true-wind-dir-value');
    if (trueWindDirElement) {
        if (trueWindDirection !== null && trueWindDirection !== undefined && !isNaN(trueWindDirection)) {
            trueWindDirElement.textContent = trueWindDirection.toFixed(0);
        } else {
            trueWindDirElement.textContent = 'N/A';
        }
    }

    // True wind arrow or question mark
    const trueWindCompassContainer = document.getElementById('true-wind-direction');
    if (trueWindCompassContainer) {
        if (
            trueWindDirection === null ||
            trueWindDirection === undefined ||
            isNaN(trueWindDirection) ||
            trueWindSpeed === null ||
            trueWindSpeed === undefined ||
            isNaN(trueWindSpeed) ||
            trueWindSpeed < 0.1
        ) {
            // Only replace with question mark if not already present
            if (!trueWindCompassContainer.querySelector('.wind-arrow-question')) {
                trueWindCompassContainer.innerHTML = `
                    <div class="wind-arrow-question"><span>?</span></div>
                `;
            }
        } else {
            // Only create the SVG once
            let arrow = trueWindCompassContainer.querySelector('.wind-arrow-svg');
            let group;
            if (!arrow) {
                trueWindCompassContainer.innerHTML = `
                    <svg class="wind-arrow-svg" width="120" height="240" viewBox="0 0 64 128">
                        <g class="wind-arrow-group">
                            <polygon points="32,16 20,64 32,48 44,64" fill="#0a4a7c" />
                            <rect x="28" y="64" width="8" height="56" rx="3" fill="#0a4a7c" />
                        </g>
                    </svg>
                `;
                arrow = trueWindCompassContainer.querySelector('.wind-arrow-svg');
            }
            group = trueWindCompassContainer.querySelector('.wind-arrow-group');
            if (group) {
                group.setAttribute('style', `transform: rotate(${trueWindDirection}deg); transform-origin: 32px 64px;`);
            }
        }
    }

    const windSpeedStr = (windSpeed !== null && windSpeed !== undefined && !isNaN(windSpeed)) ? windSpeed.toFixed(1) : 'N/A';
    const trueWindDirStr = (trueWindDirection !== null && trueWindDirection !== undefined && !isNaN(trueWindDirection)) ? trueWindDirection.toFixed(0) : 'N/A';
    const trueWindSpeedStr = (trueWindSpeed !== null && trueWindSpeed !== undefined && !isNaN(trueWindSpeed)) ? trueWindSpeed.toFixed(1) : 'N/A';
    console.log(`Wind updated - Apparent: ${direction}° (${getCardinalDirection(direction)}) ${windSpeedStr} kts, True: ${trueWindDirStr}° ${trueWindSpeedStr} kts`);
}

// Update tilt display with CSS classes
function updateTiltGauge(tilt) {
    // Update degree label
    const colorClass = Math.abs(tilt) > 20 ? 'tilt-danger' : Math.abs(tilt) > 10 ? 'tilt-medium' : 'tilt-good';
    const tiltDegreeLabel = document.getElementById('tilt-degree-label');
    if (tiltDegreeLabel) {
        tiltDegreeLabel.textContent = `${Math.abs(tilt).toFixed(1)}°`;
        tiltDegreeLabel.className = `tilt-degree-label ${colorClass}`;
    }

    // SVG mast and waterline
    const tiltGaugeContainer = document.getElementById('tilt-gauge');
    if (tiltGaugeContainer) {
        // SVG size and mast length
        const width = tiltGaugeContainer.offsetWidth > 0 ? tiltGaugeContainer.offsetWidth : 180;
        const height = 120;
        const mastLength = 95; // Even longer mast
        const mastBaseX = width / 2;
        const mastBaseY = height * 0.92; // Lower the base for less top margin
        const mastAngle = Math.max(-45, Math.min(45, tilt)); // Clamp for display

        // Check if SVG exists, else create it
        let svg = tiltGaugeContainer.querySelector('.tilt-svg');
        let mastGroup;
        if (!svg) {
            tiltGaugeContainer.innerHTML = `
<svg class="tilt-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <!-- Waterline (full width) -->
  <line x1="0" y1="${mastBaseY}" x2="${width}" y2="${mastBaseY}" stroke="#0a4a7c" stroke-width="3" />
  <!-- Mast group for animation -->
  <g class="mast-group" style="transform: rotate(${mastAngle}deg); transform-origin: ${mastBaseX}px ${mastBaseY}px;">
    <line x1="${mastBaseX}" y1="${mastBaseY}" x2="${mastBaseX}" y2="${mastBaseY - mastLength}" stroke="#ffa500" stroke-width="6" stroke-linecap="round" />
  </g>
  <!-- Boat dot -->
  <circle cx="${mastBaseX}" cy="${mastBaseY}" r="10" fill="#0a4a7c" stroke="#fff" stroke-width="2" />
</svg>`;
            svg = tiltGaugeContainer.querySelector('.tilt-svg');
            mastGroup = svg ? svg.querySelector('.mast-group') : null;
        } else {
            // Update SVG size and waterline if container size changes
            svg.setAttribute('width', width);
            svg.setAttribute('height', height);
            svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
            // Update waterline and mast line positions
            const waterline = svg.querySelector('line');
            if (waterline) {
                waterline.setAttribute('x1', 0);
                waterline.setAttribute('y1', mastBaseY);
                waterline.setAttribute('x2', width);
                waterline.setAttribute('y2', mastBaseY);
            }
            mastGroup = svg.querySelector('.mast-group');
            if (mastGroup) {
                // Update mast line
                const mastLine = mastGroup.querySelector('line');
                if (mastLine) {
                    mastLine.setAttribute('x1', mastBaseX);
                    mastLine.setAttribute('y1', mastBaseY);
                    mastLine.setAttribute('x2', mastBaseX);
                    mastLine.setAttribute('y2', mastBaseY - mastLength);
                }
                // Update transform-origin and animate rotation
                mastGroup.style.transformOrigin = `${mastBaseX}px ${mastBaseY}px`;
                mastGroup.style.transform = `rotate(${mastAngle}deg)`;
            }
            // Update boat dot position
            const boatDot = svg.querySelector('circle');
            if (boatDot) {
                boatDot.setAttribute('cx', mastBaseX);
                boatDot.setAttribute('cy', mastBaseY);
            }
        }
        // Always ensure transition is set
        if (mastGroup) {
            mastGroup.style.transition = 'transform 0.7s cubic-bezier(0.4,0.0,0.2,1)';
        }
    }
    console.log(`Tilt updated: ${tilt.toFixed(1)}°`);
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
    
    // Initialize charts and reset true wind history with a small delay to ensure containers are rendered
    setTimeout(() => {
        speedChart = new SpeedChart('speed-chart');
        windChart = new WindChart('wind-chart');
        trueWindSpeedChart = new WindChart('true-wind-speed-chart');
        trueWindSpeedHistory = [];
        console.log('Speed, wind, and true wind charts initialized');
    }, 100);
});
