/**
 * テスト対象: hooks/useChannelNotifications
 * 責務: 通知設定の一覧取得（Map形式キャッシュ）と設定更新 API 呼び出し
 * 戦略:
 *   - api モジュールを vi.mock で差し替えてネットワーク通信を排除
 *   - renderHook でフックの状態変化を検証する
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ChannelNotificationSetting } from '@chat-app/shared';

vi.mock('../api/client', () => ({
  api: {
    channels: {
      getNotifications: vi.fn(),
      setNotificationLevel: vi.fn(),
    },
  },
}));

import { api } from '../api/client';
import { useChannelNotifications } from '../hooks/useChannelNotifications';

const mockedApi = api as {
  channels: {
    getNotifications: ReturnType<typeof vi.fn>;
    setNotificationLevel: ReturnType<typeof vi.fn>;
  };
};

function makeSetting(
  channelId: number,
  level: ChannelNotificationSetting['level'],
): ChannelNotificationSetting {
  return { channelId, level, updatedAt: '2024-01-01T00:00:00Z' };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useChannelNotifications', () => {
  describe('初回データ取得', () => {
    it('マウント時に GET /api/channels/notifications を呼ぶ', async () => {
      mockedApi.channels.getNotifications.mockResolvedValue({ settings: [] });
      const { result } = renderHook(() => useChannelNotifications());
      await act(async () => {
        await result.current.fetchSettings();
      });
      expect(mockedApi.channels.getNotifications).toHaveBeenCalledTimes(1);
    });

    it('取得したデータが channelId をキーとする Map で返される', async () => {
      mockedApi.channels.getNotifications.mockResolvedValue({
        settings: [makeSetting(1, 'muted'), makeSetting(2, 'mentions')],
      });
      const { result } = renderHook(() => useChannelNotifications());
      await act(async () => {
        await result.current.fetchSettings();
      });
      expect(result.current.settings.size).toBe(2);
      expect(result.current.settings.get(1)?.level).toBe('muted');
      expect(result.current.settings.get(2)?.level).toBe('mentions');
    });

    it('レスポンスが空配列の場合は空の Map を返す', async () => {
      mockedApi.channels.getNotifications.mockResolvedValue({ settings: [] });
      const { result } = renderHook(() => useChannelNotifications());
      await act(async () => {
        await result.current.fetchSettings();
      });
      expect(result.current.settings.size).toBe(0);
    });
  });

  describe('setLevel（通知レベルの更新）', () => {
    it('setLevel を呼ぶと PUT /api/channels/:id/notifications が呼ばれる', async () => {
      mockedApi.channels.setNotificationLevel.mockResolvedValue({
        setting: makeSetting(5, 'muted'),
      });
      const { result } = renderHook(() => useChannelNotifications());
      await act(async () => {
        await result.current.setLevel(5, 'muted');
      });
      expect(mockedApi.channels.setNotificationLevel).toHaveBeenCalledWith(5, 'muted');
    });

    it('setLevel 成功後にローカルのキャッシュ（Map）が更新される', async () => {
      mockedApi.channels.setNotificationLevel.mockResolvedValue({
        setting: makeSetting(5, 'muted'),
      });
      const { result } = renderHook(() => useChannelNotifications());
      await act(async () => {
        await result.current.setLevel(5, 'muted');
      });
      expect(result.current.settings.get(5)?.level).toBe('muted');
    });

    it('setLevel が失敗してもキャッシュが変更されない', async () => {
      mockedApi.channels.setNotificationLevel.mockRejectedValue(new Error('Network error'));
      const { result } = renderHook(() => useChannelNotifications());
      await act(async () => {
        await result.current.setLevel(5, 'muted').catch(() => {});
      });
      expect(result.current.settings.get(5)).toBeUndefined();
    });
  });

  describe('getLevel（個別チャンネルの通知レベル参照）', () => {
    it('設定済みのチャンネルは正しいレベルを返す', async () => {
      mockedApi.channels.getNotifications.mockResolvedValue({
        settings: [makeSetting(3, 'mentions')],
      });
      const { result } = renderHook(() => useChannelNotifications());
      await act(async () => {
        await result.current.fetchSettings();
      });
      expect(result.current.getLevel(3)).toBe('mentions');
    });

    it('未設定のチャンネルはデフォルト値 "all" を返す', () => {
      const { result } = renderHook(() => useChannelNotifications());
      expect(result.current.getLevel(999)).toBe('all');
    });
  });
});
