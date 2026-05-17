/**
 * 最近開いたチャンネルの履歴を localStorage で管理するカスタムフック。
 * 最大 MAX_RECENT 件を保持し、新しいものが先頭に来る順序で保存する。
 */

import { useState, useCallback } from 'react';

const STORAGE_KEY = 'recentChannels';
const MAX_RECENT = 5;

export interface RecentChannel {
  id: number;
  name: string;
}

function loadRecent(): RecentChannel[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecentChannel[];
  } catch {
    return [];
  }
}

function saveRecent(channels: RecentChannel[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(channels));
}

export function useRecentChannels() {
  const [recentChannels, setRecentChannels] = useState<RecentChannel[]>(() => loadRecent());

  /** チャンネルを履歴の先頭に追加する（重複は除外し、MAX_RECENT 件に切り詰める） */
  const addRecentChannel = useCallback((channel: RecentChannel) => {
    setRecentChannels((prev) => {
      const filtered = prev.filter((ch) => ch.id !== channel.id);
      const next = [channel, ...filtered].slice(0, MAX_RECENT);
      saveRecent(next);
      return next;
    });
  }, []);

  return { recentChannels, addRecentChannel };
}
