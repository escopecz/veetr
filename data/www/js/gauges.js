// Gauge Visualizations for Luna Sailing Dashboard

// Speed gauge
let speedGauge;

// Wind direction indicator
let windDirectionCanvas;
let windDirectionCtx;

// Tilt gauge
let tiltGauge;

// Initialize all gauges
function initGauges() {
    initSpeedGauge();
    initWindDirection();
    initTiltGauge();
}

// Initialize speed gauge
function initSpeedGauge() {
    const speedGaugeContainer = document.getElementById('speed-gauge');
    
    // Simple canvas-based gauge
    speedGaugeContainer.innerHTML = '<canvas id="speed-gauge-canvas" width="200" height="150"></canvas>';
    const canvas = document.getElementById('speed-gauge-canvas');
    const ctx = canvas.getContext('2d');
    
    // Store for updates
    speedGauge = {
        canvas: canvas,
        ctx: ctx,
        maxSpeed: 15 // Default max speed in knots
    };
    
    // Draw initial gauge
    updateSpeedGauge(0);
}

// Update speed gauge with new value
function updateSpeedGauge(speed) {
    const { ctx, canvas, maxSpeed } = speedGauge;
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Adjust max speed if needed
    if (speed > speedGauge.maxSpeed * 0.8) {
        speedGauge.maxSpeed = Math.ceil(speed * 1.5);
    }
    
    // Draw gauge background
    ctx.beginPath();
    ctx.arc(width / 2, height, width / 2, Math.PI, 0);
    ctx.lineWidth = 10;
    ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--border-color');
    ctx.stroke();
    
    // Draw speed value
    const percentage = Math.min(speed / speedGauge.maxSpeed, 1);
    ctx.beginPath();
    ctx.arc(width / 2, height, width / 2, Math.PI, Math.PI - percentage * Math.PI);
    ctx.lineWidth = 10;
    
    // Color based on speed
    let color;
    if (percentage < 0.3) {
        color = getComputedStyle(document.body).getPropertyValue('--secondary-color');
    } else if (percentage < 0.7) {
        color = getComputedStyle(document.body).getPropertyValue('--accent-color');
    } else {
        color = getComputedStyle(document.body).getPropertyValue('--danger-color');
    }
    
    ctx.strokeStyle = color;
    ctx.stroke();
    
    // Draw speed markers
    for (let i = 0; i <= 10; i++) {
        const markerValue = (speedGauge.maxSpeed / 10) * i;
        const angle = Math.PI - (i / 10) * Math.PI;
        const markerX = width / 2 + Math.cos(angle) * (width / 2 - 15);
        const markerY = height + Math.sin(angle) * (width / 2 - 15);
        
        ctx.beginPath();
        ctx.moveTo(
            width / 2 + Math.cos(angle) * (width / 2 - 10),
            height + Math.sin(angle) * (width / 2 - 10)
        );
        ctx.lineTo(
            width / 2 + Math.cos(angle) * (width / 2),
            height + Math.sin(angle) * (width / 2)
        );
        ctx.lineWidth = i % 5 === 0 ? 2 : 1;
        ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--text-color');
        ctx.stroke();
        
        // Add labels for major markers
        if (i % 2 === 0) {
            ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-color');
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(
                markerValue.toFixed(0),
                markerX,
                markerY - 5
            );
        }
    }
    
    // Draw needle
    const needleAngle = Math.PI - percentage * Math.PI;
    ctx.beginPath();
    ctx.moveTo(width / 2, height);
    ctx.lineTo(
        width / 2 + Math.cos(needleAngle) * (width / 2 - 20),
        height + Math.sin(needleAngle) * (width / 2 - 20)
    );
    ctx.lineWidth = 2;
    ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--danger-color');
    ctx.stroke();
    
    // Draw center cap
    ctx.beginPath();
    ctx.arc(width / 2, height, 5, 0, Math.PI * 2);
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-color');
    ctx.fill();
}

// Initialize wind direction indicator
function initWindDirection() {
    const windDirectionContainer = document.getElementById('wind-direction');
    
    // Create canvas for compass
    windDirectionContainer.innerHTML = '<canvas id="wind-direction-canvas" width="150" height="150"></canvas>';
    windDirectionCanvas = document.getElementById('wind-direction-canvas');
    windDirectionCtx = windDirectionCanvas.getContext('2d');
    
    // Draw initial compass
    updateWindDirection(0);
}

// Update wind direction indicator
function updateWindDirection(direction) {
    const ctx = windDirectionCtx;
    const canvas = windDirectionCanvas;
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 10;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Draw compass circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--border-color');
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw cardinal points
    const cardinalPoints = ['N', 'E', 'S', 'W'];
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-color');
    
    cardinalPoints.forEach((point, index) => {
        const angle = (index * Math.PI / 2) - Math.PI / 2;
        const x = centerX + Math.cos(angle) * (radius - 15);
        const y = centerY + Math.sin(angle) * (radius - 15);
        ctx.fillText(point, x, y);
    });
    
    // Draw direction arrow
    const arrowAngle = (direction * Math.PI / 180) - Math.PI / 2;
    
    // Arrow body
    ctx.beginPath();
    ctx.moveTo(
        centerX + Math.cos(arrowAngle) * radius,
        centerY + Math.sin(arrowAngle) * radius
    );
    ctx.lineTo(
        centerX - Math.cos(arrowAngle) * (radius / 3),
        centerY - Math.sin(arrowAngle) * (radius / 3)
    );
    ctx.lineWidth = 3;
    ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--accent-color');
    ctx.stroke();
    
    // Arrow head
    ctx.beginPath();
    ctx.moveTo(
        centerX + Math.cos(arrowAngle) * radius,
        centerY + Math.sin(arrowAngle) * radius
    );
    ctx.lineTo(
        centerX + Math.cos(arrowAngle - 0.2) * (radius - 10),
        centerY + Math.sin(arrowAngle - 0.2) * (radius - 10)
    );
    ctx.lineTo(
        centerX + Math.cos(arrowAngle + 0.2) * (radius - 10),
        centerY + Math.sin(arrowAngle + 0.2) * (radius - 10)
    );
    ctx.closePath();
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--accent-color');
    ctx.fill();
    
    // Draw center
    ctx.beginPath();
    ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-color');
    ctx.fill();
}

// Initialize tilt gauge
function initTiltGauge() {
    const tiltGaugeContainer = document.getElementById('tilt-gauge');
    
    // Create canvas for tilt indicator
    tiltGaugeContainer.innerHTML = '<canvas id="tilt-gauge-canvas" width="200" height="100"></canvas>';
    const canvas = document.getElementById('tilt-gauge-canvas');
    const ctx = canvas.getContext('2d');
    
    // Store for updates
    tiltGauge = {
        canvas: canvas,
        ctx: ctx,
        maxTilt: 45 // Default max tilt in degrees
    };
    
    // Draw initial gauge
    updateTiltGauge(0);
}

// Update tilt gauge
function updateTiltGauge(tilt) {
    const { ctx, canvas, maxTilt } = tiltGauge;
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height - 20;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Draw horizon line
    ctx.beginPath();
    ctx.moveTo(20, centerY);
    ctx.lineTo(width - 20, centerY);
    ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--border-color');
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw boat
    // Calculate boat tilt (limit to maxTilt)
    const limitedTilt = Math.max(Math.min(tilt, maxTilt), -maxTilt);
    const tiltRatio = limitedTilt / maxTilt;
    const tiltAngle = tiltRatio * (Math.PI / 4); // Max 45 degrees in radians
    
    // Boat dimensions
    const boatWidth = 60;
    const boatHeight = 15;
    const mastHeight = 40;
    
    // Save context for rotation
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(tiltAngle);
    
    // Draw boat hull
    ctx.beginPath();
    ctx.moveTo(-boatWidth / 2, 0);
    ctx.lineTo(boatWidth / 2, 0);
    ctx.lineTo(boatWidth / 3, boatHeight);
    ctx.lineTo(-boatWidth / 3, boatHeight);
    ctx.closePath();
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--secondary-color');
    ctx.fill();
    
    // Draw mast
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -mastHeight);
    ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--text-color');
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Restore context
    ctx.restore();
    
    // Draw tilt angle markers
    for (let i = -3; i <= 3; i++) {
        if (i === 0) continue; // Skip center
        
        const markerX = centerX + (width / 3) * (i / 3);
        const markerY = centerY;
        
        ctx.beginPath();
        ctx.moveTo(markerX, markerY - 5);
        ctx.lineTo(markerX, markerY + 5);
        ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--text-color');
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Add angle labels
        const angle = (maxTilt / 3) * i;
        ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-color');
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.abs(angle)}°`, markerX, markerY + 15);
    }
    
    // Label port and starboard
    ctx.font = '12px sans-serif';
    ctx.fillText('Port', 30, centerY - 10);
    ctx.fillText('Starboard', width - 30, centerY - 10);
}
