import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api/client';

/**
 * Rail のホームアイコン (Inbox) に出すメンション未読バッジ用の集計フック。
 *
 * - `api.messages.search('', { mentionedToMe: true, unreadOnly: true })` で件数を取得
 * - 現在パスが Inbox (`/`) のときは 0 を返す (見ている画面のバッジは冗長になるため)
 * - API 失敗時は 0 を返す (throw しない)
 */
export function useMentionUnreadCount(): number {
  const [count, setCount] = useState(0);
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    api.messages
      .search('', { mentionedToMe: true, unreadOnly: true })
      .then(({ messages }) => {
        if (cancelled) return;
        setCount(messages.length);
      })
      .catch(() => {
        // 取得失敗時は 0 のまま
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (location.pathname === '/') return 0;
  return count;
}
