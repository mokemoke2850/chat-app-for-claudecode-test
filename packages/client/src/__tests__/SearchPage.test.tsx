/**
 * pages/SearchPage.tsx のユニットテスト (Step 7a)
 *
 * テスト対象:
 *   - 検索ページの描画 (検索クエリ入力 / SearchFilterPanel / SearchResults)
 *   - クエリ入力の debounce 後に api.messages.search が呼ばれる
 *   - 結果クリックで /chat?channel=X#message-Y に navigate する
 *   - 「保存」ボタン押下で api.savedViews.create が呼ばれる
 *
 * 戦略:
 *   - SearchFilterPanel / SearchResults は最小スタブ
 *   - api.messages.search / api.savedViews.create を vi.hoisted で操作
 *   - react-router-dom は importActual + MemoryRouter で初期 URL を制御
 */

import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import SearchPage from '../pages/SearchPage';

// AppLayout は最小スタブ
vi.mock('../components/Layout/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout-stub">{children}</div>
  ),
}));

// ChannelList / SidebarDmList も最小スタブ（api 依存を避ける）
vi.mock('../components/Channel/ChannelList', () => ({ default: () => null }));
vi.mock('../components/Layout/SidebarDmList', () => ({ default: () => null }));

// SearchFilterPanel スタブ: onFilterChange / onSaveView を呼び出せるボタンを公開
vi.mock('../components/Chat/SearchFilterPanel', () => ({
  default: ({
    onFilterChange,
    onSaveView,
  }: {
    onFilterChange: (filters: { tagIds?: number[] }) => void;
    onSaveView?: (params: { name: string; filters: { tagIds?: number[] } }) => void;
  }) => (
    <div data-testid="mock-search-filter-panel">
      <button data-testid="set-tag-filter" onClick={() => onFilterChange({ tagIds: [42] })}>
        set-tag-filter
      </button>
      <button
        data-testid="save-view-btn"
        onClick={() => onSaveView?.({ name: 'view1', filters: { tagIds: [42] } })}
      >
        save-view
      </button>
    </div>
  ),
}));

// SearchResults スタブ: onNavigate を呼び出せるボタンを公開
vi.mock('../components/Chat/SearchResults', () => ({
  default: ({ onNavigate }: { onNavigate: (channelId: number, messageId: number) => void }) => (
    <div data-testid="mock-search-results">
      <button data-testid="navigate-btn" onClick={() => onNavigate(7, 42)}>
        navigate
      </button>
    </div>
  ),
}));

// Step 7c-1: ChipFilterSection スタブ — 検索ページ上部のチップ入力欄。
// onResolved を直接駆動できるようにし、 Suspense + use(promise) を経由しない。
vi.mock('../components/Search/ChipFilterSection', () => ({
  default: ({
    value,
    onTextChange,
    onResolved,
  }: {
    value: string;
    onTextChange: (text: string) => void;
    onResolved: (params: {
      keyword: string;
      filters: { userId?: number; channelId?: number; tagIds?: number[] };
    }) => void;
  }) => (
    <div data-testid="mock-chip-filter-section">
      <input
        data-testid="mock-chip-input"
        aria-label="メッセージ検索"
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          onTextChange(next);
          // 本物では useEffect で resolved 通知が走るので、テスト用にスタブも同期通知する
          onResolved({ keyword: next, filters: {} });
        }}
      />
      <button
        data-testid="emit-resolved-from-alice"
        onClick={() =>
          onResolved({ keyword: 'リリース', filters: { userId: 42, channelId: 7, tagIds: [3] } })
        }
      >
        emit
      </button>
    </div>
  ),
}));

// Step 7b: SavedViewsSection スタブ — Suspense + use(promise) を経由せずに
// onSelect / onDelete をテストから直接駆動する。`mockSavedViewsForSection` で
// 表示する保存ビューを各 it から制御する。
const mockSavedViewsForSection = vi.hoisted(() => ({
  current: [] as Array<{ id: number; name: string; query: Record<string, unknown> }>,
}));
vi.mock('../components/Search/SavedViewsSection', () => ({
  default: ({
    onSelect,
    onDelete,
  }: {
    onSelect: (view: { id: number; query: Record<string, unknown> }) => void;
    onDelete: (id: number) => void;
  }) => (
    <div data-testid="mock-saved-views-section">
      {mockSavedViewsForSection.current.map((v) => (
        <div key={v.id}>
          <button data-testid={`select-view-${v.id}`} onClick={() => onSelect(v)}>
            {v.name}
          </button>
          <button data-testid={`delete-view-${v.id}`} onClick={() => onDelete(v.id)}>
            delete
          </button>
        </div>
      ))}
    </div>
  ),
}));

// Snackbar
const mockSnackbar = vi.hoisted(() => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
  showInfo: vi.fn(),
}));
vi.mock('../contexts/SnackbarContext', () => ({
  useSnackbar: () => mockSnackbar,
}));

// API モック
const mockSearch = vi.hoisted(() => vi.fn());
const mockSavedViewsCreate = vi.hoisted(() => vi.fn());
const mockSavedViewsList = vi.hoisted(() => vi.fn());
const mockSavedViewsDelete = vi.hoisted(() => vi.fn());
vi.mock('../api/client', () => ({
  api: {
    messages: { search: (...args: unknown[]) => mockSearch(...args) },
    savedViews: {
      list: () => mockSavedViewsList(),
      create: (...args: unknown[]) => mockSavedViewsCreate(...args),
      delete: (...args: unknown[]) => mockSavedViewsDelete(...args),
    },
  },
}));

// useNavigate は importActual + spy で記録
const mockNavigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

beforeEach(() => {
  mockSearch.mockReset();
  mockSearch.mockResolvedValue({ messages: [] });
  mockSavedViewsCreate.mockReset();
  mockSavedViewsCreate.mockResolvedValue({ savedView: { id: 1, name: 'view1' } });
  mockSavedViewsList.mockReset();
  mockSavedViewsList.mockResolvedValue({ savedViews: [] });
  mockSavedViewsDelete.mockReset();
  mockSavedViewsDelete.mockResolvedValue(undefined);
  mockNavigate.mockReset();
  mockSnackbar.showSuccess.mockReset();
  mockSnackbar.showError.mockReset();
  mockSavedViewsForSection.current = [];
});

function renderSearch() {
  return render(
    <MemoryRouter initialEntries={['/search']}>
      <SearchPage />
    </MemoryRouter>,
  );
}

describe('SearchPage (Step 7a)', () => {
  describe('描画', () => {
    it('検索クエリ入力欄が表示される', () => {
      renderSearch();
      expect(screen.getByLabelText('メッセージ検索')).toBeInTheDocument();
    });

    it('SearchFilterPanel が表示される', () => {
      renderSearch();
      expect(screen.getByTestId('mock-search-filter-panel')).toBeInTheDocument();
    });

    it('SearchResults が表示される', () => {
      renderSearch();
      expect(screen.getByTestId('mock-search-results')).toBeInTheDocument();
    });
  });

  describe('検索動作', () => {
    it('クエリ入力後 debounce で api.messages.search が呼ばれる', async () => {
      renderSearch();
      const input = screen.getByLabelText('メッセージ検索');
      await userEvent.type(input, 'hello');
      await waitFor(
        () => {
          expect(mockSearch).toHaveBeenCalled();
        },
        { timeout: 1000 },
      );
      const lastCall = mockSearch.mock.calls[mockSearch.mock.calls.length - 1];
      expect(lastCall[0]).toBe('hello');
    });

    it('クエリ・フィルタ共に空のときは api.messages.search は呼ばれない', async () => {
      renderSearch();
      // debounce 期間 (300ms) より長く待っても呼ばれないこと
      await new Promise((r) => setTimeout(r, 400));
      expect(mockSearch).not.toHaveBeenCalled();
    });

    it('SearchFilterPanel から onFilterChange が呼ばれた後、フィルタ込みで search が呼ばれる', async () => {
      renderSearch();
      await act(async () => {
        await userEvent.click(screen.getByTestId('set-tag-filter'));
      });
      await waitFor(
        () => {
          expect(mockSearch).toHaveBeenCalled();
        },
        { timeout: 1000 },
      );
      const lastCall = mockSearch.mock.calls[mockSearch.mock.calls.length - 1];
      expect(lastCall[0]).toBe('');
      expect(lastCall[1]).toEqual(expect.objectContaining({ tagIds: [42] }));
    });
  });

  describe('ナビゲーション', () => {
    it('SearchResults の onNavigate が発火すると /chat?channel=X#message-Y へ遷移する', async () => {
      renderSearch();
      await userEvent.click(screen.getByTestId('navigate-btn'));
      expect(mockNavigate).toHaveBeenCalledWith('/chat?channel=7#message-42');
    });
  });

  describe('保存ビュー作成', () => {
    it('SearchFilterPanel の onSaveView が発火すると api.savedViews.create が呼ばれる', async () => {
      renderSearch();
      await userEvent.click(screen.getByTestId('save-view-btn'));
      await waitFor(() => {
        expect(mockSavedViewsCreate).toHaveBeenCalled();
      });
      const callArg = mockSavedViewsCreate.mock.calls[0][0];
      expect(callArg.name).toBe('view1');
      expect(callArg.query.tagIds).toEqual([42]);
    });
  });

  describe('保存ビューのピル一覧 (Step 7b)', () => {
    it('SavedViewPills の onSelect が呼ばれると、view.query から searchQuery / searchFilters が反映される', async () => {
      mockSavedViewsForSection.current = [
        {
          id: 10,
          name: '営業',
          query: { keyword: 'クロスチャンネル', tagIds: [1, 2], hasAttachment: true },
        },
      ];
      renderSearch();
      const pill = screen.getByTestId('select-view-10');
      await act(async () => {
        await userEvent.click(pill);
      });
      // searchQuery が反映されて debounce 後 search が呼ばれる
      await waitFor(
        () => {
          expect(mockSearch).toHaveBeenCalled();
        },
        { timeout: 1000 },
      );
      const lastCall = mockSearch.mock.calls[mockSearch.mock.calls.length - 1];
      expect(lastCall[0]).toBe('クロスチャンネル');
      expect(lastCall[1]).toEqual(expect.objectContaining({ tagIds: [1, 2], hasAttachment: true }));
    });

    it('SavedViewPills の onDelete が呼ばれると api.savedViews.delete が該当 id で呼ばれる', async () => {
      mockSavedViewsForSection.current = [
        {
          id: 99,
          name: 'remove-me',
          query: {},
        },
      ];
      renderSearch();
      const deleteBtn = screen.getByTestId('delete-view-99');
      await userEvent.click(deleteBtn);
      await waitFor(() => {
        expect(mockSavedViewsDelete).toHaveBeenCalledWith(99);
      });
    });
  });

  describe('チップ式フィルタ入力 (Step 7c-1)', () => {
    it('ChipFilterSection の onResolved が呼ばれると、searchQuery と effectiveFilters が search API に渡される', async () => {
      renderSearch();
      await userEvent.click(screen.getByTestId('emit-resolved-from-alice'));
      await waitFor(
        () => {
          expect(mockSearch).toHaveBeenCalled();
        },
        { timeout: 1000 },
      );
      const lastCall = mockSearch.mock.calls[mockSearch.mock.calls.length - 1];
      expect(lastCall[0]).toBe('リリース');
      expect(lastCall[1]).toEqual(
        expect.objectContaining({ userId: 42, channelId: 7, tagIds: [3] }),
      );
    });
  });
});
