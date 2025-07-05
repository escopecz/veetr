/**
 * Sailing Dashboard Interactive Map
 * Generic map implementation that works with GPS coordinates from ESP32
 * 
 * Usage Examples:
 * 
 * // For Orlik Dam, Czech Republic:
 * new SailingMap({
 *     initialLocation: [49.5167, 14.1667],
 *     locationName: 'Orlik Dam',
 *     waterBodyName: 'Vltava River'
 * });
 * 
 * // For Lake Geneva, Switzerland:
 * new SailingMap({
 *     initialLocation: [46.4548, 6.5602],
 *     locationName: 'Lake Geneva',
 *     waterBodyName: 'Lac Léman'
 * });
 * 
 * // For San Francisco Bay, USA:
 * new SailingMap({
 *     initialLocation: [37.8272, -122.2913],
 *     locationName: 'San Francisco Bay',
 *     waterBodyName: 'Pacific Ocean'
 * });
 */

class SailingMap {
    constructor(options = {}) {
        this.map = null;
        this.currentLocation = options.initialLocation || [49.5167, 14.1667]; // Default to Orlik Dam
        this.defaultZoom = options.zoom || 15;
        this.locationName = options.locationName || 'Sailing Location';
        this.waterBodyName = options.waterBodyName || 'Water Area';
        this.initialized = false;
        
        // GPS tracking
        this.gpsMarker = null;
        this.trackingEnabled = false;
        this.positionHistory = [];
    }

    init() {
        if (this.initialized) return;

        try {
            // Initialize the map centered on current location
            this.map = L.map('sailing-map', {
                center: this.currentLocation,
                zoom: this.defaultZoom,
                zoomControl: true,
                attributionControl: true,
                doubleClickZoom: true,
                scrollWheelZoom: true,
                touchZoom: true,
                dragging: true
            });

            // Add base map layers
            this.addBaseLayers();

            // Add layer control
            this.addLayerControl();

            // Add location markers and features
            this.addLocationFeatures();

            // Initialize GPS tracking
            this.initGPSTracking();

            // Mark as initialized
            this.initialized = true;

            console.log('Sailing map initialized successfully at', this.currentLocation);
        } catch (error) {
            console.error('Failed to initialize sailing map:', error);
        }
    }

    addBaseLayers() {
        // OpenStreetMap base layer
        const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        });

        // Satellite imagery
        const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: '© Esri, Maxar, GeoEye, Earthstar Geographics',
            maxZoom: 18
        });

        // Topographic map
        const topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenTopoMap (CC-BY-SA)',
            maxZoom: 17
        });

        // Add default layer (OSM)
        osmLayer.addTo(this.map);

        // Store layers for layer control
        this.baseLayers = {
            'OpenStreetMap': osmLayer,
            'Satellite': satelliteLayer,
            'Topographic': topoLayer
        };
    }

    addLayerControl() {
        // Create layer control
        L.control.layers(this.baseLayers).addTo(this.map);
    }

    addLocationFeatures() {
        // Add marker for current sailing location
        const locationMarker = L.marker(this.currentLocation, {
            title: this.locationName
        }).addTo(this.map);

        locationMarker.bindPopup(`
            <div style="text-align: center;">
                <h3>${this.locationName}</h3>
                <p><strong>Current Sailing Location</strong></p>
                <p>Lat: ${this.currentLocation[0].toFixed(4)}, Lon: ${this.currentLocation[1].toFixed(4)}</p>
            </div>
        `);

        // Add scale control
        L.control.scale({
            metric: true,
            imperial: false
        }).addTo(this.map);
    }

    // Initialize GPS tracking for ESP32 integration
    initGPSTracking() {
        // Create a custom boat icon
        const boatIcon = L.divIcon({
            className: 'boat-marker',
            html: '🚤',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });

        // Add CSS for boat marker
        if (!document.getElementById('boat-marker-css')) {
            const style = document.createElement('style');
            style.id = 'boat-marker-css';
            style.textContent = `
                .boat-marker {
                    font-size: 20px;
                    text-align: center;
                    line-height: 30px;
                    filter: drop-shadow(2px 4px 6px rgba(0,0,0,0.4)) drop-shadow(0px 8px 12px rgba(0,0,0,0.2));
                    position: relative;
                    z-index: 10;
                }
                .boat-marker::before {
                    content: '';
                    position: absolute;
                    bottom: -8px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 24px;
                    height: 8px;
                    background: rgba(0,0,0,0.3);
                    border-radius: 50%;
                    filter: blur(2px);
                    z-index: -1;
                }
            `;
            document.head.appendChild(style);
        }

        // Initialize GPS marker (will be updated with real coordinates)
        this.gpsMarker = L.marker(this.currentLocation, {
            icon: boatIcon,
            title: 'Current Position'
        }).addTo(this.map);

        this.gpsMarker.bindPopup(`
            <div style="text-align: center;">
                <h3>Luna Sailing</h3>
                <p>Current Position</p>
                <p id="gps-coordinates">Lat: ${this.currentLocation[0].toFixed(6)}, Lon: ${this.currentLocation[1].toFixed(6)}</p>
                <p id="gps-timestamp">Waiting for GPS data...</p>
            </div>
        `);
    }

    // Update GPS position from ESP32 data
    updateGPSPosition(latitude, longitude, timestamp = null) {
        if (!this.gpsMarker) return;

        const newPosition = [latitude, longitude];
        
        // Update marker position
        this.gpsMarker.setLatLng(newPosition);
        
        // Update current location
        this.currentLocation = newPosition;
        
        // Add to position history for track
        this.positionHistory.push({
            position: newPosition,
            timestamp: timestamp || new Date()
        });
        
        // Keep only last 100 positions
        if (this.positionHistory.length > 100) {
            this.positionHistory.shift();
        }
        
        // Update popup content
        const timeStr = timestamp ? new Date(timestamp).toLocaleTimeString() : 'Live';
        this.gpsMarker.getPopup().setContent(`
            <div style="text-align: center;">
                <h3>Luna Sailing</h3>
                <p>Current Position</p>
                <p id="gps-coordinates">Lat: ${latitude.toFixed(6)}, Lon: ${longitude.toFixed(6)}</p>
                <p id="gps-timestamp">Updated: ${timeStr}</p>
            </div>
        `);
        
        console.log('GPS position updated:', latitude, longitude);
    }

    // Center map on current GPS position
    centerOnCurrentPosition() {
        if (this.map && this.currentLocation) {
            this.map.setView(this.currentLocation, this.defaultZoom);
        }
    }

    // Set a new sailing location (useful for different sailing areas)
    setSailingLocation(latitude, longitude, name = 'Sailing Location', waterBodyName = 'Water Area') {
        this.currentLocation = [latitude, longitude];
        this.locationName = name;
        this.waterBodyName = waterBodyName;
        
        if (this.map && this.initialized) {
            this.map.setView(this.currentLocation, this.defaultZoom);
            // Refresh location features
            this.addLocationFeatures();
        }
    }

    // Method to update map size (useful for responsive design)
    invalidateSize() {
        if (this.map) {
            setTimeout(() => {
                this.map.invalidateSize();
            }, 100);
        }
   }

    // Predefined sailing locations for easy setup
    static SAILING_LOCATIONS = {
        ORLIK_DAM: {
            coordinates: [49.5167, 14.1667],
            name: 'Orlik Dam',
            waterBody: 'Vltava River',
            country: 'Czech Republic'
        },
        LAKE_GENEVA: {
            coordinates: [46.4548, 6.5602],
            name: 'Lake Geneva',
            waterBody: 'Lac Léman',
            country: 'Switzerland'
        },
        SAN_FRANCISCO_BAY: {
            coordinates: [37.8272, -122.2913],
            name: 'San Francisco Bay',
            waterBody: 'Pacific Ocean',
            country: 'USA'
        },
        LAKE_BALATON: {
            coordinates: [46.9073, 17.7624],
            name: 'Lake Balaton',
            waterBody: 'Balaton',
            country: 'Hungary'
        },
        SOLENT: {
            coordinates: [50.7489, -1.2933],
            name: 'The Solent',
            waterBody: 'English Channel',
            country: 'UK'
        }
    };

    // Helper method to quickly set up a predefined location
    static createForLocation(locationKey, options = {}) {
        const location = SailingMap.SAILING_LOCATIONS[locationKey];
        if (!location) {
            throw new Error(`Unknown sailing location: ${locationKey}`);
        }
        
        return new SailingMap({
            initialLocation: location.coordinates,
            locationName: location.name,
            waterBodyName: location.waterBody,
            ...options
        });
    }
}

// Initialize map when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Wait a bit for the DOM to fully settle
    setTimeout(() => {
        // Easy way: Use predefined location
        window.sailingMap = SailingMap.createForLocation('ORLIK_DAM', {
            zoom: 15
        });
        
        // Alternative: Manual configuration for custom locations
        // window.sailingMap = new SailingMap({
        //     initialLocation: [49.5167, 14.1667],
        //     zoom: 15,
        //     locationName: 'Custom Sailing Spot',
        //     waterBodyName: 'Custom Water Body'
        // });
        
        window.sailingMap.init();
        
        // Handle window resize
        window.addEventListener('resize', () => {
            window.sailingMap.invalidateSize();
        });
        
        // Global functions for ESP32 integration
        // These functions will be called by ble.js when GPS data arrives
        window.updateMapPosition = function(lat, lon, timestamp) {
            if (window.sailingMap) {
                window.sailingMap.updateGPSPosition(lat, lon, timestamp);
            }
        };
        
        // Center on current position function
        window.centerMapOnPosition = function() {
            if (window.sailingMap) {
                window.sailingMap.centerOnCurrentPosition();
            }
        };
        
        // Function to change sailing location (useful for settings)
        window.changeSailingLocation = function(locationKey) {
            const location = SailingMap.SAILING_LOCATIONS[locationKey];
            if (location && window.sailingMap) {
                window.sailingMap.setSailingLocation(
                    location.coordinates[0],
                    location.coordinates[1],
                    location.name,
                    location.waterBody
                );
            }
        };
        
        console.log('Sailing map initialized. Available locations:', Object.keys(SailingMap.SAILING_LOCATIONS));
    }, 100);
});
