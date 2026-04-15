import { Server as SocketServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import * as messageService from '../services/messageService';
import * as pinMessageService from '../services/pinMessageService';
import * as pushService from '../services/pushService';
import * as channelService from '../services/channelService';
import * as dmService from '../services/dmService';
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

    // ユーザー専用ルームに join（mention_updated などの個人通知用）
    void socket.join(`user:${userId}`);

    // 接続時にアクセス可能な全チャンネルへ自動 join（非アクティブチャンネルの new_message も受信するため）
    const accessibleChannels = channelService.getChannelsForUser(userId);
    for (const ch of accessibleChannels) {
      void socket.join(`channel:${ch.id}`);
    }

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

              // mention_updated をメンション対象ユーザーに emit
              const mentionedChannels = channelService.getChannelsForUser(mentionedUserId);
              const ch = mentionedChannels.find((c) => c.id === data.channelId);
              if (ch !== undefined) {
                io.to(`user:${mentionedUserId}`).emit('mention_updated', {
                  channelId: data.channelId,
                  mentionCount: ch.mentionCount ?? 0,
                });
              }
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

    socket.on('add_reaction', (data) => {
      try {
        const message = messageService.getMessageById(data.messageId);
        if (!message) return;

        const reactions = messageService.addReaction(data.messageId, userId, data.emoji);
        io.to(`channel:${message.channelId}`).emit('reaction_updated', {
          messageId: data.messageId,
          channelId: message.channelId,
          reactions,
        });
      } catch {
        socket.emit('error', 'Failed to add reaction');
      }
    });

    socket.on('remove_reaction', (data) => {
      try {
        const message = messageService.getMessageById(data.messageId);
        if (!message) return;

        const reactions = messageService.removeReaction(data.messageId, userId, data.emoji);
        io.to(`channel:${message.channelId}`).emit('reaction_updated', {
          messageId: data.messageId,
          channelId: message.channelId,
          reactions,
        });
      } catch {
        socket.emit('error', 'Failed to remove reaction');
      }
    });

    socket.on('send_thread_reply', (data) => {
      try {
        const reply = messageService.createThreadReply(
          data.parentMessageId,
          data.rootMessageId,
          userId,
          data.content,
          data.mentionedUserIds,
          data.attachmentIds,
        );

        const replyCount = messageService.getThreadReplies(data.rootMessageId).length;

        io.to(`channel:${reply.channelId}`).emit('new_thread_reply', {
          reply,
          rootMessageId: data.rootMessageId,
          channelId: reply.channelId,
          replyCount,
        });
      } catch {
        socket.emit('error', 'Failed to send thread reply');
      }
    });

    socket.on('pin_message', (data) => {
      try {
        const pinned = pinMessageService.pinMessage(data.messageId, data.channelId, userId);
        io.to(`channel:${data.channelId}`).emit('message_pinned', {
          messageId: data.messageId,
          channelId: data.channelId,
          pinnedBy: userId,
          pinnedAt: pinned.pinnedAt,
        });
      } catch {
        socket.emit('error', 'Failed to pin message');
      }
    });

    socket.on('unpin_message', (data) => {
      try {
        pinMessageService.unpinMessage(data.messageId, data.channelId);
        io.to(`channel:${data.channelId}`).emit('message_unpinned', {
          messageId: data.messageId,
          channelId: data.channelId,
        });
      } catch {
        socket.emit('error', 'Failed to unpin message');
      }
    });

    socket.on('send_dm', (data) => {
      try {
        const message = dmService.sendMessage(data.conversationId, userId, data.content);

        // 送信者と受信者の両方に new_dm_message を emit
        io.to(`user:${userId}`).emit('new_dm_message', message);

        const otherUserId = dmService.getOtherUserId(data.conversationId, userId);
        if (otherUserId !== null) {
          io.to(`user:${otherUserId}`).emit('new_dm_message', message);

          // 未読カウントを含む通知を相手に送る
          const conversations = dmService.getConversations(otherUserId);
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
    });

    socket.on('dm_typing_start', (conversationId) => {
      const otherUserId = dmService.getOtherUserId(conversationId, userId);
      if (otherUserId !== null) {
        io.to(`user:${otherUserId}`).emit('dm_user_typing', { conversationId, userId, username });
      }
    });

    socket.on('dm_typing_stop', (conversationId) => {
      const otherUserId = dmService.getOtherUserId(conversationId, userId);
      if (otherUserId !== null) {
        io.to(`user:${otherUserId}`).emit('dm_user_stopped_typing', { conversationId, userId });
      }
    });
  });
}
