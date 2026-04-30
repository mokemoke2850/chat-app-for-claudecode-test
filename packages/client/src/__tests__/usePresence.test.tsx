/**
 * テスト対象: usePresence（新規フック）
 *
 * 戦略:
 *   - Socket は手動モック（イベントハンドラを保持するオブジェクト）を注入する
 *   - @testing-library/react の renderHook でフックの戻り値を検証する
 *   - mousemove / keydown のユーザー操作でクライアント側 heartbeat が送信されることを fake timer で検証する
 *
 * 仕様前提（ユーザー承認済み）:
 *   - フックは現在の在席ユーザー Map<userId, state> を返す
 *   - presence:bulk / presence:state を購読してマップを更新する
 *   - 自分自身の操作（mousemove / keydown）を検知して socket.emit('presence:heartbeat') を送る
 *   - 自分自身の状態が away → online に復帰したら UI に即時反映する
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { usePresence, HEARTBEAT_INTERVAL_MS } from '../hooks/usePresence';

type Handler = (...args: unknown[]) => void;

function createMockSocket() {
  const handlers: Record<string, Handler[]> = {};
  return {
    on: vi.fn((event: string, cb: Handler) => {
      (handlers[event] ||= []).push(cb);
    }),
    off: vi.fn((event: string, cb: Handler) => {
      handlers[event] = (handlers[event] || []).filter((h) => h !== cb);
    }),
    emit: vi.fn(),
    /** テスト用: イベントを発火する */
    _trigger(event: string, ...args: unknown[]) {
      for (const h of handlers[event] || []) h(...args);
    },
    _handlers: handlers,
  };
}

type MockSocket = ReturnType<typeof createMockSocket>;

// usePresence は型上 Socket<...> を要求するが、テストではモックを as never で渡す
function renderUsePresence(socket: MockSocket | null) {
  return renderHook(() => usePresence(socket as never));
}

describe('usePresence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('購読', () => {
    it('マウント時に presence:bulk と presence:state を購読する', () => {
      const socket = createMockSocket();
      renderUsePresence(socket);
      const events = socket.on.mock.calls.map((c) => c[0]);
      expect(events).toContain('presence:bulk');
      expect(events).toContain('presence:state');
    });

    it('アンマウント時に購読を解除する', () => {
      const socket = createMockSocket();
      const { unmount } = renderUsePresence(socket);
      unmount();
      const events = socket.off.mock.calls.map((c) => c[0]);
      expect(events).toContain('presence:bulk');
      expect(events).toContain('presence:state');
    });
  });

  describe('状態マップの更新', () => {
    it('presence:bulk を受信すると state マップが初期化される', () => {
      const socket = createMockSocket();
      const { result } = renderUsePresence(socket);
      act(() => {
        socket._trigger('presence:bulk', {
          states: [
            { userId: 1, state: 'online' },
            { userId: 2, state: 'away' },
          ],
        });
      });
      expect(result.current.get(1)).toBe('online');
      expect(result.current.get(2)).toBe('away');
    });

    it('presence:state を受信すると対象ユーザーの state が更新される', () => {
      const socket = createMockSocket();
      const { result } = renderUsePresence(socket);
      act(() => {
        socket._trigger('presence:bulk', { states: [{ userId: 1, state: 'online' }] });
      });
      act(() => {
        socket._trigger('presence:state', { userId: 1, state: 'away' });
      });
      expect(result.current.get(1)).toBe('away');
    });

    it('未知のユーザー ID の presence:state を受信した場合、新しいエントリとして追加される', () => {
      const socket = createMockSocket();
      const { result } = renderUsePresence(socket);
      act(() => {
        socket._trigger('presence:state', { userId: 42, state: 'online' });
      });
      expect(result.current.get(42)).toBe('online');
    });
  });

  describe('ハートビート送信', () => {
    it('mousemove イベントで socket.emit("presence:heartbeat") が呼ばれる', () => {
      const socket = createMockSocket();
      renderUsePresence(socket);
      act(() => {
        window.dispatchEvent(new MouseEvent('mousemove'));
      });
      expect(socket.emit).toHaveBeenCalledWith('presence:heartbeat');
    });

    it('keydown イベントで socket.emit("presence:heartbeat") が呼ばれる', () => {
      const socket = createMockSocket();
      renderUsePresence(socket);
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
      });
      expect(socket.emit).toHaveBeenCalledWith('presence:heartbeat');
    });

    it('短時間に連続発火するイベントは throttle され、heartbeat は過剰に送られない', () => {
      const socket = createMockSocket();
      renderUsePresence(socket);

      // 1 回目で送信
      act(() => {
        window.dispatchEvent(new MouseEvent('mousemove'));
      });
      const firstCount = socket.emit.mock.calls.length;
      expect(firstCount).toBe(1);

      // throttle 期間中の連続発火 → 増えない
      for (let i = 0; i < 100; i++) {
        act(() => {
          window.dispatchEvent(new MouseEvent('mousemove'));
        });
      }
      expect(socket.emit.mock.calls.length).toBe(1);

      // throttle 期間経過後はもう 1 回送られる
      act(() => {
        vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS + 100);
        window.dispatchEvent(new MouseEvent('mousemove'));
      });
      expect(socket.emit.mock.calls.length).toBe(2);
    });
  });

  describe('自分の状態復帰', () => {
    it('away だった自分自身が操作すると、自分の state が online に切り替わって反映される', () => {
      const socket = createMockSocket();
      const { result } = renderUsePresence(socket);
      // 自分（userId=1）が away だとサーバから通知されている状態
      act(() => {
        socket._trigger('presence:state', { userId: 1, state: 'away' });
      });
      expect(result.current.get(1)).toBe('away');

      // クライアントは操作を検知して heartbeat を送る
      act(() => {
        window.dispatchEvent(new MouseEvent('mousemove'));
      });
      expect(socket.emit).toHaveBeenCalledWith('presence:heartbeat');

      // サーバが broadcast した online 通知を受信 → state が online に戻る
      act(() => {
        socket._trigger('presence:state', { userId: 1, state: 'online' });
      });
      expect(result.current.get(1)).toBe('online');
    });
  });
});
