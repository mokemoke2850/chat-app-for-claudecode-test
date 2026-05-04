/**
 * テスト対象: hooks/useMentionUnreadCount.ts (Rail のホームアイコン メンション未読バッジ用集計フック)
 *
 * 修正 Issue #240: 依存配列が [] のため初回マウント時の値で固定されていた問題を修正。
 *
 * 戦略:
 *   - api.messages.search をモックして件数を制御する
 *   - SocketContext をモックして mention_updated イベントを任意のタイミングで発火させる
 *   - MemoryRouter で initialEntries を切り替え、現在パスによる挙動を検証する
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useMentionUnreadCount } from '../useMentionUnreadCount';

const mockSearch = vi.fn();

vi.mock('../../api/client', () => ({
  api: {
    messages: {
      search: (q: string, filters: unknown) => mockSearch(q, filters),
    },
  },
}));

type MentionUpdatedHandler = (data: { channelId: number; mentionCount: number }) => void;

const mockSocket = {
  on: vi.fn<(event: string, handler: MentionUpdatedHandler) => void>(),
  off: vi.fn<(event: string, handler: MentionUpdatedHandler) => void>(),
};

let socketReturnValue: typeof mockSocket | null = mockSocket;

vi.mock('../../contexts/SocketContext', () => ({
  useSocket: () => socketReturnValue,
}));

function wrapperFactory(initialPath: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[initialPath]}>{children}</MemoryRouter>;
  };
}

beforeEach(() => {
  mockSearch.mockReset();
  mockSocket.on.mockReset();
  mockSocket.off.mockReset();
  socketReturnValue = mockSocket;
});

describe('useMentionUnreadCount', () => {
  describe('初期取得', () => {
    it('初回マウント時に api.messages.search を mentionedToMe / unreadOnly フィルタで呼ぶ', async () => {
      mockSearch.mockResolvedValue({ messages: [] });
      renderHook(() => useMentionUnreadCount(), { wrapper: wrapperFactory('/chat') });
      await waitFor(() => {
        expect(mockSearch).toHaveBeenCalledWith('', { mentionedToMe: true, unreadOnly: true });
      });
    });

    it('レスポンスの messages.length をカウントとして返す', async () => {
      mockSearch.mockResolvedValue({
        messages: [{ id: 1 }, { id: 2 }, { id: 3 }],
      });
      const { result } = renderHook(() => useMentionUnreadCount(), {
        wrapper: wrapperFactory('/chat'),
      });
      await waitFor(() => {
        expect(result.current).toBe(3);
      });
    });

    it('API が失敗した場合は 0 を返す（throw しない）', async () => {
      mockSearch.mockRejectedValue(new Error('network error'));
      const { result } = renderHook(() => useMentionUnreadCount(), {
        wrapper: wrapperFactory('/chat'),
      });
      await waitFor(() => {
        expect(mockSearch).toHaveBeenCalled();
      });
      expect(result.current).toBe(0);
    });
  });

  describe('Socket 受信による再フェッチ', () => {
    it('mention_updated イベントを受信すると api.messages.search が再フェッチされる', async () => {
      mockSearch.mockResolvedValue({ messages: [] });
      renderHook(() => useMentionUnreadCount(), { wrapper: wrapperFactory('/chat') });

      await waitFor(() => {
        expect(mockSocket.on).toHaveBeenCalledWith('mention_updated', expect.any(Function));
      });

      const handler = mockSocket.on.mock.calls.find(([e]) => e === 'mention_updated')?.[1];
      expect(handler).toBeDefined();

      const beforeCount = mockSearch.mock.calls.length;
      act(() => {
        handler!({ channelId: 1, mentionCount: 2 });
      });

      await waitFor(() => {
        expect(mockSearch.mock.calls.length).toBeGreaterThan(beforeCount);
      });
    });

    it('再フェッチ後の件数が count に反映される', async () => {
      // 初回は 1 件、再フェッチ後は 3 件
      mockSearch
        .mockResolvedValueOnce({ messages: [{ id: 1 }] })
        .mockResolvedValueOnce({ messages: [{ id: 1 }, { id: 2 }, { id: 3 }] });

      const { result } = renderHook(() => useMentionUnreadCount(), {
        wrapper: wrapperFactory('/chat'),
      });

      await waitFor(() => {
        expect(result.current).toBe(1);
      });

      await waitFor(() => {
        expect(mockSocket.on).toHaveBeenCalledWith('mention_updated', expect.any(Function));
      });

      const handler = mockSocket.on.mock.calls.find(([e]) => e === 'mention_updated')?.[1];
      act(() => {
        handler!({ channelId: 1, mentionCount: 3 });
      });

      await waitFor(() => {
        expect(result.current).toBe(3);
      });
    });

    it('mention_updated を複数回受信するたびに再フェッチが走る', async () => {
      mockSearch.mockResolvedValue({ messages: [] });
      renderHook(() => useMentionUnreadCount(), { wrapper: wrapperFactory('/chat') });

      await waitFor(() => {
        expect(mockSocket.on).toHaveBeenCalledWith('mention_updated', expect.any(Function));
      });

      const handler = mockSocket.on.mock.calls.find(([e]) => e === 'mention_updated')?.[1];
      expect(handler).toBeDefined();

      act(() => {
        handler!({ channelId: 1, mentionCount: 1 });
      });
      act(() => {
        handler!({ channelId: 2, mentionCount: 2 });
      });

      // 初回 + 2 回 = 合計 3 回以上のフェッチが走る
      await waitFor(() => {
        expect(mockSearch.mock.calls.length).toBeGreaterThanOrEqual(3);
      });
    });

    it('socket が null のとき mention_updated の購読は行わない', async () => {
      socketReturnValue = null;
      mockSearch.mockResolvedValue({ messages: [] });
      renderHook(() => useMentionUnreadCount(), { wrapper: wrapperFactory('/chat') });
      await waitFor(() => {
        expect(mockSearch).toHaveBeenCalled();
      });
      expect(mockSocket.on).not.toHaveBeenCalled();
    });

    it('unmount 時に mention_updated の購読が解除される', async () => {
      mockSearch.mockResolvedValue({ messages: [] });
      const { unmount } = renderHook(() => useMentionUnreadCount(), {
        wrapper: wrapperFactory('/chat'),
      });
      await waitFor(() => {
        expect(mockSocket.on).toHaveBeenCalledWith('mention_updated', expect.any(Function));
      });
      unmount();
      expect(mockSocket.off).toHaveBeenCalledWith('mention_updated', expect.any(Function));
    });
  });

  describe('現在パスによる挙動', () => {
    it('現在パスが / (Inbox) のときは 0 を返す（内部 state は保持される）', async () => {
      mockSearch.mockResolvedValue({
        messages: [{ id: 1 }, { id: 2 }],
      });
      const { result } = renderHook(() => useMentionUnreadCount(), {
        wrapper: wrapperFactory('/'),
      });
      // API は呼ばれるが、location が '/' のため count は 0
      await waitFor(() => {
        expect(mockSearch).toHaveBeenCalled();
      });
      expect(result.current).toBe(0);
    });

    it('現在パスが /chat など / 以外のときは集計値を返す', async () => {
      mockSearch.mockResolvedValue({
        messages: [{ id: 1 }, { id: 2 }, { id: 3 }],
      });
      const { result } = renderHook(() => useMentionUnreadCount(), {
        wrapper: wrapperFactory('/chat'),
      });
      await waitFor(() => {
        expect(result.current).toBe(3);
      });
    });
  });
});
