/**
 * テスト対象: hooks/useDmUnreadCount.ts (Rail の DM 未読バッジ用集計フック)
 * 戦略:
 *   - api.dm.listConversations をモックして初期未読数を制御する
 *   - SocketContext をモックして dm_notification を任意のタイミングで発火させる
 *   - MemoryRouter で initialEntries を切り替え、現在パスによる挙動を検証する
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useDmUnreadCount } from '../useDmUnreadCount';

const mockListConversations = vi.fn();

vi.mock('../../api/client', () => ({
  api: {
    dm: {
      listConversations: () => mockListConversations(),
    },
  },
}));

type SocketEventHandler = (data: { conversationId: number; unreadCount: number }) => void;

const mockSocket = {
  on: vi.fn<(event: string, handler: SocketEventHandler) => void>(),
  off: vi.fn<(event: string, handler: SocketEventHandler) => void>(),
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
  mockListConversations.mockReset();
  mockSocket.on.mockReset();
  mockSocket.off.mockReset();
  socketReturnValue = mockSocket;
});

describe('useDmUnreadCount', () => {
  describe('初期取得', () => {
    it('マウント時に api.dm.listConversations が呼ばれる', async () => {
      mockListConversations.mockResolvedValue({ conversations: [] });
      renderHook(() => useDmUnreadCount(), { wrapper: wrapperFactory('/') });
      await waitFor(() => {
        expect(mockListConversations).toHaveBeenCalledTimes(1);
      });
    });

    it('listConversations の各 conversation.unreadCount を合計した値が count として返る', async () => {
      mockListConversations.mockResolvedValue({
        conversations: [
          { id: 1, unreadCount: 3 },
          { id: 2, unreadCount: 2 },
          { id: 3, unreadCount: 0 },
        ],
      });
      const { result } = renderHook(() => useDmUnreadCount(), {
        wrapper: wrapperFactory('/'),
      });
      await waitFor(() => {
        expect(result.current).toBe(5);
      });
    });

    it('listConversations が失敗した場合は count が 0 のまま例外を伝播しない', async () => {
      mockListConversations.mockRejectedValue(new Error('network error'));
      const { result } = renderHook(() => useDmUnreadCount(), {
        wrapper: wrapperFactory('/'),
      });
      await waitFor(() => {
        expect(mockListConversations).toHaveBeenCalled();
      });
      expect(result.current).toBe(0);
    });
  });

  describe('Socket 受信', () => {
    it('dm_notification を受信すると count が unreadCount 分増加する', async () => {
      mockListConversations.mockResolvedValue({ conversations: [] });
      const { result } = renderHook(() => useDmUnreadCount(), {
        wrapper: wrapperFactory('/'),
      });
      await waitFor(() => {
        expect(mockSocket.on).toHaveBeenCalledWith('dm_notification', expect.any(Function));
      });
      const handler = mockSocket.on.mock.calls.find(([e]) => e === 'dm_notification')?.[1];
      expect(handler).toBeDefined();
      act(() => {
        handler!({ conversationId: 1, unreadCount: 3 });
      });
      expect(result.current).toBe(3);
    });

    it('dm_notification を複数回受信すると累積される', async () => {
      mockListConversations.mockResolvedValue({ conversations: [] });
      const { result } = renderHook(() => useDmUnreadCount(), {
        wrapper: wrapperFactory('/'),
      });
      await waitFor(() => {
        expect(mockSocket.on).toHaveBeenCalled();
      });
      const handler = mockSocket.on.mock.calls.find(([e]) => e === 'dm_notification')?.[1];
      act(() => {
        handler!({ conversationId: 1, unreadCount: 2 });
        handler!({ conversationId: 2, unreadCount: 1 });
        handler!({ conversationId: 1, unreadCount: 3 });
      });
      expect(result.current).toBe(6);
    });

    it('socket が null のとき購読は行わない', async () => {
      socketReturnValue = null;
      mockListConversations.mockResolvedValue({ conversations: [] });
      renderHook(() => useDmUnreadCount(), { wrapper: wrapperFactory('/') });
      await waitFor(() => {
        expect(mockListConversations).toHaveBeenCalled();
      });
      expect(mockSocket.on).not.toHaveBeenCalled();
    });

    it('unmount 時に dm_notification の購読が解除される', async () => {
      mockListConversations.mockResolvedValue({ conversations: [] });
      const { unmount } = renderHook(() => useDmUnreadCount(), {
        wrapper: wrapperFactory('/'),
      });
      await waitFor(() => {
        expect(mockSocket.on).toHaveBeenCalled();
      });
      unmount();
      expect(mockSocket.off).toHaveBeenCalledWith('dm_notification', expect.any(Function));
    });
  });

  describe('現在パスによる挙動', () => {
    it('現在のパスが /dm のときは 0 を返す（集計値は内部状態として保持される）', async () => {
      mockListConversations.mockResolvedValue({
        conversations: [{ id: 1, unreadCount: 5 }],
      });
      const { result } = renderHook(() => useDmUnreadCount(), {
        wrapper: wrapperFactory('/dm'),
      });
      await waitFor(() => {
        expect(mockListConversations).toHaveBeenCalled();
      });
      expect(result.current).toBe(0);
    });

    it('現在のパスが /dm/123 のときも 0 を返す', async () => {
      mockListConversations.mockResolvedValue({
        conversations: [{ id: 1, unreadCount: 5 }],
      });
      const { result } = renderHook(() => useDmUnreadCount(), {
        wrapper: wrapperFactory('/dm/123'),
      });
      await waitFor(() => {
        expect(mockListConversations).toHaveBeenCalled();
      });
      expect(result.current).toBe(0);
    });

    it('現在のパスが /dm 以外（例: /tasks）のときは集計値を返す', async () => {
      mockListConversations.mockResolvedValue({
        conversations: [{ id: 1, unreadCount: 4 }],
      });
      const { result } = renderHook(() => useDmUnreadCount(), {
        wrapper: wrapperFactory('/tasks'),
      });
      await waitFor(() => {
        expect(result.current).toBe(4);
      });
    });
  });
});
