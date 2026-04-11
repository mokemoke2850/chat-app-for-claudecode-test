/**
 * components/Chat/MessageList.tsx のユニットテスト
 *
 * テスト対象: URL ハッシュ #message-{id} に対応するメッセージへのスクロール
 * 戦略:
 *   - AuthContext をモックして user を注入する
 *   - MessageItem はスタブに差し替えて id 属性だけ持つ div をレンダリングする
 *   - document.getElementById をスパイして hash スクロール対象の要素だけモック化する
 *     （auto-scroll の scrollIntoView と混在しないよう getElementById ベースで検証）
 *   - window.location.hash を各テストで設定し afterEach でリセットする
 */

import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Message } from '@chat-app/shared';
import MessageList from '../components/Chat/MessageList';

// AuthContext モック — user が null だと MessageList は null を返すため注入が必要
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

// MessageItem スタブ — id 属性だけ持つ div にして DOM にアンカーを作る
vi.mock('../components/Chat/MessageItem', () => ({
  default: ({ message }: { message: Message }) => (
    <div id={`message-${message.id}`} data-testid={`message-${message.id}`} />
  ),
}));

function makeMessage(id: number): Message {
  return {
    id,
    channelId: 1,
    userId: 1,
    username: 'alice',
    avatarUrl: null,
    content: JSON.stringify({ ops: [{ insert: 'hello\n' }] }),
    isEdited: false,
    isDeleted: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    mentions: [],
  };
}

const setLocationHash = (hash: string) => {
  Object.defineProperty(window, 'location', {
    value: { hash, search: '', pathname: '/', origin: 'http://localhost' },
    writable: true,
    configurable: true,
  });
};

beforeEach(() => {
  setLocationHash('');
  // jsdom は scrollIntoView を未実装のため空関数でモックする（auto-scroll の呼び出しを吸収）
  // hash-scroll のテストでは document.getElementById を spy して専用の mockScrollIntoView を注入するため干渉しない
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MessageList', () => {
  describe('URL ハッシュへのスクロール', () => {
    it('messages ロード後に window.location.hash に対応する id を持つ要素へ scrollIntoView が呼ばれる', () => {
      setLocationHash('#message-42');

      // document.getElementById をスパイし、対象 id のみモック要素を返す
      const mockScrollIntoView = vi.fn();
      const originalGetById = document.getElementById.bind(document);
      vi.spyOn(document, 'getElementById').mockImplementation((id: string) => {
        if (id === 'message-42') {
          return { scrollIntoView: mockScrollIntoView } as unknown as HTMLElement;
        }
        return originalGetById(id);
      });

      render(
        <MessageList
          messages={[makeMessage(42)]}
          loading={false}
          onLoadMore={vi.fn()}
          currentUserId={1}
        />,
      );

      expect(mockScrollIntoView).toHaveBeenCalledOnce();
    });

    it('#message- で始まらない hash のときは scrollIntoView は呼ばれない', () => {
      setLocationHash('#some-other-section');

      const mockScrollIntoView = vi.fn();
      vi.spyOn(document, 'getElementById').mockReturnValue({
        scrollIntoView: mockScrollIntoView,
      } as unknown as HTMLElement);

      render(
        <MessageList
          messages={[makeMessage(42)]}
          loading={false}
          onLoadMore={vi.fn()}
          currentUserId={1}
        />,
      );

      expect(mockScrollIntoView).not.toHaveBeenCalled();
    });

    it('hash に対応する要素が DOM に存在しないときは scrollIntoView は呼ばれない', () => {
      setLocationHash('#message-999');

      const mockScrollIntoView = vi.fn();
      // message-999 は存在しない → getElementById が null を返す
      const originalGetById = document.getElementById.bind(document);
      vi.spyOn(document, 'getElementById').mockImplementation((id: string) => {
        if (id === 'message-999') return null;
        return originalGetById(id);
      });

      render(
        <MessageList
          messages={[makeMessage(42)]}
          loading={false}
          onLoadMore={vi.fn()}
          currentUserId={1}
        />,
      );

      expect(mockScrollIntoView).not.toHaveBeenCalled();
    });

    it('一度スクロールした後はメッセージが追加されても再度 scrollIntoView は呼ばれない', () => {
      setLocationHash('#message-42');

      const mockScrollIntoView = vi.fn();
      const originalGetById = document.getElementById.bind(document);
      vi.spyOn(document, 'getElementById').mockImplementation((id: string) => {
        if (id === 'message-42') {
          return { scrollIntoView: mockScrollIntoView } as unknown as HTMLElement;
        }
        return originalGetById(id);
      });

      const { rerender } = render(
        <MessageList
          messages={[makeMessage(42)]}
          loading={false}
          onLoadMore={vi.fn()}
          currentUserId={1}
        />,
      );

      expect(mockScrollIntoView).toHaveBeenCalledOnce();

      // 新しいメッセージを追加して rerender
      rerender(
        <MessageList
          messages={[makeMessage(42), makeMessage(100)]}
          loading={false}
          onLoadMore={vi.fn()}
          currentUserId={1}
        />,
      );

      // 2 回目は呼ばれない
      expect(mockScrollIntoView).toHaveBeenCalledOnce();
    });
  });
});
