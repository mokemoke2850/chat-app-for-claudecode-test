import 'dotenv/config';
import http from 'http';
import { Server as SocketServer } from 'socket.io';
import { createApp } from './app';
import { setupSocketHandlers } from './socket/handler';
import { getDatabase } from './db/database';
import {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from '@chat-app/shared';

const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const app = createApp();
const server = http.createServer(app);

const io = new SocketServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(server, {
  cors: { origin: CLIENT_URL, credentials: true },
});

setupSocketHandlers(io);
getDatabase(); // initialize DB + schema

server.listen(PORT, () => {
  console.log(`Server:    http://localhost:${PORT}`);
  console.log(`Swagger:   http://localhost:${PORT}/api-docs`);
});
