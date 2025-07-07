#include <Arduino.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <vector>
#include <TinyGPS++.h>
#include <Wire.h>
#include <Adafruit_ADXL345_U.h>
#include <NimBLEDevice.h>

// Debug flags - uncomment for verbose output
#define DEBUG_BLE_DATA
// #define DEBUG_WIND_SENSOR
// #define DEBUG_GPS
// #define DEBUG_ACCEL

// Persistent storage for settings
Preferences preferences;
float heelAngleDelta = 0.0f;
int deadWindAngle = 40; // default

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
#define RS485_DE 14
#define RS485_RX 25
#define RS485_TX 26
#define RS485_UART 2

// GPS Module Configuration (using UART1)
#define GPS_RX 16
#define GPS_TX 17
#define GPS_UART 1

// RS485 Wind Sensor
HardwareSerial rs485(RS485_UART);
const uint8_t windSensorQuery[8] = {0x01, 0x03, 0x00, 0x00, 0x00, 0x02, 0xC4, 0x0B};

// GPS Module
HardwareSerial gpsSerial(GPS_UART);
TinyGPSPlus gps;

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

// Data structure to hold sensor readings
struct SensorData {
  float speed;          // Vessel speed in knots
  float speedMax;       // Maximum recorded speed
  float speedAvg;       // Average speed
  float windSpeed;      // Apparent wind speed in knots
  float windSpeedMax;   // Maximum recorded apparent wind speed
  float windSpeedAvg;   // Average apparent wind speed
  int windDirection;    // Apparent wind direction in degrees (0-359)
  float trueWindSpeed;  // True wind speed in knots
  float trueWindSpeedMax; // Maximum recorded true wind speed
  float trueWindSpeedAvg; // Average true wind speed
  float trueWindDirection; // True wind direction in degrees (0-359)
  float tilt;           // Vessel heel/tilt angle in degrees
  float tiltPortMax;    // Maximum port tilt
  float tiltStarboardMax; // Maximum starboard tilt
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

// History buffer for chart data
const int HISTORY_LENGTH = 60; // 1 minute at 1Hz
std::vector<SensorData> dataHistory;

// Refresh rate in milliseconds
int refreshRate = 1000;

// Timestamp for next update
unsigned long nextUpdate = 0;

// Function prototypes
void readSensors();
void updateHistory();
String getSensorDataJson();
void setupBLE();
void updateBLEData();

// Wind Sensor Functions
void setTransmit(bool tx);
uint16_t modbusCRC(const uint8_t *data, uint8_t len);
bool readWindSensor(float &windSpeed, int &windDirection);

// GPS Functions
bool readGPS();
bool isGPSDataValid();

// BLE Setup Function
void setupBLE() {
  // Initialize NimBLE
  NimBLEDevice::init("Luna_Sailing");
  
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
  
  Serial.println("NimBLE Server started, waiting for client connections...");
  Serial.printf("Multiple connections supported (max %d)\n", CONFIG_BT_NIMBLE_MAX_CONNECTIONS);
}

// Update BLE with current sensor data
void updateBLEData() {
  if (deviceConnected && pSensorDataCharacteristic) {
    String jsonData = getSensorDataJson();
    
    // Check if JSON is valid and not too large for BLE
    const int MAX_BLE_PACKET_SIZE = 244; // Conservative BLE MTU limit
    
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
  Serial.print("[Boot] Loaded heelAngleDelta from NVS: ");
  Serial.println(heelAngleDelta);
  Serial.print("[Boot] Loaded deadWindAngle from NVS: ");
  Serial.println(deadWindAngle);
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
  
  // Initialize RS485 for wind sensor (keeping for backup)
  rs485.begin(4800, SERIAL_8N1, RS485_RX, RS485_TX);
  pinMode(RS485_DE, OUTPUT);
  setTransmit(false);
  Serial.println("RS485 wind sensor initialized");
  
  // Initialize sensor data and history
  currentData.speedMax = 0;
  currentData.speedAvg = 0;
  currentData.windSpeedMax = 0;
  currentData.windSpeedAvg = 0;
  currentData.trueWindSpeedMax = 0;
  currentData.trueWindSpeedAvg = 0;
  currentData.tiltPortMax = 0;
  currentData.tiltStarboardMax = 0;
  
  // Pre-populate history with zero values
  for (int i = 0; i < HISTORY_LENGTH; i++) {
    dataHistory.push_back(currentData);
  }
  
  Serial.println("Setup complete");
}

void loop() {
  // Check if it's time to update data
  if (millis() >= nextUpdate) {
    // Read sensor data
    readSensors();
    
    // Update BLE RSSI if connected
    updateBLERSSI();
    
    // Update history
    updateHistory();
    
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

// Set up WiFi Access Point
// Read sensor data
void readSensors() {
  // Update max and average true wind speed only if valid
  static float trueWindSpeedSum = 0;
  static int trueWindSpeedCount = 0;
  if (!isnan(currentData.trueWindSpeed)) {
    if (currentData.trueWindSpeed > currentData.trueWindSpeedMax) {
      currentData.trueWindSpeedMax = currentData.trueWindSpeed;
    }
    trueWindSpeedSum += currentData.trueWindSpeed;
    trueWindSpeedCount++;
    currentData.trueWindSpeedAvg = trueWindSpeedSum / trueWindSpeedCount;
  }
  // Read GPS data first
  bool gpsDataValid = readGPS();
  
  // Only use GPS speed if we have valid, recent data with good satellite count
  if (gpsDataValid && gps.speed.isValid() && gps.satellites.value() >= 5) {
    currentData.speed = gps.speed.knots();
  } else {
    currentData.speed = 0.0;
  }

  // Update max and average speed only if valid
  if (!isnan(currentData.speed)) {
    if (currentData.speed > currentData.speedMax) {
      currentData.speedMax = currentData.speed;
    }
    static float speedSum = 0;
    static int speedCount = 0;
    speedSum += currentData.speed;
    speedCount++;
    currentData.speedAvg = speedSum / speedCount;
  }

  // Read wind sensor only, no fallback to simulated data
  float sensorWindSpeed;
  int sensorWindDirection;
  if (readWindSensor(sensorWindSpeed, sensorWindDirection)) {
    // Convert m/s to knots (1 m/s = 1.944 knots)
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
  
  // Update max and average wind speed only if valid
  if (!isnan(currentData.windSpeed)) {
    if (currentData.windSpeed > currentData.windSpeedMax) {
      currentData.windSpeedMax = currentData.windSpeed;
    }
    static float windSpeedSum = 0;
    static int windSpeedCount = 0;
    windSpeedSum += currentData.windSpeed;
    windSpeedCount++;
    currentData.windSpeedAvg = windSpeedSum / windSpeedCount;
  }
  
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
          
          // Track max port/starboard heel
          if (tilt < 0) {
            // Port
            if (isnan(currentData.tiltPortMax) || tilt < currentData.tiltPortMax) {
              currentData.tiltPortMax = tilt;
            }
          } else {
            // Starboard
            if (isnan(currentData.tiltStarboardMax) || tilt > currentData.tiltStarboardMax) {
              currentData.tiltStarboardMax = tilt;
            }
          }
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
    currentData.tiltPortMax = 0.0;
    currentData.tiltStarboardMax = 0.0;
  }
}

// Update history buffer with current data
void updateHistory() {
  // Remove oldest entry and add new one
  if (dataHistory.size() >= HISTORY_LENGTH) {
    dataHistory.erase(dataHistory.begin());
  }
  dataHistory.push_back(currentData);
}

// Generate JSON string with current sensor data (compact format)
String getSensorDataJson() {
  DynamicJsonDocument doc(200); // Reduced to be extra safe for BLE MTU
  
  // Core data only - keep it minimal
  doc["spd"] = isnan(currentData.speed) ? 0 : currentData.speed;
  doc["wSpd"] = isnan(currentData.windSpeed) ? 0 : currentData.windSpeed;
  
  // Only include wind direction if we have valid data (0-359 degrees)
  if (currentData.windDirection >= 0 && currentData.windDirection <= 359) {
    doc["wDir"] = currentData.windDirection;
  }
  
  doc["tilt"] = isnan(currentData.tilt) ? 0 : currentData.tilt;
  doc["gSpd"] = (gpsDataValid && gps.speed.isValid() && gps.satellites.value() >= 5) ? gps.speed.knots() : 0.0;
  doc["gSat"] = (gps.charsProcessed() > 10 && gps.satellites.isValid()) ? gps.satellites.value() : 0;
  doc["bleRSSI"] = bleRSSI;
  
  // Only add max values if we have room (check actual memory usage)
  if (doc.memoryUsage() < 150) {
    doc["spdMax"] = isnan(currentData.speedMax) ? 0 : currentData.speedMax;
    doc["wSpdMax"] = isnan(currentData.windSpeedMax) ? 0 : currentData.windSpeedMax;
  }
  
  String output;
  serializeJson(doc, output);
  return output;
}

// Wind Sensor Functions

// Set RS485 transmit/receive mode
void setTransmit(bool tx) { 
  digitalWrite(RS485_DE, tx ? HIGH : LOW); 
}

// Calculate Modbus CRC16
uint16_t modbusCRC(const uint8_t *data, uint8_t len) {
  uint16_t crc = 0xFFFF;
  for (uint8_t i = 0; i < len; i++) {
    crc ^= data[i];
    for (uint8_t j = 0; j < 8; j++)
      crc = (crc & 0x01) ? (crc >> 1) ^ 0xA001 : crc >> 1;
  }
  return crc;
}

// Read wind sensor data via RS485
bool readWindSensor(float &windSpeed, int &windDirection) {
  // Clear any existing data
  while (rs485.available()) rs485.read();
  
  // Send query
  setTransmit(true);
  delayMicroseconds(100);
  for (uint8_t i = 0; i < 8; i++) rs485.write(windSensorQuery[i]);
  rs485.flush();
  delayMicroseconds(100);
  setTransmit(false);
  delayMicroseconds(500);

  // Read response
  uint8_t response[9];
  uint32_t startTime = millis();
  uint8_t index = 0;
  
  while (index < 9 && millis() - startTime < 1000) {
    if (rs485.available()) {
      response[index++] = rs485.read();
    }
  }

  // Validate response
  if (index == 9 && response[0] == 0x01 && response[1] == 0x03 && response[2] == 0x04) {
    uint16_t receivedCRC = (response[8] << 8) | response[7];
    uint16_t calculatedCRC = modbusCRC(response, 7);
    
    if (receivedCRC == calculatedCRC) {
      // Parse wind data
      windSpeed = ((response[3] << 8) | response[4]) / 100.0;  // Convert to m/s
      windDirection = (response[5] << 8) | response[6];        // Direction in degrees
      return true;
    } else {
      #ifdef DEBUG_WIND_SENSOR
      Serial.println("Wind sensor CRC error");
      #endif
    }
  } else {
    #ifdef DEBUG_WIND_SENSOR
    Serial.print("Wind sensor invalid response, received ");
    Serial.print(index);
    Serial.println(" bytes");
    #endif
  }
  
  return false;
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