import { WebSocketServer } from "ws";
import WebSocket from "ws";
import dotenv from "dotenv";

dotenv.config();

// Configuration
const BROWSER_PORT = 8080;
const PYTHON_SERVICE_URL = process.env.PYTHON_WS_URL || "ws://192.168.1.5:5000/ws/audio";
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const CONNECTION_TIMEOUT = 15000; // 15 seconds (increased for ngrok)

// Setup Browser WebSocket Server
const wss = new WebSocketServer({ 
  port: BROWSER_PORT,
  clientTracking: true 
});

console.log(`🚀 Voice Chat Proxy Server running on ws://localhost:${BROWSER_PORT}`);
console.log(`🎯 Target Python Service: ${PYTHON_SERVICE_URL}`);
console.log(`⏰ Ready for connections...\n`);

// Track active connections
let connectionCount = 0;

wss.on("connection", (browserSocket, req) => {
  const connectionId = ++connectionCount;
  const clientIP = req.socket.remoteAddress;
  
  console.log(`\n✅ [${connectionId}] Browser connected from ${clientIP}`);
  
  // Connection state
  let pythonSocket = null;
  let isConnecting = false;
  let heartbeatTimer = null;
  let bytesFromBrowser = 0;
  let bytesFromPython = 0;
  
  // Helper: Clean shutdown
  const cleanup = (reason) => {
    console.log(`🧹 [${connectionId}] Cleanup: ${reason}`);
    
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    
    if (pythonSocket) {
      pythonSocket.removeAllListeners();
      if (pythonSocket.readyState === WebSocket.OPEN) {
        pythonSocket.close(1000, reason);
      }
      pythonSocket = null;
    }
    
    if (browserSocket.readyState === WebSocket.OPEN) {
      browserSocket.close(1000, reason);
    }
    
    console.log(`📊 [${connectionId}] Session stats: ⬆️ ${(bytesFromBrowser/1024).toFixed(1)}KB sent, ⬇️ ${(bytesFromPython/1024).toFixed(1)}KB received\n`);
  };

  // Connect to Python AI Service
  const connectToPython = () => {
    if (isConnecting || pythonSocket) return;
    
    isConnecting = true;
    console.log(`🔌 [${connectionId}] Connecting to Python service...`);
    console.log(`📍 [${connectionId}] Target URL: ${PYTHON_SERVICE_URL}`);
    
    try {
      pythonSocket = new WebSocket(PYTHON_SERVICE_URL, {
        handshakeTimeout: CONNECTION_TIMEOUT,
        headers: {
          'User-Agent': 'VoiceChat-Proxy/1.0'
        }
      });
      
      pythonSocket.binaryType = "arraybuffer";
      
      // Connection timeout handler
      const timeoutId = setTimeout(() => {
        if (pythonSocket && pythonSocket.readyState === WebSocket.CONNECTING) {
          console.error(`⏱️ [${connectionId}] Python connection timeout`);
          pythonSocket.terminate();
          cleanup("Connection timeout");
        }
      }, CONNECTION_TIMEOUT);

      // Python connection established
      pythonSocket.on("open", () => {
        clearTimeout(timeoutId);
        isConnecting = false;
        console.log(`🔗 [${connectionId}] Bridge established: Browser ↔️ Python`);
        
        // Start heartbeat to keep connection alive
        heartbeatTimer = setInterval(() => {
          if (pythonSocket?.readyState === WebSocket.OPEN) {
            pythonSocket.ping();
          }
        }, HEARTBEAT_INTERVAL);
      });

      // Receive messages from Python → Forward to Browser
      pythonSocket.on("message", (data, isBinary) => {
        if (browserSocket.readyState === WebSocket.OPEN) {
          // Forward with the same type (binary or text)
          browserSocket.send(data, { binary: isBinary });
          bytesFromPython += data.byteLength || data.length;
          
          // Log message type for debugging
          if (!isBinary && data.length < 200) {
            console.log(`📨 [${connectionId}] Text message from Python: ${data.toString()}`);
          }
        }
      });

      // Python connection closed
      pythonSocket.on("close", (code, reason) => {
        clearTimeout(timeoutId);
        isConnecting = false;
        console.log(`🔻 [${connectionId}] Python disconnected (${code}): ${reason || 'No reason'}`);
        cleanup("Python service disconnected");
      });

      // Python connection error
      pythonSocket.on("error", (err) => {
        clearTimeout(timeoutId);
        isConnecting = false;
        console.error(`⚠️ [${connectionId}] Python error: ${err.message}`);
        
        if (err.message.includes("ECONNREFUSED")) {
          console.error(`   💡 Is the Python service running at ${PYTHON_SERVICE_URL}?`);
        }
        
        cleanup("Python service error");
      });

      // Handle pong responses
      pythonSocket.on("pong", () => {
        // Connection is alive
      });

    } catch (err) {
      isConnecting = false;
      console.error(`❌ [${connectionId}] Failed to create Python connection: ${err.message}`);
      cleanup("Failed to connect to Python");
    }
  };

  // Receive audio from Browser → Forward to Python
  browserSocket.on("message", (data) => {
    if (!pythonSocket || pythonSocket.readyState !== WebSocket.OPEN) {
      // If Python isn't connected yet, try to connect
      if (!isConnecting) {
        connectToPython();
      }
      return;
    }
    
    pythonSocket.send(data);
    bytesFromBrowser += data.byteLength || data.length;
  });

  // Browser disconnected
  browserSocket.on("close", (code, reason) => {
    console.log(`🔻 [${connectionId}] Browser disconnected (${code}): ${reason || 'No reason'}`);
    cleanup("Browser disconnected");
    sendCallSummary();
  });

  // Browser error
  browserSocket.on("error", (err) => {
    console.error(`⚠️ [${connectionId}] Browser error: ${err.message}`);
    cleanup("Browser error");
  });

  // Initial connection to Python
  connectToPython();
});

// Server error handling
wss.on("error", (err) => {
  console.error("❌ WebSocket Server Error:", err);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n\n🛑 Shutting down gracefully...");
  wss.clients.forEach((client) => {
    client.close(1000, "Server shutting down");
  });
  wss.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  console.log("\n\n🛑 Received SIGTERM, shutting down...");
  wss.close(() => {
    process.exit(0);
  });
});

async function sendCallSummary() {
  const url = 'http://localhost:3000/api/ai/call-result';
  /**
   * const { contactId, campaignId, outcome, ai_notes, transcript } = req.body;
   */
  const data = {
    contactId: "12345",
    campaignId: "67890",
    outcome: "interested",
    ai_notes: "The customer is interested in a villa for their family.",
    transcript: "",
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data), // Body must be a string
    });

    const result = await response.json();
    console.log('Success:', result);
  } catch (error) {
    console.error('Error:', error);
  }
}

createPost();