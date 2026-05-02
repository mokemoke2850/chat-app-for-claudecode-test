import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api/client';

/**
 * Step 6d: Rail のホームアイコン (Inbox) に出すメンション未読バッジ用集計フック。
 *
 * - Step 6b の `api.messages.search('', { mentionedToMe: true, unreadOnly: true })`
 *   を再利用して未読メンション件数を取得する
 * - 現在パスが Inbox (`/`) のときは 0 を返す（自分が見ている画面に
 *   バッジを出すと冗長になるため。state は保持）
 * - API 失敗時は 0 を返す（throw しない）
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
