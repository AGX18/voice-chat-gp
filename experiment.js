// experiment.js
import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 8080 });
console.log("🧪 Lab Server (Audio Mode) running on ws://localhost:8080");

wss.on("connection", (ws) => {
  ws.on("message", (message) => {
    console.log(`📩 Trigger received: ${message}`);

    // 1. Create a "Fake" Audio Buffer (100 bytes of random data)
    // In real life, this is the PCM data from Gemini.
    const bufferSize = 48000;
    const fakeAudio = Buffer.alloc(bufferSize);

    // 2. Fill it with random noise
    for (let i = 0; i < bufferSize; i++) {
      // Random byte between 0-255
      fakeAudio[i] = Math.floor(Math.random() * 255);
    }

    console.log("📤 Sending 1 second of static...");
    ws.send(fakeAudio);
  });
});
