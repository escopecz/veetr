#include <Arduino.h>
#include <WiFi.h>
#include <ESPAsyncWebServer.h>
#include <AsyncTCP.h>
#include <ArduinoJson.h>
#include <LittleFS.h>
#include <vector>

// Define your WiFi credentials for Access Point mode
const char* ssid = "Luna_Sailing";
const char* password = ""; // Empty for open network, or set a password

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
void handleWebSocketMessage(void *arg, uint8_t *data, size_t len);
void onEvent(AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type, void *arg, uint8_t *data, size_t len);
void notifyClients();
void readSensors();
void updateHistory();
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
}

// Set up WiFi Access Point
void setupWiFi() {
  Serial.println("Setting up WiFi Access Point...");
  
  WiFi.mode(WIFI_AP);
  WiFi.softAP(ssid, password);
  
  IPAddress IP = WiFi.softAPIP();
  Serial.print("AP IP address: ");
  Serial.println(IP);
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
    }
  }
}

// Set up the web server
void setupWebServer() {
  // Initialize WebSocket
  ws.onEvent(onEvent);
  server.addHandler(&ws);
  
  // Serve static files from LittleFS
  server.serveStatic("/", LittleFS, "/www/").setDefaultFile("index.html");
  
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