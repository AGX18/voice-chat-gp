import { WebSocketServer } from "ws";
import WebSocket from "ws";
import dotenv from "dotenv";
dotenv.config();

// 1. Setup the Browser Server (The one you just tested)
const wss = new WebSocketServer({ port: 8080 });

console.log("🚀 Proxy Server running on ws://localhost:8080");

wss.on("connection", (browserSocket) => {
  console.log("✅ Browser connected");

  // 2. Connect to the Python AI Service (Port 8000)
  const pythonUrl = "wss://wintriest-brandee-homoiothermic.ngrok-free.dev/ws/audio";
  const pythonSocket = new WebSocket(pythonUrl);

  // --- EVENT: Connected to Python ---
  pythonSocket.on("open", () => {
    console.log("🔗 Bridge established: Browser <-> Python");
  });

  // --- DIRECTION 1: Browser -> Node -> Python ---
  browserSocket.on("message", (data) => {
    // 'data' can be the "HIT_ME" text OR raw audio bytes.
    // We forward it blindly to Python.
    if (pythonSocket.readyState === WebSocket.OPEN) {
      pythonSocket.send(data);
    }
  });

  // --- DIRECTION 2: Python -> Node -> Browser ---
  pythonSocket.on("message", (data) => {
    // Python sends raw audio bytes back.
    // We forward it blindly to the Browser.
    if (browserSocket.readyState === WebSocket.OPEN) {
      browserSocket.send(data);
    }
  });

  // --- CLEANUP (If one side disconnects, kill the other) ---
  browserSocket.on("close", () => {
    console.log("🔻 Browser left. Closing Python connection...");
    pythonSocket.close();
  });

  pythonSocket.on("close", () => {
    console.log("🔻 Python left. Closing Browser connection...");
    browserSocket.close();
  });

  pythonSocket.on("error", (err) => {
    console.error("⚠️ Python Service Error:", err.message);
    console.log("Is the Python script running?");
  });
});