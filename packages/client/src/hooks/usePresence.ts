/**
 * #146 プレゼンス購読フック
 *
 * Socket 経由で `presence:bulk` / `presence:state` を購読し、
 * Map<userId, state> を返す。
 *
 * 加えて、自身の操作（mousemove / keydown）を監視して
 * 一定 throttle 間隔で `presence:heartbeat` を送る。
 *
 * 実装メモ:
 *   - useState のイニシャライザで Map を生成すると毎回再生成されないため、空の Map を返す関数を渡す。
 *   - throttle は最終送信時刻を ref に保持し、HEARTBEAT_INTERVAL_MS 未満の連発をスキップする。
 *   - mount 時 / アンマウント時に socket.on / off を確実に揃える。
 */

import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  PresenceState,
  PresenceBulk,
  PresenceUpdate,
} from '@chat-app/shared';

export type PresenceMap = Map<number, PresenceState>;

type ChatSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** ハートビート最小送信間隔（ms）。30 秒間隔で十分（5 分の AWAY 判定より十分短い） */
export const HEARTBEAT_INTERVAL_MS = 30 * 1000;

export function usePresence(socket: ChatSocket | null): PresenceMap {
  const [map, setMap] = useState<PresenceMap>(() => new Map());
  const lastHeartbeatRef = useRef<number>(0);

  useEffect(() => {
    if (!socket) return;

    const handleBulk = (data: PresenceBulk) => {
      setMap(() => {
        const next: PresenceMap = new Map();
        for (const s of data.states) {
          next.set(s.userId, s.state);
        }
        return next;
      });
    };
    const handleState = (data: PresenceUpdate) => {
      setMap((prev) => {
        const next = new Map(prev);
        if (data.state === 'offline') {
          next.delete(data.userId);
        } else {
          next.set(data.userId, data.state);
        }
        return next;
      });
    };

    socket.on('presence:bulk', handleBulk);
    socket.on('presence:state', handleState);

    return () => {
      socket.off('presence:bulk', handleBulk);
      socket.off('presence:state', handleState);
    };
  }, [socket]);

  useEffect(() => {
    if (!socket) return;

    const sendHeartbeat = () => {
      const now = Date.now();
      if (now - lastHeartbeatRef.current < HEARTBEAT_INTERVAL_MS) return;
      lastHeartbeatRef.current = now;
      socket.emit('presence:heartbeat');
    };

    window.addEventListener('mousemove', sendHeartbeat);
    window.addEventListener('keydown', sendHeartbeat);

    return () => {
      window.removeEventListener('mousemove', sendHeartbeat);
      window.removeEventListener('keydown', sendHeartbeat);
    };
  }, [socket]);

  return map;
}
