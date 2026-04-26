import { Server as SocketServer, Socket } from 'socket.io';
import * as channelService from '../services/channelService';
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
 * チャンネル関連のソケットハンドラを登録する。
 * - 接続時にuser:${userId}ルームおよびアクセス可能な全チャンネルへ自動join
 * - join_channel, leave_channel, typing_start, typing_stop イベントを処理
 */
export async function registerChannelHandlers(socket: ChatSocket): Promise<void> {
  const { userId, username } = socket.data;

  void socket.join(`user:${userId}`);

  // 接続時にアクセス可能な全チャンネルへ自動 join
  try {
    const accessibleChannels = await channelService.getChannelsForUser(userId);
    for (const ch of accessibleChannels) {
      void socket.join(`channel:${ch.id}`);
    }
  } catch {
    // 接続時の自動joinエラーは無視
  }

  socket.on('join_channel', (channelId) => {
    void socket.join(`channel:${channelId}`);
  });

  socket.on('leave_channel', (channelId) => {
    void socket.leave(`channel:${channelId}`);
  });

  socket.on('typing_start', (channelId) => {
    socket.to(`channel:${channelId}`).emit('user_typing', { userId, username, channelId });
  });

  socket.on('typing_stop', (channelId) => {
    socket.to(`channel:${channelId}`).emit('user_stopped_typing', { userId, channelId });
  });

  // #107 転送先イベントの RSVP リアルタイム更新を購読するため、
  // EventCard がマウント時に event-id ベースのルームへ join する。
  // ログインユーザーであれば誰でも join できる（RSVP 自体に閲覧側の認可制約がないため）。
  socket.on('event:join_room', (eventId) => {
    void socket.join(`event:${eventId}`);
  });

  socket.on('event:leave_room', (eventId) => {
    void socket.leave(`event:${eventId}`);
  });
}
