import { Server as SocketServer, Socket } from 'socket.io';
import * as messageService from '../services/messageService';
import * as pinMessageService from '../services/pinMessageService';
import * as pushService from '../services/pushService';
import * as channelService from '../services/channelService';
import * as channelNotificationService from '../services/channelNotificationService';
import * as moderationService from '../services/moderationService';
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

type ChatSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

/**
 * メッセージ関連のソケットハンドラを登録する。
 * - send_message, edit_message, delete_message, restore_message
 * - add_reaction, remove_reaction
 * - send_thread_reply
 * - pin_message, unpin_message
 */
export function registerMessageHandlers(io: ChatServer, socket: ChatSocket): void {
  const { userId, username } = socket.data;

  socket.on('send_message', (data) => {
    void (async () => {
      try {
        const message = await messageService.createMessage(
          data.channelId,
          userId,
          data.content,
          data.mentionedUserIds,
          (data as { attachmentIds?: number[] }).attachmentIds,
          (data as { quotedMessageId?: number }).quotedMessageId,
        );

        // #117 warn: 送信成功扱い。送信者にだけ message_warning を返す
        const ngResult = await moderationService.checkContent(data.content);
        if (ngResult?.action === 'warn') {
          socket.emit('message_warning', {
            matchedPattern: ngResult.matchedPattern,
            message: `投稿に注意ワードが含まれています: ${ngResult.matchedPattern}`,
          });
        }

        io.to(`channel:${data.channelId}`).emit('new_message', message);

        if (data.mentionedUserIds && data.mentionedUserIds.length > 0) {
          for (const mentionedUserId of data.mentionedUserIds) {
            if (mentionedUserId !== userId) {
              // 通知レベルチェック: muted なら push も mention_updated も送らない
              const level = await channelNotificationService.getLevel(
                mentionedUserId,
                data.channelId,
              );

              if (level !== 'muted') {
                void pushService.sendPushToUser(mentionedUserId, {
                  title: `${username} mentioned you`,
                  body: 'You were mentioned in a message',
                  url: `/channels/${data.channelId}`,
                });

                const mentionedChannels = await channelService.getChannelsForUser(mentionedUserId);
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
        }
      } catch {
        socket.emit('error', 'Failed to send message');
      }
    })();
  });

  socket.on('edit_message', (data) => {
    void (async () => {
      try {
        const message = await messageService.editMessage(
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
    })();
  });

  socket.on('delete_message', (messageId) => {
    void (async () => {
      try {
        const message = await messageService.getMessageById(messageId);
        if (!message) return;

        await messageService.deleteMessage(messageId, userId);
        io.to(`channel:${message.channelId}`).emit('message_deleted', {
          messageId,
          channelId: message.channelId,
        });
      } catch {
        socket.emit('error', 'Failed to delete message');
      }
    })();
  });

  socket.on('restore_message', (messageId) => {
    void (async () => {
      try {
        const message = await messageService.restoreMessage(messageId, userId);
        io.to(`channel:${message.channelId}`).emit('message_restored', message);
      } catch {
        socket.emit('error', 'Failed to restore message');
      }
    })();
  });

  socket.on('add_reaction', (data) => {
    void (async () => {
      try {
        const message = await messageService.getMessageById(data.messageId);
        if (!message) return;

        const reactions = await messageService.addReaction(data.messageId, userId, data.emoji);
        io.to(`channel:${message.channelId}`).emit('reaction_updated', {
          messageId: data.messageId,
          channelId: message.channelId,
          reactions,
        });
      } catch {
        socket.emit('error', 'Failed to add reaction');
      }
    })();
  });

  socket.on('remove_reaction', (data) => {
    void (async () => {
      try {
        const message = await messageService.getMessageById(data.messageId);
        if (!message) return;

        const reactions = await messageService.removeReaction(data.messageId, userId, data.emoji);
        io.to(`channel:${message.channelId}`).emit('reaction_updated', {
          messageId: data.messageId,
          channelId: message.channelId,
          reactions,
        });
      } catch {
        socket.emit('error', 'Failed to remove reaction');
      }
    })();
  });

  socket.on('send_thread_reply', (data) => {
    void (async () => {
      try {
        const reply = await messageService.createThreadReply(
          data.parentMessageId,
          data.rootMessageId,
          userId,
          data.content,
          data.mentionedUserIds,
          data.attachmentIds,
        );

        const replies = await messageService.getThreadReplies(data.rootMessageId);
        const replyCount = replies.length;

        io.to(`channel:${reply.channelId}`).emit('new_thread_reply', {
          reply,
          rootMessageId: data.rootMessageId,
          channelId: reply.channelId,
          replyCount,
        });
      } catch {
        socket.emit('error', 'Failed to send thread reply');
      }
    })();
  });

  socket.on('pin_message', (data) => {
    void (async () => {
      try {
        const pinned = await pinMessageService.pinMessage(data.messageId, data.channelId, userId);
        io.to(`channel:${data.channelId}`).emit('message_pinned', {
          messageId: data.messageId,
          channelId: data.channelId,
          pinnedBy: userId,
          pinnedAt: pinned.pinnedAt,
        });
      } catch {
        socket.emit('error', 'Failed to pin message');
      }
    })();
  });

  socket.on('unpin_message', (data) => {
    void (async () => {
      try {
        await pinMessageService.unpinMessage(data.messageId, data.channelId);
        io.to(`channel:${data.channelId}`).emit('message_unpinned', {
          messageId: data.messageId,
          channelId: data.channelId,
        });
      } catch {
        socket.emit('error', 'Failed to unpin message');
      }
    })();
  });
}
