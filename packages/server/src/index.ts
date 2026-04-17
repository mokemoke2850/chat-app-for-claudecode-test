import 'dotenv/config';
import http from 'http';
import { Server as SocketServer } from 'socket.io';
import { createApp } from './app';
import { setupSocketHandlers } from './socket/handler';
import { setSocketServer } from './socket';
import { startReminderScheduler } from './services/reminderService';
import { getPool } from './db/database';
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
setSocketServer(io);
startReminderScheduler();

// PostgreSQL Pool 接続確認
getPool().query('SELECT 1').then(() => {
  console.log('Database:  PostgreSQL connected');
}).catch((err) => {
  console.error('Database connection failed:', err);
});

server.listen(PORT, () => {
  console.log(`Server:    http://localhost:${PORT}`);
  console.log(`Swagger:   http://localhost:${PORT}/api-docs`);
});
