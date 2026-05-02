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

import { render, waitFor, act, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ChatPage from '../pages/ChatPage';

// ChannelList は activeChannelId を受け取るスタブ — 呼び出し引数を後で検証する
const MockChannelList = vi.hoisted(() => vi.fn(() => null));

vi.mock('../components/Channel/ChannelList', () => ({ default: MockChannelList }));

// Step 3c: SidebarDmList を ChatPage が sidebar 内に組み込むようになったため、
// ChatPage.test.tsx 側ではスタブ化して api.dm.listConversations への依存を回避する。
// SidebarDmList 自体の挙動は SidebarDmList.test.tsx で検証する。
vi.mock('../components/Layout/SidebarDmList', () => ({ default: () => null }));

// AppLayout スタブ — searchQuery/onSearchChange/onSearchFocus を子に露出する
vi.mock('../components/Layout/AppLayout', async () => {
  const React = (await import('react')) as typeof import('react');
  return {
    default: ({
      sidebar,
      children,
      searchQuery,
      onSearchChange,
      onSearchFocus,
      onSearchBlur,
    }: {
      sidebar: React.ReactNode;
      children: React.ReactNode;
      searchQuery?: string;
      onSearchChange?: (q: string) => void;
      onSearchFocus?: () => void;
      onSearchBlur?: () => void;
    }) =>
      React.createElement(
        React.Fragment,
        null,
        sidebar,
        React.createElement('input', {
          'data-testid': 'mock-search-input',
          value: searchQuery ?? '',
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => onSearchChange?.(e.target.value),
          onFocus: () => onSearchFocus?.(),
          onBlur: () => onSearchBlur?.(),
        }),
        children,
      ),
  };
});

vi.mock('../components/Chat/MessageList', () => ({ default: () => null }));
// RichEditor を props キャプチャ可能なモックに差し替え（#113 で disabled prop を検証する）
const MockRichEditor = vi.hoisted(() => vi.fn(() => null));
vi.mock('../components/Chat/RichEditor', () => ({ default: MockRichEditor }));

// SearchFilterPanel スタブ: onFilterChange を呼び出せるボタンを公開
vi.mock('../components/Chat/SearchFilterPanel', () => ({
  default: ({ onFilterChange }: { onFilterChange: (filters: { tagIds?: number[] }) => void }) => (
    <div data-testid="mock-search-filter-panel">
      <button data-testid="set-tag-filter" onClick={() => onFilterChange({ tagIds: [42] })}>
        set-tag-filter
      </button>
      <button data-testid="clear-tag-filter" onClick={() => onFilterChange({})}>
        clear-filter
      </button>
    </div>
  ),
}));
vi.mock('../components/Chat/SearchResults', () => ({ default: () => null }));
vi.mock('../components/Chat/ThreadPanel', () => ({ default: () => null }));
vi.mock('../components/Channel/ChannelTopicBar', () => ({ default: () => null }));
vi.mock('../components/Channel/PinnedMessages', () => ({ default: () => null }));
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

vi.mock('../api/client', () => ({
  api: {
    messages: { search: mockSearch },
    bookmarks: { list: mockBookmarksList },
    drafts: { getAll: mockDraftsGetAll },
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
      Object.defineProperty(window, 'location', {
        value: { search: '?channel=5', hash: '', pathname: '/', origin: 'http://localhost' },
        writable: true,
        configurable: true,
      });

      render(<ChatPage users={[]} />);

      // useEffect 後の再レンダリングで ChannelList に activeChannelId=5 が渡されること
      await waitFor(() => {
        expect(MockChannelList).toHaveBeenLastCalledWith(
          expect.objectContaining({ activeChannelId: 5 }),
          undefined,
        );
      });
    });

    it('?channel が URL に含まれないとき、activeChannelId は null のまま', () => {
      // window.location.search は beforeEach で '' にリセット済み
      render(<ChatPage users={[]} />);

      expect(MockChannelList).toHaveBeenLastCalledWith(
        expect.objectContaining({ activeChannelId: null }),
        undefined,
      );
    });
  });

  // #115 — クエリ無しでもフィルター指定で検索が走るようにする
  // Step 2b で AppLayout から検索 box を撤去したため、これらのテストは一時的に skip。
  // 復活予定: Step 7 (検索ページ新設) — PROGRESS.md 保留 TODO #2 を参照。
  describe.skip('検索モードの切り替え (#115) [Step 2b で skip / Step 7 で復活]', () => {
    it('検索クエリが空でもフィルター（tagIds など）が指定されれば検索 API が呼ばれる', async () => {
      render(<ChatPage users={[]} />);

      // 検索ボックスにフォーカス → 検索モード ON、フィルターパネルが現れる
      const searchInput = screen.getByTestId('mock-search-input');
      await act(async () => {
        fireEvent.focus(searchInput);
      });

      // フィルターパネルが表示されることを確認
      const setTagBtn = await screen.findByTestId('set-tag-filter');
      await userEvent.click(setTagBtn);

      // debounce 300ms を待ってから search が呼ばれる
      await waitFor(
        () => {
          expect(mockSearch).toHaveBeenCalled();
        },
        { timeout: 1000 },
      );

      // q='' で tagIds=[42] が渡される
      const lastCall = mockSearch.mock.calls[mockSearch.mock.calls.length - 1];
      expect(lastCall[0]).toBe('');
      expect(lastCall[1]).toEqual(expect.objectContaining({ tagIds: [42] }));
    });

    it('検索クエリ・フィルター共に空のときは検索 API は呼ばれない', async () => {
      render(<ChatPage users={[]} />);

      // 何もせずに 400ms 待っても呼ばれないこと
      await new Promise((r) => setTimeout(r, 400));
      expect(mockSearch).not.toHaveBeenCalled();
    });

    it('検索クエリが空でも検索ボックスにフォーカスすると検索モードに入りフィルターパネルが表示される', async () => {
      render(<ChatPage users={[]} />);

      // フォーカス前: フィルターパネルは表示されない
      expect(screen.queryByTestId('mock-search-filter-panel')).toBeNull();

      const searchInput = screen.getByTestId('mock-search-input');
      await act(async () => {
        fireEvent.focus(searchInput);
      });

      // フォーカス後: フィルターパネルが表示される
      expect(screen.getByTestId('mock-search-filter-panel')).toBeInTheDocument();
    });

    // バグ1: 検索ボックスから blur してもパネルが消えないこと
    it('検索ボックスから blur してもフィルターパネルは表示されたまま維持される', async () => {
      render(<ChatPage users={[]} />);

      const searchInput = screen.getByTestId('mock-search-input');
      await act(async () => {
        fireEvent.focus(searchInput);
      });
      expect(screen.getByTestId('mock-search-filter-panel')).toBeInTheDocument();

      // タグ Autocomplete などにクリックすることをシミュレート: blur が発火する
      await act(async () => {
        fireEvent.blur(searchInput);
      });

      // blur 後もフィルターパネルが残ること
      expect(screen.getByTestId('mock-search-filter-panel')).toBeInTheDocument();
    });

    it('チャンネル切り替えで検索モードが解除されフィルターパネルが閉じる', async () => {
      render(<ChatPage users={[]} />);

      const searchInput = screen.getByTestId('mock-search-input');
      await act(async () => {
        fireEvent.focus(searchInput);
      });
      expect(screen.getByTestId('mock-search-filter-panel')).toBeInTheDocument();

      // ChannelList の onSelect を呼び出してチャンネル切替をシミュレート
      const calls = MockChannelList.mock.calls as unknown as Array<
        [{ onSelect: (id: number, name: string) => void }]
      >;
      const props = calls[calls.length - 1][0];
      await act(async () => {
        props.onSelect(99, 'random');
      });

      // 検索モード解除でパネルが消える
      expect(screen.queryByTestId('mock-search-filter-panel')).toBeNull();
    });
  });

  // #113 投稿権限制御チャンネル — RichEditor の disabled 計算
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
      render(<ChatPage users={[]} />);
      await selectChannelWithPermission('everyone');

      expect(getLastDisabled()).toBe(false);
    });

    it('postingPermission が "readonly" のとき、RichEditor に disabled=true で渡される', async () => {
      render(<ChatPage users={[]} />);
      await selectChannelWithPermission('readonly');

      expect(getLastDisabled()).toBe(true);
    });

    it('postingPermission が "admins" のとき、一般ユーザー（role=user）には disabled=true で渡される', async () => {
      mockUser.current = { id: 1, role: 'user', isActive: true, username: 'testuser' };
      render(<ChatPage users={[]} />);
      await selectChannelWithPermission('admins');

      expect(getLastDisabled()).toBe(true);
    });

    it('postingPermission が "admins" のとき、管理者（role=admin）には disabled=false で渡される', async () => {
      mockUser.current = { id: 1, role: 'admin', isActive: true, username: 'adminuser' };
      render(<ChatPage users={[]} />);
      await selectChannelWithPermission('admins');

      expect(getLastDisabled()).toBe(false);
    });
  });

  // #154 コンパクトヘッダー — 1行ヘッダー化 / ファイル切替アイコン
  describe('コンパクトヘッダー (#154)', () => {
    /** チャンネルを選択するヘルパー */
    const selectChannel = async () => {
      const calls = MockChannelList.mock.calls as unknown as Array<
        [{ onSelect: (id: number, name: string) => void }]
      >;
      const props = calls[calls.length - 1][0];
      await act(async () => {
        props.onSelect(1, 'general');
      });
    };

    describe('1行ヘッダーのレイアウト', () => {
      it('チャンネル選択時にチャンネル名・トピック・アクションアイコンが同一行に収まる', async () => {
        render(<ChatPage users={[]} />);
        await selectChannel();

        // ヘッダー行に チャンネル名・ファイル切替アイコン・予約送信アイコンが存在する
        expect(screen.getByText('# general')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /ファイル一覧/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /予約送信/i })).toBeInTheDocument();
      });

      it('チャンネル未選択時にはヘッダー領域が表示されない', () => {
        render(<ChatPage users={[]} />);

        // チャンネル選択前はチャンネル名もアイコンも表示されない
        expect(screen.queryByRole('button', { name: /ファイル一覧/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /予約送信/i })).not.toBeInTheDocument();
      });
    });

    describe('ファイル切替アイコンの動作', () => {
      it('初期状態でメッセージ一覧が表示され、ファイル一覧は表示されない', async () => {
        render(<ChatPage users={[]} />);
        await selectChannel();

        // ChannelFilesTab は表示されない
        expect(screen.queryByTestId('channel-files-tab')).not.toBeInTheDocument();
      });

      it('ファイル切替アイコンをクリックするとファイル一覧が表示される', async () => {
        const user = userEvent.setup();
        render(<ChatPage users={[]} />);
        await selectChannel();

        await user.click(screen.getByRole('button', { name: /ファイル一覧/i }));

        expect(screen.getByTestId('channel-files-tab')).toBeInTheDocument();
      });

      it('ファイル一覧表示中に再度アイコンをクリックするとメッセージ一覧に戻る', async () => {
        const user = userEvent.setup();
        render(<ChatPage users={[]} />);
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
        render(<ChatPage users={[]} />);
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
        render(<ChatPage users={[]} />);
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
      render(<ChatPage users={[]} />);

      await waitFor(() => expect(handlers.error).toBeDefined());
      // 実装側 (socket/messageHandler.ts) は 4xx 時にサーバーのエラーメッセージをそのまま転送する。
      // NG ワードによる block は 'NGワードは投稿できません' になる。
      handlers.error('NGワードは投稿できません');

      // 受信した文字列がそのまま showError に渡されること
      expect(mockSnackbar.showError).toHaveBeenCalledWith('NGワードは投稿できません');
    });

    it('Socket "message_warning" イベントを受信したらスナックバーで警告通知が出る', async () => {
      const handlers = installSocket();
      render(<ChatPage users={[]} />);

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
});
