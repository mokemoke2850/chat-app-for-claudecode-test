import { Server as SocketServer } from 'socket.io';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from '@chat-app/shared';

type ChatServer = SocketServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

let _io: ChatServer | null = null;

export function setSocketServer(io: ChatServer): void {
  _io = io;
}

export function getSocketServer(): ChatServer | null {
  return _io;
}
