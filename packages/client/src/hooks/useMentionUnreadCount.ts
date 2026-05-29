import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api/client';
import { useSocket } from '../contexts/SocketContext';

/**
 * Rail のホームアイコン (Inbox) に出すメンション未読バッジ用の集計フック。
 *
 * - `api.messages.search('', { mentionedToMe: true, unreadOnly: true })` で件数を取得
 * - Socket イベント `mention_updated` を購読し、受信のたびに再フェッチして最新件数を反映する
 * - 現在パスが Inbox (`/`) のときは 0 を返す (見ている画面のバッジは冗長になるため)
 * - API 失敗時は 0 を返す (throw しない)
 */
export function useMentionUnreadCount(): number {
  const [count, setCount] = useState(0);
  const socket = useSocket();
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    api.messages
      .search('', { mentionedToMe: true, unreadOnly: true })
      .then(({ total }) => {
        if (cancelled) return;
        setCount(total);
      })
      .catch(() => {
        // 取得失敗時は 0 のまま
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handler = () => {
      api.messages
        .search('', { mentionedToMe: true, unreadOnly: true })
        .then(({ total }) => {
          setCount(total);
        })
        .catch(() => {
          // 取得失敗時は現在値を維持
        });
    };

    socket.on('mention_updated', handler);
    return () => {
      socket.off('mention_updated', handler);
    };
  }, [socket]);

  if (location.pathname === '/') return 0;
  return count;
}
