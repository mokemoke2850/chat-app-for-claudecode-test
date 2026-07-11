import { Server as SocketServer, Socket } from 'socket.io';
import * as messageService from '../services/messageService';
import * as pinMessageService from '../services/pinMessageService';
import * as pushService from '../services/pushService';
import * as channelService from '../services/channelService';
import * as channelNotificationService from '../services/channelNotificationService';
import * as appNotificationService from '../services/appNotificationService';
import * as presenceService from '../services/presenceService';
import * as moderationService from '../services/moderationService';
import { rateLimitService, getRateLimitConfig } from '../services/rateLimitService';
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
      // レート制限チェック
      const rateLimitResult = rateLimitService.check(userId, 'message');
      if (!rateLimitResult.allowed) {
        const { windowSec, limit } = getRateLimitConfig();
        socket.emit('error', {
          type: 'rate_limit',
          retryAfterSec: rateLimitResult.retryAfterSec,
          limit,
          windowSec,
          message: '短時間に多くの送信を検出しました。少し時間をおいてください。',
        });
        return;
      }

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

        // @here / @channel 展開: チャンネルメンバーへ mention_updated を送信
        const mentionTypeData = (data as { mentionType?: 'here' | 'channel' }).mentionType;
        if (mentionTypeData === 'here' || mentionTypeData === 'channel') {
          const channelMembers = await channelService.getChannelMembers(data.channelId);
          const notifiedUserIds = new Set<number>();

          for (const member of channelMembers) {
            if (member.id === userId) continue; // 送信者自身は除外

            // @here はオンライン中のみ、@channel は全員
            if (mentionTypeData === 'here') {
              const state = presenceService.getState(member.id);
              if (state === 'offline') continue;
            }

            // muted ユーザーは除外
            const level = await channelNotificationService.getLevel(member.id, data.channelId);
            if (level === 'muted') continue;

            notifiedUserIds.add(member.id);
          }

          for (const targetUserId of notifiedUserIds) {
            const targetChannels = await channelService.getChannelsForUser(targetUserId);
            const ch = targetChannels.find((c) => c.id === data.channelId);
            if (ch !== undefined) {
              io.to(`user:${targetUserId}`).emit('mention_updated', {
                channelId: data.channelId,
                mentionCount: ch.mentionCount ?? 0,
              });
            }
          }
        }

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
                void appNotificationService.create({ userId: mentionedUserId, type: 'mention', sourceId: message.id, title: `${username} があなたをメンションしました`, body: message.content, channelId: data.channelId, messageId: message.id, conversationId: null }).then(async (notification) => io.to(`user:${mentionedUserId}`).emit('notification_created', { notification, unreadCount: await appNotificationService.getUnreadCount(mentionedUserId) })).catch(() => {});
              }
            }
          }
        }
      } catch (err) {
        // 4xx のクライアント向けエラー（NG ワードや投稿権限など）はメッセージをそのまま送信者に伝える
        const e = err as { statusCode?: number; message?: string };
        const isClientError =
          typeof e.statusCode === 'number' && e.statusCode >= 400 && e.statusCode < 500;
        socket.emit('error', isClientError && e.message ? e.message : 'Failed to send message');
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

        // 編集でメンションが追加された場合、send_message と同じパターンで通知する
        if (data.mentionedUserIds && data.mentionedUserIds.length > 0) {
          for (const mentionedUserId of data.mentionedUserIds) {
            if (mentionedUserId !== userId) {
              // 通知レベルチェック: muted なら mention_updated も送らない（send_message と同仕様）
              const level = await channelNotificationService.getLevel(
                mentionedUserId,
                message.channelId,
              );

              if (level !== 'muted') {
                const mentionedChannels = await channelService.getChannelsForUser(mentionedUserId);
                const ch = mentionedChannels.find((c) => c.id === message.channelId);
                if (ch !== undefined) {
                  io.to(`user:${mentionedUserId}`).emit('mention_updated', {
                    channelId: message.channelId,
                    mentionCount: ch.mentionCount ?? 0,
                  });
                }
              }
            }
          }
        }
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
        const pinned = await pinMessageService.pinMessage(
          data.messageId,
          data.channelId,
          userId,
          data.categoryId,
        );
        io.to(`channel:${data.channelId}`).emit('message_pinned', {
          messageId: data.messageId,
          channelId: data.channelId,
          pinnedBy: userId,
          pinnedAt: pinned.pinnedAt,
          categoryId: pinned.categoryId,
        });
      } catch {
        socket.emit('error', 'Failed to pin message');
      }
    })();
  });

  socket.on('unpin_message', (data) => {
    void (async () => {
      try {
        await pinMessageService.unpinMessage(data.messageId, data.channelId, userId);
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
