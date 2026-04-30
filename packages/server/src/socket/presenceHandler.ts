/**
 * #146 プレゼンス Socket ハンドラ
 *
 * - 接続時: presenceService に connect を登録、presence:bulk をクライアントに送信
 * - presence:heartbeat を受信したら presenceService に通知
 * - disconnect 時: presenceService に disconnect を登録
 *
 * 状態変化（online / away / offline）は presenceService の onStateChange リスナー
 * 経由で io.emit('presence:state', ...) として全接続クライアントに broadcast する。
 *
 * broadcast 範囲:
 *   - MVP では「現在 Socket 接続中のクライアント全員」（= ワークスペース内ユーザー集合）
 *     に対して io.emit する。socket.io はサーバ側で接続中の全 Socket に届けるため、
 *     これがそのまま「ワークスペース内 broadcast」となる。
 */

import { Server as SocketServer, Socket } from 'socket.io';
import {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from '@chat-app/shared';
import * as presenceService from '../services/presenceService';

type ChatServer = SocketServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

type ChatSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

let _listenerUnsub: (() => void) | null = null;

/**
 * 状態変化リスナーを 1 度だけ登録する（io 単位）。
 * setupSocketHandlers で 1 回呼び出される想定。
 */
export function attachPresenceBroadcaster(io: ChatServer): void {
  // 既に登録済みなら一度解除してから再登録（テストで複数回 setup される場合を考慮）
  if (_listenerUnsub) {
    _listenerUnsub();
    _listenerUnsub = null;
  }
  _listenerUnsub = presenceService.onStateChange((userId, state) => {
    io.emit('presence:state', { userId, state });
  });
}

/**
 * 各ソケットに対するプレゼンス処理を登録する。
 */
export function registerPresenceHandlers(socket: ChatSocket): void {
  const { userId } = socket.data;

  presenceService.handleConnect(userId, socket.id);

  // 接続直後にスナップショットを送る
  socket.emit('presence:bulk', { states: presenceService.getBulk() });

  socket.on('presence:heartbeat', () => {
    presenceService.handleHeartbeat(userId);
  });

  socket.on('disconnect', () => {
    presenceService.handleDisconnect(userId, socket.id);
  });
}
