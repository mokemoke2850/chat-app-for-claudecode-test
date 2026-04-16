/**
 * hooks/useMessages.ts のユニットテスト
 *
 * テスト対象: API 取得ロジック、ページネーション、Socket.IO リアルタイム更新
 * 戦略:
 *   - api モジュールを vi.mock で差し替えてネットワーク通信を排除
 *   - Socket.IO は EventEmitter に相当するモックオブジェクトを手動で組み立て、
 *     SocketContext.Provider 経由で注入する
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import type { Message } from '@chat-app/shared';
import { useMessages } from '../hooks/useMessages';

// Socket.IO のイベントハンドラを保持するモック
// on/off/emit を記録し、テストから任意のイベントを発火できるようにする
function createMockSocket() {
  const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
  return {
    on: vi.fn((event: string, fn: (...args: unknown[]) => void) => {
      handlers[event] = [...(handlers[event] ?? []), fn];
    }),
    off: vi.fn((event: string, fn: (...args: unknown[]) => void) => {
      handlers[event] = (handlers[event] ?? []).filter((h) => h !== fn);
    }),
    emit: vi.fn(),
    // テスト側からイベントを手動発火するユーティリティ
    _emit: (event: string, ...args: unknown[]) => {
      (handlers[event] ?? []).forEach((h) => h(...args));
    },
  };
}

vi.mock('../api/client', () => ({
  api: {
    messages: {
      list: vi.fn(),
    },
  },
}));

vi.mock('../contexts/SocketContext', () => ({
  useSocket: vi.fn(),
}));

import { api } from '../api/client';
import { useSocket } from '../contexts/SocketContext';

const mockList = api.messages.list as ReturnType<typeof vi.fn>;
const mockUseSocket = useSocket as ReturnType<typeof vi.fn>;

// テスト用のサンプルメッセージを生成するヘルパー
function makeMessage(id: number, channelId = 1): Message {
  return {
    id,
    channelId,
    userId: 1,
    username: 'alice',
    avatarUrl: null,
    content: '{}',
    isEdited: false,
    isDeleted: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    mentions: [],
    reactions: [],
    parentMessageId: null,
    rootMessageId: null,
    replyCount: 0,
    quotedMessageId: null,
    quotedMessage: null,
  };
}

const wrapper = ({ children }: { children: ReactNode }) => <>{children}</>;

beforeEach(() => {
  vi.resetAllMocks();
});

describe('useMessages', () => {
  describe('初期ロード', () => {
    it('channelId が null のときは API を呼び出さずメッセージが空のまま', async () => {
      mockUseSocket.mockReturnValue(null);

      const { result } = renderHook(() => useMessages(null), { wrapper });

      // 少し待っても API が呼ばれないことを確認
      await act(async () => {});
      expect(mockList).not.toHaveBeenCalled();
      expect(result.current.messages).toHaveLength(0);
    });

    it('channelId が渡されたとき API を呼び出しメッセージをセットする', async () => {
      mockUseSocket.mockReturnValue(createMockSocket());
      mockList.mockResolvedValue({ messages: [makeMessage(1), makeMessage(2)] });

      const { result } = renderHook(() => useMessages(1), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(mockList).toHaveBeenCalledWith(1, expect.objectContaining({ limit: 50 }));
      expect(result.current.messages).toHaveLength(2);
    });

    it('channelId が変わると以前のメッセージをクリアして再取得する', async () => {
      const socket = createMockSocket();
      mockUseSocket.mockReturnValue(socket);
      mockList.mockResolvedValue({ messages: [makeMessage(1, 1)] });

      const { result, rerender } = renderHook(({ ch }: { ch: number }) => useMessages(ch), {
        wrapper,
        initialProps: { ch: 1 },
      });
      await waitFor(() => expect(result.current.messages).toHaveLength(1));

      // チャンネルを切り替える
      mockList.mockResolvedValue({ messages: [makeMessage(10, 2), makeMessage(11, 2)] });
      rerender({ ch: 2 });

      // 切り替え直後はメッセージがクリアされる
      expect(result.current.messages).toHaveLength(0);
      await waitFor(() => expect(result.current.messages).toHaveLength(2));
    });
  });

  describe('Socket.IO チャンネル参加・離脱', () => {
    it('channelId がセットされると join_channel イベントを emit する', async () => {
      const socket = createMockSocket();
      mockUseSocket.mockReturnValue(socket);
      mockList.mockResolvedValue({ messages: [] });

      renderHook(() => useMessages(5), { wrapper });

      await waitFor(() => expect(socket.emit).toHaveBeenCalledWith('join_channel', 5));
    });

    it('channelId が変わる（クリーンアップ）と leave_channel イベントを emit する', async () => {
      const socket = createMockSocket();
      mockUseSocket.mockReturnValue(socket);
      mockList.mockResolvedValue({ messages: [] });

      const { rerender } = renderHook(({ ch }: { ch: number }) => useMessages(ch), {
        wrapper,
        initialProps: { ch: 3 },
      });
      await waitFor(() => expect(socket.emit).toHaveBeenCalledWith('join_channel', 3));

      rerender({ ch: 4 });

      // チャンネル離脱イベントが発火されること
      expect(socket.emit).toHaveBeenCalledWith('leave_channel', 3);
    });
  });

  describe('リアルタイム更新', () => {
    it('socket の new_message イベントを受信すると、対象 channelId のメッセージをリストに追加する', async () => {
      const socket = createMockSocket();
      mockUseSocket.mockReturnValue(socket);
      mockList.mockResolvedValue({ messages: [] });

      const { result } = renderHook(() => useMessages(1), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        socket._emit('new_message', makeMessage(99, 1));
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].id).toBe(99);
    });

    it('socket の new_message イベントで channelId が異なるメッセージは無視する', async () => {
      const socket = createMockSocket();
      mockUseSocket.mockReturnValue(socket);
      mockList.mockResolvedValue({ messages: [] });

      const { result } = renderHook(() => useMessages(1), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        // channelId=2 のメッセージは channelId=1 のフックでは無視される
        socket._emit('new_message', makeMessage(99, 2));
      });

      expect(result.current.messages).toHaveLength(0);
    });

    it('socket の message_edited イベントを受信すると、対象メッセージを置き換える', async () => {
      const socket = createMockSocket();
      mockUseSocket.mockReturnValue(socket);
      mockList.mockResolvedValue({ messages: [makeMessage(1)] });

      const { result } = renderHook(() => useMessages(1), { wrapper });
      await waitFor(() => expect(result.current.messages).toHaveLength(1));

      const editedMsg = { ...makeMessage(1), content: '{"edited":true}', isEdited: true };
      act(() => {
        socket._emit('message_edited', editedMsg);
      });

      expect(result.current.messages[0].isEdited).toBe(true);
    });

    it('socket の message_deleted イベントを受信すると、対象メッセージの isDeleted を true にする', async () => {
      const socket = createMockSocket();
      mockUseSocket.mockReturnValue(socket);
      mockList.mockResolvedValue({ messages: [makeMessage(1)] });

      const { result } = renderHook(() => useMessages(1), { wrapper });
      await waitFor(() => expect(result.current.messages).toHaveLength(1));

      act(() => {
        socket._emit('message_deleted', { messageId: 1, channelId: 1 });
      });

      expect(result.current.messages[0].isDeleted).toBe(true);
    });
  });

  describe('loadMore（ページネーション）', () => {
    it('loadMore を呼ぶと先頭メッセージの id を before に指定して追加取得する', async () => {
      const socket = createMockSocket();
      mockUseSocket.mockReturnValue(socket);
      mockList.mockResolvedValue({ messages: [makeMessage(10), makeMessage(11)] });

      const { result } = renderHook(() => useMessages(1), { wrapper });
      await waitFor(() => expect(result.current.messages).toHaveLength(2));

      mockList.mockResolvedValue({ messages: [makeMessage(8), makeMessage(9)] });

      act(() => {
        result.current.loadMore();
      });

      await waitFor(() => expect(mockList).toHaveBeenCalledTimes(2));
      // 先頭メッセージの id=10 を before に指定して呼ばれること
      expect(mockList).toHaveBeenLastCalledWith(1, expect.objectContaining({ before: 10 }));
    });

    it('追加取得したメッセージは既存メッセージの前に結合される', async () => {
      const socket = createMockSocket();
      mockUseSocket.mockReturnValue(socket);
      mockList.mockResolvedValue({ messages: [makeMessage(10), makeMessage(11)] });

      const { result } = renderHook(() => useMessages(1), { wrapper });
      await waitFor(() => expect(result.current.messages).toHaveLength(2));

      mockList.mockResolvedValue({ messages: [makeMessage(8), makeMessage(9)] });
      act(() => {
        result.current.loadMore();
      });

      await waitFor(() => expect(result.current.messages).toHaveLength(4));
      // 古いメッセージが先頭に来ること
      expect(result.current.messages[0].id).toBe(8);
      expect(result.current.messages[2].id).toBe(10);
    });
  });
});
