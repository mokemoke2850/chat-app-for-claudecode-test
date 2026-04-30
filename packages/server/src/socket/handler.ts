import { Server as SocketServer } from 'socket.io';
import {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from '@chat-app/shared';
import { authMiddleware } from './socketAuthMiddleware';
import { registerChannelHandlers } from './channelHandler';
import { registerMessageHandlers } from './messageHandler';
import { registerDmHandlers } from './dmHandler';
import { attachPresenceBroadcaster, registerPresenceHandlers } from './presenceHandler';

type ChatServer = SocketServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export function setupSocketHandlers(io: ChatServer): void {
  io.use(authMiddleware);
  attachPresenceBroadcaster(io);

  io.on('connection', (socket) => {
    void registerChannelHandlers(socket);
    registerMessageHandlers(io, socket);
    registerDmHandlers(io, socket);
    registerPresenceHandlers(socket);
  });
}
