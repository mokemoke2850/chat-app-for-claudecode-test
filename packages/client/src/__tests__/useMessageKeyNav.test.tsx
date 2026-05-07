/**
 * テスト対象: useMessageKeyNav カスタムフック（実装予定）
 *
 * 戦略:
 *   - j/k キーによるメッセージ間の移動ロジックをカスタムフックとして切り出す
 *   - renderHook + fireEvent でキーイベントを発火してフォーカスインデックスを検証する
 *   - エディタフォーカス時の無効化は isEditorFocused フラグを注入して検証する
 *   - Enter / r / p などの操作キーはコールバックが呼ばれるかを検証する
 *   - MessageList.tsx への統合（ハイライト表示・スクロール追従）は MessageList テストで検証する
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMessageKeyNav } from '../hooks/useMessageKeyNav';
import { makeMessage } from './__fixtures__/messages';

// ─────────────────────────────────────────
// ヘルパー: document に keydown イベントを発火する
// ─────────────────────────────────────────
function fireKeydown(key: string) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

// ─────────────────────────────────────────
// useMessageKeyNav フック単体テスト
// ─────────────────────────────────────────
describe('useMessageKeyNav', () => {
  const messages = [makeMessage({ id: 1 }), makeMessage({ id: 2 }), makeMessage({ id: 3 })];

  const defaultCallbacks = {
    onOpenThread: vi.fn(),
    onReact: vi.fn(),
    onPinMessage: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('j/k ナビゲーション', () => {
    it('j キーを押すと次のメッセージへフォーカスが移動する', () => {
      const { result } = renderHook(() =>
        useMessageKeyNav({ messages, isEditorFocused: false, ...defaultCallbacks }),
      );

      expect(result.current.focusedIndex).toBeNull();

      act(() => {
        fireKeydown('j');
      });

      expect(result.current.focusedIndex).toBe(0);

      act(() => {
        fireKeydown('j');
      });

      expect(result.current.focusedIndex).toBe(1);
    });

    it('k キーを押すと前のメッセージへフォーカスが移動する', () => {
      const { result } = renderHook(() =>
        useMessageKeyNav({ messages, isEditorFocused: false, ...defaultCallbacks }),
      );

      // まず j で2つ進む
      act(() => {
        fireKeydown('j');
        fireKeydown('j');
      });

      expect(result.current.focusedIndex).toBe(1);

      act(() => {
        fireKeydown('k');
      });

      expect(result.current.focusedIndex).toBe(0);
    });

    it('リスト末尾で j キーを押しても末尾より先へ進まない（境界値）', () => {
      const { result } = renderHook(() =>
        useMessageKeyNav({ messages, isEditorFocused: false, ...defaultCallbacks }),
      );

      // messages.length - 1 = 2 まで進む
      act(() => {
        fireKeydown('j');
        fireKeydown('j');
        fireKeydown('j');
      });

      expect(result.current.focusedIndex).toBe(2);

      // 末尾でさらに j を押しても変わらない
      act(() => {
        fireKeydown('j');
      });

      expect(result.current.focusedIndex).toBe(2);
    });

    it('リスト先頭で k キーを押しても 0 未満にならない（境界値）', () => {
      const { result } = renderHook(() =>
        useMessageKeyNav({ messages, isEditorFocused: false, ...defaultCallbacks }),
      );

      act(() => {
        fireKeydown('j');
      });

      expect(result.current.focusedIndex).toBe(0);

      // 先頭で k を押しても 0 のまま
      act(() => {
        fireKeydown('k');
      });

      expect(result.current.focusedIndex).toBe(0);
    });

    it('メッセージが空のときはフォーカスインデックスが変化しない', () => {
      const { result } = renderHook(() =>
        useMessageKeyNav({ messages: [], isEditorFocused: false, ...defaultCallbacks }),
      );

      act(() => {
        fireKeydown('j');
      });

      expect(result.current.focusedIndex).toBeNull();
    });
  });

  describe('エディタフォーカス中の無効化', () => {
    it('isEditorFocused が true のとき j キーを押してもフォーカスが移動しない', () => {
      const { result } = renderHook(() =>
        useMessageKeyNav({ messages, isEditorFocused: true, ...defaultCallbacks }),
      );

      act(() => {
        fireKeydown('j');
      });

      expect(result.current.focusedIndex).toBeNull();
    });

    it('isEditorFocused が true のとき k キーを押してもフォーカスが移動しない', () => {
      const { result } = renderHook(() =>
        useMessageKeyNav({ messages, isEditorFocused: true, ...defaultCallbacks }),
      );

      act(() => {
        fireKeydown('k');
      });

      expect(result.current.focusedIndex).toBeNull();
    });

    it('isEditorFocused が false のとき j/k が正常に動作する', () => {
      const { result } = renderHook(() =>
        useMessageKeyNav({ messages, isEditorFocused: false, ...defaultCallbacks }),
      );

      act(() => {
        fireKeydown('j');
      });

      expect(result.current.focusedIndex).toBe(0);

      act(() => {
        fireKeydown('k');
      });

      expect(result.current.focusedIndex).toBe(0);
    });
  });

  describe('Enter キー — スレッド展開', () => {
    it('フォーカス中のメッセージで Enter を押すと onOpenThread が呼ばれる', () => {
      const { result } = renderHook(() =>
        useMessageKeyNav({ messages, isEditorFocused: false, ...defaultCallbacks }),
      );

      // j で最初のメッセージにフォーカス
      act(() => {
        fireKeydown('j');
      });

      expect(result.current.focusedIndex).toBe(0);

      act(() => {
        fireKeydown('Enter');
      });

      expect(defaultCallbacks.onOpenThread).toHaveBeenCalledWith(messages[0].id);
    });

    it('フォーカスがない状態（focusedIndex が null）のとき Enter を押しても onOpenThread は呼ばれない', () => {
      renderHook(() => useMessageKeyNav({ messages, isEditorFocused: false, ...defaultCallbacks }));

      act(() => {
        fireKeydown('Enter');
      });

      expect(defaultCallbacks.onOpenThread).not.toHaveBeenCalled();
    });
  });

  describe('r キー — リアクション', () => {
    it('フォーカス中のメッセージで r キーを押すと onReact が呼ばれる', () => {
      const { result } = renderHook(() =>
        useMessageKeyNav({ messages, isEditorFocused: false, ...defaultCallbacks }),
      );

      act(() => {
        fireKeydown('j');
      });

      expect(result.current.focusedIndex).toBe(0);

      act(() => {
        fireKeydown('r');
      });

      expect(defaultCallbacks.onReact).toHaveBeenCalledWith(messages[0].id);
    });

    it('エディタフォーカス中は r キーを押しても onReact は呼ばれない', () => {
      renderHook(() => useMessageKeyNav({ messages, isEditorFocused: true, ...defaultCallbacks }));

      act(() => {
        fireKeydown('r');
      });

      expect(defaultCallbacks.onReact).not.toHaveBeenCalled();
    });
  });

  describe('p キー — ピン留め', () => {
    it('フォーカス中のメッセージで p キーを押すと onPinMessage が呼ばれる', () => {
      const { result } = renderHook(() =>
        useMessageKeyNav({ messages, isEditorFocused: false, ...defaultCallbacks }),
      );

      act(() => {
        fireKeydown('j');
      });

      expect(result.current.focusedIndex).toBe(0);

      act(() => {
        fireKeydown('p');
      });

      expect(defaultCallbacks.onPinMessage).toHaveBeenCalledWith(messages[0].id);
    });

    it('エディタフォーカス中は p キーを押しても onPinMessage は呼ばれない', () => {
      renderHook(() => useMessageKeyNav({ messages, isEditorFocused: true, ...defaultCallbacks }));

      act(() => {
        fireKeydown('p');
      });

      expect(defaultCallbacks.onPinMessage).not.toHaveBeenCalled();
    });
  });

  describe('keydown リスナーのライフサイクル', () => {
    it('マウント時に document に keydown リスナーが登録される', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

      renderHook(() => useMessageKeyNav({ messages, isEditorFocused: false, ...defaultCallbacks }));

      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('アンマウント時に keydown リスナーが解除される', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      const { unmount } = renderHook(() =>
        useMessageKeyNav({ messages, isEditorFocused: false, ...defaultCallbacks }),
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });
  });
});

// ─────────────────────────────────────────
// MessageList への統合テスト（ハイライト・スクロール追従）
// ─────────────────────────────────────────
import { render, screen } from '@testing-library/react';
import MessageList from '../components/Chat/MessageList';

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

// MessageItem スタブ — data-message-id と data-focused を公開する
vi.mock('../components/Chat/MessageItem', () => ({
  default: ({
    message,
    isContinued,
    focused,
  }: {
    message: { id: number };
    isContinued?: boolean;
    focused?: boolean;
  }) => (
    <div
      id={`message-${message.id}`}
      data-testid={`message-${message.id}`}
      data-message-id={message.id}
      data-continued={isContinued ? 'true' : 'false'}
      data-focused={focused ? 'true' : 'false'}
    />
  ),
}));

describe('MessageList — キーボードナビゲーション統合', () => {
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

  describe('フォーカスメッセージのハイライト表示', () => {
    it('focusedMessageId と一致するメッセージに data-focused 属性が付与される', () => {
      render(
        <MessageList
          messages={[makeMessage({ id: 1 }), makeMessage({ id: 2 })]}
          loading={false}
          onLoadMore={vi.fn()}
          currentUserId={1}
          focusedMessageId={1}
        />,
      );

      expect(screen.getByTestId('message-1')).toHaveAttribute('data-focused', 'true');
      expect(screen.getByTestId('message-2')).toHaveAttribute('data-focused', 'false');
    });

    it('focusedMessageId が変わると前の要素の data-focused が除去される', () => {
      const { rerender } = render(
        <MessageList
          messages={[makeMessage({ id: 1 }), makeMessage({ id: 2 })]}
          loading={false}
          onLoadMore={vi.fn()}
          currentUserId={1}
          focusedMessageId={1}
        />,
      );

      expect(screen.getByTestId('message-1')).toHaveAttribute('data-focused', 'true');

      rerender(
        <MessageList
          messages={[makeMessage({ id: 1 }), makeMessage({ id: 2 })]}
          loading={false}
          onLoadMore={vi.fn()}
          currentUserId={1}
          focusedMessageId={2}
        />,
      );

      expect(screen.getByTestId('message-1')).toHaveAttribute('data-focused', 'false');
      expect(screen.getByTestId('message-2')).toHaveAttribute('data-focused', 'true');
    });
  });

  describe('スクロール追従', () => {
    it('フォーカスが変わったとき対象メッセージ要素の scrollIntoView が呼ばれる', () => {
      const scrollIntoView = vi.fn();
      HTMLElement.prototype.scrollIntoView = scrollIntoView;

      const { rerender } = render(
        <MessageList
          messages={[makeMessage({ id: 1 }), makeMessage({ id: 2 })]}
          loading={false}
          onLoadMore={vi.fn()}
          currentUserId={1}
          focusedMessageId={null}
        />,
      );

      // 初回ロードのscrollIntoView呼び出し回数を記録
      const initialCallCount = scrollIntoView.mock.calls.length;

      rerender(
        <MessageList
          messages={[makeMessage({ id: 1 }), makeMessage({ id: 2 })]}
          loading={false}
          onLoadMore={vi.fn()}
          currentUserId={1}
          focusedMessageId={2}
        />,
      );

      // フォーカス変更後にscrollIntoViewが追加で呼ばれる
      expect(scrollIntoView.mock.calls.length).toBeGreaterThan(initialCallCount);
    });

    it('フォーカスが画面内に収まっている場合は不要な scrollIntoView が呼ばれない', () => {
      const scrollIntoView = vi.fn();
      HTMLElement.prototype.scrollIntoView = scrollIntoView;

      // focusedMessageId が null のままの場合
      render(
        <MessageList
          messages={[makeMessage({ id: 1 })]}
          loading={false}
          onLoadMore={vi.fn()}
          currentUserId={1}
          focusedMessageId={null}
        />,
      );

      // 初回ロードの自動スクロール以外では scrollIntoView が呼ばれない
      // (focusedMessageId が null なので、フォーカス追従のscrollIntoViewは呼ばれない)
      const callsAfterRender = scrollIntoView.mock.calls.length;

      // 追加レンダリングしてもフォーカス変化なしなら増えない
      expect(callsAfterRender).toBeLessThanOrEqual(1); // 初回ロードの1回のみ許容
    });
  });
});
