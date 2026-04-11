import { Server as SocketServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import * as messageService from '../services/messageService';
import * as pushService from '../services/pushService';
import {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from '@chat-app/shared';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-please-change-in-production';

type ChatServer = SocketServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export function setupSocketHandlers(io: ChatServer): void {
  // Auth middleware: verify JWT from cookie or auth header
  io.use((socket, next) => {
    const cookieHeader = socket.handshake.headers.cookie ?? '';
    const tokenMatch = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
    const token = tokenMatch?.[1] ?? (socket.handshake.auth as { token?: string }).token;

    if (!token) {
      next(new Error('Unauthorized'));
      return;
    }

    try {
      const payload = jwt.verify(token, JWT_SECRET) as { userId: number; username: string };
      socket.data.userId = payload.userId;
      socket.data.username = payload.username;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const { userId, username } = socket.data;

    socket.on('join_channel', (channelId) => {
      void socket.join(`channel:${channelId}`);
    });

    socket.on('leave_channel', (channelId) => {
      void socket.leave(`channel:${channelId}`);
    });

    socket.on('send_message', (data) => {
      try {
        const message = messageService.createMessage(
          data.channelId,
          userId,
          data.content,
          data.mentionedUserIds,
          (data as { attachmentIds?: number[] }).attachmentIds,
        );

        io.to(`channel:${data.channelId}`).emit('new_message', message);

        if (data.mentionedUserIds && data.mentionedUserIds.length > 0) {
          for (const mentionedUserId of data.mentionedUserIds) {
            if (mentionedUserId !== userId) {
              void pushService.sendPushToUser(mentionedUserId, {
                title: `${username} mentioned you`,
                body: 'You were mentioned in a message',
                url: `/channels/${data.channelId}`,
              });
            }
          }
        }
      } catch {
        socket.emit('error', 'Failed to send message');
      }
    });

    socket.on('edit_message', (data) => {
      try {
        const message = messageService.editMessage(
          data.messageId,
          userId,
          data.content,
          data.mentionedUserIds,
          data.attachmentIds,
        );
        io.to(`channel:${message.channelId}`).emit('message_edited', message);
      } catch {
        socket.emit('error', 'Failed to edit message');
      }
    });

    socket.on('delete_message', (messageId) => {
      try {
        const message = messageService.getMessageById(messageId);
        if (!message) return;

        messageService.deleteMessage(messageId, userId);
        io.to(`channel:${message.channelId}`).emit('message_deleted', {
          messageId,
          channelId: message.channelId,
        });
      } catch {
        socket.emit('error', 'Failed to delete message');
      }
    });

    socket.on('restore_message', (messageId) => {
      try {
        const message = messageService.restoreMessage(messageId, userId);
        io.to(`channel:${message.channelId}`).emit('message_restored', message);
      } catch {
        socket.emit('error', 'Failed to restore message');
      }
    });

    socket.on('typing_start', (channelId) => {
      socket.to(`channel:${channelId}`).emit('user_typing', { userId, username, channelId });
    });

    socket.on('typing_stop', (channelId) => {
      socket.to(`channel:${channelId}`).emit('user_stopped_typing', { userId, channelId });
    });
  });
}
