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
vi.mock('../api/client', () => ({
  api: {
    messages: { search: (...args: unknown[]) => mockSearch(...args) },
    savedViews: { create: (...args: unknown[]) => mockSavedViewsCreate(...args) },
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
  mockNavigate.mockReset();
  mockSnackbar.showSuccess.mockReset();
  mockSnackbar.showError.mockReset();
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
});
