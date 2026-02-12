#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <ESPAsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <ESP8266mDNS.h>
#include <Servo.h>

#define SERVO_PIN 14   // GPIO14 = D5 na Wemos Lolin

Servo myServo;

bool isOn = false;  // Stan przełącznika
const int centerPosition = 90;  // Pozycja środkowa
const int angle = 40;  // Kąt obrotu

// Główna sieć WiFi
const char* ssid1     = "NJU_Swiatlowod_E95A";
const char* password1 = "DY6PVASTP7LQ";

const char* mdnsName = "switch";  // Nazwa mDNS (bez .local)

AsyncWebServer server(80);
AsyncWebSocket ws("/ws");

const char* htmlPage PROGMEM = R"HTML(
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Switch</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #000;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      font-family: Arial, sans-serif;
      transition: background-color 0.3s;
    }
    
    body.on {
      background-color: #fff;
    }
    
    .circle {
      width: 200px;
      height: 200px;
      border-radius: 50%;
      background-color: #fff;
      cursor: pointer;
      transition: background-color 0.3s, transform 0.1s;
      box-shadow: 0 0 30px rgba(255,255,255,0.3);
    }
    
    body.on .circle {
      background-color: #000;
      box-shadow: 0 0 30px rgba(0,0,0,0.3);
    }
    
    .circle:active {
      transform: scale(0.95);
    }
  </style>
</head>
<body>
  <div class="circle" id="switch" onclick="toggle()"></div>
  
  <script>
    var ws;
    var isOn = false;
    
    function initWebSocket() {
      ws = new WebSocket("ws://" + window.location.hostname + "/ws");
      
      ws.onopen = function() {
        console.log("WebSocket connected");
      };
      
      ws.onclose = function() {
        console.log("WebSocket disconnected");
        setTimeout(initWebSocket, 2000);
      };
      
      ws.onmessage = function(event) {
        if(event.data === "ON") {
          isOn = true;
          document.body.classList.add("on");
        } else if(event.data === "OFF") {
          isOn = false;
          document.body.classList.remove("on");
        }
      };
    }
    
    function toggle() {
      if(ws && ws.readyState === WebSocket.OPEN) {
        ws.send("TOGGLE");
      }
    }
    
    window.onload = function() {
      initWebSocket();
    };
  </script>
</body>
</html>
)HTML";

void handleRoot(AsyncWebServerRequest *request) {
  request->send_P(200, "text/html", htmlPage);
}

// Nowa funkcja do przełączania przez HTTP
void handleToggle(AsyncWebServerRequest *request) {
  isOn = !isOn;
  
  if (isOn) {
    myServo.write(centerPosition + angle);
    Serial.println("HTTP: Servo ON (135°)");
    ws.textAll("ON");
    request->send(200, "application/json", "{\"status\":\"ON\"}");
  } else {
    myServo.write(centerPosition - angle);
    Serial.println("HTTP: Servo OFF (45°)");
    ws.textAll("OFF");
    request->send(200, "application/json", "{\"status\":\"OFF\"}");
  }
}

// Endpoint do sprawdzania stanu
void handleStatus(AsyncWebServerRequest *request) {
  String json = "{\"status\":\"";
  json += isOn ? "ON" : "OFF";
  json += "\"}";
  request->send(200, "application/json", json);
}

// Endpoint do włączenia
void handleOn(AsyncWebServerRequest *request) {
  if (!isOn) {
    isOn = true;
    myServo.write(centerPosition + angle);
    Serial.println("HTTP: Servo ON (135°)");
    ws.textAll("ON");
  }
  request->send(200, "application/json", "{\"status\":\"ON\"}");
}

// Endpoint do wyłączenia
void handleOff(AsyncWebServerRequest *request) {
  if (isOn) {
    isOn = false;
    myServo.write(centerPosition - angle);
    Serial.println("HTTP: Servo OFF (45°)");
    ws.textAll("OFF");
  }
  request->send(200, "application/json", "{\"status\":\"OFF\"}");
}

void onWebSocketEvent(AsyncWebSocket *server, 
                      AsyncWebSocketClient *client, 
                      AwsEventType type,
                      void *arg, 
                      uint8_t *data, 
                      size_t len) {
  switch (type) {
    case WS_EVT_CONNECT:
      Serial.printf("WebSocket client #%u connected\n", client->id());
      client->text(isOn ? "ON" : "OFF");
      break;
      
    case WS_EVT_DISCONNECT:
      Serial.printf("WebSocket client #%u disconnected\n", client->id());
      break;
      
    case WS_EVT_DATA:
      {
        AwsFrameInfo *info = (AwsFrameInfo*)arg;
        if (info->final && info->index == 0 && info->len == len && info->opcode == WS_TEXT) {
          String command = "";
          for (size_t i = 0; i < len; i++) {
            command += (char)data[i];
          }
          
          if (command == "TOGGLE") {
            isOn = !isOn;
            
            if (isOn) {
              myServo.write(centerPosition + angle);
              Serial.println("WS: Servo ON (135°)");
              ws.textAll("ON");
            } else {
              myServo.write(centerPosition - angle);
              Serial.println("WS: Servo OFF (45°)");
              ws.textAll("OFF");
            }
          }
        }
      }
      break;
  }
}

// Funkcja łączenia z WiFi z fallbackiem
bool connectToWiFi() {
  WiFi.mode(WIFI_STA);
  
  // Próba połączenia z pierwszą siecią
  Serial.print("Łączenie z siecią 1: ");
  Serial.println(ssid1);
  WiFi.begin(ssid1, password1);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  Serial.println();
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("✓ Połączono z siecią 1!");
    Serial.print("SSID: ");
    Serial.println(ssid1);
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
    return true;
  }

  Serial.println("✗ Nie udało się połączyć z żadną siecią");
  return false;
}

void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println("\n\n=== ESP8266 Servo Switch ===");

  myServo.attach(SERVO_PIN);
  myServo.write(centerPosition);
  Serial.println("Servo ustawione na pozycję startową (90°)");

  // Próba połączenia z WiFi (z fallbackiem)
  if (!connectToWiFi()) {
    Serial.println("Brak połączenia WiFi - urządzenie nie będzie działać");
    return;
  }

  // Uruchom mDNS
  if (MDNS.begin(mdnsName)) {
    Serial.println("✓ mDNS uruchomiony");
    Serial.print("Dostęp: http://");
    Serial.print(mdnsName);
    Serial.println(".local");
    MDNS.addService("http", "tcp", 80);
  } else {
    Serial.println("✗ Błąd uruchamiania mDNS");
    Serial.print("Użyj IP: http://");
    Serial.println(WiFi.localIP());
  }

  // Konfiguracja endpointów
  server.on("/", HTTP_GET, handleRoot);
  server.on("/toggle", HTTP_GET, handleToggle);    // Przełącz
  server.on("/status", HTTP_GET, handleStatus);    // Sprawdź stan
  server.on("/on", HTTP_GET, handleOn);            // Włącz
  server.on("/off", HTTP_GET, handleOff);          // Wyłącz
  
  ws.onEvent(onWebSocketEvent);
  server.addHandler(&ws);
  server.begin();
  
  Serial.println("✓ Serwer uruchomiony");
  Serial.println("\nDostępne endpointy:");
  Serial.println("  /toggle - przełącz stan");
  Serial.println("  /on - włącz");
  Serial.println("  /off - wyłącz");
  Serial.println("  /status - sprawdź stan");
  Serial.println("============================\n");
}

void loop() {
  MDNS.update();
  ws.cleanupClients();
  
  // Sprawdź połączenie WiFi co 30 sekund
  static unsigned long lastCheck = 0;
  if (millis() - lastCheck > 30000) {
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("⚠ WiFi rozłączony - próba ponownego połączenia...");
      connectToWiFi();
    }
    lastCheck = millis();
  }
}
