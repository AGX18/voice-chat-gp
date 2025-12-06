// server.js
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 1. Recreate __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

// 2. Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    // We will save the file to the project root
    const fileName = `recording-${socket.id}.webm`;
    const filePath = path.join(__dirname, fileName);
    const fileStream = fs.createWriteStream(filePath);

    console.log(`Recording to ${fileName}...`);

    socket.on('audio-stream', (blob) => {
        fileStream.write(blob);
    });

    socket.on('end-stream', () => {
        console.log('Audio stream ended.');
        fileStream.end();
        socket.emit('bot-message', "I received your message! Processing...");
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
        fileStream.end();
    });
});

httpServer.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});