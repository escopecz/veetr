#include <Arduino.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <vector>
#include <TinyGPS++.h>
#include <Wire.h>
#include <Adafruit_ADXL345_U.h>
#include <NimBLEDevice.h>
#include <ModbusMaster.h>

// Debug flags - uncomment for verbose output
#define DEBUG_BLE_DATA
#define DEBUG_WIND_SENSOR
// #define DEBUG_GPS
// #define DEBUG_ACCEL

// Persistent storage for settings
Preferences preferences;
float heelAngleDelta = 0.0f;
int deadWindAngle = 40; // default
String boatName = "My Boat"; // default boat name

// BLE Configuration
#define SERVICE_UUID        "12345678-1234-1234-1234-123456789abc"
#define SENSOR_DATA_UUID    "87654321-4321-4321-4321-cba987654321"
#define COMMAND_UUID        "11111111-2222-3333-4444-555555555555"

NimBLEServer* pServer = NULL;
NimBLECharacteristic* pSensorDataCharacteristic = NULL;
NimBLECharacteristic* pCommandCharacteristic = NULL;
bool deviceConnected = false;
bool oldDeviceConnected = false;
int bleRSSI = 0; // BLE signal strength
uint16_t connectedDeviceCount = 0; // Track number of connected devices

// ADXL345 Accelerometer (I2C)
#define ADXL345_SDA 18
#define ADXL345_SCL 19
Adafruit_ADXL345_Unified accel = Adafruit_ADXL345_Unified(12345);
bool accelAvailable = false; // Track if accelerometer is working

// RS485 Wind Sensor Configuration
#define RS485_DE 14
#define RS485_RX 32
#define RS485_TX 33
#define RS485_UART 2

// GPS Module Configuration (using UART1)
#define GPS_RX 16
#define GPS_TX 17
#define GPS_UART 1

// RS485 Wind Sensor
HardwareSerial rs485(RS485_UART);
ModbusMaster windSensor;

// GPS Module
HardwareSerial gpsSerial(GPS_UART);
TinyGPSPlus gps;

// Function prototypes (declared early for use in callbacks)
void setupBLE();
void preTransmission();
void postTransmission();
float regsToFloat(uint16_t lowReg, uint16_t highReg);

// BLE Server Callbacks
class MyServerCallbacks: public NimBLEServerCallbacks {
    void onConnect(NimBLEServer* pServer) {
      connectedDeviceCount++;
      deviceConnected = true;
      Serial.printf("BLE Client connected (total: %d)\n", connectedDeviceCount);
      
      // Continue advertising if we haven't reached max connections
      if (connectedDeviceCount < CONFIG_BT_NIMBLE_MAX_CONNECTIONS) {
        NimBLEDevice::startAdvertising();
        Serial.println("Continuing advertising for additional connections...");
      }
    };

    void onDisconnect(NimBLEServer* pServer) {
      connectedDeviceCount--;
      if (connectedDeviceCount == 0) {
        deviceConnected = false;
        bleRSSI = 0; // Reset RSSI when all devices disconnected
      }
      Serial.printf("BLE Client disconnected (remaining: %d)\n", connectedDeviceCount);
      
      // Restart advertising when a device disconnects
      delay(500);
      NimBLEDevice::startAdvertising();
      Serial.println("Restarting advertising...");
    }
};

class CommandCallbacks: public NimBLECharacteristicCallbacks {
    void onWrite(NimBLECharacteristic *pCharacteristic) {
      std::string value = pCharacteristic->getValue();
      
      if (value.length() > 0) {
        #ifdef DEBUG_BLE_DATA
        Serial.print("BLE Command received: ");
        Serial.println(value.c_str());
        #endif
        
        // Parse JSON command
        DynamicJsonDocument doc(256);
        DeserializationError error = deserializeJson(doc, value.c_str());
        
        if (!error) {
          String action = doc["action"];
          
          if (action == "resetHeelAngle") {
            // Reset heel angle by saving current tilt as delta
            if (accelAvailable) {
              sensors_event_t event;
              if (accel.getEvent(&event)) {
                heelAngleDelta = atan2(event.acceleration.y, event.acceleration.z) * 180.0 / PI;
                preferences.putFloat("delta", heelAngleDelta);
                Serial.println("Heel angle reset");
              } else {
                Serial.println("Heel angle reset failed - can't read accelerometer");
              }
            } else {
              Serial.println("Heel angle reset failed - accelerometer not available");
            }
          }
          else if (action == "regattaSetPort") {
            Serial.println("Regatta port line set");
            // TODO: Implement regatta line setting logic
          }
          else if (action == "regattaSetStarboard") {
            Serial.println("Regatta starboard line set");
            // TODO: Implement regatta line setting logic
          }
          else if (action == "setBoatName") {
            String newBoatName = doc["boatName"];
            if (newBoatName.length() > 0 && newBoatName.length() <= 20) {
              // Basic validation: remove leading/trailing spaces and validate characters
              newBoatName.trim();
              
              // Check for invalid characters that could break JSON or BLE
              bool validName = true;
              for (int i = 0; i < newBoatName.length(); i++) {
                char c = newBoatName[i];
                if (c == '"' || c == '\\' || c < 32 || c > 126) {
                  validName = false;
                  break;
                }
              }
              
              if (validName && newBoatName.length() > 0) {
                boatName = newBoatName;
                preferences.putString("boatName", boatName);
                Serial.printf("Boat name set to: '%s'\n", boatName.c_str());
                
                // Restart BLE advertising with new name
                NimBLEDevice::stopAdvertising();
                NimBLEDevice::deinit();
                delay(500);
                setupBLE();
                Serial.println("BLE restarted with new boat name");
              } else {
                Serial.println("Invalid boat name - no quotes, backslashes, or control characters allowed");
              }
            } else {
              Serial.println("Invalid boat name - must be 1-20 characters");
            }
          }
        }
      }
    }
};

// Function to read BLE connection RSSI
void updateBLERSSI() {
  if (deviceConnected && pServer) {
    // Get the actual RSSI from connected devices
    std::vector<uint16_t> connIds = pServer->getPeerDevices();
    if (!connIds.empty()) {
      // Use NimBLE API to get RSSI for the first connected device
      uint16_t connHandle = connIds[0];
      
      // Call the NimBLE function to read RSSI
      int8_t rssi = 0;
      if (ble_gap_conn_rssi(connHandle, &rssi) == 0) {
        bleRSSI = rssi;
      } else {
        bleRSSI = -50; // Fallback if RSSI read fails
      }
      
      #ifdef DEBUG_BLE_DATA
      static unsigned long lastRSSIDebug = 0;
      if (millis() - lastRSSIDebug > 10000) { // Debug every 10 seconds
        Serial.printf("[BLE] %d devices connected, RSSI: %d dBm\n", connIds.size(), bleRSSI);
        // Show RSSI for all connected devices
        for (uint16_t connId : connIds) {
          int8_t deviceRSSI = 0;
          if (ble_gap_conn_rssi(connId, &deviceRSSI) == 0) {
            Serial.printf("  Device %d: %d dBm\n", connId, deviceRSSI);
          }
        }
        lastRSSIDebug = millis();
      }
      #endif
    } else {
      bleRSSI = 0; // No valid connection IDs
    }
  } else {
    bleRSSI = 0; // No connection
  }
}

// ModbusMaster callback functions for RS485 control
void preTransmission() { 
  digitalWrite(RS485_DE, HIGH); 
}

void postTransmission() { 
  digitalWrite(RS485_DE, LOW); 
}

// Convert two Modbus registers (32 bits) to float
float regsToFloat(uint16_t lowReg, uint16_t highReg) {
  uint32_t combined = ((uint32_t)highReg << 16) | lowReg;
  float value;
  memcpy(&value, &combined, sizeof(value));
  return value;
}

// Data structure to hold sensor readings
struct SensorData {
  float speed;          // Vessel speed in knots
  float windSpeed;      // Apparent wind speed in knots
  int windDirection;    // Apparent wind direction in degrees (0-359)
  float trueWindSpeed;  // True wind speed in knots
  float trueWindDirection; // True wind direction in degrees (0-359)
  float tilt;           // Vessel heel/tilt angle in degrees
};

// Function to calculate true wind from apparent wind
// Assumes vessel heading is 0 degrees (north) for simplification
// In a real implementation, you would need compass/GPS heading data
void calculateTrueWind(float vesselSpeed, float apparentWindSpeed, float apparentWindDirection, 
                       float &trueWindSpeed, float &trueWindDirection) {
  
  // Convert degrees to radians
  float appWindDirRad = apparentWindDirection * PI / 180.0;
  
  // Convert apparent wind to components (relative to vessel)
  float appWindX = apparentWindSpeed * sin(appWindDirRad);  // Cross-track component
  float appWindY = apparentWindSpeed * cos(appWindDirRad);  // Along-track component
  
  // Calculate true wind components
  // True wind = apparent wind - vessel velocity
  float trueWindX = appWindX;  // Cross-track unchanged
  float trueWindY = appWindY - vesselSpeed;  // Subtract vessel speed from along-track
  
  // Calculate true wind speed and direction
  trueWindSpeed = sqrt(trueWindX * trueWindX + trueWindY * trueWindY);
  
  // Calculate true wind direction (in degrees)
  trueWindDirection = atan2(trueWindX, trueWindY) * 180.0 / PI;
  
  // Normalize to 0-359 degrees
  if (trueWindDirection < 0) {
    trueWindDirection += 360.0;
  }
  
  // Ensure we don't have negative wind speeds
  if (trueWindSpeed < 0) {
    trueWindSpeed = 0;
  }
}

// Current sensor data
SensorData currentData = {0};

// GPS status
bool gpsDataValid = false;

// Refresh rate in milliseconds
int refreshRate = 1000;

// Timestamp for next update
unsigned long nextUpdate = 0;

// Function prototypes
void readSensors();
String getSensorDataJson();
void setupBLE();
void updateBLEData();
float filterGPSSpeed(float rawSpeed, int satellites, float hdop);

// Wind Sensor Functions
bool readWindSensor(float &windSpeed, int &windDirection);

// GPS Functions
bool readGPS();
bool isGPSDataValid();

// BLE Setup Function
void setupBLE() {
  // Initialize NimBLE with boat name
  NimBLEDevice::init(boatName.c_str());
  
  // Set TX power for balance between range and power consumption
  NimBLEDevice::setPower(ESP_PWR_LVL_P3); // +3dBm for better range
  
  // Create the BLE Server with connection callbacks
  pServer = NimBLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  // Create the BLE Service
  NimBLEService *pService = pServer->createService(SERVICE_UUID);

  // Create BLE Characteristics
  
  // Sensor Data Characteristic (notify + read for better compatibility)
  pSensorDataCharacteristic = pService->createCharacteristic(
                      SENSOR_DATA_UUID,
                      NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY
                    );
  
  // Command Characteristic (write only)
  pCommandCharacteristic = pService->createCharacteristic(
                      COMMAND_UUID,
                      NIMBLE_PROPERTY::WRITE
                    );
  pCommandCharacteristic->setCallbacks(new CommandCallbacks());

  // Start the service
  pService->start();

  // Start advertising with settings to support multiple connections
  NimBLEAdvertising *pAdvertising = NimBLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);  // 7.5ms intervals
  pAdvertising->setMaxPreferred(0x12);  // 22.5ms intervals
  pAdvertising->start();
  
  Serial.printf("NimBLE Server started as '%s', waiting for client connections...\n", boatName.c_str());
  Serial.printf("Multiple connections supported (max %d)\n", CONFIG_BT_NIMBLE_MAX_CONNECTIONS);
}

// Update BLE with current sensor data
void updateBLEData() {
  if (deviceConnected && pSensorDataCharacteristic) {
    String jsonData = getSensorDataJson();
    
    // Check if JSON is valid and not too large for BLE
    const int MAX_BLE_PACKET_SIZE = 300; // Increased for marine standard JSON
    
    if (jsonData.length() > MAX_BLE_PACKET_SIZE) {
      Serial.printf("[BLE] ERROR: JSON too large (%d bytes, max %d)\n", jsonData.length(), MAX_BLE_PACKET_SIZE);
      return; // Don't send invalid data
    }
    
    // Validate JSON format
    if (!jsonData.startsWith("{") || !jsonData.endsWith("}")) {
      Serial.println("[BLE] ERROR: Invalid JSON format");
      return;
    }
    
    #ifdef DEBUG_BLE_DATA
    Serial.printf("[BLE] %lu: Sending %d bytes to %d devices: %s\n", 
                  millis(), jsonData.length(), connectedDeviceCount, jsonData.c_str());
    #endif
    
    // Send to all connected devices
    // Double-check connection state before sending
    if (pServer->getConnectedCount() > 0) {
      // Create byte array to avoid string encoding issues
      std::vector<uint8_t> data(jsonData.begin(), jsonData.end());
      pSensorDataCharacteristic->setValue(data);
      pSensorDataCharacteristic->notify();
    } else {
      Serial.println("[BLE] No connected devices found, skipping transmission");
    }
  }
}

void setup() {
  // Initialize Preferences for persistent storage
  preferences.begin("settings", false);
  heelAngleDelta = preferences.getFloat("delta", 0.0f);
  deadWindAngle = preferences.getInt("deadWindAngle", 40);
  boatName = preferences.getString("boatName", "Luna_Sailing");
  Serial.print("[Boot] Loaded heelAngleDelta from NVS: ");
  Serial.println(heelAngleDelta);
  Serial.print("[Boot] Loaded deadWindAngle from NVS: ");
  Serial.println(deadWindAngle);
  Serial.print("[Boot] Loaded boatName from NVS: ");
  Serial.println(boatName);
  // Initialize I2C for ADXL345 with detection
  Wire.begin(ADXL345_SDA, ADXL345_SCL);
  Wire.setTimeout(100); // Set I2C timeout to 100ms to prevent long blocking
  
  Serial.print("Testing ADXL345 connection... ");
  if (accel.begin()) {
    // Test if we can actually read data (not all zeros)
    sensors_event_t testEvent;
    delay(50); // Give sensor time to initialize
    
    if (accel.getEvent(&testEvent)) {
      // Check if we get real data (not all zeros)
      if (testEvent.acceleration.x != 0 || testEvent.acceleration.y != 0 || testEvent.acceleration.z != 0) {
        accelAvailable = true;
        accel.setRange(ADXL345_RANGE_16_G);
        Serial.println("Connected and working!");
      } else {
        accelAvailable = false;
        Serial.println("Detected but returning all zeros - check wiring/power");
      }
    } else {
      accelAvailable = false;
      Serial.println("Detected but can't read data - check wiring");
    }
  } else {
    accelAvailable = false;
    Serial.println("Not detected - check wiring/address");
  }
  
  if (accelAvailable) {
    Serial.println("ADXL345 accelerometer enabled");
  } else {
    Serial.println("ADXL345 accelerometer disabled - tilt will be set to 0");
  }
  // Initialize serial communication
  Serial.begin(115200);
  Serial.println("Luna Sailing Dashboard starting...");
  
  // Initialize BLE
  setupBLE();
  
  // Initialize GPS module
  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX, GPS_TX);
  Serial.println("GPS module initialized");
  
  // Initialize RS485 for wind sensor with ModbusMaster
  rs485.begin(9600, SERIAL_8E1, RS485_RX, RS485_TX);
  pinMode(RS485_DE, OUTPUT);
  digitalWrite(RS485_DE, LOW);
  
  windSensor.begin(1, rs485); // Sensor ID 1
  windSensor.preTransmission(preTransmission);
  windSensor.postTransmission(postTransmission);
  Serial.println("RS485 wind sensor initialized with ModbusMaster");
  
  // Initialize sensor data
  
  Serial.println("Setup complete");
}

void loop() {
  // Check if it's time to update data
  if (millis() >= nextUpdate) {
    // Read sensor data
    readSensors();
    
    // Update BLE RSSI if connected
    updateBLERSSI();
    
    // Update BLE clients with sensor data
    updateBLEData();
    
    // Set next update time
    nextUpdate = millis() + refreshRate;
    
    // Print concise status summary every 5 seconds
    static unsigned long lastStatusTime = 0;
    if (millis() - lastStatusTime > 5000) {
      Serial.print("Status: ");
      if (deviceConnected) {
        Serial.printf("BLE✓(%d) ", connectedDeviceCount);
        if (bleRSSI != 0) Serial.printf("RSSI:%ddBm ", bleRSSI);
      }
      if (!isnan(currentData.speed) && currentData.speed > 0) 
        Serial.printf("Spd:%.1fkt ", currentData.speed);
      if (!isnan(currentData.windSpeed)) 
        Serial.printf("Wind:%.1fkt@%d° ", currentData.windSpeed, currentData.windDirection);
      if (!isnan(currentData.tilt)) 
        Serial.printf("Tilt:%.1f° ", currentData.tilt);
      
      // GPS status - only show satellite count if we have actual GPS data
      if (gps.charsProcessed() > 10) {
        // We're receiving GPS data
        if (isGPSDataValid()) {
          Serial.printf("GPS:%dsat✓ ", gps.satellites.value());
        } else if (gps.satellites.isValid()) {
          Serial.printf("GPS:%dsat(no fix) ", gps.satellites.value());
        } else {
          Serial.print("GPS:parsing ");
        }
      } else {
        // No GPS data being received
        Serial.print("GPS:no data ");
      }
      
      Serial.println();
      lastStatusTime = millis();
    }
  }
}

// GPS track-based filtering variables
const int GPS_TRACK_BUFFER_SIZE = 10;  // Track last 10 positions
struct GPSPoint {
  double lat;
  double lon;
  float speed;
  unsigned long timestamp;
  bool valid;
};

static GPSPoint gpsTrackBuffer[GPS_TRACK_BUFFER_SIZE];
static int gpsTrackIndex = 0;
static bool gpsTrackBufferFull = false;
static float lastValidSpeed = 0.0;

// Calculate distance between two GPS points in meters
float calculateDistance(double lat1, double lon1, double lat2, double lon2) {
  const float R = 6371000; // Earth's radius in meters
  float dLat = (lat2 - lat1) * PI / 180.0;
  float dLon = (lon2 - lon1) * PI / 180.0;
  float a = sin(dLat/2) * sin(dLat/2) +
            cos(lat1 * PI / 180.0) * cos(lat2 * PI / 180.0) *
            sin(dLon/2) * sin(dLon/2);
  float c = 2 * atan2(sqrt(a), sqrt(1-a));
  return R * c;
}

// Calculate bearing between two GPS points in degrees
float calculateBearing(double lat1, double lon1, double lat2, double lon2) {
  float dLon = (lon2 - lon1) * PI / 180.0;
  float y = sin(dLon) * cos(lat2 * PI / 180.0);
  float x = cos(lat1 * PI / 180.0) * sin(lat2 * PI / 180.0) -
            sin(lat1 * PI / 180.0) * cos(lat2 * PI / 180.0) * cos(dLon);
  float bearing = atan2(y, x) * 180.0 / PI;
  return fmod(bearing + 360.0, 360.0);
}

// Analyze GPS track to determine if movement is real
bool isMovementConsistent() {
  if (!gpsTrackBufferFull && gpsTrackIndex < 3) {
    return false; // Need at least 3 points
  }
  
  int validPoints = gpsTrackBufferFull ? GPS_TRACK_BUFFER_SIZE : gpsTrackIndex;
  if (validPoints < 3) return false;
  
  // Calculate total distance and bearing changes
  float totalDistance = 0.0;
  float totalBearingChange = 0.0;
  float lastBearing = 0.0;
  bool firstBearing = true;
  int consecutivePoints = 0;
  
  for (int i = 1; i < validPoints; i++) {
    int prevIdx = (gpsTrackIndex - validPoints + i - 1 + GPS_TRACK_BUFFER_SIZE) % GPS_TRACK_BUFFER_SIZE;
    int currIdx = (gpsTrackIndex - validPoints + i + GPS_TRACK_BUFFER_SIZE) % GPS_TRACK_BUFFER_SIZE;
    
    if (!gpsTrackBuffer[prevIdx].valid || !gpsTrackBuffer[currIdx].valid) continue;
    
    float distance = calculateDistance(
      gpsTrackBuffer[prevIdx].lat, gpsTrackBuffer[prevIdx].lon,
      gpsTrackBuffer[currIdx].lat, gpsTrackBuffer[currIdx].lon
    );
    
    totalDistance += distance;
    consecutivePoints++;
    
    if (distance > 2.0) { // Only calculate bearing for significant movement
      float bearing = calculateBearing(
        gpsTrackBuffer[prevIdx].lat, gpsTrackBuffer[prevIdx].lon,
        gpsTrackBuffer[currIdx].lat, gpsTrackBuffer[currIdx].lon
      );
      
      if (!firstBearing) {
        float bearingDiff = fabs(bearing - lastBearing);
        if (bearingDiff > 180) bearingDiff = 360 - bearingDiff;
        totalBearingChange += bearingDiff;
      }
      
      lastBearing = bearing;
      firstBearing = false;
    }
  }
  
  if (consecutivePoints < 2) return false;
  
  // Calculate average distance per sample
  float avgDistance = totalDistance / consecutivePoints;
  
  // If we're moving very little, check for GPS noise pattern
  if (avgDistance < 3.0) { // Less than 3 meters per sample = likely stationary
    return false;
  }
  
  // If we're moving significantly, check for consistent track
  if (avgDistance > 5.0) { // More than 5 meters per sample = likely real movement
    // Check if bearing changes are reasonable (not jumping around randomly)
    float avgBearingChange = totalBearingChange / max(1, consecutivePoints - 1);
    
    // Allow for reasonable course changes in sailing
    if (avgBearingChange < 45.0) { // Less than 45° average change = consistent track
      return true;
    }
  }
  
  return false;
}

// Track-based GPS speed filtering
float filterGPSSpeed(float rawSpeed, int satellites, float hdop) {
  // Basic GPS quality check - less strict than before
  bool goodGPSQuality = (satellites >= 4 && hdop <= 3.0);
  
  // If GPS quality is very poor, don't trust readings
  if (!goodGPSQuality) {
    return lastValidSpeed * 0.95; // Gradually decay speed if no GPS
  }
  
  // Store current GPS point in track buffer
  GPSPoint currentPoint;
  currentPoint.lat = gps.location.lat();
  currentPoint.lon = gps.location.lng();
  currentPoint.speed = rawSpeed;
  currentPoint.timestamp = millis();
  currentPoint.valid = gps.location.isValid();
  
  gpsTrackBuffer[gpsTrackIndex] = currentPoint;
  gpsTrackIndex = (gpsTrackIndex + 1) % GPS_TRACK_BUFFER_SIZE;
  
  if (!gpsTrackBufferFull && gpsTrackIndex == 0) {
    gpsTrackBufferFull = true;
  }
  
  // Basic speed smoothing with smaller window
  const int SPEED_SMOOTH_SIZE = 3;
  float speedSum = 0.0;
  int speedCount = 0;
  
  for (int i = 0; i < SPEED_SMOOTH_SIZE && i < (gpsTrackBufferFull ? GPS_TRACK_BUFFER_SIZE : gpsTrackIndex); i++) {
    int idx = (gpsTrackIndex - 1 - i + GPS_TRACK_BUFFER_SIZE) % GPS_TRACK_BUFFER_SIZE;
    if (gpsTrackBuffer[idx].valid) {
      speedSum += gpsTrackBuffer[idx].speed;
      speedCount++;
    }
  }
  
  float smoothedSpeed = speedCount > 0 ? speedSum / speedCount : rawSpeed;
  
  // Very conservative noise filtering for low speeds
  const float NOISE_THRESHOLD = 0.08; // Much lower threshold - 0.08 knots
  
  if (smoothedSpeed < NOISE_THRESHOLD) {
    // Check if we have consistent track indicating real movement
    if (isMovementConsistent()) {
      // GPS track shows real movement, trust the speed even if low
      lastValidSpeed = smoothedSpeed;
      return smoothedSpeed;
    } else {
      // No consistent track, likely stationary
      lastValidSpeed = 0.0;
      return 0.0;
    }
  }
  
  // For higher speeds, use lighter filtering
  const float HYSTERESIS_FACTOR = 0.1; // 10% hysteresis
  
  if (lastValidSpeed < NOISE_THRESHOLD) {
    // Was stationary, need slightly higher speed to register movement
    if (smoothedSpeed > (NOISE_THRESHOLD + HYSTERESIS_FACTOR)) {
      lastValidSpeed = smoothedSpeed;
      return smoothedSpeed;
    } else {
      return 0.0;
    }
  } else {
    // Was moving, use current speed with minimal filtering
    lastValidSpeed = smoothedSpeed;
    return smoothedSpeed;
  }
}

// Set up WiFi Access Point
// Read sensor data
void readSensors() {
  // Read GPS data first
  bool gpsDataValid = readGPS();
  
  // Apply track-based GPS speed filtering
  if (gpsDataValid && gps.speed.isValid()) {
    static unsigned long lastGPSDebugTime = 0;
    
    float rawSpeed = gps.speed.knots();
    int satellites = gps.satellites.isValid() ? gps.satellites.value() : 0;
    float hdop = gps.hdop.isValid() ? gps.hdop.hdop() : 99.9;
    
    // Use track-based filtering that considers GPS position changes
    currentData.speed = filterGPSSpeed(rawSpeed, satellites, hdop);
    
    #ifdef DEBUG_GPS
    Serial.printf("[GPS Filter] Raw: %.2f, Filtered: %.2f, Sats: %d, HDOP: %.1f, Track: %s\n", 
                  rawSpeed, currentData.speed, satellites, hdop,
                  isMovementConsistent() ? "MOVING" : "STATIONARY");
    #endif
    
    // Additional debug for movement detection (always show when speed > 0.3 knots raw)
    if (rawSpeed > 0.3) {
      Serial.printf("[GPS Track] Raw: %.3f kt, Filtered: %.3f kt, Movement: %s\n", 
                    rawSpeed, currentData.speed, 
                    isMovementConsistent() ? "CONSISTENT" : "INCONSISTENT");
    }
  } else {
    currentData.speed = 0.0;
  }

  // Read wind sensor using ModbusMaster
  float sensorWindSpeed;
  int sensorWindDirection;
  if (readWindSensor(sensorWindSpeed, sensorWindDirection)) {
    // Speed is already in m/s from the sensor, convert to knots (1 m/s = 1.944 knots)
    currentData.windSpeed = sensorWindSpeed * 1.944;
    currentData.windDirection = sensorWindDirection;
    #ifdef DEBUG_WIND_SENSOR
    Serial.print("[Wind Sensor] Wind speed: ");
    Serial.print(sensorWindSpeed, 2);
    Serial.print(" m/s (");
    Serial.print(currentData.windSpeed, 2);
    Serial.print(" knots), Direction: ");
    Serial.print(sensorWindDirection);
    Serial.println(" deg");
    #endif
  } else {
    currentData.windSpeed = NAN;
    currentData.windDirection = -999; // Use clearly invalid value (not -1 which could be valid)
    // Only show error once every 10 seconds to avoid spam
    static unsigned long lastErrorTime = 0;
    if (millis() - lastErrorTime > 10000) {
      Serial.println("[Wind Sensor] No valid data");
      lastErrorTime = millis();
    }
  }
  
  // Enhanced GPS debug output (only when needed)
  #ifdef DEBUG_GPS
  Serial.print("[GPS Debug] TinyGPS++ chars processed: ");
  Serial.print(gps.charsProcessed());
  Serial.print(", Sentences with fix: ");
  Serial.print(gps.sentencesWithFix());
  Serial.print(", Satellites: ");
  Serial.print(gps.satellites.value());
  Serial.print(", HDOP: ");
  Serial.print(gps.hdop.value());
  Serial.print(", Age: ");
  Serial.print(gps.location.age());
  Serial.print(" ms");
  if (gps.location.isValid() && gps.speed.isValid() && gps.satellites.value() >= 5) {
    Serial.print(" | GPS FIX: Lat: ");
    Serial.print(gps.location.lat(), 6);
    Serial.print(", Lng: ");
    Serial.print(gps.location.lng(), 6);
    Serial.print(", Speed: ");
    Serial.print(gps.speed.knots(), 2);
    Serial.println(" knots");
  } else {
    Serial.println(" | No valid GPS fix or insufficient satellites");
  }
  #endif
  // Optionally, print raw NMEA sentences for troubleshooting
  // while (gpsSerial.available() > 0) {
  //   char c = gpsSerial.read();
  //   Serial.write(c);
  // }
  
  // Calculate true wind: if speed is very low, set true wind = apparent wind
  const float SPEED_THRESHOLD = 0.5; // knots
  if (!isnan(currentData.windSpeed) && currentData.windDirection >= 0 && currentData.windDirection <= 359) {
    if (!isnan(currentData.speed) && currentData.speed >= SPEED_THRESHOLD) {
      calculateTrueWind(currentData.speed, currentData.windSpeed, currentData.windDirection,
                        currentData.trueWindSpeed, currentData.trueWindDirection);
    } else {
      // Boat is stationary or moving very slowly: true wind = apparent wind
      currentData.trueWindSpeed = currentData.windSpeed;
      currentData.trueWindDirection = currentData.windDirection;
    }
  } else {
    currentData.trueWindSpeed = NAN;
    currentData.trueWindDirection = NAN;
  }
  
  // Read tilt from ADXL345 (only if available)
  if (accelAvailable) {
    static unsigned long lastAccelRead = 0;
    const unsigned long ACCEL_READ_INTERVAL = 100; // Read accelerometer every 100ms max
    
    if (millis() - lastAccelRead >= ACCEL_READ_INTERVAL) {
      lastAccelRead = millis();
      
      sensors_event_t event;
      if (accel.getEvent(&event)) {
        #ifdef DEBUG_ACCEL
        Serial.print("[ADXL345] X: "); Serial.print(event.acceleration.x);
        Serial.print(" Y: "); Serial.print(event.acceleration.y);
        Serial.print(" Z: "); Serial.print(event.acceleration.z);
        #endif
        
        // Check for valid data (not all zeros)
        if (event.acceleration.x != 0 || event.acceleration.y != 0 || event.acceleration.z != 0) {
          // Calculate heel/tilt angle (degrees)
          // Assume Y axis is port-starboard, Z is up
          float tilt = atan2(event.acceleration.y, event.acceleration.z) * 180.0 / PI;
          float zeroedTilt = tilt - heelAngleDelta;
          currentData.tilt = zeroedTilt;
        } else {
          // All zeros - sensor may have failed
          static unsigned long lastZeroWarning = 0;
          if (millis() - lastZeroWarning > 30000) { // Warn every 30 seconds
            Serial.println("[ADXL345] Warning: All axes returning zero");
            lastZeroWarning = millis();
          }
          // Keep previous tilt value
        }
      } else {
        // I2C read failed - sensor may have disconnected
        static unsigned long lastReadError = 0;
        if (millis() - lastReadError > 30000) { // Warn every 30 seconds
          Serial.println("[ADXL345] Warning: I2C read failed - sensor disconnected?");
          lastReadError = millis();
        }
        // Keep previous tilt value
      }
    }
  } else {
    // Accelerometer not available - set tilt to 0
    currentData.tilt = 0.0;
  }
}

// Generate JSON string with current sensor data using marine standard terminology
String getSensorDataJson() {
  DynamicJsonDocument doc(300); // Increased size to accommodate marine standard fields
  
  // Always present GPS fields (marine standard)
  doc["SOG"] = isnan(currentData.speed) ? 0.0 : currentData.speed; // Speed Over Ground
  
  // GPS coordinates and course
  if (gps.location.isValid()) {
    doc["lat"] = gps.location.lat();
    doc["lon"] = gps.location.lng();
  } else {
    doc["lat"] = 0.0;
    doc["lon"] = 0.0;
  }
  
  if (gps.course.isValid()) {
    doc["COG"] = gps.course.deg(); // Course Over Ground
  } else {
    doc["COG"] = 0.0;
  }
  
  // GPS quality indicators
  doc["satellites"] = (gps.charsProcessed() > 10 && gps.satellites.isValid()) ? gps.satellites.value() : 0;
  
  if (gps.hdop.isValid()) {
    doc["hdop"] = gps.hdop.hdop();
  } else {
    doc["hdop"] = 99.9; // Invalid HDOP value
  }
  
  // Wind data - only include if sensor is connected and working
  if (!isnan(currentData.windSpeed)) {
    doc["AWS"] = currentData.windSpeed; // Apparent Wind Speed
  }
  
  if (currentData.windDirection >= 0 && currentData.windDirection <= 359) {
    doc["AWD"] = currentData.windDirection; // Apparent Wind Direction
  }
  
  // Heel angle - only include if accelerometer is available
  if (accelAvailable && !isnan(currentData.tilt)) {
    doc["heel"] = currentData.tilt; // Vessel heel angle
  }
  
  // BLE connection quality
  doc["rssi"] = bleRSSI;
  
  // Boat identification
  doc["boatName"] = boatName;
  
  String output;
  serializeJson(doc, output);
  return output;
}

// Wind Sensor Functions

// Read wind sensor data via RS485 using ModbusMaster
bool readWindSensor(float &windSpeed, int &windDirection) {
  uint8_t result = windSensor.readHoldingRegisters(0x0001, 4); // direction + speed (4 regs)

  if (result == windSensor.ku8MBSuccess) {
    uint16_t windDir   = windSensor.getResponseBuffer(0); // direction (0–359)
    uint16_t speedLow  = windSensor.getResponseBuffer(1); // first half of float
    uint16_t speedHigh = windSensor.getResponseBuffer(2); // second half of float

    // Convert registers to float (swapped order for correct endianness)
    windSpeed = regsToFloat(speedLow, speedHigh);
    windDirection = windDir;
    
    #ifdef DEBUG_WIND_SENSOR
    Serial.printf("[Wind Sensor] Raw response: dir=%d, speedLow=0x%04X, speedHigh=0x%04X, speed=%.2f m/s\n", 
                  windDir, speedLow, speedHigh, windSpeed);
    #endif
    
    return true;
  } else {
    #ifdef DEBUG_WIND_SENSOR
    Serial.printf("[Wind Sensor] Modbus read error: %d\n", result);
    #endif
    return false;
  }
}

// GPS Functions

// Check if GPS has valid, recent data
bool isGPSDataValid() {
  // Require multiple conditions for valid GPS:
  // 1. Must have processed characters (indicating actual serial data)
  // 2. Must have valid sentences with fix data
  // 3. Location must be valid
  // 4. Data must be recent (less than 5 seconds old)
  // 5. Must have reasonable satellite count (not just noise)
  return gps.charsProcessed() > 10 &&        // Must have processed actual data
         gps.sentencesWithFix() > 0 &&       // Must have valid NMEA sentences
         gps.location.isValid() && 
         gps.location.age() < 5000 && 
         gps.satellites.isValid() &&
         gps.satellites.value() >= 3;         // Minimum for any fix
}

// Read GPS data
bool readGPS() {
  bool newData = false;
  int bytesRead = 0;
  
  // Read available GPS data (but limit to prevent infinite loops)
  while (gpsSerial.available() > 0 && bytesRead < 256) {
    if (gps.encode(gpsSerial.read())) {
      newData = true;
    }
    bytesRead++;
  }
  
  // Return true only if we have valid, recent location data
  return newData && isGPSDataValid();
}