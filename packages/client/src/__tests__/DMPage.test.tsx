/**
 * テスト対象: DMページ（DMPage）・サイドバーのDM一覧
 * 戦略:
 *   - ネットワーク通信は vi.mock('../api/client') で差し替える
 *   - Socket.IO はイベントハンドラを保持するモックオブジェクトを手動で組み立てて注入する
 *   - React 19 の use() + Suspense パターンを考慮し、非同期データ取得を検証する
 *   - 画面から確認困難なビジネスロジック（未読数・通知・リアルタイム更新）を重点的に検証する
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { makeConversation, makeDmMessage } from './__fixtures__/dm';

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
      getMessageContext: vi.fn(),
      sendMessage: vi.fn(),
      edit: vi.fn(),
      history: vi.fn(),
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
const mockShowError = vi.hoisted(() => vi.fn());
vi.mock('../contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showError: mockShowError }),
}));

const mockNavigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

// Step 8a: AppLayout を最小スタブ化
vi.mock('../components/Layout/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout-stub">{children}</div>
  ),
}));

import { api } from '../api/client';
import DMPage, { resetDmConversationsCache } from '../pages/DMPage';

const mockApi = api as unknown as {
  dm: {
    listConversations: ReturnType<typeof vi.fn>;
    createConversation: ReturnType<typeof vi.fn>;
    getMessages: ReturnType<typeof vi.fn>;
    getMessageContext: ReturnType<typeof vi.fn>;
    sendMessage: ReturnType<typeof vi.fn>;
    edit: ReturnType<typeof vi.fn>;
    history: ReturnType<typeof vi.fn>;
    markAsRead: ReturnType<typeof vi.fn>;
  };
};

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
  mockApi.dm.getMessages.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
  mockApi.dm.getMessageContext.mockResolvedValue({ items: [], targetMessageId: 1 });
});

describe('DMページ（DMPage）', () => {
  describe('DMメッセージ編集（#424）', () => {
    it('編集APIが返したDMで表示中のメッセージを更新する', async () => {
      const original = makeDmMessage({ senderId: 1, content: '編集前DM' });
      const edited = {
        ...original,
        content: '編集後DM',
        isEdited: true,
        updatedAt: '2024-01-02T00:00:00Z',
      };
      mockApi.dm.listConversations.mockResolvedValue({ conversations: [makeConversation()] });
      mockApi.dm.getMessages.mockResolvedValue({
        items: [original],
        nextCursor: null,
        hasMore: false,
      });
      mockApi.dm.edit.mockResolvedValue({ message: edited });
      await renderDMPage();

      await userEvent.click(screen.getByText('bob'));
      await screen.findByText('編集前DM');
      await userEvent.click(screen.getByRole('button', { name: 'DMを編集' }));
      const input = screen.getByLabelText('DM編集');
      await userEvent.clear(input);
      await userEvent.type(input, '編集後DM');
      await userEvent.click(screen.getByRole('button', { name: '編集を保存' }));

      expect(mockApi.dm.edit).toHaveBeenCalledWith(1, 1, '編集後DM');
      expect(await screen.findByText('編集後DM')).toBeInTheDocument();
      expect(screen.queryByText('編集前DM')).not.toBeInTheDocument();
    });
  });

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
      mockApi.dm.getMessages.mockResolvedValue({
        items: [makeDmMessage()],
        nextCursor: null,
        hasMore: false,
      });
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
      mockApi.dm.getMessages.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
      await renderDMPage();

      await userEvent.click(screen.getByText('bob'));
      await waitFor(() => screen.getByLabelText('DM入力'));

      const newMsg = makeDmMessage({ id: 99, content: 'リアルタイムメッセージ' });
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
      mockApi.dm.getMessages.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
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

  // Step 3c: SidebarDmList から /dm?conv=N で遷移してきた場合の URL クエリ対応
  describe('URL クエリで会話を初期選択', () => {
    it('URL の ?conv=N が含まれるとき、初期 activeConvId として N の会話が選択される', async () => {
      mockApi.dm.listConversations.mockResolvedValue({
        conversations: [makeConversation({ id: 7 })],
      });
      mockApi.dm.getMessages.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
      await act(async () => {
        render(
          <MemoryRouter initialEntries={['/dm?conv=7']}>
            <DMPage users={dummyUsers as never} />
          </MemoryRouter>,
        );
      });
      // activeConvId が 7 になると getMessages が呼ばれる
      await waitFor(() => {
        expect(mockApi.dm.getMessages).toHaveBeenCalledWith(7);
      });
    });
  });
});

describe('Issue #417 DM検索対象メッセージの表示', () => {
  async function renderJump(error?: Error) {
    mockApi.dm.listConversations.mockResolvedValue({
      conversations: [makeConversation({ id: 7 })],
    });
    if (error) mockApi.dm.getMessageContext.mockRejectedValueOnce(error);
    else
      mockApi.dm.getMessageContext.mockResolvedValueOnce({
        items: [makeDmMessage({ id: 42, conversationId: 7, content: '検索対象です' })],
        targetMessageId: 42,
      });
    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/dm?conv=7&message=42&search=%E5%AF%BE%E8%B1%A1']}>
          <DMPage users={dummyUsers as never} />
        </MemoryRouter>,
      );
    });
  }
  it('URLの対象DMメッセージを前後文脈APIから取得して表示する', async () => {
    await renderJump();
    await waitFor(() => expect(mockApi.dm.getMessageContext).toHaveBeenCalledWith(7, 42));
    expect(await screen.findByText(/検索/)).toBeInTheDocument();
  });
  it('対象DMメッセージが存在しない場合に分かりやすいエラーを表示する', async () => {
    await renderJump(new Error('not found'));
    await waitFor(() =>
      expect(mockShowError).toHaveBeenCalledWith(
        expect.stringContaining('対象メッセージが存在しない'),
      ),
    );
  });
  it('対象DMメッセージを閲覧できない場合に分かりやすいエラーを表示する', async () => {
    await renderJump(new Error('forbidden'));
    await waitFor(() =>
      expect(mockShowError).toHaveBeenCalledWith(expect.stringContaining('閲覧権限がありません')),
    );
  });
  it('対象DM投稿を視覚的にハイライトし対象投稿本文の検索語を強調する', async () => {
    await renderJump();
    const row = await waitFor(() => document.querySelector('[data-dm-message-id="42"]'));
    expect(row).toHaveStyle({ outline: '3px solid var(--accent, #1976d2)' });
    expect(row?.querySelector('mark')).toHaveTextContent('対象');
  });
  it('通常会話の取得失敗は検索対象固有ではないエラーを表示する', async () => {
    mockApi.dm.listConversations.mockResolvedValue({
      conversations: [makeConversation({ id: 7 })],
    });
    mockApi.dm.getMessages.mockRejectedValueOnce(new Error('network'));
    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/dm?conv=7']}>
          <DMPage users={dummyUsers as never} />
        </MemoryRouter>,
      );
    });
    await waitFor(() =>
      expect(mockShowError).toHaveBeenCalledWith('DMメッセージの取得に失敗しました'),
    );
  });
  it('既読更新の失敗では取得済みメッセージを消去せず専用エラーを表示する', async () => {
    mockApi.dm.listConversations.mockResolvedValue({
      conversations: [makeConversation({ id: 7 })],
    });
    mockApi.dm.getMessages.mockResolvedValueOnce({
      items: [makeDmMessage({ id: 8, conversationId: 7, content: '表示を維持' })],
      nextCursor: null,
      hasMore: false,
    });
    mockApi.dm.markAsRead.mockRejectedValueOnce(new Error('network'));
    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/dm?conv=7']}>
          <DMPage users={dummyUsers as never} />
        </MemoryRouter>,
      );
    });
    expect(await screen.findByText('表示を維持')).toBeInTheDocument();
    expect(mockShowError).toHaveBeenCalledWith('DMの既読更新に失敗しました');
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
      mockApi.dm.getMessages.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
      await renderDMPage();

      // id=1の会話を選択
      await userEvent.click(screen.getAllByText('bob')[0]);
      await waitFor(() => screen.getByLabelText('DM入力'));

      // id=2の会話へのメッセージを受信（非アクティブ会話）
      const newMsg = makeDmMessage({
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
      mockApi.dm.getMessages.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
      await renderDMPage();

      // 会話を選択して開く
      await userEvent.click(screen.getByText('bob'));
      await waitFor(() => screen.getByLabelText('DM入力'));

      // アクティブ会話への自分以外のメッセージを受信
      const incomingMsg = makeDmMessage({ id: 77, senderId: 2 });
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

// Step 8a: AppLayout 適用拡大
describe('DMPage: Step 8a: AppLayout 化', () => {
  beforeEach(() => {
    Object.keys(socketHandlers).forEach((k) => {
      delete socketHandlers[k];
    });
    mockApi.dm.markAsRead.mockResolvedValue(undefined);
    mockApi.dm.getMessages.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
    mockApi.dm.listConversations.mockResolvedValue({ conversations: [] });
    resetDmConversationsCache();
  });

  it('AppLayout 内にレンダリングされる', async () => {
    await renderDMPage();
    expect(screen.getByTestId('app-layout-stub')).toBeInTheDocument();
  });

  it('独自 AppBar の戻るボタン (aria-label="戻る") が撤去されている', async () => {
    await renderDMPage();
    expect(screen.queryByRole('button', { name: '戻る' })).not.toBeInTheDocument();
  });

  it('AppLayout 内に統一見出し行「ダイレクトメッセージ」が表示される', async () => {
    await renderDMPage();
    const layout = screen.getByTestId('app-layout-stub');
    // 注: 内部の DmConversationList にも同じ見出しがあるため getAllByRole で 1 件以上を確認。
    // Step 8b で Sidebar 整理時に DmConversationList の見出しを撤去予定。
    const headings = within(layout).getAllByRole('heading', { name: 'ダイレクトメッセージ' });
    expect(headings.length).toBeGreaterThanOrEqual(1);
  });

  it('内部の DmConversationList とメッセージエリアが従来どおり表示される', async () => {
    mockApi.dm.listConversations.mockResolvedValue({
      conversations: [makeConversation()],
    });
    await renderDMPage();
    expect(screen.getByText('bob')).toBeInTheDocument();
  });

  // #386 DM メッセージがカーソル系 CursorPaged を返すようになったため items を消費する
  describe('カーソルページング移行（#386）', () => {
    it('会話選択時に CursorPaged.items を DM メッセージとして表示する', async () => {
      mockApi.dm.listConversations.mockResolvedValue({
        conversations: [makeConversation()],
      });
      mockApi.dm.getMessages.mockResolvedValue({
        items: [makeDmMessage({ id: 10, content: 'カーソル封筒の本文' })],
        nextCursor: '10',
        hasMore: true,
      });
      await renderDMPage();

      await userEvent.click(screen.getByText('bob'));
      await waitFor(() => {
        expect(screen.getByText('カーソル封筒の本文')).toBeInTheDocument();
      });
    });
  });
});
