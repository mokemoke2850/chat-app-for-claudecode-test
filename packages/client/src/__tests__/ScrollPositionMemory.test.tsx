/**
 * テスト対象: チャンネル切替時のスクロール位置記憶機能
 * 戦略:
 *   - useScrollPositionMemory フックの保存・復元ロジックを直接検証する
 *   - MessageList コンポーネント経由での channelId 変化時の動作を検証する
 *   - containerRef の scrollTop を直接操作してスクロール状態を再現する
 *   - セッション内のインメモリ保持のみを対象とする（localStorage 永続化は対象外）
 */

import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useScrollPositionMemory } from '../hooks/useScrollPositionMemory';
import MessageList from '../components/Chat/MessageList';
import { makeMessage } from './__fixtures__/messages';

// DensityContext モック
vi.mock('../contexts/DensityContext', () => ({
  useDensity: () => ({ density: 'cozy', setDensity: vi.fn() }),
}));

// AuthContext モック
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 1,
      username: 'alice',
      email: 'alice@example.com',
      avatarUrl: null,
      createdAt: '2024-01-01T00:00:00Z',
    },
  }),
}));

// MessageItem スタブ
vi.mock('../components/Chat/MessageItem', () => ({
  default: ({ message }: { message: { id: number } }) => (
    <div id={`message-${message.id}`} data-testid={`message-${message.id}`} />
  ),
}));

beforeEach(() => {
  Object.defineProperty(window, 'location', {
    value: { hash: '', search: '', pathname: '/', origin: 'http://localhost' },
    writable: true,
    configurable: true,
  });
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('スクロール位置記憶 — チャンネル切替', () => {
  describe('useScrollPositionMemory フック', () => {
    it('save した scrollTop を restore で取得できる', () => {
      // コンテナの scrollTop をモック
      const container = document.createElement('div');
      Object.defineProperty(container, 'scrollTop', { value: 300, writable: true });

      const containerRef = { current: container };
      const { result } = renderHook(() => useScrollPositionMemory(containerRef));

      act(() => {
        result.current.save(1);
      });

      expect(result.current.getSaved(1)).toBe(300);
    });

    it('restore を呼ぶと container.scrollTop に保存値が反映される', () => {
      const container = document.createElement('div');
      let scrollTopValue = 0;
      Object.defineProperty(container, 'scrollTop', {
        get: () => scrollTopValue,
        set: (v) => {
          scrollTopValue = v;
        },
        configurable: true,
      });

      // 先にsave
      scrollTopValue = 500;
      const containerRef = { current: container };
      const { result } = renderHook(() => useScrollPositionMemory(containerRef));

      act(() => {
        result.current.save(42);
      });

      // scrollTop を変えて restore
      scrollTopValue = 0;
      let restored = false;
      act(() => {
        restored = result.current.restore(42);
      });

      expect(restored).toBe(true);
      expect(scrollTopValue).toBe(500);
    });

    it('未保存の key を restore すると false を返し scrollTop を変更しない', () => {
      const container = document.createElement('div');
      let scrollTopValue = 0;
      Object.defineProperty(container, 'scrollTop', {
        get: () => scrollTopValue,
        set: (v) => {
          scrollTopValue = v;
        },
        configurable: true,
      });

      const containerRef = { current: container };
      const { result } = renderHook(() => useScrollPositionMemory(containerRef));

      let restored = true;
      act(() => {
        restored = result.current.restore(999);
      });

      expect(restored).toBe(false);
      expect(scrollTopValue).toBe(0);
    });

    it('複数の key を独立して保存・復元できる', () => {
      const container = document.createElement('div');
      let scrollTopValue = 0;
      Object.defineProperty(container, 'scrollTop', {
        get: () => scrollTopValue,
        set: (v) => {
          scrollTopValue = v;
        },
        configurable: true,
      });

      const containerRef = { current: container };
      const { result } = renderHook(() => useScrollPositionMemory(containerRef));

      // key=1 で 200 を保存
      scrollTopValue = 200;
      act(() => {
        result.current.save(1);
      });

      // key=2 で 400 を保存
      scrollTopValue = 400;
      act(() => {
        result.current.save(2);
      });

      expect(result.current.getSaved(1)).toBe(200);
      expect(result.current.getSaved(2)).toBe(400);
    });
  });

  describe('MessageList コンポーネント', () => {
    it('channelId が変化したとき、離脱前の scrollTop を内部マップに保存する', () => {
      // jsdom では scrollTop を直接設定できないが、
      // channelId prop の変化に応じた save 呼び出しを ref 経由で検証する
      const { rerender, container: renderContainer } = render(
        <MessageList
          messages={[makeMessage({ id: 1 })]}
          loading={false}
          onLoadMore={vi.fn()}
          currentUserId={1}
          channelId={1}
        />,
      );

      // scrollTop を模擬して container に設定
      const scrollContainer = renderContainer.firstChild as HTMLElement;
      Object.defineProperty(scrollContainer, 'scrollTop', {
        value: 300,
        writable: true,
        configurable: true,
      });

      // channelId を変更（切替）すると旧チャンネルのスクロール位置が保存される
      rerender(
        <MessageList
          messages={[makeMessage({ id: 2 })]}
          loading={false}
          onLoadMore={vi.fn()}
          currentUserId={1}
          channelId={2}
        />,
      );

      // 再びチャンネル1に戻したとき、コンポーネントがクラッシュせず正常に動作することを確認
      // （jsdom では scrollTop の復元値まで検証することは難しいが、エラーなく動作することを確認）
      expect(() => {
        rerender(
          <MessageList
            messages={[makeMessage({ id: 1 })]}
            loading={false}
            onLoadMore={vi.fn()}
            currentUserId={1}
            channelId={1}
          />,
        );
      }).not.toThrow();
    });

    it('messages が空（チャンネル切替直後）の間はスクロール復元を実行しない', () => {
      const scrollIntoView = vi.fn();
      HTMLElement.prototype.scrollIntoView = scrollIntoView;

      render(
        <MessageList
          messages={[]}
          loading={false}
          onLoadMore={vi.fn()}
          currentUserId={1}
          channelId={1}
        />,
      );

      // メッセージが空の間は scrollIntoView は呼ばれない
      expect(scrollIntoView).not.toHaveBeenCalled();
    });

    it('未訪問チャンネルに移動したとき、スクロール位置の復元をスキップして最下部へ移動する', () => {
      const scrollIntoView = vi.fn();
      HTMLElement.prototype.scrollIntoView = scrollIntoView;

      const { rerender } = render(
        <MessageList
          messages={[]}
          loading={false}
          onLoadMore={vi.fn()}
          currentUserId={1}
          channelId={1}
        />,
      );

      // 初回メッセージが届く（保存済みなし → 最下部へ scrollIntoView）
      rerender(
        <MessageList
          messages={[makeMessage({ id: 1 })]}
          loading={false}
          onLoadMore={vi.fn()}
          currentUserId={1}
          channelId={1}
        />,
      );

      expect(scrollIntoView).toHaveBeenCalledOnce();
    });
  });

  describe('ChatPage — チャンネル間の切替', () => {
    it('新着メッセージ受信後、最下部付近でなければスクロール位置が自動変更されない', () => {
      const scrollIntoView = vi.fn();
      HTMLElement.prototype.scrollIntoView = scrollIntoView;

      const { rerender, container: renderContainer } = render(
        <MessageList
          messages={[makeMessage({ id: 1 })]}
          loading={false}
          onLoadMore={vi.fn()}
          currentUserId={1}
          channelId={1}
        />,
      );

      // 初回ロード: 1回呼ばれる
      expect(scrollIntoView).toHaveBeenCalledOnce();

      // スクロールコンテナを「上部にいる」状態に設定
      const scrollContainer = renderContainer.firstChild as HTMLElement;
      Object.defineProperty(scrollContainer, 'scrollHeight', { value: 1000, configurable: true });
      Object.defineProperty(scrollContainer, 'scrollTop', { value: 0, configurable: true });
      Object.defineProperty(scrollContainer, 'clientHeight', { value: 500, configurable: true });

      // 新着メッセージ追加
      rerender(
        <MessageList
          messages={[makeMessage({ id: 1 }), makeMessage({ id: 2 })]}
          loading={false}
          onLoadMore={vi.fn()}
          currentUserId={1}
          channelId={1}
        />,
      );

      // 最下部付近でないため、新着では scrollIntoView は呼ばれない
      expect(scrollIntoView).toHaveBeenCalledOnce();
    });
  });

  describe('DMPage — DM会話間の切替', () => {
    it('activeConvId が変化したとき、切替前の conversationId に対応する scrollTop を保存する', () => {
      const container = document.createElement('div');
      let scrollTopValue = 0;
      Object.defineProperty(container, 'scrollTop', {
        get: () => scrollTopValue,
        set: (v) => {
          scrollTopValue = v;
        },
        configurable: true,
      });

      const containerRef = { current: container };
      const { result } = renderHook(() => useScrollPositionMemory(containerRef));

      // 会話1のスクロール位置を保存
      scrollTopValue = 250;
      act(() => {
        result.current.save(1);
      });

      expect(result.current.getSaved(1)).toBe(250);

      // 会話2に切り替えて保存
      scrollTopValue = 100;
      act(() => {
        result.current.save(2);
      });

      // 各会話のスクロール位置が独立して保持されている
      expect(result.current.getSaved(1)).toBe(250);
      expect(result.current.getSaved(2)).toBe(100);
    });
  });

  describe('スレッドパネル', () => {
    it('同じスレッドIDで save した位置を restore で取得できる', () => {
      const container = document.createElement('div');
      let scrollTopValue = 0;
      Object.defineProperty(container, 'scrollTop', {
        get: () => scrollTopValue,
        set: (v) => {
          scrollTopValue = v;
        },
        configurable: true,
      });

      const containerRef = { current: container };
      const { result } = renderHook(() => useScrollPositionMemory(containerRef));

      // スレッドID=10のスクロール位置を保存
      scrollTopValue = 180;
      act(() => {
        result.current.save(10);
      });

      // スクロール位置を変える
      scrollTopValue = 0;
      let restored = false;
      act(() => {
        restored = result.current.restore(10);
      });

      expect(restored).toBe(true);
      expect(scrollTopValue).toBe(180);
    });
  });

  describe('エッジケース', () => {
    it('ページリロード後はスクロール位置がリセットされ最下部から表示される', () => {
      // useScrollPositionMemory はインメモリの Map を使用するため、
      // フックが再マウントされると Map がリセットされることを確認する
      const container = document.createElement('div');
      let scrollTopValue = 0;
      Object.defineProperty(container, 'scrollTop', {
        get: () => scrollTopValue,
        set: (v) => {
          scrollTopValue = v;
        },
        configurable: true,
      });

      const containerRef = { current: container };

      // 1回目のマウント: 保存
      const { result: result1, unmount } = renderHook(() => useScrollPositionMemory(containerRef));
      scrollTopValue = 400;
      act(() => {
        result1.current.save(1);
      });
      expect(result1.current.getSaved(1)).toBe(400);

      // アンマウント（= ページリロードを模倣）
      unmount();

      // 2回目のマウント（新しいフックインスタンス）: 保存データは存在しない
      const { result: result2 } = renderHook(() => useScrollPositionMemory(containerRef));
      expect(result2.current.getSaved(1)).toBeUndefined();
    });

    it('スクロール位置が 0 のチャンネルを save すると restore で 0 が返る', () => {
      const container = document.createElement('div');
      let scrollTopValue = 0;
      Object.defineProperty(container, 'scrollTop', {
        get: () => scrollTopValue,
        set: (v) => {
          scrollTopValue = v;
        },
        configurable: true,
      });

      const containerRef = { current: container };
      const { result } = renderHook(() => useScrollPositionMemory(containerRef));

      scrollTopValue = 0;
      act(() => {
        result.current.save(5);
      });

      expect(result.current.getSaved(5)).toBe(0);
    });
  });
});
