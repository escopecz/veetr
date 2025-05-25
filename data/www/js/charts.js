// Chart visualizations for Luna Sailing Dashboard

// Store chart instances
let speedChart;
let windChart;
let tiltChart;

// Chart data storage
const chartData = {
    timestamps: [],
    speed: [],
    windSpeed: [],
    windDirection: [],
    tilt: []
};

// Maximum number of data points to show
const MAX_DATA_POINTS = 60; // Show 1 minute of data at 1Hz

// Initialize all charts
function initCharts() {
    // Only initialize charts if Chart.js is loaded
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js not loaded, skipping chart initialization');
        return;
    }
    
    initSpeedChart();
    initWindChart();
    initTiltChart();
}

// Initialize speed chart
function initSpeedChart() {
    const ctx = document.getElementById('speed-chart').getContext('2d');
    
    speedChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Speed (knots)',
                data: [],
                borderColor: getComputedStyle(document.body).getPropertyValue('--secondary-color'),
                backgroundColor: hexToRgba(getComputedStyle(document.body).getPropertyValue('--secondary-color'), 0.2),
                borderWidth: 2,
                fill: true,
                tension: 0.3
            }]
        },
        options: getChartOptions('Vessel Speed')
    });
}

// Initialize wind chart
function initWindChart() {
    const ctx = document.getElementById('wind-chart').getContext('2d');
    
    windChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Wind Speed (knots)',
                    data: [],
                    borderColor: getComputedStyle(document.body).getPropertyValue('--accent-color'),
                    backgroundColor: hexToRgba(getComputedStyle(document.body).getPropertyValue('--accent-color'), 0.2),
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3,
                    yAxisID: 'y'
                },
                {
                    label: 'Direction (°)',
                    data: [],
                    borderColor: getComputedStyle(document.body).getPropertyValue('--primary-color'),
                    borderWidth: 1,
                    borderDash: [5, 5],
                    pointRadius: 2,
                    fill: false,
                    tension: 0.1,
                    yAxisID: 'y1'
                }
            ]
        },
        options: getWindChartOptions()
    });
}

// Initialize tilt chart
function initTiltChart() {
    const ctx = document.getElementById('tilt-chart').getContext('2d');
    
    tiltChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Heel Angle (°)',
                data: [],
                borderColor: getComputedStyle(document.body).getPropertyValue('--danger-color'),
                backgroundColor: hexToRgba(getComputedStyle(document.body).getPropertyValue('--danger-color'), 0.2),
                borderWidth: 2,
                fill: true,
                tension: 0.3
            }]
        },
        options: getChartOptions('Heel Angle')
    });
}

// Get default chart options
function getChartOptions(title) {
    const textColor = getComputedStyle(document.body).getPropertyValue('--text-color');
    
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            title: {
                display: true,
                text: title,
                color: textColor
            },
            legend: {
                display: false
            },
            tooltip: {
                mode: 'index',
                intersect: false
            }
        },
        scales: {
            x: {
                display: false
            },
            y: {
                beginAtZero: true,
                ticks: {
                    color: textColor
                },
                grid: {
                    color: hexToRgba(textColor, 0.1)
                }
            }
        },
        animation: {
            duration: 300
        }
    };
}

// Get wind chart options with dual y-axes
function getWindChartOptions() {
    const textColor = getComputedStyle(document.body).getPropertyValue('--text-color');
    const options = getChartOptions('Wind');
    
    // Add second y-axis for wind direction
    options.scales.y1 = {
        type: 'linear',
        position: 'right',
        min: 0,
        max: 360,
        ticks: {
            color: textColor,
            callback: function(value) {
                if (value === 0) return 'N';
                if (value === 90) return 'E';
                if (value === 180) return 'S';
                if (value === 270) return 'W';
                if (value === 360) return 'N';
                return '';
            }
        },
        grid: {
            drawOnChartArea: false
        }
    };
    
    // Show legend for wind chart to distinguish between speed and direction
    options.plugins.legend.display = true;
    
    return options;
}

// Update charts with new data
function updateCharts(historyData) {
    if (!speedChart || !windChart || !tiltChart) return;
    
    // Add current timestamp
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    // Update data arrays
    chartData.timestamps.push(timestamp);
    chartData.speed.push(historyData.speed);
    chartData.windSpeed.push(historyData.windSpeed);
    chartData.windDirection.push(historyData.windDirection);
    chartData.tilt.push(historyData.tilt);
    
    // Limit array size
    if (chartData.timestamps.length > MAX_DATA_POINTS) {
        chartData.timestamps.shift();
        chartData.speed.shift();
        chartData.windSpeed.shift();
        chartData.windDirection.shift();
        chartData.tilt.shift();
    }
    
    // Update chart data
    speedChart.data.labels = chartData.timestamps;
    speedChart.data.datasets[0].data = chartData.speed;
    
    windChart.data.labels = chartData.timestamps;
    windChart.data.datasets[0].data = chartData.windSpeed;
    windChart.data.datasets[1].data = chartData.windDirection;
    
    tiltChart.data.labels = chartData.timestamps;
    tiltChart.data.datasets[0].data = chartData.tilt;
    
    // Update charts
    speedChart.update();
    windChart.update();
    tiltChart.update();
}

// Update charts theme
function updateChartsTheme() {
    if (!speedChart || !windChart || !tiltChart) return;
    
    const textColor = getComputedStyle(document.body).getPropertyValue('--text-color');
    const secondaryColor = getComputedStyle(document.body).getPropertyValue('--secondary-color');
    const accentColor = getComputedStyle(document.body).getPropertyValue('--accent-color');
    const primaryColor = getComputedStyle(document.body).getPropertyValue('--primary-color');
    const dangerColor = getComputedStyle(document.body).getPropertyValue('--danger-color');
    
    // Update speed chart
    speedChart.data.datasets[0].borderColor = secondaryColor;
    speedChart.data.datasets[0].backgroundColor = hexToRgba(secondaryColor, 0.2);
    speedChart.options.plugins.title.color = textColor;
    speedChart.options.scales.y.ticks.color = textColor;
    speedChart.options.scales.y.grid.color = hexToRgba(textColor, 0.1);
    
    // Update wind chart
    windChart.data.datasets[0].borderColor = accentColor;
    windChart.data.datasets[0].backgroundColor = hexToRgba(accentColor, 0.2);
    windChart.data.datasets[1].borderColor = primaryColor;
    windChart.options.plugins.title.color = textColor;
    windChart.options.scales.y.ticks.color = textColor;
    windChart.options.scales.y.grid.color = hexToRgba(textColor, 0.1);
    windChart.options.scales.y1.ticks.color = textColor;
    
    // Update tilt chart
    tiltChart.data.datasets[0].borderColor = dangerColor;
    tiltChart.data.datasets[0].backgroundColor = hexToRgba(dangerColor, 0.2);
    tiltChart.options.plugins.title.color = textColor;
    tiltChart.options.scales.y.ticks.color = textColor;
    tiltChart.options.scales.y.grid.color = hexToRgba(textColor, 0.1);
    
    // Update charts
    speedChart.update();
    windChart.update();
    tiltChart.update();
}

// Helper to convert hex color to rgba
function hexToRgba(hex, alpha) {
    // Default value if invalid hex
    if (!hex || typeof hex !== 'string') {
        return `rgba(0, 0, 0, ${alpha})`;
    }
    
    // Remove # if present
    hex = hex.replace('#', '');
    
    // Convert shorthand hex to full form
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    
    // Parse hex values
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    // Return rgba
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
