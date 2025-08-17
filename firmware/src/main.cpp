#include <Arduino.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <vector>
#include <TinyGPS++.h>
#include <Wire.h>
#include <SparkFun_BNO080_Arduino_Library.h>
#include <NimBLEDevice.h>
#include <ModbusMaster.h>

// Debug flags - uncomment for verbose output
// #define DEBUG_BLE_DATA
#define DEBUG_WIND_SENSOR
// #define DEBUG_GPS
#define DEBUG_BNO080

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

// BNO080 IMU Sensor (I2C)
#define BNO080_SDA 21
#define BNO080_SCL 22
BNO080 imu;
bool imuAvailable = false; // Track if IMU is working

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
void restartBLE();
void setupBLEServer();
void preTransmission();
void postTransmission();
void generateRandomBLEAddress();
void resetBLEForNewName(const String& newName);

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
            if (imuAvailable) {
              // Get current rotation vector for calibration
              if (imu.dataAvailable()) {
                // Use rotation vector to calculate current heel angle
                float i = imu.getQuatI();
                float j = imu.getQuatJ();
                float k = imu.getQuatK();
                float real = imu.getQuatReal();
                
                // Convert quaternion to heel angle (roll around X-axis)
                float roll = atan2(2.0f * (real * i + j * k), 1.0f - 2.0f * (i * i + j * j)) * 180.0f / PI;
                heelAngleDelta = roll;
                preferences.putFloat("delta", heelAngleDelta);
                Serial.printf("Heel angle reset to %.2f degrees\n", heelAngleDelta);
              } else {
                Serial.println("Heel angle reset failed - can't read IMU sensor");
              }
            } else {
              Serial.println("Heel angle reset failed - IMU sensor not available");
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
          else if (action == "setDeviceName") {
            String newDeviceName = doc["deviceName"];
            if (newDeviceName.length() > 0 && newDeviceName.length() <= 20) {
              // Basic validation: remove leading/trailing spaces and validate characters
              newDeviceName.trim();
              
              // Check for invalid characters that could break BLE device name
              bool validName = true;
              for (int i = 0; i < newDeviceName.length(); i++) {
                char c = newDeviceName[i];
                // Allow alphanumeric, underscore, hyphen, and space for device names
                if (!((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || 
                      (c >= '0' && c <= '9') || c == '_' || c == '-' || c == ' ')) {
                  validName = false;
                  break;
                }
              }
              
              if (validName && newDeviceName.length() > 0) {
                // Get current device name for comparison
                String currentDeviceName = preferences.getString("deviceName", "Luna_Sailing");
                
                // Save new device name to preferences
                preferences.putString("deviceName", newDeviceName);
                
                // CRITICAL: Ensure preferences are committed to NVS before restart
                preferences.end();  // Close preferences to force commit
                delay(100);         // Give time for flash write
                preferences.begin("settings", false);  // Reopen preferences
                
                // Verify the name was actually saved
                String savedName = preferences.getString("deviceName", "Luna_Sailing");
                Serial.printf("Device name changed from '%s' to '%s'\n", currentDeviceName.c_str(), newDeviceName.c_str());
                Serial.printf("Verified saved name: '%s'\n", savedName.c_str());
                
                if (savedName != newDeviceName) {
                  Serial.println("ERROR: Device name not saved properly to NVS!");
                  return; // Don't restart if save failed
                }
                
                // Send success response first before restarting
                Serial.println("Device name saved successfully - ESP32 will restart to apply changes");
                
                // Reset BLE with new random address to bypass client cache
                resetBLEForNewName(newDeviceName);
                
                // Restart ESP32 to apply new device name
                Serial.println("ESP32 will restart in 1 second");
                delay(200); // Brief delay to ensure BLE response is sent
                ESP.restart();
              } else {
                Serial.println("Invalid device name - only alphanumeric, underscore, hyphen, and space allowed");
              }
            } else {
              Serial.println("Invalid device name - must be 1-20 characters");
            }
          }
          else if (action == "restartWithNewName") {
            Serial.println("Restarting ESP32 to apply new device name...");
            delay(500); // Give time for response to be sent
            ESP.restart();
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

// Data structure to hold sensor readings
struct SensorData {
  float speed;          // Vessel speed in knots
  float windSpeed;      // Apparent wind speed in knots
  int windDirection;    // Apparent wind direction in degrees (0-359)
  float trueWindSpeed;  // True wind speed in knots
  float trueWindDirection; // True wind direction in degrees (0-359)
  float tilt;           // Vessel heel/tilt angle in degrees
  int HDM;              // Magnetic heading in degrees (0-359)
  float accelX;         // Acceleration X-axis in m/s²
  float accelY;         // Acceleration Y-axis in m/s²
  float accelZ;         // Acceleration Z-axis in m/s²
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
float regsToFloat(uint16_t lowReg, uint16_t highReg);

// GPS Functions
bool readGPS();
bool isGPSDataValid();

// Generate random BLE address to help bypass client cache
void generateRandomBLEAddress() {
  uint8_t randomAddr[6];
  
  // Generate random MAC address
  esp_fill_random(randomAddr, 6);
  
  // Ensure it's a valid random address (first two bits should be '11')
  randomAddr[5] |= 0xC0;
  
  Serial.printf("[BLE] Generated random address: %02X:%02X:%02X:%02X:%02X:%02X\n",
               randomAddr[5], randomAddr[4], randomAddr[3], 
               randomAddr[2], randomAddr[1], randomAddr[0]);
}

// Reset BLE with new name and random address to bypass client cache
void resetBLEForNewName(const String& newName) {
  Serial.printf("[BLE] Preparing reset for device name: '%s'\n", newName.c_str());
  
  // Generate new random address before restart to help bypass client cache
  generateRandomBLEAddress();
  
  Serial.println("[BLE] ESP32 will restart with new name and random address");
}

// BLE Setup Function
void setupBLE() {
  // Get device name from preferences
  String deviceName = preferences.getString("deviceName", "Luna_Sailing");
  Serial.printf("[BLE] Initializing as '%s'\n", deviceName.c_str());
  
  // Initialize NimBLE with device name
  NimBLEDevice::init(deviceName.c_str());
  
  // Use random address type to help bypass client cache on name changes
  NimBLEDevice::setOwnAddrType(BLE_OWN_ADDR_RANDOM);
  
  // Set TX power for good range
  NimBLEDevice::setPower(ESP_PWR_LVL_P3); // +3dBm
  
  // Setup the BLE server
  setupBLEServer();
  
  Serial.printf("BLE Server started as '%s'\n", deviceName.c_str());
}

// BLE Restart Function (for device name changes)
void restartBLE() {
  // Get device name from preferences
  String deviceName = preferences.getString("deviceName", "Luna_Sailing");
  Serial.printf("[BLE Restart] Using device name from preferences: '%s'\n", deviceName.c_str());
  
  // Ensure BLE is completely deinitialized first (only when restarting)
  Serial.println("[BLE Restart] Deinitializing existing BLE stack...");
  NimBLEDevice::deinit(true); // true = clear all bonding info
  delay(100); // Give time for cleanup
  
  // Initialize NimBLE with new device name
  Serial.printf("[BLE Restart] Initializing NimBLE with name: '%s'\n", deviceName.c_str());
  NimBLEDevice::init(deviceName.c_str());
  
  // Set TX power for balance between range and power consumption
  NimBLEDevice::setPower(ESP_PWR_LVL_P3); // +3dBm for better range
  
  // Setup the BLE server
  setupBLEServer();
  
  Serial.printf("NimBLE Server restarted as '%s', waiting for client connections...\n", deviceName.c_str());
  Serial.printf("Multiple connections supported (max %d)\n", CONFIG_BT_NIMBLE_MAX_CONNECTIONS);
}

// BLE Server Setup Function (without device initialization)
void setupBLEServer() {
  // Create the BLE Server with connection callbacks
  pServer = NimBLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  // Create the BLE Service
  NimBLEService *pService = pServer->createService(SERVICE_UUID);

  // Create BLE Characteristics
  pSensorDataCharacteristic = pService->createCharacteristic(
                      SENSOR_DATA_UUID,
                      NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY
                    );
  
  pCommandCharacteristic = pService->createCharacteristic(
                      COMMAND_UUID,
                      NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR
                    );
  pCommandCharacteristic->setCallbacks(new CommandCallbacks());

  // Start the service
  pService->start();

  // Start advertising
  NimBLEAdvertising *pAdvertising = NimBLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);  // 7.5ms intervals
  pAdvertising->setMaxPreferred(0x12);  // 22.5ms intervals
  
  // Include device name in advertising data
  String deviceName = preferences.getString("deviceName", "Luna_Sailing");
  pAdvertising->setName(deviceName.c_str());
  
  pAdvertising->start();
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
  // Initialize serial communication first
  Serial.begin(115200);
  delay(1000); // Give serial time to initialize
  Serial.println("\n=== Luna Sailing Dashboard Starting ===");
  
  // Initialize Preferences for persistent storage
  preferences.begin("settings", false);
  heelAngleDelta = preferences.getFloat("delta", 0.0f);
  deadWindAngle = preferences.getInt("deadWindAngle", 40);
  String deviceName = preferences.getString("deviceName", "Luna_Sailing");
  Serial.print("[Boot] Loaded heelAngleDelta from NVS: ");
  Serial.println(heelAngleDelta);
  Serial.print("[Boot] Loaded deadWindAngle from NVS: ");
  Serial.println(deadWindAngle);
  Serial.print("[Boot] Loaded deviceName from NVS: ");
  Serial.println(deviceName);
  
  // Initialize I2C for BNO080 with detection
  Wire.begin(BNO080_SDA, BNO080_SCL);
  Wire.setTimeout(100); // Set I2C timeout to 100ms to prevent long blocking
  
  Serial.print("Testing BNO080 connection... ");
  Serial.printf("I2C SDA=%d, SCL=%d\n", BNO080_SDA, BNO080_SCL);
  
  // Test I2C bus first
  Wire.beginTransmission(0x4A); // BNO080 default I2C address
  uint8_t i2cError = Wire.endTransmission();
  Serial.printf("I2C scan result: %d (0=success, 2=NACK, 4=other error)\n", i2cError);
  
  if (imu.begin()) {
    Serial.println("BNO080 begin() successful, configuring sensor...");
    
    // Enable rotation vector for heel angle calculation first
    imu.enableRotationVector(50); // 50ms = 20Hz update rate
    Serial.println("Rotation vector configuration sent");
    
    // Enable magnetometer for compass heading with higher update rate
    imu.enableMagnetometer(50); // 50ms = 20Hz update rate (increased from 100ms)
    Serial.println("Magnetometer configuration sent (20Hz)");
    
    // Enable accelerometer for acceleration data
    imu.enableAccelerometer(50); // 50ms = 20Hz update rate
    Serial.println("Accelerometer configuration sent");
    
    // Give sensor more time to initialize and start providing data
    Serial.println("Waiting for sensor data...");
    delay(500); // Longer delay for BNO080 to stabilize
    
    // Try multiple times to get data
    bool dataFound = false;
    for (int attempt = 0; attempt < 10; attempt++) {
      if (imu.dataAvailable()) {
        dataFound = true;
        Serial.printf("Data available after %d attempts!\n", attempt + 1);
        break;
      }
      delay(100); // Wait 100ms between attempts
      Serial.print(".");
    }
    Serial.println();
    
    if (dataFound) {
      imuAvailable = true;
      Serial.println("BNO080 connected and working!");
      
      // Test reading actual data
      float testI = imu.getQuatI();
      float testReal = imu.getQuatReal();
      Serial.printf("Test quaternion read: i=%.3f, real=%.3f\n", testI, testReal);
    } else {
      imuAvailable = false;
      Serial.println("BNO080 detected but no data available after 10 attempts");
      Serial.println("Check power supply (3.3V) and wiring connections");
    }
  } else {
    imuAvailable = false;
    Serial.println("Not detected - check wiring/address");
    Serial.println("Trying alternative I2C address 0x4B...");
    
    // Try alternative address
    Wire.beginTransmission(0x4B);
    i2cError = Wire.endTransmission();
    Serial.printf("I2C scan 0x4B result: %d\n", i2cError);
  }
  
  if (imuAvailable) {
    Serial.println("BNO080 IMU sensor enabled");
  } else {
    Serial.println("BNO080 IMU sensor disabled - tilt will be set to 0");
  }
  
  // Scan I2C bus for all devices
  Serial.println("Scanning I2C bus...");
  int devicesFound = 0;
  for (byte address = 1; address < 127; address++) {
    Wire.beginTransmission(address);
    byte error = Wire.endTransmission();
    
    if (error == 0) {
      Serial.printf("I2C device found at address 0x%02X\n", address);
      devicesFound++;
    }
  }
  
  if (devicesFound == 0) {
    Serial.println("No I2C devices found. Check wiring and power.");
  } else {
    Serial.printf("Found %d I2C device(s)\n", devicesFound);
  }
  
  // Initialize BLE with the loaded device name
  Serial.printf("[Boot] Initializing BLE with device name: '%s'\n", deviceName.c_str());
  setupBLE();
  
  // Initialize GPS module
  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX, GPS_TX);
  Serial.println("GPS module initialized");
  
  // Initialize RS485 for wind sensor with ModbusMaster
  // Try both sensor configurations - start with 9600 baud format first
  rs485.begin(9600, SERIAL_8E1, RS485_RX, RS485_TX); // Ultrasonic sensor (9600,8E1,IEEE754)
  pinMode(RS485_DE, OUTPUT);
  digitalWrite(RS485_DE, LOW);
  
  windSensor.begin(1, rs485); // Sensor ID 1
  windSensor.preTransmission(preTransmission);
  windSensor.postTransmission(postTransmission);
  
  // Set shorter timeout to prevent long delays - default is often 2000ms
  windSensor.idle([]() {
    // Allow other tasks during Modbus idle time
    yield();
  });
  
  // Try to set a shorter timeout if the library supports it
  // Note: Not all ModbusMaster versions support this
  #ifdef MODBUS_RESPONSE_TIMEOUT
  windSensor.setResponseTimeout(500); // 500ms timeout instead of default 2000ms
  #endif
  
  Serial.println("RS485 wind sensor initialized with ModbusMaster");
  Serial.printf("RS485 pins: RX=%d, TX=%d, DE=%d\n", RS485_RX, RS485_TX, RS485_DE);
  Serial.println("RS485 settings: Auto-detect between IEEE754 float (9600,8E1) and integer (4800,8N1) formats");
  Serial.println("Anemometer format: Auto-detect between IEEE 754 float and integer data types");
  
  // Test wind sensor connection
  delay(1000);
  Serial.println("Testing wind sensor connection...");
  
  float testSpeed;
  int testDirection;
  bool testResult = readWindSensor(testSpeed, testDirection);
  if (testResult) {
    Serial.printf("Wind sensor test PASSED: %.2f m/s (%.1f kt) @ %d°\n", 
                  testSpeed, testSpeed * 1.944, testDirection);
  } else {
    Serial.println("Wind sensor test FAILED - check connections and power");
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
      if (currentData.HDM >= 0 && currentData.HDM <= 359) 
        Serial.printf("Hdm:%d° ", currentData.HDM);
      
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

// Accelerometer-based movement detection variables
const int ACCEL_BUFFER_SIZE = 8;  // Track last 8 acceleration readings
struct AccelPoint {
  float x, y, z;
  float magnitude;
  unsigned long timestamp;
  bool valid;
};

static GPSPoint gpsTrackBuffer[GPS_TRACK_BUFFER_SIZE];
static int gpsTrackIndex = 0;
static bool gpsTrackBufferFull = false;
static float lastValidSpeed = 0.0;

static AccelPoint accelBuffer[ACCEL_BUFFER_SIZE];
static int accelIndex = 0;
static bool accelBufferFull = false;

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

// Store accelerometer reading for movement analysis
void storeAccelReading(float accelX, float accelY, float accelZ) {
  if (!imuAvailable) return;
  
  AccelPoint point;
  point.x = accelX;
  point.y = accelY;
  point.z = accelZ;
  point.magnitude = sqrt(accelX * accelX + accelY * accelY + accelZ * accelZ);
  point.timestamp = millis();
  point.valid = true;
  
  accelBuffer[accelIndex] = point;
  accelIndex = (accelIndex + 1) % ACCEL_BUFFER_SIZE;
  
  if (!accelBufferFull && accelIndex == 0) {
    accelBufferFull = true;
  }
}

// Analyze accelerometer data to detect movement
bool isAccelerometerMovementDetected() {
  if (!imuAvailable || (!accelBufferFull && accelIndex < 3)) {
    return false; // Not enough data or no IMU
  }
  
  static unsigned long lastAnalysisTime = 0;
  static bool lastResult = false;
  
  // Only analyze every 500ms to reduce CPU load
  if (millis() - lastAnalysisTime < 500) {
    return lastResult;
  }
  lastAnalysisTime = millis();
  
  int validPoints = accelBufferFull ? ACCEL_BUFFER_SIZE : accelIndex;
  if (validPoints < 3) return false;
  
  // Calculate acceleration variance to detect movement
  float totalMagnitude = 0.0;
  float maxMagnitude = 0.0;
  float minMagnitude = 1000.0;
  
  for (int i = 0; i < validPoints; i++) {
    int idx = (accelIndex - validPoints + i + ACCEL_BUFFER_SIZE) % ACCEL_BUFFER_SIZE;
    if (!accelBuffer[idx].valid) continue;
    
    float mag = accelBuffer[idx].magnitude;
    totalMagnitude += mag;
    maxMagnitude = max(maxMagnitude, mag);
    minMagnitude = min(minMagnitude, mag);
  }
  
  float avgMagnitude = totalMagnitude / validPoints;
  float magnitudeRange = maxMagnitude - minMagnitude;
  
  // Calculate standard deviation of acceleration magnitude
  float variance = 0.0;
  for (int i = 0; i < validPoints; i++) {
    int idx = (accelIndex - validPoints + i + ACCEL_BUFFER_SIZE) % ACCEL_BUFFER_SIZE;
    if (!accelBuffer[idx].valid) continue;
    
    float diff = accelBuffer[idx].magnitude - avgMagnitude;
    variance += diff * diff;
  }
  variance /= validPoints;
  float stdDev = sqrt(variance);
  
  // Movement detection thresholds
  const float MOVEMENT_STD_DEV_THRESHOLD = 0.5;  // m/s² - acceleration variation indicating movement
  const float MOVEMENT_RANGE_THRESHOLD = 1.0;    // m/s² - total acceleration range indicating movement
  const float MIN_AVERAGE_ACCEL = 8.0;           // m/s² - minimum for valid readings (gravity ~9.81)
  const float MAX_AVERAGE_ACCEL = 12.0;          // m/s² - maximum for valid readings
  
  // Check if accelerometer readings are reasonable (detecting presence of gravity)
  bool validAccelData = (avgMagnitude >= MIN_AVERAGE_ACCEL && avgMagnitude <= MAX_AVERAGE_ACCEL);
  
  // Movement detected if significant variation in acceleration
  bool movementDetected = validAccelData && 
                         (stdDev > MOVEMENT_STD_DEV_THRESHOLD || magnitudeRange > MOVEMENT_RANGE_THRESHOLD);
  
  #ifdef DEBUG_GPS
  static unsigned long lastAccelDebugTime = 0;
  if (millis() - lastAccelDebugTime > 2000) { // Debug every 2 seconds
    Serial.printf("[Accel Movement] Avg: %.2f m/s², StdDev: %.2f, Range: %.2f, Movement: %s\n",
                  avgMagnitude, stdDev, magnitudeRange, movementDetected ? "YES" : "NO");
    lastAccelDebugTime = millis();
  }
  #endif
  
  lastResult = movementDetected;
  return movementDetected;
}

// Analyze GPS track to determine if movement is real
bool isMovementConsistent() {
  static unsigned long lastAnalysisTime = 0;
  static bool lastResult = false;
  
  // Only analyze movement every 2 seconds to reduce CPU load
  if (millis() - lastAnalysisTime < 2000) {
    return lastResult;
  }
  lastAnalysisTime = millis();
  
  if (!gpsTrackBufferFull && gpsTrackIndex < 3) {
    lastResult = false;
    return false; // Need at least 3 points
  }
  
  int validPoints = gpsTrackBufferFull ? GPS_TRACK_BUFFER_SIZE : gpsTrackIndex;
  if (validPoints < 3) {
    lastResult = false;
    return false;
  }
  
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
      lastResult = true;
      return true;
    }
  }
  
  lastResult = false;
  return false;
}

// Enhanced GPS speed filtering with accelerometer data
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
  
  // Enhanced movement detection combining GPS track and accelerometer
  bool gpsMovementDetected = isMovementConsistent();
  bool accelMovementDetected = isAccelerometerMovementDetected();
  
  // Combined movement detection logic
  bool realMovementDetected = false;
  
  if (imuAvailable) {
    // When IMU is available, use both GPS and accelerometer
    // Movement confirmed if EITHER sensor detects movement (OR logic for sensitivity)
    // But both must agree for stationary state (AND logic for stability)
    if (gpsMovementDetected || accelMovementDetected) {
      realMovementDetected = true;
    } else {
      // Both sensors agree: no movement
      realMovementDetected = false;
    }
  } else {
    // Fall back to GPS-only detection when no IMU
    realMovementDetected = gpsMovementDetected;
  }
  
  // Adaptive noise threshold based on movement detection confidence
  float noiseThreshold = 0.08; // Base threshold: 0.08 knots
  
  if (imuAvailable && accelMovementDetected && gpsMovementDetected) {
    // Both sensors confirm movement - lower threshold for better sensitivity
    noiseThreshold = 0.05; // More sensitive when movement is confirmed
  } else if (imuAvailable && !accelMovementDetected && !gpsMovementDetected) {
    // Both sensors confirm stationary - higher threshold to filter noise
    noiseThreshold = 0.12; // Less sensitive when stationary is confirmed
  }
  
  if (smoothedSpeed < noiseThreshold) {
    if (realMovementDetected) {
      // Movement detected by sensors, trust the GPS speed even if low
      lastValidSpeed = smoothedSpeed;
      return smoothedSpeed;
    } else {
      // No movement detected, likely stationary or GPS noise
      lastValidSpeed = 0.0;
      return 0.0;
    }
  }
  
  // For higher speeds, use lighter filtering with hysteresis
  const float HYSTERESIS_FACTOR = 0.1; // 10% hysteresis
  
  if (lastValidSpeed < noiseThreshold) {
    // Was stationary, need slightly higher speed to register movement
    if (smoothedSpeed > (noiseThreshold + HYSTERESIS_FACTOR)) {
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

// Read sensor data
void readSensors() {
  #ifdef DEBUG_BLE_DATA
  unsigned long startTime = millis();
  #endif
  
  // Read GPS data first
  bool gpsDataValid = readGPS();
  
  #ifdef DEBUG_BLE_DATA
  unsigned long gpsTime = millis();
  #endif
  
  // Apply track-based GPS speed filtering
  if (gpsDataValid && gps.speed.isValid()) {
    static unsigned long lastGPSDebugTime = 0;
    
    float rawSpeed = gps.speed.knots();
    int satellites = gps.satellites.isValid() ? gps.satellites.value() : 0;
    float hdop = gps.hdop.isValid() ? gps.hdop.hdop() : 99.9;
    
    // Use enhanced GPS filtering with accelerometer data
    currentData.speed = filterGPSSpeed(rawSpeed, satellites, hdop);
    
    #ifdef DEBUG_GPS
    Serial.printf("[GPS Filter] Raw: %.2f, Filtered: %.2f, Sats: %d, HDOP: %.1f, GPS Track: %s, Accel: %s\n", 
                  rawSpeed, currentData.speed, satellites, hdop,
                  isMovementConsistent() ? "MOVING" : "STATIONARY",
                  imuAvailable ? (isAccelerometerMovementDetected() ? "MOVING" : "STATIONARY") : "N/A");
    #endif
    
    // Additional debug for enhanced movement detection (always show when speed > 0.3 knots raw)
    if (rawSpeed > 0.3) {
      Serial.printf("[Enhanced GPS] Raw: %.3f kt, Filtered: %.3f kt, GPS: %s, Accel: %s\n", 
                    rawSpeed, currentData.speed, 
                    isMovementConsistent() ? "MOVING" : "STATIONARY",
                    imuAvailable ? (isAccelerometerMovementDetected() ? "MOVING" : "STATIONARY") : "N/A");
    }
  } else {
    currentData.speed = 0.0;
  }

  #ifdef DEBUG_BLE_DATA
  unsigned long filterTime = millis();
  #endif

  // Read wind sensor using ModbusMaster
  float sensorWindSpeed;
  int sensorWindDirection;
  if (readWindSensor(sensorWindSpeed, sensorWindDirection)) {
    // Speed is already in m/s from the sensor, convert to knots (1 m/s = 1.944 knots)
    currentData.windSpeed = sensorWindSpeed * 1.944;
    currentData.windDirection = sensorWindDirection;
    #ifdef DEBUG_WIND_SENSOR
    Serial.printf("[Wind Sensor] %.2f m/s (%.1f kt) @ %d°\n", sensorWindSpeed, currentData.windSpeed, sensorWindDirection);
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
  
  #ifdef DEBUG_BLE_DATA
  unsigned long windTime = millis();
  #endif
  
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
  
  // Read tilt from BNO080 (only if available)
  if (imuAvailable) {
    static unsigned long lastIMURead = 0;
    const unsigned long IMU_READ_INTERVAL = 50; // Read IMU every 50ms max (20Hz)
    
    if (millis() - lastIMURead >= IMU_READ_INTERVAL) {
      lastIMURead = millis();
      
      if (imu.dataAvailable()) {
        // Get quaternion data for precise orientation
        float i = imu.getQuatI();
        float j = imu.getQuatJ();
        float k = imu.getQuatK();
        float real = imu.getQuatReal();
        
        #ifdef DEBUG_BNO080
        Serial.printf("[BNO080] Quat: i=%.3f j=%.3f k=%.3f real=%.3f\n", i, j, k, real);
        #endif
        
        // Convert quaternion to roll angle (heel angle)
        // Roll is rotation around X-axis (fore-aft axis of boat)
        float roll = atan2(2.0f * (real * i + j * k), 1.0f - 2.0f * (i * i + j * j)) * 180.0f / PI;
        
        // Apply calibration offset
        float zeroedTilt = roll - heelAngleDelta;
        currentData.tilt = zeroedTilt;
        
        #ifdef DEBUG_BNO080
        Serial.printf("[BNO080] Roll: %.2f°, Heel: %.2f°\n", roll, zeroedTilt);
        #endif
        
        // Read magnetometer data with fresh data detection
        static float lastMagX = 0, lastMagY = 0, lastMagZ = 0;
        static unsigned long lastMagChangeTime = 0;
        
        // Force magnetometer data update by checking for new magnetometer reports
        // The BNO080 might be caching old values, so we need to ensure fresh reads
        bool newMagData = false;
        
        // Check if there's specifically magnetometer data available
        if (imu.dataAvailable()) {
          // Try multiple approaches to get fresh magnetometer data
          
          // Method 1: Check if there's been a magnetometer data update
          // by calling the data parsing function
          imu.parseInputReport(); // Force parsing of any pending reports
          
          // Get current magnetometer readings
          float magX = imu.getMagX();
          float magY = imu.getMagY();
          float magZ = imu.getMagZ();
          
          // Check if magnetometer data has actually changed
          bool magDataChanged = (abs(magX - lastMagX) > 0.01 || 
                                abs(magY - lastMagY) > 0.01 || 
                                abs(magZ - lastMagZ) > 0.01);
          
          if (magDataChanged) {
            lastMagChangeTime = millis();
            lastMagX = magX;
            lastMagY = magY; 
            lastMagZ = magZ;
            newMagData = true;
          }
          
          // Calculate total magnetic field strength to validate readings
          float magMagnitude = sqrt(magX * magX + magY * magY + magZ * magZ);
          
          #ifdef DEBUG_BNO080
          Serial.printf("[BNO080] Mag: X=%.2f Y=%.2f Z=%.2f (mag=%.2f) %s\n", 
                        magX, magY, magZ, magMagnitude, 
                        magDataChanged ? "CHANGED" : "same");
          
          // Warn if magnetometer data hasn't changed in a while
          static unsigned long lastStaleWarning = 0;
          if (millis() - lastMagChangeTime > 3000 && millis() - lastStaleWarning > 5000) {
            Serial.printf("[BNO080] WARNING: Magnetometer data hasn't changed in %lu ms\n", 
                          millis() - lastMagChangeTime);
            lastStaleWarning = millis();
          }
          #endif
          
          // Only calculate new heading if we have fresh magnetometer data or reasonable readings
          if (newMagData || magMagnitude > 0.1) {
            // Calculate heading (yaw) from magnetometer data
            float heading = atan2(magY, magX) * 180.0f / PI;
            if (heading < 0) heading += 360.0f; // Normalize to 0-360
            
            // Only update heading if we have genuinely new data
            if (newMagData) {
              currentData.HDM = (int)round(heading); // Convert to integer
              
              #ifdef DEBUG_BNO080
              Serial.printf("[BNO080] Updated Heading: %d° (NEW DATA)\n", currentData.HDM);
              #endif
            } else {
              #ifdef DEBUG_BNO080
              Serial.printf("[BNO080] Heading would be: %.1f° (but data is stale)\n", heading);
              #endif
            }
          }
        } else {
          // No general data available, but try to force a magnetometer update anyway
          static unsigned long lastMagForceTime = 0;
          if (millis() - lastMagForceTime > 100) { // Try every 100ms
            lastMagForceTime = millis();
            
            #ifdef DEBUG_BNO080
            Serial.println("[BNO080] No dataAvailable(), trying to force magnetometer read...");
            #endif
            
            // Force the sensor to process any pending data
            if (imu.receivePacket()) {
              float magX = imu.getMagX();
              float magY = imu.getMagY();
              float magZ = imu.getMagZ();
              
              bool magDataChanged = (abs(magX - lastMagX) > 0.01 || 
                                    abs(magY - lastMagY) > 0.01 || 
                                    abs(magZ - lastMagZ) > 0.01);
              
              if (magDataChanged) {
                lastMagChangeTime = millis();
                lastMagX = magX;
                lastMagY = magY; 
                lastMagZ = magZ;
                
                float heading = atan2(magY, magX) * 180.0f / PI;
                if (heading < 0) heading += 360.0f;
                currentData.HDM = (int)round(heading); // Convert to integer
                
                #ifdef DEBUG_BNO080
                Serial.printf("[BNO080] Forced update - Heading: %d°\n", currentData.HDM);
                #endif
              }
            }
          }
        }
        
        // Read accelerometer data if available
        if (imu.getAccelX() != 0 || imu.getAccelY() != 0 || imu.getAccelZ() != 0) {
          // Get acceleration in m/s²
          currentData.accelX = imu.getAccelX();
          currentData.accelY = imu.getAccelY();
          currentData.accelZ = imu.getAccelZ();
          
          // Store accelerometer data for movement analysis
          storeAccelReading(currentData.accelX, currentData.accelY, currentData.accelZ);
          
          #ifdef DEBUG_BNO080
          Serial.printf("[BNO080] Accel: X=%.2f Y=%.2f Z=%.2f m/s²\n", 
                        currentData.accelX, currentData.accelY, currentData.accelZ);
          #endif
        }
        
      } else {
        // No new data available
        static unsigned long lastNoDataWarning = 0;
        if (millis() - lastNoDataWarning > 30000) { // Warn every 30 seconds
          Serial.println("[BNO080] Warning: No new data available");
          lastNoDataWarning = millis();
        }
        // Keep previous values
      }
    }
  } else {
    // IMU not available - set all values to 0/NaN
    currentData.tilt = 0.0;
    currentData.HDM = -1; // Use -1 to indicate invalid heading
    currentData.accelX = NAN;
    currentData.accelY = NAN;
    currentData.accelZ = NAN;
  }
  
  #ifdef DEBUG_BLE_DATA
  unsigned long endTime = millis();
  static unsigned long lastTimingReport = 0;
  if (millis() - lastTimingReport > 5000) { // Report timing every 5 seconds
    Serial.printf("[Timing] Total: %lums, GPS: %lums, Filter: %lums, Wind: %lums, IMU: %lums\n",
                  endTime - startTime,
                  gpsTime - startTime,
                  filterTime - gpsTime, 
                  windTime - filterTime,
                  endTime - windTime);
    lastTimingReport = millis();
  }
  #endif
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
  
  // Heel angle - only include if IMU is available
  if (imuAvailable && !isnan(currentData.tilt)) {
    doc["heel"] = currentData.tilt; // Vessel heel angle
  }
  
  // Magnetic heading - only include if IMU is available and has valid data
  if (imuAvailable && currentData.HDM >= 0 && currentData.HDM <= 359) {
    doc["HDM"] = currentData.HDM; // Magnetic heading in degrees
  }
  
  // Acceleration data - only include if IMU is available and has valid data
  if (imuAvailable && !isnan(currentData.accelX)) {
    doc["accelX"] = currentData.accelX; // Acceleration X-axis in m/s²
    doc["accelY"] = currentData.accelY; // Acceleration Y-axis in m/s²
    doc["accelZ"] = currentData.accelZ; // Acceleration Z-axis in m/s²
  }
  
  // BLE connection quality
  doc["rssi"] = bleRSSI;
  
  // Device identification (BLE device name)
  String deviceName = preferences.getString("deviceName", "Luna_Sailing");
  doc["deviceName"] = deviceName;
  
  String output;
  serializeJson(doc, output);
  return output;
}

// Wind Sensor Functions

// Convert two Modbus registers (32 bits) to float
float regsToFloat(uint16_t lowReg, uint16_t highReg) {
  uint32_t combined = ((uint32_t)highReg << 16) | lowReg;
  float value;
  memcpy(&value, &combined, sizeof(value));
  return value;
}

// Read wind sensor data via RS485 using ModbusMaster
bool readWindSensor(float &windSpeed, int &windDirection) {
  static unsigned long lastAttempt = 0;
  static bool sensorTypeDetected = false;
  static bool useIEEE754Format = true; // true = IEEE754 float (9600,8E1), false = integer (4800,8N1)
  
  // Don't hammer the sensor - minimum 100ms between attempts
  if (millis() - lastAttempt < 100) {
    return false;
  }
  lastAttempt = millis();
  
  #ifdef DEBUG_WIND_SENSOR
  Serial.print("[Wind Sensor] Reading ");
  if (useIEEE754Format) {
    Serial.print("IEEE754 format (9600,8E1,float)... ");
  } else {
    Serial.print("integer format (4800,8N1,int)... ");
  }
  unsigned long modbusStart = millis();
  #endif
  
  // Clear any existing response data
  windSensor.clearResponseBuffer();
  
  uint8_t result;
  
  if (useIEEE754Format) {
    // IEEE754 ultrasonic sensor: Read registers 0x0001 for 4 registers (direction + speed float)
    result = windSensor.readHoldingRegisters(0x0001, 4);
  } else {
    // Integer ultrasonic sensor: Read registers 0x0000 for 2 registers (speed int + direction)  
    result = windSensor.readHoldingRegisters(0x0000, 2);
  }

  #ifdef DEBUG_WIND_SENSOR
  unsigned long modbusTime = millis() - modbusStart;
  Serial.printf("(took %lums) ", modbusTime);
  #endif

  if (result == windSensor.ku8MBSuccess) {
    
    if (useIEEE754Format) {
      // IEEE754 ultrasonic anemometer format:
      // reg0 = direction (0–359°)
      // reg1 = speed float low word
      // reg2 = speed float high word  
      // reg3 = unused
      
      windDirection = windSensor.getResponseBuffer(0); // direction
      uint16_t speedLow = windSensor.getResponseBuffer(1);
      uint16_t speedHigh = windSensor.getResponseBuffer(2);
      
      // Convert registers to IEEE 754 float
      windSpeed = regsToFloat(speedLow, speedHigh);
      
      #ifdef DEBUG_WIND_SENSOR
      Serial.printf("SUCCESS - IEEE754 format: Direction=%d°, Speed=%.3f m/s (raw: low=%d, high=%d)\n", 
                    windDirection, windSpeed, speedLow, speedHigh);
      #endif
      
      // Validate data - if it looks wrong, try integer format
      if (!sensorTypeDetected && (windDirection < 0 || windDirection > 359 || 
          isnan(windSpeed) || windSpeed < 0 || windSpeed > 50)) {
        #ifdef DEBUG_WIND_SENSOR
        Serial.println("  IEEE754 format data invalid, will try integer format next");
        #endif
        useIEEE754Format = false;
        
        // Reconfigure RS485 for integer sensor
        rs485.end();
        rs485.begin(4800, SERIAL_8N1, RS485_RX, RS485_TX);
        windSensor.begin(1, rs485);
        windSensor.preTransmission(preTransmission);
        windSensor.postTransmission(postTransmission);
        
        return false; // Try again with integer format
      }
      
    } else {
      // Integer ultrasonic anemometer format:
      // reg0 = speed (expanded by 100, e.g., 125 = 1.25 m/s)
      // reg1 = direction (0-359°)
      
      uint16_t speedRaw = windSensor.getResponseBuffer(0);
      windSpeed = speedRaw / 100.0f;
      windDirection = windSensor.getResponseBuffer(1);
      
      #ifdef DEBUG_WIND_SENSOR
      Serial.printf("SUCCESS - integer format: Speed raw=%d (%.2f m/s), Direction=%d°\n", 
                    speedRaw, windSpeed, windDirection);
      #endif
      
      // Validate data - if it looks wrong, try IEEE754 format
      if (!sensorTypeDetected && (windDirection < 0 || windDirection > 359 || windSpeed < 0 || windSpeed > 50)) {
        #ifdef DEBUG_WIND_SENSOR
        Serial.println("  Integer format data invalid, will try IEEE754 format next");
        #endif
        useIEEE754Format = true;
        
        // Reconfigure RS485 for IEEE754 sensor
        rs485.end(); 
        rs485.begin(9600, SERIAL_8E1, RS485_RX, RS485_TX);
        windSensor.begin(1, rs485);
        windSensor.preTransmission(preTransmission);
        windSensor.postTransmission(postTransmission);
        
        return false; // Try again with IEEE754 format
      }
    }
    
    // If we get here with valid data, lock in the sensor type
    if (!sensorTypeDetected && windDirection >= 0 && windDirection <= 359 && 
        windSpeed >= 0 && windSpeed <= 50 && !isnan(windSpeed)) {
      sensorTypeDetected = true;
      Serial.printf("\n[Wind Sensor] Detected %s format and locked it in\n", 
                    useIEEE754Format ? "IEEE754 float" : "integer");
    }
    
    return true;
    
  } else {
    #ifdef DEBUG_WIND_SENSOR
    Serial.printf("ERROR %d - ", result);
    
    // Decode common Modbus error codes
    switch(result) {
      case 0xE0: Serial.println("Invalid slave ID"); break;
      case 0xE1: Serial.println("Invalid function"); break;
      case 0xE2: Serial.println("Response timeout"); break;
      case 0xE3: Serial.println("Invalid CRC"); break;
      default:   
        if (result == 226) {
          Serial.println("Communication timeout/no response");
        } else {
          Serial.printf("Unknown error code\n");
        }
        break;
    }
    
    // If we haven't detected sensor type yet, try the other format
    if (!sensorTypeDetected) {
      useIEEE754Format = !useIEEE754Format;
      #ifdef DEBUG_WIND_SENSOR
      Serial.printf("  Switching to %s format for next attempt\n", 
                    useIEEE754Format ? "IEEE754 float" : "integer");
      #endif
      
      // Reconfigure RS485 for the other sensor type
      rs485.end();
      if (useIEEE754Format) {
        rs485.begin(9600, SERIAL_8E1, RS485_RX, RS485_TX);
      } else {
        rs485.begin(4800, SERIAL_8N1, RS485_RX, RS485_TX);
      }
      windSensor.begin(1, rs485);
      windSensor.preTransmission(preTransmission);
      windSensor.postTransmission(postTransmission);
    }
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