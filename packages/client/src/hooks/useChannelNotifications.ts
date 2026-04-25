import { useState, useCallback } from 'react';
import type { ChannelNotificationLevel, ChannelNotificationSetting } from '@chat-app/shared';
import { api } from '../api/client';

export interface UseChannelNotificationsResult {
  settings: Map<number, ChannelNotificationSetting>;
  getLevel: (channelId: number) => ChannelNotificationLevel;
  setLevel: (channelId: number, level: ChannelNotificationLevel) => Promise<void>;
  fetchSettings: () => Promise<void>;
}

/**
 * チャンネル通知設定を管理するフック。
 * - 初回は fetchSettings() を呼び出して設定を取得する
 * - setLevel() で通知レベルを変更し、ローカルキャッシュ（Map）を即時更新する
 * - getLevel() でチャンネルごとの通知レベルを参照する（未設定は 'all'）
 */
export function useChannelNotifications(): UseChannelNotificationsResult {
  const [settings, setSettings] = useState<Map<number, ChannelNotificationSetting>>(new Map());

  const fetchSettings = useCallback(async () => {
    const { settings: list } = await api.channels.getNotifications();
    const map = new Map<number, ChannelNotificationSetting>();
    for (const s of list) {
      map.set(s.channelId, s);
    }
    setSettings(map);
  }, []);

  const getLevel = useCallback(
    (channelId: number): ChannelNotificationLevel => {
      return settings.get(channelId)?.level ?? 'all';
    },
    [settings],
  );

  const setLevel = useCallback(
    async (channelId: number, level: ChannelNotificationLevel): Promise<void> => {
      const { setting } = await api.channels.setNotificationLevel(channelId, level);
      setSettings((prev) => {
        const next = new Map(prev);
        next.set(channelId, setting);
        return next;
      });
    },
    [],
  );

  return { settings, getLevel, setLevel, fetchSettings };
}
