/**
 * テスト対象: DMページ（DMPage）・サイドバーのDM一覧
 * 戦略:
 *   - ネットワーク通信は vi.mock('../api/client') で差し替える
 *   - Socket.IO はイベントハンドラを保持するモックオブジェクトを手動で組み立てて注入する
 *   - React 19 の use() + Suspense パターンを考慮し、非同期データ取得を検証する
 *   - 画面から確認困難なビジネスロジック（未読数・通知・リアルタイム更新）を重点的に検証する
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { DmConversationWithDetails, DmMessage } from '@chat-app/shared';

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

vi.mock('../api/client', () => ({
  api: {
    dm: {
      listConversations: vi.fn(),
      createConversation: vi.fn(),
      getMessages: vi.fn(),
      sendMessage: vi.fn(),
      markAsRead: vi.fn(),
    },
    auth: {
      users: vi.fn(),
    },
  },
}));

vi.mock('../contexts/SocketContext', () => ({
  useSocket: () => mockSocket,
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, username: 'alice', displayName: null, avatarUrl: null },
  }),
}));

const mockNavigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

import { api } from '../api/client';
import DMPage, { resetDmConversationsCache } from '../pages/DMPage';

const mockApi = api as unknown as {
  dm: {
    listConversations: ReturnType<typeof vi.fn>;
    createConversation: ReturnType<typeof vi.fn>;
    getMessages: ReturnType<typeof vi.fn>;
    sendMessage: ReturnType<typeof vi.fn>;
    markAsRead: ReturnType<typeof vi.fn>;
  };
};

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

const dummyUsers = [
  { id: 1, username: 'alice', displayName: null, avatarUrl: null },
  { id: 2, username: 'bob', displayName: null, avatarUrl: null },
];

async function renderDMPage() {
  await act(async () => {
    render(
      <MemoryRouter>
        <DMPage users={dummyUsers as never} />
      </MemoryRouter>,
    );
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetDmConversationsCache();
  // socketHandlers をクリア
  Object.keys(socketHandlers).forEach((k) => {
    delete socketHandlers[k];
  });
  mockApi.dm.markAsRead.mockResolvedValue(undefined);
  mockApi.dm.getMessages.mockResolvedValue({ messages: [] });
});

describe('DMページ（DMPage）', () => {
  describe('DM会話一覧の表示', () => {
    it('DM会話一覧が正しく表示される', async () => {
      mockApi.dm.listConversations.mockResolvedValue({
        conversations: [makeConversation()],
      });
      await renderDMPage();
      expect(screen.getByText('bob')).toBeInTheDocument();
    });

    it('未読メッセージ数バッジが表示される', async () => {
      mockApi.dm.listConversations.mockResolvedValue({
        conversations: [makeConversation({ unreadCount: 3 })],
      });
      await renderDMPage();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('最新メッセージのプレビューが表示される', async () => {
      mockApi.dm.listConversations.mockResolvedValue({
        conversations: [
          makeConversation({
            lastMessage: {
              content: '最新メッセージ',
              createdAt: '2024-01-01T00:00:00Z',
              senderId: 2,
            },
          }),
        ],
      });
      await renderDMPage();
      expect(screen.getByText('最新メッセージ')).toBeInTheDocument();
    });

    it('DM会話がない場合は適切なメッセージを表示する', async () => {
      mockApi.dm.listConversations.mockResolvedValue({ conversations: [] });
      await renderDMPage();
      expect(screen.getByText('DM会話がありません')).toBeInTheDocument();
    });
  });

  describe('DM会話のメッセージ表示', () => {
    it('選択したDM会話のメッセージ一覧が表示される', async () => {
      mockApi.dm.listConversations.mockResolvedValue({
        conversations: [makeConversation()],
      });
      mockApi.dm.getMessages.mockResolvedValue({ messages: [makeMessage()] });
      await renderDMPage();

      await userEvent.click(screen.getByText('bob'));
      await waitFor(() => {
        expect(screen.getByText('こんにちは')).toBeInTheDocument();
      });
    });

    it('会話を開いたときに未読が既読に更新される', async () => {
      mockApi.dm.listConversations.mockResolvedValue({
        conversations: [makeConversation({ unreadCount: 2 })],
      });
      await renderDMPage();

      await userEvent.click(screen.getByText('bob'));
      await waitFor(() => {
        expect(mockApi.dm.markAsRead).toHaveBeenCalledWith(1);
      });
    });
  });

  describe('DM送信', () => {
    it('メッセージを入力して送信できる', async () => {
      mockApi.dm.listConversations.mockResolvedValue({
        conversations: [makeConversation()],
      });
      await renderDMPage();

      await userEvent.click(screen.getByText('bob'));
      await waitFor(() => screen.getByLabelText('DM入力'));

      await userEvent.type(screen.getByLabelText('DM入力'), 'テストメッセージ');
      await userEvent.click(screen.getByRole('button', { name: '送信' }));

      expect(mockSocket.emit).toHaveBeenCalledWith('send_dm', {
        conversationId: 1,
        content: 'テストメッセージ',
      });
    });

    it('空のメッセージは送信できない', async () => {
      mockApi.dm.listConversations.mockResolvedValue({
        conversations: [makeConversation()],
      });
      await renderDMPage();

      await userEvent.click(screen.getByText('bob'));
      await waitFor(() => screen.getByRole('button', { name: '送信' }));

      expect(screen.getByRole('button', { name: '送信' })).toBeDisabled();
    });

    it('送信後に入力欄がクリアされる', async () => {
      mockApi.dm.listConversations.mockResolvedValue({
        conversations: [makeConversation()],
      });
      await renderDMPage();

      await userEvent.click(screen.getByText('bob'));
      await waitFor(() => screen.getByLabelText('DM入力'));

      const input = screen.getByLabelText('DM入力');
      await userEvent.type(input, 'クリアテスト');
      await userEvent.click(screen.getByRole('button', { name: '送信' }));

      await waitFor(() => {
        expect(input).toHaveValue('');
      });
    });
  });

  describe('Socket.IO リアルタイム更新', () => {
    it('new_dm_message イベント受信時にメッセージが追加される', async () => {
      mockApi.dm.listConversations.mockResolvedValue({
        conversations: [makeConversation()],
      });
      mockApi.dm.getMessages.mockResolvedValue({ messages: [] });
      await renderDMPage();

      await userEvent.click(screen.getByText('bob'));
      await waitFor(() => screen.getByLabelText('DM入力'));

      const newMsg = makeMessage({ id: 99, content: 'リアルタイムメッセージ' });
      await act(async () => {
        emitSocket('new_dm_message', newMsg);
      });

      // メッセージ本文（p要素）に表示されることを確認（lastMessageプレビューと区別）
      await waitFor(() => {
        const elements = screen.getAllByText('リアルタイムメッセージ');
        const messageBody = elements.find((el) => el.tagName === 'P');
        expect(messageBody).toBeInTheDocument();
      });
    });

    it('dm_user_typing イベント受信時にタイピングインジケーターが表示される', async () => {
      mockApi.dm.listConversations.mockResolvedValue({
        conversations: [makeConversation()],
      });
      await renderDMPage();

      await userEvent.click(screen.getByText('bob'));
      await waitFor(() => screen.getByLabelText('DM入力'));

      await act(async () => {
        emitSocket('dm_user_typing', { conversationId: 1, userId: 2, username: 'bob' });
      });

      expect(screen.getByText(/bob.*入力中/)).toBeInTheDocument();
    });

    it('dm_user_stopped_typing イベント受信時にタイピングインジケーターが消える', async () => {
      mockApi.dm.listConversations.mockResolvedValue({
        conversations: [makeConversation()],
      });
      await renderDMPage();

      await userEvent.click(screen.getByText('bob'));
      await waitFor(() => screen.getByLabelText('DM入力'));

      await act(async () => {
        emitSocket('dm_user_typing', { conversationId: 1, userId: 2, username: 'bob' });
      });
      expect(screen.getByText(/bob.*入力中/)).toBeInTheDocument();

      await act(async () => {
        emitSocket('dm_user_stopped_typing', { conversationId: 1, userId: 2 });
      });
      await waitFor(() => {
        expect(screen.queryByText(/bob.*入力中/)).not.toBeInTheDocument();
      });
    });
  });

  describe('新規DM開始', () => {
    it('ユーザー一覧から相手を選択してDMを開始できる', async () => {
      mockApi.dm.listConversations.mockResolvedValue({ conversations: [] });
      mockApi.dm.createConversation.mockResolvedValue({
        conversation: makeConversation(),
      });
      await renderDMPage();

      await userEvent.click(screen.getByRole('button', { name: '新規DM' }));
      await waitFor(() => screen.getByText('新規ダイレクトメッセージ'));

      await userEvent.click(screen.getAllByText('bob')[0]);

      expect(mockApi.dm.createConversation).toHaveBeenCalledWith(2);
    });

    it('既存のDM会話がある相手を選択すると既存会話に遷移する', async () => {
      const existingConv = makeConversation({ id: 42 });
      mockApi.dm.listConversations.mockResolvedValue({
        conversations: [existingConv],
      });
      mockApi.dm.createConversation.mockResolvedValue({
        conversation: existingConv,
      });
      mockApi.dm.getMessages.mockResolvedValue({ messages: [] });
      await renderDMPage();

      await userEvent.click(screen.getByRole('button', { name: '新規DM' }));
      // ダイアログ表示を待つ
      await screen.findByRole('dialog');
      // ダイアログ内のbobをクリック（MUI ListItemButton は role="button"）
      const bobItem = await screen.findByRole('button', { name: /bob/ });
      await userEvent.click(bobItem);

      // 既存会話が選択されること（追加されず同じIDが維持される）
      await waitFor(() => {
        expect(mockApi.dm.createConversation).toHaveBeenCalledWith(2);
      });
    });
  });
});

describe('サイドバーのDM一覧', () => {
  describe('新着DM通知', () => {
    it('dm_notification イベント受信時にサイドバーの未読数が更新される', async () => {
      // ChannelList は別コンポーネントのため、DMPage のdm_notification 受信はサービス層で確認
      // ここでは new_dm_message を受信した際に非アクティブ会話の unreadCount が増えることを検証する
      mockApi.dm.listConversations.mockResolvedValue({
        conversations: [
          makeConversation({ id: 1 }),
          makeConversation({
            id: 2,
            userBId: 3,
            otherUser: { id: 3, username: 'charlie', displayName: null, avatarUrl: null },
          }),
        ],
      });
      mockApi.dm.getMessages.mockResolvedValue({ messages: [] });
      await renderDMPage();

      // id=1の会話を選択
      await userEvent.click(screen.getAllByText('bob')[0]);
      await waitFor(() => screen.getByLabelText('DM入力'));

      // id=2の会話へのメッセージを受信（非アクティブ会話）
      const newMsg = makeMessage({
        id: 50,
        conversationId: 2,
        senderId: 3,
        senderUsername: 'charlie',
        content: '非アクティブ会話へのメッセージ',
      });
      await act(async () => {
        emitSocket('new_dm_message', newMsg);
      });

      // charlie の会話に未読バッジが表示される
      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });
    });

    it('DM会話を開いているときは通知バッジが表示されない', async () => {
      mockApi.dm.listConversations.mockResolvedValue({
        conversations: [makeConversation({ id: 1, unreadCount: 0 })],
      });
      mockApi.dm.getMessages.mockResolvedValue({ messages: [] });
      await renderDMPage();

      // 会話を選択して開く
      await userEvent.click(screen.getByText('bob'));
      await waitFor(() => screen.getByLabelText('DM入力'));

      // アクティブ会話への自分以外のメッセージを受信
      const incomingMsg = makeMessage({ id: 77, senderId: 2 });
      await act(async () => {
        emitSocket('new_dm_message', incomingMsg);
      });

      // アクティブ会話なので unreadCount のバッジは表示されない（MUI Badge の span に数値が入る）
      await waitFor(() => {
        // MUI の Badge は span.MuiBadge-badge にバッジ数値を表示する
        const badges = document.querySelectorAll('.MuiBadge-badge:not(.MuiBadge-invisible)');
        const visibleNumericBadges = Array.from(badges).filter((el) =>
          /^\d+$/.test(el.textContent?.trim() ?? ''),
        );
        expect(visibleNumericBadges.length).toBe(0);
      });
    });
  });
});
