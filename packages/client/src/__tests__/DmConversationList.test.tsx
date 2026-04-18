/**
 * テスト対象: DMPage 内の DmConversationList コンポーネント
 * 責務: DM会話一覧のサイドバー表示・会話選択・新規DM起動ボタン
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DmConversationWithDetails, DmMessage } from '@chat-app/shared';
import DmConversationList from '../components/DM/DmConversationList';

// Socket モック：イベントハンドラを手動管理
const socketHandlers: Record<string, ((...args: unknown[]) => void)[]> = {};
const mockSocket = {
  emit: vi.fn(),
  on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    if (!socketHandlers[event]) socketHandlers[event] = [];
    socketHandlers[event].push(handler);
  }),
  off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    if (socketHandlers[event]) {
      socketHandlers[event] = socketHandlers[event].filter((h) => h !== handler);
    }
  }),
};

function emitSocket(event: string, ...args: unknown[]) {
  (socketHandlers[event] ?? []).forEach((h) => h(...args));
}

vi.mock('../contexts/SocketContext', () => ({
  useSocket: () => mockSocket,
}));

const makeConversation = (
  overrides: Partial<DmConversationWithDetails> = {},
): DmConversationWithDetails => ({
  id: 1,
  userAId: 1,
  userBId: 2,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  otherUser: { id: 2, username: 'bob', displayName: null, avatarUrl: null },
  unreadCount: 0,
  lastMessage: null,
  ...overrides,
});

const makeMessage = (overrides: Partial<DmMessage> = {}): DmMessage => ({
  id: 1,
  conversationId: 1,
  senderId: 2,
  senderUsername: 'bob',
  senderAvatarUrl: null,
  content: 'こんにちは',
  isRead: false,
  createdAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(socketHandlers).forEach((k) => {
    delete socketHandlers[k];
  });
});

describe('DmConversationList', () => {
  describe('会話一覧表示', () => {
    it('会話一覧が正しく表示される', () => {
      const conversations = [
        makeConversation({ id: 1, otherUser: { id: 2, username: 'bob', displayName: null, avatarUrl: null } }),
        makeConversation({ id: 2, userBId: 3, otherUser: { id: 3, username: 'charlie', displayName: null, avatarUrl: null } }),
      ];
      render(
        <DmConversationList
          conversations={conversations}
          activeConvId={null}
          currentUserId={1}
          onSelectConversation={vi.fn()}
          onNewDm={vi.fn()}
          onConversationsChange={vi.fn()}
        />,
      );
      expect(screen.getByText('bob')).toBeInTheDocument();
      expect(screen.getByText('charlie')).toBeInTheDocument();
    });

    it('会話が存在しない場合は「DM会話がありません」と表示される', () => {
      render(
        <DmConversationList
          conversations={[]}
          activeConvId={null}
          currentUserId={1}
          onSelectConversation={vi.fn()}
          onNewDm={vi.fn()}
          onConversationsChange={vi.fn()}
        />,
      );
      expect(screen.getByText('DM会話がありません')).toBeInTheDocument();
    });

    it('会話相手の displayName がある場合は displayName が表示される', () => {
      const conversations = [
        makeConversation({ otherUser: { id: 2, username: 'bob', displayName: 'Bob Smith', avatarUrl: null } }),
      ];
      render(
        <DmConversationList
          conversations={conversations}
          activeConvId={null}
          currentUserId={1}
          onSelectConversation={vi.fn()}
          onNewDm={vi.fn()}
          onConversationsChange={vi.fn()}
        />,
      );
      expect(screen.getByText('Bob Smith')).toBeInTheDocument();
      expect(screen.queryByText('bob')).not.toBeInTheDocument();
    });

    it('lastMessage がある場合はメッセージプレビューが表示される', () => {
      const conversations = [
        makeConversation({
          lastMessage: { content: '最新メッセージ', createdAt: '2024-01-01T10:00:00Z', senderId: 2 },
        }),
      ];
      render(
        <DmConversationList
          conversations={conversations}
          activeConvId={null}
          currentUserId={1}
          onSelectConversation={vi.fn()}
          onNewDm={vi.fn()}
          onConversationsChange={vi.fn()}
        />,
      );
      expect(screen.getByText('最新メッセージ')).toBeInTheDocument();
    });

    it('lastMessage がある場合は日時が表示される', () => {
      const conversations = [
        makeConversation({
          lastMessage: { content: 'テスト', createdAt: '2024-01-15T10:30:00Z', senderId: 2 },
        }),
      ];
      render(
        <DmConversationList
          conversations={conversations}
          activeConvId={null}
          currentUserId={1}
          onSelectConversation={vi.fn()}
          onNewDm={vi.fn()}
          onConversationsChange={vi.fn()}
        />,
      );
      // toLocaleString で日時フォーマット
      expect(screen.getByText(/\d{1,2}月\d{1,2}日/)).toBeInTheDocument();
    });

    it('lastMessage がない場合は日時プレビューが表示されない', () => {
      render(
        <DmConversationList
          conversations={[makeConversation({ lastMessage: null })]}
          activeConvId={null}
          currentUserId={1}
          onSelectConversation={vi.fn()}
          onNewDm={vi.fn()}
          onConversationsChange={vi.fn()}
        />,
      );
      expect(screen.queryByText(/\d{1,2}月/)).not.toBeInTheDocument();
    });
  });

  describe('未読バッジ', () => {
    it('unreadCount > 0 の会話に未読数バッジが表示される', () => {
      render(
        <DmConversationList
          conversations={[makeConversation({ unreadCount: 3 })]}
          activeConvId={null}
          currentUserId={1}
          onSelectConversation={vi.fn()}
          onNewDm={vi.fn()}
          onConversationsChange={vi.fn()}
        />,
      );
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('unreadCount === 0 の会話にバッジは表示されない', () => {
      render(
        <DmConversationList
          conversations={[makeConversation({ unreadCount: 0 })]}
          activeConvId={null}
          currentUserId={1}
          onSelectConversation={vi.fn()}
          onNewDm={vi.fn()}
          onConversationsChange={vi.fn()}
        />,
      );
      expect(screen.queryByText('0')).not.toBeInTheDocument();
    });

    it('unreadCount > 0 の会話では相手名が太字で表示される', () => {
      render(
        <DmConversationList
          conversations={[makeConversation({ unreadCount: 2 })]}
          activeConvId={null}
          currentUserId={1}
          onSelectConversation={vi.fn()}
          onNewDm={vi.fn()}
          onConversationsChange={vi.fn()}
        />,
      );
      expect(screen.getByText('bob')).toHaveStyle({ fontWeight: 'bold' });
    });
  });

  describe('会話選択', () => {
    it('会話をクリックすると onSelectConversation がその会話IDで呼ばれる', async () => {
      const onSelectConversation = vi.fn();
      render(
        <DmConversationList
          conversations={[makeConversation({ id: 42 })]}
          activeConvId={null}
          currentUserId={1}
          onSelectConversation={onSelectConversation}
          onNewDm={vi.fn()}
          onConversationsChange={vi.fn()}
        />,
      );
      await userEvent.click(screen.getByText('bob'));
      expect(onSelectConversation).toHaveBeenCalledWith(42);
    });

    it('選択中の会話が selected 状態になる', () => {
      render(
        <DmConversationList
          conversations={[makeConversation({ id: 1 })]}
          activeConvId={1}
          currentUserId={1}
          onSelectConversation={vi.fn()}
          onNewDm={vi.fn()}
          onConversationsChange={vi.fn()}
        />,
      );
      const btn = screen.getByText('bob').closest('[role="button"]');
      expect(btn).toHaveClass('Mui-selected');
    });
  });

  describe('新規DM起動', () => {
    it('「新規DM」ボタンが表示される', () => {
      render(
        <DmConversationList
          conversations={[]}
          activeConvId={null}
          currentUserId={1}
          onSelectConversation={vi.fn()}
          onNewDm={vi.fn()}
          onConversationsChange={vi.fn()}
        />,
      );
      expect(screen.getByRole('button', { name: '新規DM' })).toBeInTheDocument();
    });

    it('「新規DM」ボタンをクリックすると onNewDm が呼ばれる', async () => {
      const onNewDm = vi.fn();
      render(
        <DmConversationList
          conversations={[]}
          activeConvId={null}
          currentUserId={1}
          onSelectConversation={vi.fn()}
          onNewDm={onNewDm}
          onConversationsChange={vi.fn()}
        />,
      );
      await userEvent.click(screen.getByRole('button', { name: '新規DM' }));
      expect(onNewDm).toHaveBeenCalled();
    });
  });

  describe('Socket.IO リアルタイム更新', () => {
    it('new_dm_message イベント受信時に非アクティブ会話の unreadCount がインクリメントされる', async () => {
      const onConversationsChange = vi.fn();
      const initialConversation = makeConversation({ id: 2, userBId: 3, otherUser: { id: 3, username: 'charlie', displayName: null, avatarUrl: null }, unreadCount: 0 });
      render(
        <DmConversationList
          conversations={[initialConversation]}
          activeConvId={1}
          currentUserId={1}
          onSelectConversation={vi.fn()}
          onNewDm={vi.fn()}
          onConversationsChange={onConversationsChange}
        />,
      );

      const newMsg = makeMessage({ conversationId: 2, senderId: 3 });
      await act(async () => {
        emitSocket('new_dm_message', newMsg);
      });

      // unreadCount インクリメントのupdater（1回目）とlastMessage更新のupdater（2回目）が呼ばれる
      expect(onConversationsChange).toHaveBeenCalledTimes(2);
      // 1回目のupdaterがunreadCountをインクリメントすることを確認
      const unreadUpdater = onConversationsChange.mock.calls[0][0];
      const result = unreadUpdater([initialConversation]);
      expect(result[0].unreadCount).toBe(1);
    });

    it('new_dm_message イベント受信時に会話一覧の lastMessage が更新される', async () => {
      const onConversationsChange = vi.fn();
      const initialConversation = makeConversation({ id: 1, lastMessage: null });
      render(
        <DmConversationList
          conversations={[initialConversation]}
          activeConvId={null}
          currentUserId={1}
          onSelectConversation={vi.fn()}
          onNewDm={vi.fn()}
          onConversationsChange={onConversationsChange}
        />,
      );

      const newMsg = makeMessage({ conversationId: 1, senderId: 2, content: '新しいメッセージ' });
      await act(async () => {
        emitSocket('new_dm_message', newMsg);
      });

      // lastMessage 更新のupdaterが呼ばれることを確認（非アクティブ会話なのでunreadCount + lastMessageで2回）
      expect(onConversationsChange).toHaveBeenCalledTimes(2);
      // 2回目のupdaterがlastMessageを更新することを確認
      const lastMessageUpdater = onConversationsChange.mock.calls[1][0];
      const result = lastMessageUpdater([initialConversation]);
      expect(result[0].lastMessage).toEqual({
        content: '新しいメッセージ',
        createdAt: newMsg.createdAt,
        senderId: 2,
      });
    });

    it('自分が送信したメッセージでは非アクティブ会話でも unreadCount がインクリメントされない', async () => {
      const onConversationsChange = vi.fn();
      const initialConversation = makeConversation({ id: 2, userBId: 3, otherUser: { id: 3, username: 'charlie', displayName: null, avatarUrl: null }, unreadCount: 0 });
      render(
        <DmConversationList
          conversations={[initialConversation]}
          activeConvId={1}
          currentUserId={1}
          onSelectConversation={vi.fn()}
          onNewDm={vi.fn()}
          onConversationsChange={onConversationsChange}
        />,
      );

      // senderId === currentUserId（自分が送信）
      const newMsg = makeMessage({ conversationId: 2, senderId: 1 });
      await act(async () => {
        emitSocket('new_dm_message', newMsg);
      });

      // lastMessage更新のupdaterのみ呼ばれ、unreadCountのupdaterは呼ばれない（1回のみ）
      expect(onConversationsChange).toHaveBeenCalledTimes(1);
      // 呼ばれたupdaterはlastMessage更新であり、unreadCountは変化しない
      const updater = onConversationsChange.mock.calls[0][0];
      const result = updater([initialConversation]);
      expect(result[0].unreadCount).toBe(0);
    });

    it('アクティブ会話への new_dm_message では unreadCount がインクリメントされない', async () => {
      const onConversationsChange = vi.fn();
      render(
        <DmConversationList
          conversations={[makeConversation({ id: 1 })]}
          activeConvId={1}
          currentUserId={1}
          onSelectConversation={vi.fn()}
          onNewDm={vi.fn()}
          onConversationsChange={onConversationsChange}
        />,
      );

      // アクティブ会話への self message
      const newMsg = makeMessage({ conversationId: 1, senderId: 2 });
      await act(async () => {
        emitSocket('new_dm_message', newMsg);
      });

      // lastMessage 更新は呼ばれるが、unreadCount 更新のアップデーターは呼ばれない
      // onConversationsChange は lastMessage更新のために呼ばれているはず
      const calls = onConversationsChange.mock.calls;
      // 各callはupdater関数。unreadCountをインクリメントするupdaterが呼ばれていないことを確認
      // アクティブ会話のメッセージの場合は1回 (lastMessageのみ)
      // 非アクティブ会話の場合は2回 (unreadCount + lastMessage)
      expect(calls.length).toBe(1); // lastMessage更新のみ
    });
  });
});
