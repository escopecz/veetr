#include <Arduino.h>
#include <WiFi.h>
#include <ESPAsyncWebServer.h>
#include <AsyncTCP.h>
#include <ArduinoJson.h>
#include <LittleFS.h>
#include <vector>

// Factory Reset Button Configuration
#define FACTORY_RESET_BUTTON 0    // GPIO 0 (BOOT button)
#define FACTORY_RESET_HOLD_TIME 5000  // 5 seconds hold time
#define FACTORY_RESET_DEBOUNCE 50 // 50ms debounce time

// Factory reset button state
unsigned long buttonPressStart = 0;
unsigned long lastButtonCheck = 0;
bool buttonPressed = false;
bool factoryResetInProgress = false;

// Define your WiFi credentials for Access Point mode
char ssid[33] = "Luna_Sailing";  // SSID can be up to 32 characters + null terminator
char password[64] = "";          // Password can be up to 63 characters + null terminator

// Web server & WebSocket server
AsyncWebServer server(80);
AsyncWebSocket ws("/ws");

// Data structure to hold sensor readings
struct SensorData {
  float speed;          // Vessel speed in knots
  float speedMax;       // Maximum recorded speed
  float speedAvg;       // Average speed
  float windSpeed;      // Wind speed in knots
  int windDirection;    // Wind direction in degrees (0-359)
  float tilt;           // Vessel heel/tilt angle in degrees
  float tiltPortMax;    // Maximum port tilt
  float tiltStarboardMax; // Maximum starboard tilt
};

// Current sensor data
SensorData currentData = {0};

// History buffer for chart data
const int HISTORY_LENGTH = 60; // 1 minute at 1Hz
std::vector<SensorData> dataHistory;

// Refresh rate in milliseconds
int refreshRate = 1000;

// Timestamp for next update
unsigned long nextUpdate = 0;

// Function prototypes
void setupWiFi();
void setupWebServer();
void setupFactoryReset();
void checkFactoryReset();
void performFactoryReset();
void handleWebSocketMessage(void *arg, uint8_t *data, size_t len);
void onEvent(AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type, void *arg, uint8_t *data, size_t len);
void notifyClients();
void readSensors();
void updateHistory();
void updateWiFiSettings(const char* newSSID, const char* newPassword);
String getSensorDataJson();
String getHistoryJson();
String getFullDataJson();

void setup() {
  // Initialize serial communication
  Serial.begin(115200);
  Serial.println("Luna Sailing Dashboard starting...");
  
  // Initialize LittleFS for serving web files
  if (!LittleFS.begin()) {
    Serial.println("An error occurred while mounting LittleFS");
    return;
  }
  Serial.println("LittleFS mounted successfully");
  
  // Setup WiFi Access Point
  setupWiFi();
  
  // Setup web server and WebSocket
  setupWebServer();
  
  // Setup factory reset functionality
  setupFactoryReset();
  
  // Initialize sensor data and history
  currentData.speedMax = 0;
  currentData.speedAvg = 0;
  currentData.tiltPortMax = 0;
  currentData.tiltStarboardMax = 0;
  
  // Pre-populate history with zero values
  for (int i = 0; i < HISTORY_LENGTH; i++) {
    dataHistory.push_back(currentData);
  }
  
  Serial.println("Setup complete");
}

void loop() {
  // Handle WebSocket events
  ws.cleanupClients();
  
  // Check if it's time to update data
  if (millis() >= nextUpdate) {
    // Read sensor data
    readSensors();
    
    // Update history
    updateHistory();
    
    // Notify connected clients
    notifyClients();
    
    // Set next update time
    nextUpdate = millis() + refreshRate;
  }
  
  // Check factory reset button state
  checkFactoryReset();
}

// Set up WiFi Access Point
void setupWiFi() {
  Serial.println("Setting up WiFi Access Point...");
  
  WiFi.mode(WIFI_AP);
  
  // Configure WiFi settings for better file transfer performance
  WiFi.setTxPower(WIFI_POWER_19_5dBm);  // High power for better range/speed
  
  // Configure AP with optimized settings
  WiFi.softAPConfig(IPAddress(192, 168, 4, 1), IPAddress(192, 168, 4, 1), IPAddress(255, 255, 255, 0));
  
  // Create AP with optimized settings for performance
  WiFi.softAP(ssid, password, 6, false, 4);  // Channel 6, not hidden, max 4 clients
  
  // Wait a moment for AP to fully initialize
  delay(100);
  
  IPAddress IP = WiFi.softAPIP();
  Serial.print("AP IP address: ");
  Serial.println(IP);
  
  // Also print SSID and security info
  Serial.printf("SSID: %s\n", ssid);
  Serial.printf("Security: %s\n", strlen(password) > 0 ? "WPA2" : "Open");
  Serial.printf("WiFi Channel: 6, Max Clients: 4\n");
}

// WebSocket event handler
void onEvent(AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type, void *arg, uint8_t *data, size_t len) {
  switch (type) {
    case WS_EVT_CONNECT:
      Serial.printf("WebSocket client #%u connected from %s\n", client->id(), client->remoteIP().toString().c_str());
      // Send current data to newly connected client
      client->text(getFullDataJson());
      break;
    case WS_EVT_DISCONNECT:
      Serial.printf("WebSocket client #%u disconnected\n", client->id());
      break;
    case WS_EVT_DATA:
      handleWebSocketMessage(arg, data, len);
      break;
    case WS_EVT_PONG:
    case WS_EVT_ERROR:
      break;
  }
}

// Handle incoming WebSocket messages
void handleWebSocketMessage(void *arg, uint8_t *data, size_t len) {
  AwsFrameInfo *info = (AwsFrameInfo*)arg;
  if (info->final && info->index == 0 && info->len == len && info->opcode == WS_TEXT) {
    // Null-terminate the data for string operations
    data[len] = 0;
    
    // Parse JSON message
    DynamicJsonDocument doc(1024);
    DeserializationError error = deserializeJson(doc, (char*)data);
    
    if (error) {
      Serial.print("deserializeJson() failed: ");
      Serial.println(error.c_str());
      return;
    }
    
    // Check for action field
    if (doc.containsKey("action")) {
      String action = doc["action"];
      
      // Handle subscribe action (client registering for updates)
      if (action == "subscribe" && doc.containsKey("refreshRate")) {
        refreshRate = doc["refreshRate"].as<float>() * 1000; // Convert to milliseconds
        Serial.printf("Client subscribed with refresh rate: %d ms\n", refreshRate);
      }
      
      // Handle settings update
      else if (action == "updateSettings" && doc.containsKey("refreshRate")) {
        refreshRate = doc["refreshRate"].as<float>() * 1000; // Convert to milliseconds
        Serial.printf("Refresh rate updated: %d ms\n", refreshRate);
      }
      
      // Handle WiFi settings update
      else if (action == "updateWiFi") {
        if (doc.containsKey("ssid")) {
          String newSSID = doc["ssid"].as<String>();
          String newPassword = doc.containsKey("password") ? doc["password"].as<String>() : "";
          updateWiFiSettings(newSSID.c_str(), newPassword.c_str());
        }
      }
    }
  }
}

// Set up the web server
void setupWebServer() {
  // Initialize WebSocket
  ws.onEvent(onEvent);
  server.addHandler(&ws);
  
  // Serve static files from LittleFS with cache control
  server.serveStatic("/", LittleFS, "/www/")
    .setDefaultFile("index.html")
    .setCacheControl("no-cache, no-store, must-revalidate");
  
  // Handle unknown requests
  server.onNotFound([](AsyncWebServerRequest *request) {
    request->redirect("/");
  });
  
  // Start server
  server.begin();
  Serial.println("Web server started");
}

// Send updates to all connected WebSocket clients
void notifyClients() {
  // Only send data if clients are connected
  if (ws.count() > 0) {
    ws.textAll(getFullDataJson());
  }
}

// Read sensor data (currently simulated)
void readSensors() {
  // In a real implementation, this would read from actual sensors
  // For now, we'll generate simulated data
  
  // Simulate speed (0-15 knots with some variation)
  static float baseSpeed = 5.0;
  baseSpeed += random(-10, 10) / 100.0; // Add small random change
  baseSpeed = constrain(baseSpeed, 0, 15);
  currentData.speed = baseSpeed;
  
  // Update max and average speed
  if (currentData.speed > currentData.speedMax) {
    currentData.speedMax = currentData.speed;
  }
  
  static float speedSum = 0;
  static int speedCount = 0;
  speedSum += currentData.speed;
  speedCount++;
  currentData.speedAvg = speedSum / speedCount;
  
  // Simulate wind speed (0-25 knots with variation)
  static float baseWindSpeed = 8.0;
  baseWindSpeed += random(-15, 15) / 100.0;
  baseWindSpeed = constrain(baseWindSpeed, 0, 25);
  currentData.windSpeed = baseWindSpeed;
  
  // Simulate wind direction (0-359 degrees with slow changes)
  static float baseWindDir = 180;
  baseWindDir += random(-5, 5) / 10.0;
  if (baseWindDir < 0) baseWindDir += 360;
  if (baseWindDir >= 360) baseWindDir -= 360;
  currentData.windDirection = (int)baseWindDir;
  
  // Simulate tilt (-45 to 45 degrees, negative for port, positive for starboard)
  static float baseTilt = 0;
  baseTilt += random(-20, 20) / 100.0;
  baseTilt = constrain(baseTilt, -45, 45);
  currentData.tilt = baseTilt;
  
  // Update max tilt values
  if (currentData.tilt < 0 && abs(currentData.tilt) > currentData.tiltPortMax) {
    currentData.tiltPortMax = abs(currentData.tilt);
  } else if (currentData.tilt > 0 && currentData.tilt > currentData.tiltStarboardMax) {
    currentData.tiltStarboardMax = currentData.tilt;
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

// Generate JSON string with current sensor data
String getSensorDataJson() {
  DynamicJsonDocument doc(1024);
  
  doc["speed"] = currentData.speed;
  doc["speedMax"] = currentData.speedMax;
  doc["speedAvg"] = currentData.speedAvg;
  doc["windSpeed"] = currentData.windSpeed;
  doc["windDirection"] = currentData.windDirection;
  doc["tilt"] = currentData.tilt;
  doc["tiltPortMax"] = currentData.tiltPortMax;
  doc["tiltStarboardMax"] = currentData.tiltStarboardMax;
  
  String output;
  serializeJson(doc, output);
  return output;
}

// Generate JSON string with historical data for charts
String getHistoryJson() {
  DynamicJsonDocument doc(4096);
  
  // Get the most recent history data point for chart updates
  if (!dataHistory.empty()) {
    SensorData lastPoint = dataHistory.back();
    
    doc["speed"] = lastPoint.speed;
    doc["windSpeed"] = lastPoint.windSpeed;
    doc["windDirection"] = lastPoint.windDirection;
    doc["tilt"] = lastPoint.tilt;
  }
  
  String output;
  serializeJson(doc, output);
  return output;
}

// Generate JSON with both current and historical data
String getFullDataJson() {
  DynamicJsonDocument doc(4096);
  
  // Current data
  doc["speed"] = currentData.speed;
  doc["speedMax"] = currentData.speedMax;
  doc["speedAvg"] = currentData.speedAvg;
  doc["windSpeed"] = currentData.windSpeed;
  doc["windDirection"] = currentData.windDirection;
  doc["tilt"] = currentData.tilt;
  doc["tiltPortMax"] = currentData.tiltPortMax;
  doc["tiltStarboardMax"] = currentData.tiltStarboardMax;
  
  // History data for chart updates
  JsonObject history = doc.createNestedObject("history");
  if (!dataHistory.empty()) {
    SensorData lastPoint = dataHistory.back();
    
    history["speed"] = lastPoint.speed;
    history["windSpeed"] = lastPoint.windSpeed;
    history["windDirection"] = lastPoint.windDirection;
    history["tilt"] = lastPoint.tilt;
  }
  
  String output;
  serializeJson(doc, output);
  return output;
}

// Update WiFi Access Point settings
void updateWiFiSettings(const char* newSSID, const char* newPassword) {
  Serial.println("Updating WiFi settings...");
  
  // Validate SSID
  if (strlen(newSSID) == 0 || strlen(newSSID) > 32) {
    Serial.println("Invalid SSID length");
    return;
  }
  
  // Validate password
  if (strlen(newPassword) > 0 && (strlen(newPassword) < 8 || strlen(newPassword) > 63)) {
    Serial.println("Invalid password length");
    return;
  }
  
  // Copy new credentials
  strncpy(ssid, newSSID, sizeof(ssid) - 1);
  ssid[sizeof(ssid) - 1] = '\0'; // Ensure null termination
  
  strncpy(password, newPassword, sizeof(password) - 1);
  password[sizeof(password) - 1] = '\0'; // Ensure null termination
  
  // Log the change (don't log password for security)
  Serial.printf("New SSID: %s\n", ssid);
  Serial.printf("Security: %s\n", strlen(password) > 0 ? "WPA2" : "Open");
  
  // Notify clients that WiFi is restarting
  if (ws.count() > 0) {
    DynamicJsonDocument response(256);
    response["action"] = "wifiRestart";
    response["ssid"] = ssid;
    response["security"] = strlen(password) > 0 ? "WPA2" : "Open";
    
    String responseStr;
    serializeJson(response, responseStr);
    ws.textAll(responseStr);
  }
  
  // Small delay to ensure message is sent
  delay(100);
  
  // Restart WiFi with new settings
  WiFi.softAPdisconnect(true);
  delay(1000);
  
  // Setup WiFi with new credentials
  setupWiFi();
}

// Set up factory reset functionality
void setupFactoryReset() {
  pinMode(FACTORY_RESET_BUTTON, INPUT_PULLUP);
  
  Serial.println("========================================");
  Serial.println("FACTORY RESET SETUP");
  Serial.println("========================================");
  Serial.println("Factory reset button configured on GPIO 0 (BOOT button)");
  Serial.println("Hold for 5 seconds to trigger factory reset");
  Serial.println("========================================");
}

// Check factory reset button state
void checkFactoryReset() {
  // Only check button at most every FACTORY_RESET_DEBOUNCE ms
  if (millis() - lastButtonCheck < FACTORY_RESET_DEBOUNCE) {
    return;
  }
  lastButtonCheck = millis();
  
  // Read the state of the factory reset button
  bool buttonState = digitalRead(FACTORY_RESET_BUTTON) == LOW;
  
  if (buttonState && !buttonPressed) {
    // Button was just pressed
    buttonPressStart = millis();
    buttonPressed = true;
    Serial.println("Factory reset button pressed - hold for 5 seconds");
    Serial.println("(This only works during normal operation, not during flashing)");
  } else if (buttonState && buttonPressed) {
    // Button is still being held
    unsigned long holdTime = millis() - buttonPressStart;
    
    // Blink LED faster as we approach the reset time
    if (holdTime < FACTORY_RESET_HOLD_TIME) {
      // Print progress every second
      if (holdTime > 0 && (holdTime / 1000) != ((holdTime - FACTORY_RESET_DEBOUNCE) / 1000)) {
        Serial.printf("Factory reset in %d seconds...\n", 
                      (FACTORY_RESET_HOLD_TIME - holdTime) / 1000 + 1);
      }
    }
  } else if (!buttonState && buttonPressed) {
    // Button was just released
    buttonPressed = false;
    
    // Check if it was held long enough for a factory reset
    unsigned long holdTime = millis() - buttonPressStart;
    if (holdTime >= FACTORY_RESET_HOLD_TIME) {
      Serial.printf("Factory reset triggered (held for %lu ms)\n", holdTime);
      performFactoryReset();
    } else {
      Serial.printf("Factory reset cancelled (held for %lu ms, needed %d ms)\n", 
                    holdTime, FACTORY_RESET_HOLD_TIME);
    }
  }
}

// Perform factory reset
void performFactoryReset() {
  factoryResetInProgress = true;
  
  Serial.println("========================================");
  Serial.println("PERFORMING FACTORY RESET");
  Serial.println("========================================");
  
  // Notify clients before reset
  if (ws.count() > 0) {
    DynamicJsonDocument response(256);
    response["action"] = "factoryReset";
    response["message"] = "Factory reset in progress...";
    
    String responseStr;
    serializeJson(response, responseStr);
    ws.textAll(responseStr);
    
    // Give time for message to be sent
    delay(500);
  }
  
  // Reset WiFi settings
  Serial.println("Resetting WiFi settings...");
  WiFi.softAPdisconnect(true);
  delay(1000);
  
  // Reinitialize WiFi with default credentials
  strcpy(ssid, "Luna_Sailing");
  strcpy(password, "");
  Serial.printf("SSID reset to: %s\n", ssid);
  Serial.println("Password reset to: [OPEN NETWORK]");
  
  setupWiFi();
  
  // Reset sensor data and history
  Serial.println("Resetting sensor data...");
  currentData = {0};
  dataHistory.clear();
  
  // Pre-populate history with zero values
  for (int i = 0; i < HISTORY_LENGTH; i++) {
    dataHistory.push_back(currentData);
  }
  
  factoryResetInProgress = false;
  
  Serial.println("Factory reset complete!");
  Serial.println("Default settings restored:");
  Serial.println("  SSID: Luna_Sailing");
  Serial.println("  Password: None (open network)");
  Serial.println("  IP Address: 192.168.4.1");
  Serial.println("========================================");
  
  // Final notification to clients
  if (ws.count() > 0) {
    DynamicJsonDocument response(256);
    response["action"] = "factoryReset";
    response["message"] = "Factory reset complete";
    response["ssid"] = ssid;
    response["security"] = "Open";
    
    String responseStr;
    serializeJson(response, responseStr);
    ws.textAll(responseStr);
  }
}