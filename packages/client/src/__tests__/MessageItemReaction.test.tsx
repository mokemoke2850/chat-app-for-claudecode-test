/**
 * MessageItem - リアクション機能のユニットテスト
 *
 * テスト対象: packages/client/src/components/Chat/MessageItem.tsx
 * - リアクションバッジの表示
 * - 絵文字ピッカーの表示・非表示
 * - リアクションのトグル（追加・取り消し）
 * - reaction_updated Socket イベントの受信による表示更新
 *
 * 戦略:
 *   - Socket.IO は SocketContext をモックして注入する
 *   - RichEditor は jsdom では動作しないためスタブに差し替える
 *   - userEvent でホバー・クリックをシミュレートする
 */

import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Reaction } from '@chat-app/shared';
import MessageItem from '../components/Chat/MessageItem';
import { dummyUsers } from './__fixtures__/users';
import { makeMessage } from './__fixtures__/messages';

// Socket.IO モック（on でハンドラを保持できるようにする）
const socketHandlers: Record<string, ((...args: unknown[]) => void)[]> = {};
const mockSocket = {
  emit: vi.fn(),
  on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    socketHandlers[event] = socketHandlers[event] ?? [];
    socketHandlers[event].push(handler);
  }),
  off: vi.fn(),
};

vi.mock('../contexts/SocketContext', () => ({
  useSocket: () => mockSocket,
}));

vi.mock('../components/Chat/RichEditor', () => ({
  default: ({ onCancel }: { onCancel: () => void; onSend: (c: string, m: number[]) => void }) => (
    <div data-testid="rich-editor">
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

function makeReaction(overrides: Partial<Reaction> = {}): Reaction {
  return {
    emoji: '👍',
    count: 1,
    userIds: [1],
    ...overrides,
  };
}

function emitSocketEvent(event: string, payload: unknown) {
  socketHandlers[event]?.forEach((handler) => handler(payload));
}

beforeEach(() => {
  vi.resetAllMocks();
  // ハンドラ登録テーブルをリセット
  Object.keys(socketHandlers).forEach((k) => delete socketHandlers[k]);
  // on の実装を再設定（resetAllMocks で消えるため）
  mockSocket.on.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
    socketHandlers[event] = socketHandlers[event] ?? [];
    socketHandlers[event].push(handler);
  });
});

describe('MessageItem - リアクション機能', () => {
  describe('リアクションバッジの表示', () => {
    it('reactions が空配列のときバッジが表示されない', () => {
      render(
        <MessageItem
          message={makeMessage({ reactions: [] })}
          currentUserId={1}
          users={dummyUsers}
        />,
      );

      // リアクションバッジ用のコンテナが存在しないか、中身が空であること
      expect(screen.queryByTestId('reaction-badge')).not.toBeInTheDocument();
    });

    it('reactions に絵文字がある場合、その絵文字とカウントを表示する', () => {
      const reactions = [makeReaction({ emoji: '👍', count: 3, userIds: [1, 2, 3] })];
      render(
        <MessageItem message={makeMessage({ reactions })} currentUserId={1} users={dummyUsers} />,
      );

      expect(screen.getByText('👍')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('自分がリアクション済みのバッジはスタイルで強調される（data属性で判定）', () => {
      // currentUserId=1 が userIds に含まれる → 自分がリアクション済み
      const reactions = [makeReaction({ emoji: '❤️', count: 1, userIds: [1] })];
      render(
        <MessageItem message={makeMessage({ reactions })} currentUserId={1} users={dummyUsers} />,
      );

      // 実装側は data-reacted="true" を付与して強調を表現する
      const badge = screen.getByTestId('reaction-badge');
      expect(badge).toHaveAttribute('data-reacted', 'true');
    });
  });

  describe('絵文字ピッカー', () => {
    it('メッセージホバー時にアクションバーに絵文字ピッカー起動ボタンが DOM 上に存在する', () => {
      render(<MessageItem message={makeMessage()} currentUserId={1} users={dummyUsers} />);

      // opacity:0 で非表示だが DOM には存在する設計
      expect(screen.getByRole('button', { name: /リアクションを追加/i })).toBeInTheDocument();
    });

    it('絵文字ピッカー起動ボタンをクリックするとピッカーが表示される', async () => {
      render(<MessageItem message={makeMessage()} currentUserId={1} users={dummyUsers} />);

      await userEvent.click(screen.getByRole('button', { name: /リアクションを追加/i }));

      expect(screen.getByTestId('emoji-picker')).toBeInTheDocument();
    });

    it('絵文字ピッカーに固定の絵文字リストが表示される', async () => {
      render(<MessageItem message={makeMessage()} currentUserId={1} users={dummyUsers} />);

      await userEvent.click(screen.getByRole('button', { name: /リアクションを追加/i }));

      // 固定絵文字セットの一部が表示されていること
      expect(screen.getByRole('button', { name: '👍' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '❤️' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '🎉' })).toBeInTheDocument();
    });

    it('ピッカー外をクリックするとピッカーが閉じる', async () => {
      render(<MessageItem message={makeMessage()} currentUserId={1} users={dummyUsers} />);

      await userEvent.click(screen.getByRole('button', { name: /リアクションを追加/i }));
      expect(screen.getByTestId('emoji-picker')).toBeInTheDocument();

      // ピッカー外をクリックして閉じる
      await userEvent.click(document.body);

      expect(screen.queryByTestId('emoji-picker')).not.toBeInTheDocument();
    });
  });

  describe('リアクションのトグル', () => {
    it('絵文字ピッカーで絵文字を選択すると socket.emit("add_reaction") が呼ばれる', async () => {
      render(
        <MessageItem message={makeMessage({ id: 42 })} currentUserId={1} users={dummyUsers} />,
      );

      await userEvent.click(screen.getByRole('button', { name: /リアクションを追加/i }));
      await userEvent.click(screen.getByRole('button', { name: '👍' }));

      expect(mockSocket.emit).toHaveBeenCalledWith('add_reaction', {
        messageId: 42,
        emoji: '👍',
      });
    });

    it('自分がリアクション済みのバッジをクリックすると socket.emit("remove_reaction") が呼ばれる', async () => {
      // currentUserId=1 が userIds に含まれる → 自分がリアクション済み
      const reactions = [makeReaction({ emoji: '🔥', count: 1, userIds: [1] })];
      render(
        <MessageItem
          message={makeMessage({ id: 10, reactions })}
          currentUserId={1}
          users={dummyUsers}
        />,
      );

      await userEvent.click(screen.getByTestId('reaction-badge'));

      expect(mockSocket.emit).toHaveBeenCalledWith('remove_reaction', {
        messageId: 10,
        emoji: '🔥',
      });
    });

    it('自分がリアクションしていないバッジをクリックすると socket.emit("add_reaction") が呼ばれる', async () => {
      // currentUserId=1 が userIds に含まれない → 未リアクション
      const reactions = [makeReaction({ emoji: '😂', count: 1, userIds: [2] })];
      render(
        <MessageItem
          message={makeMessage({ id: 20, reactions })}
          currentUserId={1}
          users={dummyUsers}
        />,
      );

      await userEvent.click(screen.getByTestId('reaction-badge'));

      expect(mockSocket.emit).toHaveBeenCalledWith('add_reaction', {
        messageId: 20,
        emoji: '😂',
      });
    });
  });

  describe('reaction_updated Socket イベント', () => {
    it('reaction_updated イベントを受信すると対象メッセージのリアクションが更新される', async () => {
      render(
        <MessageItem
          message={makeMessage({ id: 1, reactions: [] })}
          currentUserId={1}
          users={dummyUsers}
        />,
      );

      // 初期状態ではバッジなし
      expect(screen.queryByTestId('reaction-badge')).not.toBeInTheDocument();

      // reaction_updated イベントを発火
      act(() => {
        emitSocketEvent('reaction_updated', {
          messageId: 1,
          channelId: 1,
          reactions: [{ emoji: '👍', count: 1, userIds: [2] }],
        });
      });

      // バッジが表示される
      await waitFor(() => {
        expect(screen.getByText('👍')).toBeInTheDocument();
      });
    });

    it('別メッセージの reaction_updated イベントは自分のリアクション表示に影響しない', async () => {
      render(
        <MessageItem
          message={makeMessage({ id: 1, reactions: [] })}
          currentUserId={1}
          users={dummyUsers}
        />,
      );

      // 別メッセージID=99 の reaction_updated を発火
      act(() => {
        emitSocketEvent('reaction_updated', {
          messageId: 99,
          channelId: 1,
          reactions: [{ emoji: '🚀', count: 1, userIds: [2] }],
        });
      });

      // 自分のメッセージ（id=1）には影響しない
      expect(screen.queryByText('🚀')).not.toBeInTheDocument();
    });
  });
});
