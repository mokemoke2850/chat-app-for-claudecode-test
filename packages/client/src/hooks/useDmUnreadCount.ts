import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api/client';
import { useSocket } from '../contexts/SocketContext';

/**
 * Rail の DM 未読バッジ用の集計フック。
 *
 * - 初回マウント時に GET /dm/conversations で各会話の unreadCount を合計する
 * - Socket イベント `dm_notification` を購読し、受信のたび count を加算する
 * - 現在のパスが /dm 配下のときは 0 を返す（内部 state は保持される）
 */
export function useDmUnreadCount(): number {
  const [count, setCount] = useState(0);
  const socket = useSocket();
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    api.dm
      .listConversations()
      .then(({ conversations }) => {
        if (cancelled) return;
        const sum = conversations.reduce((acc, c) => acc + (c.unreadCount ?? 0), 0);
        setCount(sum);
      })
      .catch(() => {
        // 取得失敗時は 0 のまま（次回 Socket 受信で増分のみ反映）
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handler = (data: { conversationId: number; unreadCount: number }) => {
      setCount((prev) => prev + data.unreadCount);
    };
    socket.on('dm_notification', handler);
    return () => {
      socket.off('dm_notification', handler);
    };
  }, [socket]);

  if (location.pathname.startsWith('/dm')) return 0;
  return count;
}
