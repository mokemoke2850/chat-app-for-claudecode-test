import { Server as SocketServer, Socket } from 'socket.io';
import * as dmService from '../services/dmService';
import {
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

type ChatSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

/**
 * DM関連のソケットハンドラを登録する。
 * - send_dm, dm_typing_start, dm_typing_stop イベントを処理
 */
export function registerDmHandlers(io: ChatServer, socket: ChatSocket): void {
  const { userId, username } = socket.data;

  socket.on('send_dm', (data) => {
    void (async () => {
      try {
        const message = await dmService.sendMessage(data.conversationId, userId, data.content);

        io.to(`user:${userId}`).emit('new_dm_message', message);

        const otherUserId = await dmService.getOtherUserId(data.conversationId, userId);
        if (otherUserId !== null) {
          io.to(`user:${otherUserId}`).emit('new_dm_message', message);

          const conversations = await dmService.getConversations(otherUserId);
          const conv = conversations.find((c) => c.id === data.conversationId);
          if (conv) {
            io.to(`user:${otherUserId}`).emit('dm_notification', {
              conversationId: data.conversationId,
              unreadCount: conv.unreadCount,
            });
          }
        }
      } catch {
        socket.emit('error', 'Failed to send DM');
      }
    })();
  });

  socket.on('dm_typing_start', (conversationId) => {
    void (async () => {
      const otherUserId = await dmService.getOtherUserId(conversationId, userId);
      if (otherUserId !== null) {
        io.to(`user:${otherUserId}`).emit('dm_user_typing', { conversationId, userId, username });
      }
    })();
  });

  socket.on('dm_typing_stop', (conversationId) => {
    void (async () => {
      const otherUserId = await dmService.getOtherUserId(conversationId, userId);
      if (otherUserId !== null) {
        io.to(`user:${otherUserId}`).emit('dm_user_stopped_typing', { conversationId, userId });
      }
    })();
  });
}
