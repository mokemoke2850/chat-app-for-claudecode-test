/**
 * テスト対象: メッセージ引用返信機能（フロントエンド）
 *
 * テスト対象コンポーネント:
 *   - components/Chat/MessageItem.tsx — 引用返信ボタンの表示・クリック処理
 *   - components/Chat/RichEditor.tsx — 引用元情報の表示・入力欄への反映
 * 戦略:
 *   - Socket.IO は SocketContext をモックして注入する
 *   - RichEditor は jsdom で動作しないため必要に応じてスタブに差し替える
 *   - userEvent でホバー・クリックをシミュレートする
 */

import { render, screen } from './test-utils';
import userEvent from '@testing-library/user-event';
import { describe, it, vi, beforeEach, expect } from 'vitest';
import MessageItem from '../components/Chat/MessageItem';
import { dummyUsers } from './__fixtures__/users';
import { makeMessage } from './__fixtures__/messages';

// Socket.IO モック
const mockSocket = { emit: vi.fn(), on: vi.fn(), off: vi.fn() };
vi.mock('../contexts/DensityContext', () => ({
  useDensity: () => ({ density: 'cozy', setDensity: vi.fn() }),
}));

vi.mock('../contexts/SocketContext', () => ({
  useSocket: () => mockSocket,
}));

vi.mock('../components/Chat/RichEditor', () => ({
  default: ({
    onCancel,
    quotedMessage,
  }: {
    onCancel: () => void;
    onSend: (c: string, m: number[]) => void;
    quotedMessage?: { id: number; content: string; username: string; createdAt: string };
  }) => (
    <div data-testid="rich-editor">
      {quotedMessage && (
        <div data-testid="quoted-message-preview">
          <span data-testid="quoted-username">{quotedMessage.username}</span>
          <span data-testid="quoted-content">{quotedMessage.content}</span>
        </div>
      )}
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe('MessageItem — 引用返信ボタン', () => {
  // #142 リファクタ後: 引用返信は3点メニュー内に移動
  // 「その他のアクション」ボタンをクリックしてメニューを開いた後に操作する
  it('3点メニューを開くと「引用返信」メニュー項目が表示される', async () => {
    render(
      <MessageItem
        message={makeMessage({ userId: 1, isDeleted: false })}
        currentUserId={2}
        users={dummyUsers}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'その他のアクション' }), {
      pointerEventsCheck: 0,
    });
    expect(screen.getByRole('menuitem', { name: /引用返信/ })).toBeInTheDocument();
  });

  it('自分のメッセージでも3点メニューに「引用返信」メニュー項目が表示される', async () => {
    render(
      <MessageItem
        message={makeMessage({ userId: 1, isDeleted: false })}
        currentUserId={1}
        users={dummyUsers}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'その他のアクション' }), {
      pointerEventsCheck: 0,
    });
    expect(screen.getByRole('menuitem', { name: /引用返信/ })).toBeInTheDocument();
  });

  it('削除済みメッセージには3点メニューボタン自体が表示されない', () => {
    render(
      <MessageItem
        message={makeMessage({ userId: 1, isDeleted: true })}
        currentUserId={2}
        users={dummyUsers}
      />,
    );
    expect(screen.queryByRole('button', { name: 'その他のアクション' })).not.toBeInTheDocument();
  });

  it('3点メニューの引用返信をクリックするとonQuoteReplyが呼ばれる', async () => {
    const onQuoteReply = vi.fn();
    const message = makeMessage({ userId: 1, isDeleted: false });
    render(
      <MessageItem
        message={message}
        currentUserId={2}
        users={dummyUsers}
        onQuoteReply={onQuoteReply}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'その他のアクション' }), {
      pointerEventsCheck: 0,
    });
    await userEvent.click(screen.getByRole('menuitem', { name: /引用返信/ }));
    expect(onQuoteReply).toHaveBeenCalledWith(message);
  });
});

describe('RichEditor — 引用元情報の表示', () => {
  it('引用元情報が渡されると入力欄上部に引用プレビューが表示される', () => {
    const quotedMessage = {
      id: 10,
      content: JSON.stringify({ ops: [{ insert: 'Original message\n' }] }),
      username: 'alice',
      createdAt: '2024-06-01T10:00:00Z',
    };
    // RichEditor のスタブはモックされているので MessageItem 経由でテストする
    // quotedMessage を MessageItem の quotedMessage prop として渡す
    render(
      <MessageItem
        message={makeMessage({
          userId: 2,
          isDeleted: false,
          quotedMessageId: 10,
          quotedMessage,
        })}
        currentUserId={1}
        users={dummyUsers}
      />,
    );
    expect(screen.getByTestId('quoted-message-preview')).toBeInTheDocument();
  });

  it('引用プレビューに引用元の送信者名が表示される', () => {
    const quotedMessage = {
      id: 11,
      content: JSON.stringify({ ops: [{ insert: 'Some content\n' }] }),
      username: 'bob',
      createdAt: '2024-06-01T10:00:00Z',
    };
    render(
      <MessageItem
        message={makeMessage({
          userId: 2,
          isDeleted: false,
          quotedMessageId: 11,
          quotedMessage,
        })}
        currentUserId={1}
        users={dummyUsers}
      />,
    );
    expect(screen.getByTestId('quoted-username')).toHaveTextContent('bob');
  });

  it('引用プレビューに引用元のメッセージ内容が表示される', () => {
    const quotedMessage = {
      id: 12,
      content: 'Plain text content',
      username: 'alice',
      createdAt: '2024-06-01T10:00:00Z',
    };
    render(
      <MessageItem
        message={makeMessage({
          userId: 2,
          isDeleted: false,
          quotedMessageId: 12,
          quotedMessage,
        })}
        currentUserId={1}
        users={dummyUsers}
      />,
    );
    expect(screen.getByTestId('quoted-content')).toHaveTextContent('Plain text content');
  });

  // 「×」ボタンによる引用クリアの実挙動は ChatPage 側の onClearQuote を経由するため
  // ChatPage 統合テストで検証する (ここでは MessageItem 単体スコープに留める)
});

describe('MessageList — 引用返信の投稿と表示', () => {
  // socket.emit を経由する送信パスは ChatPage 統合テストで検証する
  // (ここでテストすると mockSocket.emit を直接呼んで mockSocket.emit を検証する自己参照になる)

  it('引用元と返信内容がセットでメッセージ一覧に表示される', () => {
    const quotedMessage = {
      id: 20,
      content: JSON.stringify({ ops: [{ insert: 'Original\n' }] }),
      username: 'alice',
      createdAt: '2024-06-01T10:00:00Z',
    };
    render(
      <MessageItem
        message={makeMessage({
          id: 21,
          userId: 2,
          content: JSON.stringify({ ops: [{ insert: 'Reply\n' }] }),
          quotedMessageId: 20,
          quotedMessage,
        })}
        currentUserId={2}
        users={dummyUsers}
      />,
    );
    // 引用プレビューと返信内容の両方が表示される
    expect(screen.getByTestId('quoted-message-preview')).toBeInTheDocument();
    expect(screen.getByTestId('quoted-username')).toHaveTextContent('alice');
    expect(screen.getByTestId('quoted-content')).toHaveTextContent('Original');
    expect(screen.getByText('Reply')).toBeInTheDocument();
  });
});
