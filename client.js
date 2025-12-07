// 1. Setup Audio Engine (24kHz is standard for Gemini)
// window.webkitAudioContext is for Safari compatibility
const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
  sampleRate: 24000,
});

// Connects to local WebSocket server
// binaryType = "arraybuffer" tells the WebSocket to receive binary data as ArrayBuffer (not Blob)
const ws = new WebSocket("ws://localhost:8080");
ws.binaryType = "arraybuffer";

// When connected, sends "HIT_ME" message requesting audio data from server

ws.onopen = () => {
  console.log("Connected! Requesting Noise...");
  ws.send("HIT_ME");
};

// Receives binary audio data as ArrayBuffer
// Creates an Int16Array view - interprets raw bytes as 16-bit signed integers
// Why Int16? Audio from servers/APIs is typically in PCM 16-bit format where:
// Each sample is a 16-bit integer (-32768 to 32767)
// This is compact and standard for transmission
ws.onmessage = async (event) => {
  const rawData = event.data;
  console.log(`Received ${rawData.byteLength} bytes`);

  // 2. THE TRANSLATOR (Int16 -> Float32)
  // We wrap the raw bytes in 16-bit view
  const int16View = new Int16Array(rawData);

  // Create an empty audio buffer for the browser
  const audioBuffer = audioCtx.createBuffer(1, int16View.length, 24000);
  const channelData = audioBuffer.getChannelData(0);

  // Convert every sample from Int to Float
  // normalization (Float32 (what Web Audio API needs)
  for (let i = 0; i < int16View.length; i++) {
    // Divide by 32768 (max value of 16-bit audio) to get -1.0 to 1.0 range
    channelData[i] = int16View[i] / 32768.0;
  }

  // 3. Play it
  const source = audioCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioCtx.destination);
  source.start();
  console.log("🔊 Playing static!");
};
