#include <Arduino.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <vector>
#include <TinyGPS++.h>
#include <Wire.h>
#include <SparkFun_BNO080_Arduino_Library.h>
#include <NimBLEDevice.h>
#include <ModbusMaster.h>
#include <Update.h>
#include <esp_ota_ops.h>

// Firmware version
#define FIRMWARE_VERSION "0.0.11"

// Debug flags - uncomment for verbose output
// #define DEBUG_BLE_DATA
#define DEBUG_WIND_SENSOR
// #define DEBUG_GPS
#define DEBUG_BNO080

// Persistent storage for settings
Preferences preferences;
float heelAngleDelta = 0.0f;
float compassOffsetDelta = 0.0f; // Compass calibration offset in degrees
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
bool bleSending = false; // Prevent concurrent BLE transmissions

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

// Discovery Mode Configuration
#define DISCOVERY_BUTTON_PIN 0     // GPIO0 (BOOT button on ESP32 dev boards)
#define DISCOVERY_LED_PIN 2        // GPIO2 for discovery status LED (built-in LED)
#define DISCOVERY_TIMEOUT_MS (5 * 60 * 1000)  // 5 minutes timeout

bool discoveryModeActive = false;
unsigned long discoveryModeStartTime = 0;
bool lastButtonState = HIGH;
unsigned long lastButtonDebounceTime = 0;
const unsigned long debounceDelay = 50;

// RS485 Wind Sensor
HardwareSerial rs485(RS485_UART);
ModbusMaster windSensor;

// GPS Module
HardwareSerial gpsSerial(GPS_UART);
TinyGPSPlus gps;

// Function prototypes (declared early for use in callbacks)
bool safeBLESend(const String& data, bool isCommand = false);
void setupBLE();
void restartBLE();
void setupBLEServer();
void preTransmission();
void postTransmission();
void generateRandomBLEAddress();
void resetBLEForNewName(const String& newName);
void handleDiscoveryButton();
void startDiscoveryMode();
void stopDiscoveryMode();
void updateDiscoveryStatus();

// Safe BLE transmission function to prevent data corruption
bool safeBLESend(const String& data, bool isCommand) {
  // Check if we have a valid connection and characteristic
  if (!pServer || pServer->getConnectedCount() == 0 || !pSensorDataCharacteristic) {
    return false;
  }
  
  // Wait for any ongoing transmission to complete (max 100ms timeout)
  unsigned long startTime = millis();
  while (bleSending && (millis() - startTime) < 100) {
    delay(1);
  }
  
  // If still sending after timeout, skip this transmission
  if (bleSending) {
    Serial.println("[BLE] Transmission timeout, skipping...");
    return false;
  }
  
  // Set sending flag
  bleSending = true;
  
  try {
    // Convert string to byte array to avoid encoding issues
    std::vector<uint8_t> dataBytes(data.begin(), data.end());
    pSensorDataCharacteristic->setValue(dataBytes);
    pSensorDataCharacteristic->notify();
    
    // Small delay to ensure transmission completes
    delay(isCommand ? 10 : 5);
    
    bleSending = false;
    return true;
  } catch (...) {
    bleSending = false;
    Serial.println("[BLE] Transmission failed");
    return false;
  }
}

// BLE Server Callbacks
class MyServerCallbacks: public NimBLEServerCallbacks {
    void onConnect(NimBLEServer* pServer) {
      connectedDeviceCount++;
      deviceConnected = true;
      Serial.printf("BLE Client connected (total: %d)\n", connectedDeviceCount);
      
      // Send firmware version after connection
      delay(1000); // Give client time to set up characteristics
      if (pSensorDataCharacteristic) {
        DynamicJsonDocument doc(128);
        doc["type"] = "firmware_version";
        doc["version"] = FIRMWARE_VERSION;
        String versionData;
        serializeJson(doc, versionData);
        
        if (safeBLESend(versionData, true)) {
          Serial.printf("Sent firmware version on connect: %s\n", FIRMWARE_VERSION);
        } else {
          Serial.println("Failed to send firmware version on connect");
        }
      }
      
      // Continue advertising if we haven't reached max connections AND discovery mode is active
      if (connectedDeviceCount < CONFIG_BT_NIMBLE_MAX_CONNECTIONS && discoveryModeActive) {
        delay(100); // Small delay before restarting advertising
        NimBLEDevice::startAdvertising();
        Serial.printf("Continuing advertising for additional connections... (%d/%d connected)\n", 
                     connectedDeviceCount, CONFIG_BT_NIMBLE_MAX_CONNECTIONS);
      } else {
        if (connectedDeviceCount >= CONFIG_BT_NIMBLE_MAX_CONNECTIONS) {
          Serial.printf("Maximum connections reached (%d/%d)\n", 
                       connectedDeviceCount, CONFIG_BT_NIMBLE_MAX_CONNECTIONS);
        } else {
          Serial.println("Discovery mode not active, not advertising for new connections");
        }
      }
    };

    void onDisconnect(NimBLEServer* pServer) {
      connectedDeviceCount--;
      if (connectedDeviceCount == 0) {
        deviceConnected = false;
        bleRSSI = 0; // Reset RSSI when all devices disconnected
      }
      Serial.printf("BLE Client disconnected (remaining: %d/%d)\n", 
                   connectedDeviceCount, CONFIG_BT_NIMBLE_MAX_CONNECTIONS);
      
      // Restart advertising when a device disconnects only if discovery mode is active
      delay(500);
      if (!NimBLEDevice::getAdvertising()->isAdvertising() && discoveryModeActive) {
        NimBLEDevice::startAdvertising();
        Serial.println("Restarting advertising after disconnection (discovery mode active)...");
      } else if (!discoveryModeActive) {
        Serial.println("Discovery mode not active, not restarting advertising");
      }
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
            // Calibrate vessel level position (sets current orientation as zero reference)
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
                Serial.printf("Vessel level calibrated - offset set to %.2f degrees\n", heelAngleDelta);
              } else {
                Serial.println("Level calibration failed - can't read IMU sensor");
              }
            } else {
              Serial.println("Level calibration failed - IMU sensor not available");
            }
          }
          else if (action == "resetCompassNorth") {
            // Calibrate compass to north - saves current magnetic heading as north reference
            if (imuAvailable) {
              // Get current magnetometer data
              if (imu.dataAvailable()) {
                float magX = imu.getMagX();
                float magY = imu.getMagY();
                
                // Calculate current magnetic heading
                float currentHeading = atan2(magY, magX) * 180.0f / PI;
                if (currentHeading < 0) currentHeading += 360.0f;
                
                // Store this heading as the offset (what the device reads when vessel points north)
                compassOffsetDelta = currentHeading;
                preferences.putFloat("compassOffset", compassOffsetDelta);
                Serial.printf("Compass calibrated - north offset set to %.2f degrees\n", compassOffsetDelta);
              } else {
                Serial.println("Compass calibration failed - can't read magnetometer");
              }
            } else {
              Serial.println("Compass calibration failed - IMU sensor not available");
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
                String currentDeviceName = preferences.getString("deviceName", "Veetr");
                
                // Save new device name to preferences
                preferences.putString("deviceName", newDeviceName);
                
                // CRITICAL: Ensure preferences are committed to NVS before restart
                preferences.end();  // Close preferences to force commit
                delay(100);         // Give time for flash write
                preferences.begin("settings", false);  // Reopen preferences
                
                // Verify the name was actually saved
                String savedName = preferences.getString("deviceName", "Veetr");
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
          else if (doc["cmd"] == "GET_FW_VERSION") {
            // Send firmware version response
            DynamicJsonDocument response(128);
            response["type"] = "firmware_version";
            response["version"] = FIRMWARE_VERSION;
            String responseStr;
            serializeJson(response, responseStr);
            
            if (safeBLESend(responseStr, true)) {
              Serial.printf("Sent firmware version: %s\n", FIRMWARE_VERSION);
            } else {
              Serial.println("Failed to send firmware version response");
            }
          }
          else if (doc["cmd"] == "START_FW_UPDATE") {
            int totalSize = doc["size"];
            Serial.printf("Starting firmware update, size: %d bytes\n", totalSize);
            
            // Check if we have enough space for OTA update
            size_t freeSpace = ESP.getFreeSketchSpace();
            Serial.printf("Available OTA space: %d bytes\n", freeSpace);
            
            if (totalSize > freeSpace) {
              Serial.printf("Firmware too large! Required: %d, Available: %d\n", totalSize, freeSpace);
              DynamicJsonDocument response(128);
              response["type"] = "update_error";
              response["message"] = "Firmware too large for available space";
              String responseStr;
              serializeJson(response, responseStr);
              safeBLESend(responseStr, true);
              return;
            }
            
            // Initialize OTA update with U_FLASH type explicitly
            if (!Update.begin(totalSize, U_FLASH)) {
              Serial.printf("OTA update initialization failed: %s\n", Update.errorString());
              // Send error response
              DynamicJsonDocument response(128);
              response["type"] = "update_error";
              response["message"] = Update.errorString();
              String responseStr;
              serializeJson(response, responseStr);
              
              safeBLESend(responseStr, true);
            } else {
              Serial.println("OTA update initialized successfully");
              // Send acknowledgment
              DynamicJsonDocument response(128);
              response["type"] = "update_ready";
              String responseStr;
              serializeJson(response, responseStr);
              
              safeBLESend(responseStr, true);
            }
          }
          else if (doc["cmd"] == "FW_CHUNK") {
            int chunkIndex = doc["index"];
            String base64Data = doc["data"];
            
            Serial.printf("Received firmware chunk %d\n", chunkIndex);
            
            // Simple base64 decode using Arduino's built-in capabilities
            // Calculate decoded length (roughly 3/4 of base64 length)
            int maxDecodedLen = (base64Data.length() * 3) / 4 + 1;
            uint8_t* decodedData = new uint8_t[maxDecodedLen];
            
            // Use a simple base64 decode - for now, let's use a basic implementation
            // This is simplified - in production, use a proper base64 library
            int decodedLen = 0;
            const char* chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
            
            for (int i = 0; i < base64Data.length(); i += 4) {
              uint32_t value = 0;
              int padding = 0;
              
              // Decode 4 base64 characters into 3 bytes
              for (int j = 0; j < 4; j++) {
                if (i + j < base64Data.length()) {
                  char c = base64Data[i + j];
                  if (c == '=') {
                    padding++;
                  } else {
                    // Find character index
                    int idx = 0;
                    for (int k = 0; k < 64; k++) {
                      if (chars[k] == c) {
                        idx = k;
                        break;
                      }
                    }
                    value = (value << 6) | idx;
                  }
                } else {
                  padding++;
                }
              }
              
              // Extract bytes
              if (padding < 3 && decodedLen < maxDecodedLen) decodedData[decodedLen++] = (value >> 16) & 0xFF;
              if (padding < 2 && decodedLen < maxDecodedLen) decodedData[decodedLen++] = (value >> 8) & 0xFF;
              if (padding < 1 && decodedLen < maxDecodedLen) decodedData[decodedLen++] = value & 0xFF;
            }
            
            // Write chunk to flash
            size_t written = Update.write(decodedData, decodedLen);
            delete[] decodedData;
            
            if (written != decodedLen) {
              Serial.printf("Failed to write chunk %d: %d/%d bytes written\n", chunkIndex, written, decodedLen);
              DynamicJsonDocument response(128);
              response["type"] = "chunk_error";
              response["index"] = chunkIndex;
              String responseStr;
              serializeJson(response, responseStr);
              safeBLESend(responseStr, true);
            } else {
              Serial.printf("Chunk %d written successfully: %d bytes\n", chunkIndex, decodedLen);
              DynamicJsonDocument response(128);
              response["type"] = "chunk_ack";
              response["index"] = chunkIndex;
              String responseStr;
              serializeJson(response, responseStr);
              safeBLESend(responseStr, true);
            }
          }
          else if (doc["cmd"] == "VERIFY_FW") {
            Serial.println("Verifying firmware...");
            Serial.printf("Update progress: %d bytes written\n", Update.progress());
            Serial.printf("Update size: %d bytes\n", Update.size());
            Serial.printf("Update remaining: %d bytes\n", Update.remaining());
            
            // Check for errors before ending
            if (Update.hasError()) {
              Serial.printf("Update has error before verification: %s\n", Update.errorString());
            }
            
            // End the update process to verify it
            bool updateSuccess = Update.end(true); // true = restart if successful
            bool hasError = Update.hasError();
            
            if (!updateSuccess || hasError) {
              Serial.printf("Firmware verification failed. Error: %s\n", Update.errorString());
              Serial.printf("Update success: %s, Has error: %s\n", 
                           updateSuccess ? "true" : "false", 
                           hasError ? "true" : "false");
            } else {
              Serial.println("Firmware verification successful!");
            }
            
            DynamicJsonDocument response(128);
            response["type"] = "verify_complete";
            response["success"] = updateSuccess && !hasError;
            if (!updateSuccess || hasError) {
              response["error"] = Update.errorString();
            }
            String responseStr;
            serializeJson(response, responseStr);
            
            safeBLESend(responseStr, true);
            
            // If verification successful, restart the device
            if (updateSuccess && !hasError) {
              Serial.println("Firmware update completed successfully! Restarting in 2 seconds...");
              delay(2000);
              ESP.restart();
            }
          }
          else if (doc["cmd"] == "APPLY_FW") {
            Serial.println("Applying firmware update...");
            
            // This command is now redundant since verification handles the restart
            // But we'll keep it for compatibility
            Serial.println("Firmware already applied during verification. Restarting...");
            delay(1000);
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

// Discovery Mode Functions
void handleDiscoveryButton() {
  int reading = digitalRead(DISCOVERY_BUTTON_PIN);
  
  // Check if button state changed (with debouncing)
  if (reading != lastButtonState) {
    lastButtonDebounceTime = millis();
  }
  
  if ((millis() - lastButtonDebounceTime) > debounceDelay) {
    // Button has been stable for debounce delay
    if (reading == LOW && lastButtonState == HIGH) {
      // Button pressed (falling edge)
      if (!discoveryModeActive) {
        startDiscoveryMode();
      } else {
        stopDiscoveryMode();
      }
    }
  }
  
  lastButtonState = reading;
}

void startDiscoveryMode() {
  Serial.println("[DISCOVERY] Starting discovery mode for 5 minutes...");
  discoveryModeActive = true;
  discoveryModeStartTime = millis();
  
  // Turn on discovery LED
  digitalWrite(DISCOVERY_LED_PIN, HIGH);
  
  // Start BLE advertising if not already active
  if (!NimBLEDevice::getAdvertising()->isAdvertising()) {
    NimBLEDevice::startAdvertising();
    Serial.println("[DISCOVERY] BLE advertising started");
  }
}

void stopDiscoveryMode() {
  Serial.println("[DISCOVERY] Stopping discovery mode");
  discoveryModeActive = false;
  
  // Turn off discovery LED
  digitalWrite(DISCOVERY_LED_PIN, LOW);
  
  // Stop BLE advertising if no devices are connected
  if (pServer && pServer->getConnectedCount() == 0) {
    NimBLEDevice::getAdvertising()->stop();
    Serial.println("[DISCOVERY] BLE advertising stopped (no connected devices)");
  }
}

void updateDiscoveryStatus() {
  if (discoveryModeActive) {
    // Check if discovery timeout has elapsed
    if (millis() - discoveryModeStartTime > DISCOVERY_TIMEOUT_MS) {
      stopDiscoveryMode();
    } else {
      // Blink LED to show discovery is active
      static unsigned long lastBlink = 0;
      if (millis() - lastBlink > 1000) { // Blink every second
        digitalWrite(DISCOVERY_LED_PIN, !digitalRead(DISCOVERY_LED_PIN));
        lastBlink = millis();
      }
    }
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
void calculateTrueWind(float vesselSpeed, float vesselHeading, float apparentWindSpeed, float apparentWindDirection, 
                       float &trueWindSpeed, float &trueWindDirection) {
  
  // Convert degrees to radians
  float appWindDirRad = apparentWindDirection * PI / 180.0;
  float vesselHeadingRad = vesselHeading * PI / 180.0;
  
  // Convert apparent wind to components relative to vessel
  float appWindX = apparentWindSpeed * sin(appWindDirRad);  // Cross-track component (relative to vessel)
  float appWindY = apparentWindSpeed * cos(appWindDirRad);  // Along-track component (relative to vessel)
  
  // Convert vessel velocity to components in world coordinates
  float vesselVelX = vesselSpeed * sin(vesselHeadingRad);  // East component of vessel velocity
  float vesselVelY = vesselSpeed * cos(vesselHeadingRad);  // North component of vessel velocity
  
  // Convert apparent wind from vessel coordinates to world coordinates
  float appWindWorldX = appWindX * cos(vesselHeadingRad) - appWindY * sin(vesselHeadingRad);
  float appWindWorldY = appWindX * sin(vesselHeadingRad) + appWindY * cos(vesselHeadingRad);
  
  // Calculate true wind components in world coordinates
  // True wind = apparent wind - vessel velocity
  float trueWindWorldX = appWindWorldX - vesselVelX;
  float trueWindWorldY = appWindWorldY - vesselVelY;
  
  // Calculate true wind speed
  trueWindSpeed = sqrt(trueWindWorldX * trueWindWorldX + trueWindWorldY * trueWindWorldY);
  
  // Calculate true wind direction in world coordinates (degrees from north)
  trueWindDirection = atan2(trueWindWorldX, trueWindWorldY) * 180.0 / PI;
  
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
  String deviceName = preferences.getString("deviceName", "Veetr");
  Serial.printf("[BLE] Initializing as '%s'\n", deviceName.c_str());
  Serial.printf("[BLE] Max connections configured: %d\n", CONFIG_BT_NIMBLE_MAX_CONNECTIONS);
  
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
  String deviceName = preferences.getString("deviceName", "Veetr");
  Serial.printf("[BLE Restart] Using device name from preferences: '%s'\n", deviceName.c_str());
  
  // Ensure BLE is completely deinitialized first (only when restarting)
  Serial.println("[BLE Restart] Deinitializing existing BLE stack...");
  NimBLEDevice::deinit(true); // true = clear all bonding info
  delay(100); // Give time for cleanup
  
  // Initialize NimBLE with new device name
  Serial.printf("[BLE Restart] Initializing NimBLE with name: '%s'\n", deviceName.c_str());
  Serial.printf("[BLE Restart] Max connections configured: %d\n", CONFIG_BT_NIMBLE_MAX_CONNECTIONS);
  
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

  // Configure advertising for multiple connections (but don't start yet)
  NimBLEAdvertising *pAdvertising = NimBLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);  // 7.5ms intervals
  pAdvertising->setMaxPreferred(0x12);  // 22.5ms intervals
  pAdvertising->setAdvertisementType(BLE_GAP_CONN_MODE_UND);  // Undirected connectable
  
  // Include device name in advertising data
  String deviceName = preferences.getString("deviceName", "Veetr");
  pAdvertising->setName(deviceName.c_str());
  
  Serial.printf("[BLE] BLE server configured for up to %d connections\n", CONFIG_BT_NIMBLE_MAX_CONNECTIONS);
  Serial.println("[BLE] Advertising NOT started - requires discovery mode activation");
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
      if (safeBLESend(jsonData, false)) {
        #ifdef DEBUG_BLE_DATA
        Serial.printf("[BLE] Successfully sent %d bytes to %d devices\n", 
                      jsonData.length(), connectedDeviceCount);
        #endif
      } else {
        Serial.println("[BLE] Failed to send sensor data");
      }
    } else {
      Serial.println("[BLE] No connected devices found, skipping transmission");
    }
  }
}

void setup() {
  // Initialize serial communication first
  Serial.begin(115200);
  delay(1000); // Give serial time to initialize
  Serial.println("\n=== Veetr Starting ===");
  
  // Initialize Preferences for persistent storage
  preferences.begin("settings", false);
  heelAngleDelta = preferences.getFloat("delta", 0.0f);
  compassOffsetDelta = preferences.getFloat("compassOffset", 0.0f);
  deadWindAngle = preferences.getInt("deadWindAngle", 40);
  String deviceName = preferences.getString("deviceName", "Veetr");
  Serial.print("[Boot] Loaded level calibration offset from NVS: ");
  Serial.println(heelAngleDelta);
  Serial.print("[Boot] Loaded compass calibration offset from NVS: ");
  Serial.println(compassOffsetDelta);
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
    
    // Enable rotation vector for tilt/heel angle calculation
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
  
  // Initialize Discovery Mode GPIO
  pinMode(DISCOVERY_BUTTON_PIN, INPUT_PULLUP);  // Button with internal pullup
  pinMode(DISCOVERY_LED_PIN, OUTPUT);           // LED output
  digitalWrite(DISCOVERY_LED_PIN, LOW);         // Start with LED off
  Serial.printf("[Boot] Discovery button: GPIO%d, LED: GPIO%d\n", DISCOVERY_BUTTON_PIN, DISCOVERY_LED_PIN);
  Serial.println("[Boot] Press and hold discovery button to enable BLE discovery for 5 minutes");
  
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
  // Handle discovery button and mode
  handleDiscoveryButton();
  updateDiscoveryStatus();
  
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
      if (discoveryModeActive) {
        unsigned long remaining = (DISCOVERY_TIMEOUT_MS - (millis() - discoveryModeStartTime)) / 1000;
        Serial.printf("Discovery:%lus ", remaining);
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

// Transform accelerometer data from device coordinates to vessel coordinates using calibration
// This uses the level calibration (heelAngleDelta) and compass calibration (compassOffsetDelta)
// to create a rotation matrix that transforms device coordinates to vessel coordinates
void transformAccelerometerToVessel(float deviceX, float deviceY, float deviceZ, 
                                   float &vesselForward, float &vesselStarboard, float &vesselUp) {
  
  // For now, we'll assume the device coordinate system aligns with vessel coordinates
  // after level and compass calibration. This is a simplified approach.
  // In a full implementation, we'd need to determine the device mounting orientation
  // and create proper rotation matrices.
  
  // Simplified mapping (this assumes device X=forward, Y=starboard, Z=up)
  // This will need to be enhanced based on actual device mounting
  vesselForward = deviceX;    // Forward/aft acceleration
  vesselStarboard = deviceY;  // Port/starboard acceleration  
  vesselUp = deviceZ;         // Up/down acceleration
  
  // TODO: Apply proper rotation matrix transformation using heelAngleDelta and compassOffsetDelta
  // This would involve creating a 3D rotation matrix that accounts for:
  // 1. Device mounting orientation relative to vessel
  // 2. Current heel angle compensation
  // 3. Compass heading compensation
}

// Get forward acceleration (positive = accelerating forward)
float getForwardAcceleration(float accelX, float accelY, float accelZ) {
  float forward, starboard, up;
  transformAccelerometerToVessel(accelX, accelY, accelZ, forward, starboard, up);
  return forward;
}

// Get starboard acceleration (positive = accelerating to starboard/right)
float getStarboardAcceleration(float accelX, float accelY, float accelZ) {
  float forward, starboard, up;
  transformAccelerometerToVessel(accelX, accelY, accelZ, forward, starboard, up);
  return starboard;
}

// Get up acceleration (positive = accelerating upward)
float getUpAcceleration(float accelX, float accelY, float accelZ) {
  float forward, starboard, up;
  transformAccelerometerToVessel(accelX, accelY, accelZ, forward, starboard, up);
  return up;
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
    if (!isnan(currentData.speed) && currentData.speed >= SPEED_THRESHOLD && currentData.HDM >= 0 && currentData.HDM <= 359) {
      // We have valid speed, wind data, and heading - calculate true wind
      calculateTrueWind(currentData.speed, currentData.HDM, currentData.windSpeed, currentData.windDirection,
                        currentData.trueWindSpeed, currentData.trueWindDirection);
    } else {
      // Boat is stationary, moving very slowly, or no valid heading: true wind = apparent wind
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
        Serial.printf("[BNO080] Raw Roll: %.2f°, Calibrated Heel: %.2f°\n", roll, zeroedTilt);
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
            // Calculate raw heading (yaw) from magnetometer data
            float rawHeading = atan2(magY, magX) * 180.0f / PI;
            if (rawHeading < 0) rawHeading += 360.0f; // Normalize to 0-360
            
            // Apply compass calibration offset (subtract to align with vessel's north)
            float calibratedHeading = rawHeading - compassOffsetDelta;
            if (calibratedHeading < 0) calibratedHeading += 360.0f;
            if (calibratedHeading >= 360) calibratedHeading -= 360.0f;
            
            // Only update heading if we have genuinely new data
            if (newMagData) {
              currentData.HDM = (int)round(calibratedHeading); // Convert to integer
              
              #ifdef DEBUG_BNO080
              Serial.printf("[BNO080] Raw Heading: %.1f°, Calibrated: %d° (NEW DATA)\n", rawHeading, currentData.HDM);
              #endif
            } else {
              #ifdef DEBUG_BNO080
              Serial.printf("[BNO080] Raw Heading: %.1f°, Calibrated would be: %.1f° (but data is stale)\n", rawHeading, calibratedHeading);
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
  DynamicJsonDocument doc(400); // Larger size to accommodate all fields including acceleration and device name
  
  // Core sailing data (rounded to reduce JSON size)
  doc["SOG"] = round((isnan(currentData.speed) ? 0.0 : currentData.speed) * 10) / 10.0; // Speed Over Ground
  
  // GPS coordinates (reduced precision for BLE efficiency)
  if (gps.location.isValid()) {
    doc["lat"] = round(gps.location.lat() * 100000) / 100000.0; // 5 decimal places
    doc["lon"] = round(gps.location.lng() * 100000) / 100000.0; // 5 decimal places
  } else {
    doc["lat"] = 0.0;
    doc["lon"] = 0.0;
  }
  
  if (gps.course.isValid()) {
    doc["COG"] = round(gps.course.deg()); // Course Over Ground (integer)
  } else {
    doc["COG"] = 0;
  }
  
  // GPS quality indicators
  doc["satellites"] = (gps.charsProcessed() > 10 && gps.satellites.isValid()) ? gps.satellites.value() : 0;
  
  if (gps.hdop.isValid()) {
    doc["hdop"] = round(gps.hdop.hdop() * 10) / 10.0; // 1 decimal place
  } else {
    doc["hdop"] = 99.9; // Invalid HDOP value
  }
  
  // Wind data - only include if sensor is connected and working
  if (!isnan(currentData.windSpeed)) {
    doc["AWS"] = round(currentData.windSpeed * 10) / 10.0; // Apparent Wind Speed (1 decimal)
  }
  
  if (currentData.windDirection >= 0 && currentData.windDirection <= 359) {
    doc["AWD"] = round(currentData.windDirection); // Apparent Wind Direction (integer)
  }
  
  // True wind data - only include if calculated successfully
  if (!isnan(currentData.trueWindSpeed)) {
    doc["TWS"] = round(currentData.trueWindSpeed * 10) / 10.0; // True Wind Speed (1 decimal)
  }
  
  if (!isnan(currentData.trueWindDirection) && currentData.trueWindDirection >= 0 && currentData.trueWindDirection <= 359) {
    doc["TWD"] = round(currentData.trueWindDirection); // True Wind Direction (integer)
    
    // Calculate True Wind Angle (TWA) - relative angle between vessel heading and true wind
    if (currentData.HDM >= 0 && currentData.HDM <= 359) {
      float twa = currentData.trueWindDirection - currentData.HDM;
      
      // Normalize TWA to range -180 to +180 degrees
      if (twa > 180) {
        twa -= 360;
      } else if (twa < -180) {
        twa += 360;
      }
      
      // Convert to absolute angle (0-180) for sailing display
      doc["TWA"] = round(abs(twa));
    }
  }
  
  // Heel angle - only include if IMU is available
  if (imuAvailable && !isnan(currentData.tilt)) {
    doc["heel"] = round(currentData.tilt * 10) / 10.0; // Vessel heel angle (1 decimal)
  }
  
  // Magnetic heading - only include if IMU is available and has valid data
  if (imuAvailable && currentData.HDM >= 0 && currentData.HDM <= 359) {
    doc["HDM"] = round(currentData.HDM); // Magnetic heading in degrees (integer)
  }
  
  // Acceleration data - only include if IMU is available and has valid data
  if (imuAvailable && !isnan(currentData.accelX)) {
    doc["accelX"] = round(currentData.accelX * 100) / 100.0; // Acceleration X-axis in m/s² (2 decimals)
    doc["accelY"] = round(currentData.accelY * 100) / 100.0; // Acceleration Y-axis in m/s² (2 decimals)
    doc["accelZ"] = round(currentData.accelZ * 100) / 100.0; // Acceleration Z-axis in m/s² (2 decimals)
  }
  
  // BLE connection quality (reduced precision)
  doc["rssi"] = bleRSSI;
  
  // Device identification (proper device name)
  String deviceName = preferences.getString("deviceName", "Veetr");
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