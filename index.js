// server.js
import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import * as googleTTS from 'google-tts-api'; // Free TTS library

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);
    
    // File to save user audio
    const fileName = `recording-${socket.id}.webm`;
    const filePath = path.join(__dirname, fileName);
    const fileStream = fs.createWriteStream(filePath);

    socket.on('audio-stream', (blob) => {
        fileStream.write(blob);
    });

    socket.on('end-stream', async () => {
        console.log('Audio received. Uploading to Gemini...');
        fileStream.end();

        try {
            // STEP 1: Upload Audio to Gemini
            // Gemini needs the file uploaded to its server first to process it.
            const uploadResult = await fileManager.uploadFile(filePath, {
                mimeType: "audio/webm",
                displayName: "User Audio",
            });

            console.log(`Uploaded file: ${uploadResult.file.uri}`);
            socket.emit('bot-status', "Gemini is listening...");

            // STEP 2: Generate Response (Multimodal)
            // We send the file URI + a prompt instructions
            const result = await model.generateContent([
                "You are a helpful voice assistant. Listen to this audio and reply concisely in text.",
                {
                    fileData: {
                        fileUri: uploadResult.file.uri,
                        mimeType: uploadResult.file.mimeType,
                    },
                },
            ]);

            const aiText = result.response.text();
            console.log(`Gemini says: "${aiText}"`);
            socket.emit('bot-status', `Gemini says: "${aiText}"`);

            // STEP 3: Convert Text to Audio (TTS)
            // Since Gemini only returns text, we use google-tts-api to speak it
            const url = googleTTS.getAudioUrl(aiText, {
                lang: 'en',
                slow: false,
                host: 'https://translate.google.com',
            });

            // Fetch the audio from the URL and send buffer to client
            const ttsResponse = await fetch(url);
            const arrayBuffer = await ttsResponse.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            socket.emit('ai-audio-response', buffer);

            // Cleanup: Delete file from Gemini server to save space (Good practice)
            await fileManager.deleteFile(uploadResult.file.name);

        } catch (error) {
            console.error("Error processing with Gemini:", error);
            socket.emit('bot-status', "Error: Could not reach Gemini.");
        }
    });

    socket.on('disconnect', () => {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    });
});

httpServer.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});