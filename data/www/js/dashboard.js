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

    const compassContainer = document.getElementById('wind-direction');
    if (compassContainer) {
        // Update the dead wind V shape
        const deadWindVGroup = compassContainer.querySelector('.dead-wind-v-group');
        if (deadWindVGroup) {
            let deadWindAngle = window.currentDeadWindAngle;
            if (isNaN(deadWindAngle)) deadWindAngle = 40;
            // SVG center and radius
            const cx = 60, cy = 60, r = 55;
            // Calculate left and right V points
            const leftAngle = (-deadWindAngle) * Math.PI / 180;
            const rightAngle = (deadWindAngle) * Math.PI / 180;
            const leftX = cx + r * Math.sin(leftAngle);
            const leftY = cy - r * Math.cos(leftAngle);
            const rightX = cx + r * Math.sin(rightAngle);
            const rightY = cy - r * Math.cos(rightAngle);
            // Update polylines
            const lines = deadWindVGroup.querySelectorAll('polyline');
            if (lines.length === 2) {
                lines[0].setAttribute('points', `${cx},${cy} ${leftX.toFixed(1)},${leftY.toFixed(1)}`);
                lines[1].setAttribute('points', `${cx},${cy} ${rightX.toFixed(1)},${rightY.toFixed(1)}`);
            }
        }
        // Only update the rotation and opacity of the wind-arrow-group (apparent) and wind-arrow-group-static (true), SVG is now static in HTML
        const apparentArrowGroup = compassContainer.querySelector('.wind-arrow-group');
        const trueArrowGroup = compassContainer.querySelector('.wind-arrow-group-static');
        // Apparent wind angle (blue)
        if (!updateWindDirection._lastApparentAngle && updateWindDirection._lastApparentAngle !== 0) updateWindDirection._lastApparentAngle = 0;
        let apparentAngle = updateWindDirection._lastApparentAngle;
        let apparentOpacity = 0.2;
        if (direction !== null && direction !== undefined && !isNaN(direction) && windSpeed !== null && windSpeed !== undefined && !isNaN(windSpeed) && windSpeed >= 0.1) {
            apparentAngle = direction;
            updateWindDirection._lastApparentAngle = direction;
            apparentOpacity = 1;
        }
        if (apparentArrowGroup) {
            apparentArrowGroup.setAttribute('style', `transform: rotate(${apparentAngle}deg); transform-origin: 60px 60px; transition: transform 0.5s cubic-bezier(0.4,0.0,0.2,1); opacity: ${apparentOpacity};`);
        }
        // True wind angle (orange)
        if (!updateWindDirection._lastTrueAngle && updateWindDirection._lastTrueAngle !== 0) updateWindDirection._lastTrueAngle = 0;
        let trueAngle = updateWindDirection._lastTrueAngle;
        let trueOpacity = 0.2;
        if (trueWindDirection !== null && trueWindDirection !== undefined && !isNaN(trueWindDirection) && trueWindSpeed !== null && trueWindSpeed !== undefined && !isNaN(trueWindSpeed) && trueWindSpeed >= 0.1) {
            trueAngle = trueWindDirection;
            updateWindDirection._lastTrueAngle = trueWindDirection;
            trueOpacity = 1;
        }
        if (trueArrowGroup) {
            trueArrowGroup.setAttribute('style', `transform: rotate(${trueAngle}deg); transform-origin: 60px 60px; transition: transform 0.5s cubic-bezier(0.4,0.0,0.2,1); opacity: ${trueOpacity};`);
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

    // True wind speed value
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

    const windSpeedStr = (windSpeed !== null && windSpeed !== undefined && !isNaN(windSpeed)) ? windSpeed.toFixed(1) : 'N/A';
    const trueWindDirStr = (trueWindDirection !== null && trueWindDirection !== undefined && !isNaN(trueWindDirection)) ? trueWindDirection.toFixed(0) : 'N/A';
    const trueWindSpeedStr = (trueWindSpeed !== null && trueWindSpeed !== undefined && !isNaN(trueWindSpeed)) ? trueWindSpeed.toFixed(1) : 'N/A';
    console.log(`Wind updated - Apparent: ${direction}° (${getCardinalDirection(direction)}) ${windSpeedStr} kts, True: ${trueWindDirStr}° ${trueWindSpeedStr} kts`);
}

// --- Dead wind angle settings logic ---
// Place these at the end of the file to avoid conflicts with dashboard logic

function setupDeadWindAngleInput() {
    const deadWindInput = document.getElementById('dead-wind-angle');
    window.currentDeadWindAngle = 40; // default
    if (deadWindInput) {
        deadWindInput.addEventListener('input', function() {
            let val = parseInt(deadWindInput.value, 10);
            if (isNaN(val) || val < 20) val = 20;
            if (val > 60) val = 60;
            deadWindInput.value = val;
            window.currentDeadWindAngle = val;
            // Send to ESP32 via WebSocket
            if (typeof window.getWebSocketState === 'function') {
                const wsState = window.getWebSocketState();
                if (wsState && wsState.socket && wsState.readyState === WebSocket.OPEN) {
                    wsState.socket.send(JSON.stringify({ action: 'setDeadWindAngle', value: val }));
                }
            }
            updateWindDirection();
        });
    }
}

// Called from updateDashboard (websocket.js) to set the dead wind angle from ESP32
window.setDeadWindAngleFromESP = function(val) {
    const deadWindInput = document.getElementById('dead-wind-angle');
    // Only update the input value if it does NOT have focus
    if (deadWindInput && document.activeElement === deadWindInput) {
        // User is editing: do not overwrite input or widget
        return;
    }
    if (deadWindInput) {
        deadWindInput.value = val;
    }
    window.currentDeadWindAngle = val;
    updateWindDirection();
};

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
        const mastLength = 95;
        const mastBaseX = width / 2;
        const mastBaseY = height * 0.92;
        const mastAngle = Math.max(-45, Math.min(45, tilt));

        // Check if SVG exists, else do nothing (SVG is static in HTML)
        let svg = tiltGaugeContainer.querySelector('svg');
        let mastGroup = svg ? svg.querySelector('.mast-group') : null;
        if (svg) {
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
                mastGroup.style.transition = 'transform 0.7s cubic-bezier(0.4,0.0,0.2,1)';
            }
            // Update boat dot position
            const boatDot = svg.querySelector('circle');
            if (boatDot) {
                boatDot.setAttribute('cx', mastBaseX);
                boatDot.setAttribute('cy', mastBaseY);
            }
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
}

// Initialize - apply CSS classes and set up containers
document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard display functions initialized - big numbers mode');
    // Apply CSS classes to make numbers big
    makeBigNumbers();
    // Setup dead wind angle input and listener
    setupDeadWindAngleInput();
    // Initialize charts and reset true wind history with a small delay to ensure containers are rendered
    setTimeout(() => {
        speedChart = new SpeedChart('speed-chart');
        windChart = new WindChart('wind-chart');
        trueWindSpeedChart = new WindChart('true-wind-speed-chart');
        trueWindSpeedHistory = [];
        console.log('Speed, wind, and true wind charts initialized');
    }, 100);
});
