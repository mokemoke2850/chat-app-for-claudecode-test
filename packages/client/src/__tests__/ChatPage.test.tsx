/**
 * pages/ChatPage.tsx のユニットテスト
 *
 * テスト対象:
 *   - URL クエリパラメータ ?channel=X によるチャンネル初期選択
 *   - 検索モードの切り替え（クエリ空 + フィルターのみ・フォーカス）
 * 戦略:
 *   - 子コンポーネント（AppLayout, ChannelList, MessageList, RichEditor）はすべてスタブ化
 *   - useMessages / useSocket もモックで差し替える
 *   - window.location.search を設定してマウント時の activeChannelId を検証する
 *   - api.messages.search はモック関数 — 引数履歴を検証する
 *   - AppLayout スタブは onSearchFocus / onSearchChange を露出して操作できるようにする
 *   - SearchFilterPanel スタブは onFilterChange を露出してフィルター変更をシミュレートする
 */

import { render, waitFor, act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, useLocation, useSearchParams } from 'react-router-dom';
import ChatPage from '../pages/ChatPage';

// Step 8b: 現在の URL を data-testid で表示する補助コンポーネント
function LocationDisplay() {
  const loc = useLocation();
  return <div data-testid="location-display">{loc.pathname + loc.search}</div>;
}

// Step 8b: useSearchParams 化に伴い MemoryRouter ラップを共通ヘルパー化
function renderChatPage(initialPath: string = '/chat') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <ChatPage users={[]} />
    </MemoryRouter>,
  );
}

// ChannelList は activeChannelId を受け取るスタブ — 呼び出し引数を後で検証する
const MockChannelList = vi.hoisted(() => vi.fn(() => null));

vi.mock('../components/Channel/ChannelList', () => ({ default: MockChannelList }));

// Step 3c: SidebarDmList を ChatPage が sidebar 内に組み込むようになったため、
// ChatPage.test.tsx 側ではスタブ化して api.dm.listConversations への依存を回避する。
// SidebarDmList 自体の挙動は SidebarDmList.test.tsx で検証する。
vi.mock('../components/Layout/SidebarDmList', () => ({ default: () => null }));

// AppLayout スタブ — Step 7a で検索 props は撤去されたため sidebar / children / rightPane のみ
vi.mock('../components/Layout/AppLayout', async () => {
  const React = (await import('react')) as typeof import('react');
  return {
    default: ({
      sidebar,
      children,
      rightPane,
    }: {
      sidebar: React.ReactNode;
      children: React.ReactNode;
      rightPane?: React.ReactNode;
    }) => React.createElement(React.Fragment, null, sidebar, children, rightPane),
  };
});

// ContextRail スタブ — open 状態を data-testid で確認するため簡易表示にする (Step 5a)
vi.mock('../components/Channel/ContextRail', () => ({
  default: () => <div data-testid="context-rail-stub" />,
}));

vi.mock('../components/Chat/MessageList', () => ({ default: () => null }));
// RichEditor を props キャプチャ可能なモックに差し替え（#113 で disabled prop を検証する）
const MockRichEditor = vi.hoisted(() => vi.fn(() => null));
vi.mock('../components/Chat/RichEditor', () => ({ default: MockRichEditor }));

// Step 7a: 検索 UI は SearchPage に分離したため SearchFilterPanel / SearchResults のスタブは不要
vi.mock('../components/Chat/ThreadPanel', () => ({ default: () => null }));
vi.mock('../components/Channel/ChannelTopicBar', () => ({ default: () => null }));
// Step 5b: PinnedMessages の Main 上部バー撤去確認のため呼び出しを track できるよう vi.fn にする
const MockPinnedMessages = vi.hoisted(() => vi.fn(() => null));
vi.mock('../components/Channel/PinnedMessages', () => ({ default: MockPinnedMessages }));
vi.mock('../components/Channel/ArchivedBanner', () => ({ default: () => null }));
// ScheduledMessagesDialog: open prop を data-testid で確認可能にする
vi.mock('../components/Chat/ScheduledMessagesDialog', () => ({
  default: ({ open }: { open: boolean }) =>
    open ? <div data-testid="scheduled-messages-dialog" /> : null,
}));
// ChannelFilesTab: data-testid で表示確認可能にする
vi.mock('../pages/FilesPage', () => ({
  ChannelFilesTab: () => <div data-testid="channel-files-tab" />,
}));

// Snackbar の呼び出しをテストから検証可能にする
const mockSnackbar = vi.hoisted(() => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
  showInfo: vi.fn(),
}));
vi.mock('../contexts/SnackbarContext', () => ({
  useSnackbar: () => mockSnackbar,
}));

const mockSearch = vi.hoisted(() => vi.fn().mockResolvedValue({ messages: [] }));
const mockBookmarksList = vi.hoisted(() => vi.fn().mockResolvedValue({ bookmarks: [] }));
const mockDraftsGetAll = vi.hoisted(() => vi.fn().mockResolvedValue({ drafts: [] }));
// #247 #248 ?channel 直リンク時は ChatPage が自前で channels.list() を呼んで activeChannel を埋める
const mockChannelsList = vi.hoisted(() => vi.fn().mockResolvedValue({ channels: [] }));

vi.mock('../api/client', () => ({
  api: {
    messages: { search: mockSearch },
    bookmarks: { list: mockBookmarksList },
    drafts: { getAll: mockDraftsGetAll },
    channels: { list: mockChannelsList },
  },
}));

vi.mock('../hooks/useMessages', () => ({
  useMessages: () => ({ messages: [], loading: false, loadMore: vi.fn(), refetch: vi.fn() }),
}));
vi.mock('../components/Chat/CreateEventDialog', () => ({ default: () => null }));
vi.mock('../hooks/useScheduledMessages', () => ({
  useScheduledMessages: () => ({
    promise: Promise.resolve([]),
    refresh: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    cancel: vi.fn(),
  }),
}));
// Socket モックを動的に差し替え可能にする（#117 で error / message_warning を発火させる）
const mockSocketRef = vi.hoisted(() => ({
  current: null as unknown as null | {
    on: (e: string, h: (...args: unknown[]) => void) => void;
    off: (e: string, h: (...args: unknown[]) => void) => void;
    emit: (...args: unknown[]) => void;
  },
}));
vi.mock('../contexts/SocketContext', () => ({ useSocket: () => mockSocketRef.current }));
// テストごとに role を切り替えられるよう可変モックに変更
const mockUser = vi.hoisted(() => ({
  current: { id: 1, role: 'user', isActive: true, username: 'testuser' } as {
    id: number;
    role: string;
    isActive: boolean;
    username: string;
  },
}));
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser.current }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  MockChannelList.mockImplementation(() => null);
  MockRichEditor.mockImplementation(() => null);
  mockSearch.mockResolvedValue({ messages: [] });
  mockBookmarksList.mockResolvedValue({ bookmarks: [] });
  mockChannelsList.mockResolvedValue({ channels: [] });
  // useAuth のユーザーをデフォルトにリセット
  mockUser.current = { id: 1, role: 'user', isActive: true, username: 'testuser' };
  // socket モックをデフォルトの null に戻す
  mockSocketRef.current = null;
  // location をデフォルト（クエリなし）にリセット
  Object.defineProperty(window, 'location', {
    value: { search: '', hash: '', pathname: '/', origin: 'http://localhost' },
    writable: true,
    configurable: true,
  });
});

describe('ChatPage', () => {
  describe('URL からのチャンネル初期選択', () => {
    it('?channel=X が URL に含まれるとき、マウント時にそのチャンネルが activeChannelId として選択される', async () => {
      // Step 8b: useSearchParams 化に伴い MemoryRouter initialEntries 経由で URL を設定する
      renderChatPage('/chat?channel=5');

      // useEffect 後の再レンダリングで ChannelList に activeChannelId=5 が渡されること
      await waitFor(() => {
        expect(MockChannelList).toHaveBeenLastCalledWith(
          expect.objectContaining({ activeChannelId: 5 }),
          undefined,
        );
      });
    });

    it('?channel が URL に含まれないとき、activeChannelId は null のまま', () => {
      renderChatPage();

      expect(MockChannelList).toHaveBeenLastCalledWith(
        expect.objectContaining({ activeChannelId: null }),
        undefined,
      );
    });
  });

  // Step 7a: 検索 UI は SearchPage に分離。検索系テストは SearchPage.test.tsx に移譲。

  // #113 投稿権限制御チャンネル — RichEditor の disaled 計算
  describe('投稿権限による RichEditor 無効化 (#113)', () => {
    /**
     * activeChannel を任意の postingPermission で設定するヘルパー
     * MockChannelList の onSelect コールバックを呼び出して setActiveChannel を発火させる
     */
    const selectChannelWithPermission = async (
      postingPermission: 'everyone' | 'admins' | 'readonly',
    ) => {
      const calls = MockChannelList.mock.calls as unknown as Array<
        [
          {
            onSelect: (
              id: number,
              name: string,
              channel?: {
                id: number;
                name: string;
                description: null;
                topic: null;
                createdBy: number;
                isPrivate: boolean;
                postingPermission: 'everyone' | 'admins' | 'readonly';
                isArchived: boolean;
                isRecommended: boolean;
                createdAt: string;
                unreadCount: number;
              },
            ) => void;
          },
        ]
      >;
      const props = calls[calls.length - 1][0];
      await act(async () => {
        props.onSelect(7, 'general', {
          id: 7,
          name: 'general',
          description: null,
          topic: null,
          createdBy: 99,
          isPrivate: false,
          postingPermission,
          isArchived: false,
          isRecommended: false,
          createdAt: '2024-01-01T00:00:00Z',
          unreadCount: 0,
        });
      });
    };

    /** MockRichEditor に最後に渡された disabled prop を取得 */
    const getLastDisabled = (): boolean | undefined => {
      const calls = MockRichEditor.mock.calls as unknown as Array<[{ disabled?: boolean }]>;
      return calls[calls.length - 1]?.[0]?.disabled;
    };

    it('postingPermission が "everyone" のとき、RichEditor は disabled=false で渡される', async () => {
      renderChatPage();
      await selectChannelWithPermission('everyone');

      expect(getLastDisabled()).toBe(false);
    });

    it('postingPermission が "readonly" のとき、RichEditor に disabled=true で渡される', async () => {
      renderChatPage();
      await selectChannelWithPermission('readonly');

      expect(getLastDisabled()).toBe(true);
    });

    it('postingPermission が "admins" のとき、一般ユーザー（role=user）には disabled=true で渡される', async () => {
      mockUser.current = { id: 1, role: 'user', isActive: true, username: 'testuser' };
      renderChatPage();
      await selectChannelWithPermission('admins');

      expect(getLastDisabled()).toBe(true);
    });

    it('postingPermission が "admins" のとき、管理者（role=admin）には disabled=false で渡される', async () => {
      mockUser.current = { id: 1, role: 'admin', isActive: true, username: 'adminuser' };
      renderChatPage();
      await selectChannelWithPermission('admins');

      expect(getLastDisabled()).toBe(false);
    });
  });

  // #154 コンパクトヘッダー — 1行ヘッダー化 / ファイル切替アイコン
  describe('コンパクトヘッダー (#154)', () => {
    /** チャンネルを選択するヘルパー */
    // #247 #248 修正後はヘッダー名が activeChannel.name から派生するため、
    // テストでも実装と同じ第3引数 channel を必ず渡す（onSelect の正規シグネチャに合わせる）。
    const selectChannel = async () => {
      const calls = MockChannelList.mock.calls as unknown as Array<
        [
          {
            onSelect: (
              id: number,
              name: string,
              channel?: {
                id: number;
                name: string;
                description: null;
                topic: null;
                createdBy: number;
                isPrivate: boolean;
                postingPermission: 'everyone' | 'admins' | 'readonly';
                isArchived: boolean;
                isRecommended: boolean;
                createdAt: string;
                unreadCount: number;
              },
            ) => void;
          },
        ]
      >;
      const props = calls[calls.length - 1][0];
      await act(async () => {
        props.onSelect(1, 'general', {
          id: 1,
          name: 'general',
          description: null,
          topic: null,
          createdBy: 99,
          isPrivate: false,
          postingPermission: 'everyone',
          isArchived: false,
          isRecommended: false,
          createdAt: '2024-01-01T00:00:00Z',
          unreadCount: 0,
        });
      });
    };

    describe('1行ヘッダーのレイアウト', () => {
      it('チャンネル選択時にチャンネル名・トピック・アクションアイコンが同一行に収まる', async () => {
        renderChatPage();
        await selectChannel();

        // ヘッダー行に チャンネル名・ファイル切替アイコン・予約送信アイコンが存在する
        expect(screen.getByText('# general')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /ファイル一覧/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /予約送信/i })).toBeInTheDocument();
      });

      it('チャンネル未選択時にはヘッダー領域が表示されない', () => {
        renderChatPage();

        // チャンネル選択前はチャンネル名もアイコンも表示されない
        expect(screen.queryByRole('button', { name: /ファイル一覧/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /予約送信/i })).not.toBeInTheDocument();
      });
    });

    describe('ファイル切替アイコンの動作', () => {
      it('初期状態でメッセージ一覧が表示され、ファイル一覧は表示されない', async () => {
        renderChatPage();
        await selectChannel();

        // ChannelFilesTab は表示されない
        expect(screen.queryByTestId('channel-files-tab')).not.toBeInTheDocument();
      });

      it('ファイル切替アイコンをクリックするとファイル一覧が表示される', async () => {
        const user = userEvent.setup();
        renderChatPage();
        await selectChannel();

        await user.click(screen.getByRole('button', { name: /ファイル一覧/i }));

        expect(screen.getByTestId('channel-files-tab')).toBeInTheDocument();
      });

      it('ファイル一覧表示中に再度アイコンをクリックするとメッセージ一覧に戻る', async () => {
        const user = userEvent.setup();
        renderChatPage();
        await selectChannel();

        // 1回目クリック → ファイル表示
        await user.click(screen.getByRole('button', { name: /ファイル一覧/i }));
        expect(screen.getByTestId('channel-files-tab')).toBeInTheDocument();

        // 2回目クリック → メッセージ表示に戻る
        await user.click(screen.getByRole('button', { name: /ファイル一覧/i }));
        expect(screen.queryByTestId('channel-files-tab')).not.toBeInTheDocument();
      });

      it('ファイル表示中はアイコンが選択状態のスタイルで表示される', async () => {
        const user = userEvent.setup();
        renderChatPage();
        await selectChannel();

        const fileToggleBtn = screen.getByRole('button', { name: /ファイル一覧/i });
        // クリック前: 選択状態でない（data-active 属性なし）
        expect(fileToggleBtn).not.toHaveAttribute('data-active', 'true');

        await user.click(fileToggleBtn);

        // クリック後: 選択状態（data-active 属性あり）
        expect(screen.getByRole('button', { name: /ファイル一覧/i })).toHaveAttribute(
          'data-active',
          'true',
        );
      });
    });

    describe('既存ダイアログ動作の維持', () => {
      it('予約送信アイコンをクリックすると ScheduledMessagesDialog が開く', async () => {
        const user = userEvent.setup();
        renderChatPage();
        await selectChannel();

        // クリック前: ダイアログ非表示
        expect(screen.queryByTestId('scheduled-messages-dialog')).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /予約送信/i }));

        // クリック後: ダイアログ表示
        expect(screen.getByTestId('scheduled-messages-dialog')).toBeInTheDocument();
      });
    });
  });

  // #117 NG ワード / 添付制限 — Socket からの block / warn 受信時 UI
  describe('NG ワード警告/ブロック (#117)', () => {
    /** イベントハンドラを記録する socket モックをセット */
    function installSocket() {
      const handlers: Record<string, (...args: unknown[]) => void> = {};
      mockSocketRef.current = {
        on: (event: string, h: (...args: unknown[]) => void) => {
          handlers[event] = h;
        },
        off: () => undefined,
        emit: () => undefined,
      };
      return handlers;
    }

    it('Socket "error" イベントを受信したらスナックバーでエラー通知が出る', async () => {
      const handlers = installSocket();
      renderChatPage();

      await waitFor(() => expect(handlers.error).toBeDefined());
      // 実装側 (socket/messageHandler.ts) は 4xx 時にサーバーのエラーメッセージをそのまま転送する。
      // NG ワードによる block は 'NGワードは投稿できません' になる。
      handlers.error('NGワードは投稿できません');

      // 受信した文字列がそのまま showError に渡されること
      expect(mockSnackbar.showError).toHaveBeenCalledWith('NGワードは投稿できません');
    });

    it('Socket "message_warning" イベントを受信したらスナックバーで警告通知が出る', async () => {
      const handlers = installSocket();
      renderChatPage();

      await waitFor(() => expect(handlers.message_warning).toBeDefined());
      handlers.message_warning({
        matchedPattern: 'caution',
        message: '投稿に注意ワードが含まれています: caution',
      });

      expect(mockSnackbar.showInfo).toHaveBeenCalledWith(
        '投稿に注意ワードが含まれています: caution',
      );
    });
  });

  describe('ContextRail トグル + 永続化 (Step 5a)', () => {
    beforeEach(async () => {
      const React = await import('react');
      window.localStorage.clear();
      // チャンネル選択状態にしておく (panelR ボタンはチャンネル選択時のみ表示する想定)
      Object.defineProperty(window, 'location', {
        value: { search: '?channel=1', hash: '', pathname: '/', origin: 'http://localhost' },
        writable: true,
        configurable: true,
      });
      // ChatPage は ChannelList の onSelect 経由でしか activeChannel (Channel オブジェクト) を
      // セットしないため、テスト内では MockChannelList が即座に onSelect を発火させて
      // activeChannel をセットする。
      const mockChannel = {
        id: 1,
        name: 'general',
        description: null,
        topic: null,
        createdBy: 1,
        createdAt: '2024-01-01T00:00:00Z',
        isPrivate: false,
        postingPermission: 'everyone' as const,
        unreadCount: 0,
        isArchived: false,
      };
      // MockChannelList は vi.fn(() => null) で初期化されているため、引数を取る関数を
      // mockImplementation で渡すと TS シグネチャ不一致になる。テスト用なので抑制する。
      MockChannelList.mockImplementation(
        // @ts-expect-error mockImplementation の引数シグネチャを差し替える (テスト専用)
        ({
          onSelect,
        }: {
          onSelect?: (id: number, name: string, channel: typeof mockChannel) => void;
        }) => {
          // onSelect は ChatPage で inline 関数として渡されるためレンダー毎に新しい参照になる。
          // 依存配列に入れると無限ループするので mount 時のみ発火させる。

          React.useEffect(() => {
            onSelect?.(1, 'general', mockChannel);
          }, []);
          return null;
        },
      );
    });

    it('panelR トグルボタン (aria-label="コンテキストペインを開く") をクリックすると ContextRail が表示される', async () => {
      renderChatPage();
      expect(screen.queryByTestId('context-rail-stub')).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'コンテキストペインを開く' }));
      expect(screen.getByTestId('context-rail-stub')).toBeInTheDocument();
    });

    it('再度クリックすると ContextRail が非表示になる', async () => {
      renderChatPage();
      const button = screen.getByRole('button', { name: 'コンテキストペインを開く' });
      await userEvent.click(button);
      expect(screen.getByTestId('context-rail-stub')).toBeInTheDocument();
      await userEvent.click(button);
      expect(screen.queryByTestId('context-rail-stub')).not.toBeInTheDocument();
    });

    it('開閉状態が localStorage["contextRail.open"] に保存される', async () => {
      renderChatPage();
      await userEvent.click(screen.getByRole('button', { name: 'コンテキストペインを開く' }));
      await waitFor(() => {
        expect(window.localStorage.getItem('contextRail.open')).toBe('true');
      });
    });

    it('初期表示時 localStorage["contextRail.open"] が "true" のとき ContextRail が開いた状態で復元される', () => {
      window.localStorage.setItem('contextRail.open', 'true');
      renderChatPage();
      expect(screen.getByTestId('context-rail-stub')).toBeInTheDocument();
    });
  });

  describe('PinnedMessages 上部バー撤去 (Step 5b)', () => {
    beforeEach(() => {
      // チャンネル選択済みの状態にする (PinnedMessages はチャンネル選択時のみ Main 上部に描画されていた)
      Object.defineProperty(window, 'location', {
        value: { search: '?channel=1', hash: '', pathname: '/', origin: 'http://localhost' },
        writable: true,
        configurable: true,
      });
    });

    it('ChatPage の Main エリアに PinnedMessages の上部バーが描画されない (ContextRail 経由のみで表示)', () => {
      // ContextRail は vi.mock でスタブ化されているため、ChatPage 直接の呼び出しのみ MockPinnedMessages がカウントする
      renderChatPage();
      expect(MockPinnedMessages).not.toHaveBeenCalled();
    });
  });

  // Step 8b: URL 更新 + チャット未選択時 UX (TODO #18 解消)
  describe('Step 8b: URL 更新 + チャット未選択時 UX', () => {
    it('チャンネル選択時に URL の ?channel=X が push 更新される', async () => {
      render(
        <MemoryRouter initialEntries={['/chat']}>
          <ChatPage users={[]} />
          <LocationDisplay />
        </MemoryRouter>,
      );
      // ChannelList stub に渡された onSelect を直接呼ぶ (MockChannelList の最終呼び出し props を使用)
      const calls = MockChannelList.mock.calls as unknown as Array<
        [
          {
            onSelect: (id: number, name: string, channel?: unknown) => void;
          },
        ]
      >;
      await act(async () => {
        calls[calls.length - 1][0].onSelect(7, 'general');
      });
      expect(screen.getByTestId('location-display').textContent).toContain('/chat?channel=7');
    });

    it('URL の ?channel=X 変更で activeChannelId が同期される', async () => {
      render(
        <MemoryRouter initialEntries={['/chat?channel=5']}>
          <ChatPage users={[]} />
        </MemoryRouter>,
      );
      await waitFor(() => {
        expect(MockChannelList).toHaveBeenLastCalledWith(
          expect.objectContaining({ activeChannelId: 5 }),
          undefined,
        );
      });
    });

    it('activeChannelId === null のときメイン領域に案内文 (「チャンネルを選択してください」等) が表示される', async () => {
      render(
        <MemoryRouter initialEntries={['/chat']}>
          <ChatPage users={[]} />
        </MemoryRouter>,
      );
      expect(screen.getByText(/チャンネルを選択/)).toBeInTheDocument();
    });
  });

  // #247 #248 ?channel=N URL 直リンク時のチャンネル情報未取得バグ修正
  // - #247: ヘッダーが "# " だけになる (activeChannelName 未設定)
  // - #248: 入力欄が disabled になる (activeChannel 未設定で canPostToActiveChannel === false)
  // 共通: ChannelList の onSelect を経由しないため activeChannel / activeChannelName が空になる
  describe('?channel 直リンク時のチャンネル情報補完 (#247 #248)', () => {
    /** テスト用 Channel ファクトリ（必要最低限の Channel オブジェクトを生成） */
    const makeChannel = (
      overrides: Partial<{
        id: number;
        name: string;
        postingPermission: 'everyone' | 'admins' | 'readonly';
        isArchived: boolean;
      }>,
    ) => ({
      id: 1,
      name: 'general',
      description: null,
      topic: null,
      createdBy: 99,
      isPrivate: false,
      postingPermission: 'everyone' as 'everyone' | 'admins' | 'readonly',
      isArchived: false,
      isRecommended: false,
      createdAt: '2024-01-01T00:00:00Z',
      unreadCount: 0,
      mentionCount: 0,
      ...overrides,
    });

    /** MockRichEditor に最後に渡された disabled prop を取得 */
    const getLastDisabled = (): boolean | undefined => {
      const calls = MockRichEditor.mock.calls as unknown as Array<[{ disabled?: boolean }]>;
      return calls[calls.length - 1]?.[0]?.disabled;
    };

    describe('ヘッダー表示 (#247)', () => {
      it('?channel=N で直接マウントしたとき、ヘッダーにチャンネル名が表示される', async () => {
        mockChannelsList.mockResolvedValue({
          channels: [makeChannel({ id: 5, name: 'random', postingPermission: 'everyone' })],
        });

        renderChatPage('/chat?channel=5');

        // チャンネル取得後にヘッダーが "# random" になること
        await waitFor(() => {
          expect(screen.getByText('# random')).toBeInTheDocument();
        });
      });
    });

    describe('入力欄 disabled 計算 (#248)', () => {
      it('?channel=N で直接マウントしたとき、postingPermission=everyone のチャンネルでは RichEditor が disabled=false で渡される', async () => {
        mockChannelsList.mockResolvedValue({
          channels: [makeChannel({ id: 5, name: 'random', postingPermission: 'everyone' })],
        });

        renderChatPage('/chat?channel=5');

        await waitFor(() => {
          expect(getLastDisabled()).toBe(false);
        });
      });

      it('?channel=N で直接マウントしたとき、postingPermission=readonly のチャンネルでは RichEditor が disabled=true で渡される', async () => {
        mockChannelsList.mockResolvedValue({
          channels: [makeChannel({ id: 5, name: 'announce', postingPermission: 'readonly' })],
        });

        renderChatPage('/chat?channel=5');

        await waitFor(() => {
          expect(getLastDisabled()).toBe(true);
        });
      });

      it('?channel=N で直接マウントしたとき、postingPermission=admins のチャンネルでは一般ユーザーには disabled=true で渡される', async () => {
        mockUser.current = { id: 1, role: 'user', isActive: true, username: 'testuser' };
        mockChannelsList.mockResolvedValue({
          channels: [makeChannel({ id: 5, name: 'admin-only', postingPermission: 'admins' })],
        });

        renderChatPage('/chat?channel=5');

        await waitFor(() => {
          expect(getLastDisabled()).toBe(true);
        });
      });

      it('?channel=N で直接マウントしたとき、postingPermission=admins のチャンネルでは管理者には disabled=false で渡される', async () => {
        mockUser.current = { id: 1, role: 'admin', isActive: true, username: 'adminuser' };
        mockChannelsList.mockResolvedValue({
          channels: [makeChannel({ id: 5, name: 'admin-only', postingPermission: 'admins' })],
        });

        renderChatPage('/chat?channel=5');

        await waitFor(() => {
          expect(getLastDisabled()).toBe(false);
        });
      });
    });

    describe('URL 変更時の同期', () => {
      it('URL を ?channel=1 から ?channel=2 へ切り替えると、ヘッダー名と postingPermission がチャンネル2 のものに反映される', async () => {
        mockChannelsList.mockResolvedValue({
          channels: [
            makeChannel({ id: 1, name: 'one', postingPermission: 'everyone' }),
            makeChannel({ id: 2, name: 'two', postingPermission: 'readonly' }),
          ],
        });

        // 初期 URL は ?channel=1。LocationDisplay 経由で URL 変更を観察できるように
        // RouterFixture コンポーネントを内側に置き、テストから navigate を呼び出す。
        function NavBtn() {
          // 内部で useSearchParams を呼び、ボタン押下で ?channel=2 に書き換える
          const [, setSearchParams] = useSearchParams();
          return (
            <button
              type="button"
              data-testid="goto-2"
              onClick={() => setSearchParams({ channel: '2' })}
            >
              goto-2
            </button>
          );
        }

        render(
          <MemoryRouter initialEntries={['/chat?channel=1']}>
            <ChatPage users={[]} />
            <NavBtn />
          </MemoryRouter>,
        );

        // 1: 最初は channel=1（everyone, "# one"）
        await waitFor(() => {
          expect(screen.getByText('# one')).toBeInTheDocument();
        });
        await waitFor(() => {
          expect(getLastDisabled()).toBe(false);
        });

        // 2: ボタン押下で URL を ?channel=2 に切り替える
        await userEvent.click(screen.getByTestId('goto-2'));

        // 3: 切替後は "# two"（readonly, disabled=true）
        await waitFor(() => {
          expect(screen.getByText('# two')).toBeInTheDocument();
        });
        await waitFor(() => {
          expect(getLastDisabled()).toBe(true);
        });
      });

      it('?channel=N の状態から channel パラメータを除いた URL に変わると、activeChannel と activeChannelName がリセットされ案内文が表示される', async () => {
        mockChannelsList.mockResolvedValue({
          channels: [makeChannel({ id: 5, name: 'random', postingPermission: 'everyone' })],
        });

        function ClearBtn() {
          const [, setSearchParams] = useSearchParams();
          return (
            <button type="button" data-testid="clear-channel" onClick={() => setSearchParams({})}>
              clear
            </button>
          );
        }

        render(
          <MemoryRouter initialEntries={['/chat?channel=5']}>
            <ChatPage users={[]} />
            <ClearBtn />
          </MemoryRouter>,
        );

        // チャンネル選択中: ヘッダーが表示される
        await waitFor(() => {
          expect(screen.getByText('# random')).toBeInTheDocument();
        });

        // URL から channel パラメータを除去
        await userEvent.click(screen.getByTestId('clear-channel'));

        // 案内文が表示される
        await waitFor(() => {
          expect(screen.getByText(/チャンネルを選択/)).toBeInTheDocument();
        });
        // ヘッダーは消える
        expect(screen.queryByText('# random')).not.toBeInTheDocument();
      });
    });
  });

  // #317 チャンネル未選択時の次アクション CTA
  describe('チャンネル未選択時の次アクション CTA (#317)', () => {
    describe('最近開いたチャンネル', () => {
      it.todo('直近に開いたチャンネルが最大5件リストで表示される');
      it.todo('各チャンネル名をクリックするとそのチャンネルが選択される（?channel=X に遷移する）');
      it.todo('履歴が1件もない場合は「最近開いたチャンネル」セクションが表示されない');
    });

    describe('未読のあるチャンネル', () => {
      it.todo('unreadCount > 0 のチャンネルが「未読のあるチャンネル」セクションに表示される');
      it.todo('各チャンネル名をクリックするとそのチャンネルが選択される（?channel=X に遷移する）');
      it.todo('未読チャンネルが1件もない場合は「未読のあるチャンネル」セクションが表示されない');
    });

    describe('チャンネル作成ボタン', () => {
      it.todo('「チャンネルを作成」ボタンが空状態に表示される');
      it.todo(
        'ボタンをクリックするとチャンネル作成フロー（ChannelList の作成ダイアログ等）へ遷移する',
      );
    });

    describe('チャンネル選択時の非表示', () => {
      it.todo('チャンネルを選択すると CTA エリア全体が表示されなくなる');
    });
  });
});
