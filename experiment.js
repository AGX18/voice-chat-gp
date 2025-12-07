import { WebSocketServer } from "ws";
import WebSocket from "ws";
import dotenv from "dotenv";
dotenv.config();

// 1. Setup the Browser Server (The one you just tested)
const wss = new WebSocketServer({ port: 8080 });
console.log("🚀 Proxy Server running on ws://localhost:8080");

wss.on("connection", (browserSocket) => {
  console.log("✅ Browser connected");

  // 2. Connect to Gemini (The Source)
  const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${process.env.GEMINI_API_KEY}`;
  const geminiSocket = new WebSocket(url);

  geminiSocket.on("open", () => {
    console.log("🔗 Connected to Gemini. Sending Handshake...");

    // 3. The Handshake (Vital!)
    geminiSocket.send(
      JSON.stringify({
        setup: {
          model: "models/gemini-2.5-flash-native-audio-preview-09-2025",
          generationConfig: {
            responseModalities: ["AUDIO"], // We only want audio
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } },
            },
          },
        },
      })
    );

    // 4. Initial Greeting to wake up the model
    // We send a text event to start the conversation
    const msg = {
      clientContent: {
        turns: [
          { role: "user", parts: [{ text: "Hello, say a short sentence." }] },
        ],
        turn_complete: true,
      },
    };
    geminiSocket.send(JSON.stringify(msg));
  });

  geminiSocket.on("message", (data) => {
    const response = JSON.parse(data);

    // 5. Extract the Audio
    if (response.serverContent?.modelTurn?.parts?.[0]?.inlineData) {
      const base64Audio =
        response.serverContent.modelTurn.parts[0].inlineData.data;

      // CONVERT: Base64 String -> Raw Binary Buffer
      const audioBuffer = Buffer.from(base64Audio, "base64");

      // Forward raw binary to browser (Just like the static experiment!)
      browserSocket.send(audioBuffer);
      process.stdout.write("."); // Print a dot for every chunk
    }
  });

  browserSocket.on("message", (data) => {
    // 1. Check if it's binary audio data from the browser
    if (Buffer.isBuffer(data)) {
      // 2. Convert Raw Binary -> Base64
      const base64Audio = data.toString("base64");
      //   console.log(base64Audio);
      // 3. Wrap in Gemini's "RealtimeInput" format
      const audioMessage = {
        realtime_input: {
          media_chunks: [
            {
              mime_type: "audio/pcm",
              data: base64Audio,
            },
          ],
        },
      };

      // 4. Forward to Gemini
      if (geminiSocket.readyState === WebSocket.OPEN) {
        geminiSocket.send(JSON.stringify(audioMessage));
      }
    }
  });

  // Cleanup
  browserSocket.on("close", () => geminiSocket.close());
});
