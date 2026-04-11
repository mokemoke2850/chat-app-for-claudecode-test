/**
 * components/Chat/MessageItem.tsx のユニットテスト
 *
 * テスト対象: メッセージの表示パターン、編集・削除操作
 * 戦略:
 *   - Socket.IO は SocketContext をモックして注入する
 *   - RichEditor は Quill を依存しており jsdom では動作しないためスタブに差し替える
 *   - userEvent でホバー・クリックをシミュレートする
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Message, User } from '@chat-app/shared';
import MessageItem from '../components/Chat/MessageItem';

// Socket.IO モック
const mockSocket = { emit: vi.fn(), on: vi.fn(), off: vi.fn() };
vi.mock('../contexts/SocketContext', () => ({
  useSocket: () => mockSocket,
}));

// RichEditor は Quill を内包するため jsdom では動作しない → スタブに差し替える
vi.mock('../components/Chat/RichEditor', () => ({
  default: ({ onCancel }: { onCancel: () => void; onSend: (c: string, m: number[]) => void }) => (
    <div data-testid="rich-editor">
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

const dummyUsers: User[] = [
  {
    id: 1,
    username: 'alice',
    email: 'alice@example.com',
    avatarUrl: null,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    username: 'bob',
    email: 'bob@example.com',
    avatarUrl: null,
    createdAt: '2024-01-01T00:00:00Z',
  },
];

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 1,
    channelId: 1,
    userId: 1,
    username: 'alice',
    avatarUrl: null,
    content: JSON.stringify({ ops: [{ insert: 'Hello world\n' }] }),
    isEdited: false,
    isDeleted: false,
    createdAt: '2024-06-01T12:00:00Z',
    updatedAt: '2024-06-01T12:00:00Z',
    mentions: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('MessageItem', () => {
  describe('削除済みメッセージ', () => {
    it('isDeleted=true のとき "This message was deleted." を表示する', () => {
      render(
        <MessageItem
          message={makeMessage({ isDeleted: true })}
          currentUserId={1}
          users={dummyUsers}
        />,
      );

      expect(screen.getByText('This message was deleted.')).toBeInTheDocument();
    });

    it('isDeleted=true のとき編集・削除ボタンを表示しない', () => {
      render(
        <MessageItem
          message={makeMessage({ isDeleted: true })}
          currentUserId={1}
          users={dummyUsers}
        />,
      );

      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    });
  });

  describe('通常メッセージの表示', () => {
    it('ユーザー名と投稿時刻を表示する', () => {
      render(<MessageItem message={makeMessage()} currentUserId={1} users={dummyUsers} />);

      expect(screen.getByText('alice')).toBeInTheDocument();
      // createdAt "2024-06-01T12:00:00Z" が toLocaleTimeString で変換されて表示される
      // 環境依存を避けるため「何らかの時刻文字列が存在する」ことだけを確認する
      expect(screen.getByText(/\d{1,2}:\d{2}/)).toBeInTheDocument();
    });

    it('isEdited=true のとき "(edited)" を表示する', () => {
      render(
        <MessageItem
          message={makeMessage({ isEdited: true })}
          currentUserId={1}
          users={dummyUsers}
        />,
      );

      expect(screen.getByText('(edited)')).toBeInTheDocument();
    });

    it('isEdited=false のとき "(edited)" を表示しない', () => {
      render(
        <MessageItem
          message={makeMessage({ isEdited: false })}
          currentUserId={1}
          users={dummyUsers}
        />,
      );

      expect(screen.queryByText('(edited)')).not.toBeInTheDocument();
    });
  });

  describe('自分のメッセージ（currentUserId === message.userId）', () => {
    it('Edit ボタンと Delete ボタンが DOM 上に存在する', () => {
      render(
        // currentUserId=1 は message.userId=1 と一致 → 自分のメッセージ
        <MessageItem message={makeMessage({ userId: 1 })} currentUserId={1} users={dummyUsers} />,
      );

      // ボタンは opacity:0 で非表示だが DOM には存在する（ホバーで表示される設計）
      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });

    it('Edit ボタンをクリックすると RichEditor が表示される（編集モードになる）', async () => {
      render(
        <MessageItem message={makeMessage({ userId: 1 })} currentUserId={1} users={dummyUsers} />,
      );

      await userEvent.click(screen.getByRole('button', { name: /edit/i }));

      expect(screen.getByTestId('rich-editor')).toBeInTheDocument();
    });

    it('Delete ボタンをクリックすると socket.emit("delete_message") が呼ばれる', async () => {
      render(
        <MessageItem
          message={makeMessage({ id: 42, userId: 1 })}
          currentUserId={1}
          users={dummyUsers}
        />,
      );

      await userEvent.click(screen.getByRole('button', { name: /delete/i }));

      expect(mockSocket.emit).toHaveBeenCalledWith('delete_message', 42);
    });
  });

  describe('他人のメッセージ（currentUserId !== message.userId）', () => {
    it('Edit ボタンと Delete ボタンが表示されない', () => {
      render(
        // message.userId=1（alice）、currentUserId=2（bob）→ 他人のメッセージ
        <MessageItem message={makeMessage({ userId: 1 })} currentUserId={2} users={dummyUsers} />,
      );

      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    });
  });

  describe('メッセージコンテンツのレンダリング', () => {
    it('Quill Delta の ops を HTML として正しく描画する（bold, italic など）', () => {
      const content = JSON.stringify({
        ops: [{ insert: 'bold text', attributes: { bold: true } }, { insert: '\n' }],
      });

      render(
        <MessageItem message={makeMessage({ content })} currentUserId={1} users={dummyUsers} />,
      );

      // bold テキストが <strong> タグで包まれること
      expect(screen.getByText('bold text').tagName).toBe('STRONG');
    });

    it('@メンションを含む ops をハイライト表示する', () => {
      const content = JSON.stringify({
        ops: [{ insert: { mention: { value: 'bob' } } }, { insert: '\n' }],
      });

      render(
        <MessageItem message={makeMessage({ content })} currentUserId={1} users={dummyUsers} />,
      );

      // メンション表示: "@bob" が描画されること
      expect(screen.getByText('@bob')).toBeInTheDocument();
    });

    it('content が不正な JSON のとき raw テキストとしてフォールバック表示する', () => {
      const rawContent = 'not a json string';

      render(
        <MessageItem
          message={makeMessage({ content: rawContent })}
          currentUserId={1}
          users={dummyUsers}
        />,
      );

      expect(screen.getByText('not a json string')).toBeInTheDocument();
    });

    it('画像 op（insert.image）を img タグとして描画する', () => {
      const content = JSON.stringify({
        ops: [{ insert: { image: 'data:image/png;base64,abc123' } }],
      });

      render(
        <MessageItem message={makeMessage({ content })} currentUserId={1} users={dummyUsers} />,
      );

      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', 'data:image/png;base64,abc123');
    });

    it('color 属性を持つテキストをインラインスタイルの color で描画する', () => {
      const content = JSON.stringify({
        ops: [{ insert: 'colored text', attributes: { color: '#ff0000' } }],
      });

      render(
        <MessageItem message={makeMessage({ content })} currentUserId={1} users={dummyUsers} />,
      );

      // 実装側は inline style={{ color }} で適用するため toHaveStyle で検証できる
      expect(screen.getByText('colored text')).toHaveStyle({ color: '#ff0000' });
    });

    it('background 属性を持つテキストをインラインスタイルの backgroundColor で描画する', () => {
      const content = JSON.stringify({
        ops: [{ insert: 'highlighted text', attributes: { background: '#ffff00' } }],
      });

      render(
        <MessageItem message={makeMessage({ content })} currentUserId={1} users={dummyUsers} />,
      );

      expect(screen.getByText('highlighted text')).toHaveStyle({ backgroundColor: '#ffff00' });
    });
  });

  describe('自分のメッセージの右寄せ表示', () => {
    it('isOwn（currentUserId === message.userId）のとき外側コンテナに data-own="true" が付く', () => {
      // 実装側は <Box data-own={isOwn ? 'true' : 'false'} ...> として右寄せを示す
      const { container } = render(
        <MessageItem message={makeMessage({ userId: 1 })} currentUserId={1} users={dummyUsers} />,
      );

      expect(container.firstElementChild).toHaveAttribute('data-own', 'true');
    });

    it('他人のメッセージ（currentUserId !== message.userId）のとき外側コンテナに data-own="false" が付く', () => {
      const { container } = render(
        <MessageItem message={makeMessage({ userId: 1 })} currentUserId={2} users={dummyUsers} />,
      );

      expect(container.firstElementChild).toHaveAttribute('data-own', 'false');
    });
  });

  describe('投稿リンクのコピー', () => {
    it('リンクコピーボタンが DOM 上に存在する（自分のメッセージ）', () => {
      render(
        <MessageItem message={makeMessage({ userId: 1 })} currentUserId={1} users={dummyUsers} />,
      );

      // aria-label="リンクをコピー" が付与された IconButton が存在すること
      expect(screen.getByRole('button', { name: 'リンクをコピー' })).toBeInTheDocument();
    });

    it('リンクコピーボタンが DOM 上に存在する（他人のメッセージ）', () => {
      render(
        <MessageItem message={makeMessage({ userId: 1 })} currentUserId={2} users={dummyUsers} />,
      );

      expect(screen.getByRole('button', { name: 'リンクをコピー' })).toBeInTheDocument();
    });

    it('リンクコピーボタンをクリックすると navigator.clipboard.writeText が呼ばれる', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
        writable: true,
      });

      render(
        <MessageItem
          message={makeMessage({ id: 42, userId: 1 })}
          currentUserId={1}
          users={dummyUsers}
        />,
      );

      await userEvent.click(screen.getByRole('button', { name: 'リンクをコピー' }));

      expect(writeText).toHaveBeenCalledOnce();
    });

    it('コピーされる URL に #message-{id} のフラグメントが含まれる', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
        writable: true,
      });

      render(
        <MessageItem
          message={makeMessage({ id: 42, userId: 1 })}
          currentUserId={1}
          users={dummyUsers}
        />,
      );

      await userEvent.click(screen.getByRole('button', { name: 'リンクをコピー' }));

      const copiedUrl = writeText.mock.calls[0][0] as string;
      expect(copiedUrl).toMatch(/#message-42$/);
    });
  });
});
