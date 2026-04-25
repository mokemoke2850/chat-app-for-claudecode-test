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
vi.mock('../components/Chat/RichEditor', () => ({ default: () => null }));

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
vi.mock('../components/Chat/ScheduledMessagesDialog', () => ({ default: () => null }));
vi.mock('./FilesPage', () => ({ ChannelFilesTab: () => null }));

vi.mock('../contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showSuccess: vi.fn(), showError: vi.fn(), showInfo: vi.fn() }),
}));

const mockSearch = vi.hoisted(() => vi.fn().mockResolvedValue({ messages: [] }));
const mockBookmarksList = vi.hoisted(() => vi.fn().mockResolvedValue({ bookmarks: [] }));

vi.mock('../api/client', () => ({
  api: {
    messages: { search: mockSearch },
    bookmarks: { list: mockBookmarksList },
  },
}));

vi.mock('../hooks/useMessages', () => ({
  useMessages: () => ({ messages: [], loading: false, loadMore: vi.fn() }),
}));
vi.mock('../hooks/useScheduledMessages', () => ({
  useScheduledMessages: () => ({
    promise: Promise.resolve([]),
    refresh: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    cancel: vi.fn(),
  }),
}));
vi.mock('../contexts/SocketContext', () => ({ useSocket: () => null }));
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, role: 'user', isActive: true, username: 'testuser' } }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  MockChannelList.mockImplementation(() => null);
  mockSearch.mockResolvedValue({ messages: [] });
  mockBookmarksList.mockResolvedValue({ bookmarks: [] });
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
  describe('検索モードの切り替え (#115)', () => {
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
});
