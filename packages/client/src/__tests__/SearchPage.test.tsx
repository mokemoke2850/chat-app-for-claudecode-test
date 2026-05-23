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

// AppLayout は最小スタブ — sidebar prop を露出し、defaultSidebarOpen / forceSidebarClosed を data-* 属性で露出（Issue #318）
vi.mock('../components/Layout/AppLayout', () => ({
  default: ({
    children,
    sidebar,
    defaultSidebarOpen,
    forceSidebarClosed,
  }: {
    children: React.ReactNode;
    sidebar?: React.ReactNode;
    defaultSidebarOpen?: boolean;
    forceSidebarClosed?: boolean;
  }) => (
    <div
      data-testid="app-layout-stub"
      data-default-sidebar-open={String(defaultSidebarOpen ?? true)}
      data-force-sidebar-closed={String(forceSidebarClosed ?? false)}
    >
      <div data-testid="app-layout-sidebar">{sidebar}</div>
      <div data-testid="app-layout-main">{children}</div>
    </div>
  ),
}));

// Step 8b: ChannelList の onSelect 動線を検証可能にする
vi.mock('../components/Channel/ChannelList', () => ({
  default: ({ onSelect }: { onSelect?: (id: number, name: string) => void }) => (
    <div data-testid="channel-list-stub">
      <button onClick={() => onSelect?.(7, 'general')}>select-channel-7</button>
    </div>
  ),
}));
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
// Issue #249: hasSearched / results.length を受け取り、空状態 UI / 「見つかりませんでした」/
// 結果一覧の出し分けを観測できるようにする
vi.mock('../components/Chat/SearchResults', () => ({
  default: ({
    onNavigate,
    results,
    hasSearched,
  }: {
    onNavigate: (channelId: number, messageId: number) => void;
    results: Array<{ id: number }>;
    hasSearched?: boolean;
  }) => (
    <div data-testid="mock-search-results" data-has-searched={String(hasSearched ?? true)}>
      <button data-testid="navigate-btn" onClick={() => onNavigate(7, 42)}>
        navigate
      </button>
      {hasSearched === false ? (
        <div data-testid="search-empty-state">空状態UI</div>
      ) : results.length === 0 ? (
        <div data-testid="no-results">見つかりませんでした</div>
      ) : (
        <ul>
          {results.map((r) => (
            <li key={r.id} data-testid={`result-${r.id}`}>
              {r.id}
            </li>
          ))}
        </ul>
      )}
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

describe('SearchPage', () => {
  describe('描画', () => {
    it('検索クエリ入力欄 / SearchFilterPanel / SearchResults が初期描画される', () => {
      renderSearch();
      expect(screen.getByLabelText('メッセージ検索')).toBeInTheDocument();
      expect(screen.getByTestId('mock-search-filter-panel')).toBeInTheDocument();
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

  // Step 8b: ChannelList onSelect 修正 (TODO #20)
  describe('Step 8b: ChannelList onSelect 修正', () => {
    it('sidebar の ChannelList onSelect で /chat?channel=X に navigate される (旧: 空関数)', async () => {
      renderSearch();
      await screen.findByTestId('app-layout-sidebar');
      await userEvent.click(screen.getByText('select-channel-7'));
      expect(mockNavigate).toHaveBeenCalledWith('/chat?channel=7');
    });
  });

  // Issue #249: 検索ページ初期表示の空状態UI
  // SearchPage が SearchResults に渡す `hasSearched` prop と `results` の組み合わせを
  // モック側で出し分け、空状態UI / 「見つかりませんでした」/ 結果一覧の表示を検証する。
  describe('Issue #249: 初期表示の空状態UI', () => {
    describe('初期マウント時 (クエリ空・フィルタ未設定)', () => {
      it('「見つかりませんでした」が表示されない', async () => {
        renderSearch();
        // 描画完了を待つ
        await screen.findByLabelText('メッセージ検索');
        expect(screen.queryByText(/見つかりませんでした/)).not.toBeInTheDocument();
      });

      it('空状態用 UI (使い方ヒント) が表示される', async () => {
        renderSearch();
        // 空状態の使い方ヒント領域を data-testid で確認する
        const hint = await screen.findByTestId('search-empty-state');
        expect(hint).toBeInTheDocument();
      });

      it('api.messages.search が呼ばれない', async () => {
        renderSearch();
        await new Promise((r) => setTimeout(r, 400));
        expect(mockSearch).not.toHaveBeenCalled();
      });
    });

    describe('検索実行後の表示', () => {
      it('クエリを入力して検索した結果が 0 件のときに「見つかりませんでした」が表示される', async () => {
        mockSearch.mockResolvedValue({ messages: [] });
        renderSearch();
        const input = screen.getByLabelText('メッセージ検索');
        await userEvent.type(input, 'hello');
        await waitFor(
          () => {
            expect(mockSearch).toHaveBeenCalled();
          },
          { timeout: 1000 },
        );
        await waitFor(() => {
          expect(screen.getByText(/見つかりませんでした/)).toBeInTheDocument();
        });
        // 空状態 UI は非表示
        expect(screen.queryByTestId('search-empty-state')).not.toBeInTheDocument();
      });

      it('クエリ入力後に結果がある場合は空状態 UI が消えて結果一覧が表示される', async () => {
        mockSearch.mockResolvedValue({
          messages: [
            {
              id: 99,
              channelId: 7,
              channelName: 'general',
              userId: 1,
              username: 'alice',
              avatarUrl: null,
              content: JSON.stringify({ ops: [{ insert: 'hello world\n' }] }),
              isEdited: false,
              isDeleted: false,
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
              mentions: [],
              reactions: [],
              parentMessageId: null,
              rootMessageId: null,
              replyCount: 0,
              rootMessageContent: null,
              quotedMessageId: null,
              quotedMessage: null,
              tags: [],
            },
          ],
        });
        renderSearch();
        const input = screen.getByLabelText('メッセージ検索');
        await userEvent.type(input, 'hello');
        await waitFor(
          () => {
            expect(mockSearch).toHaveBeenCalled();
          },
          { timeout: 1000 },
        );
        // 結果が反映されると 空状態 UI も「見つかりませんでした」も消える
        await waitFor(() => {
          expect(screen.getByTestId('result-99')).toBeInTheDocument();
        });
        expect(screen.queryByTestId('search-empty-state')).not.toBeInTheDocument();
        expect(screen.queryByText(/見つかりませんでした/)).not.toBeInTheDocument();
      });
    });

    describe('フィルタ設定時の表示切替', () => {
      it('フィルタ (タグ) を設定した時点で空状態 UI から結果ペインに切り替わる', async () => {
        mockSearch.mockResolvedValue({ messages: [] });
        renderSearch();
        // 初期は空状態 UI が出ている
        await screen.findByTestId('search-empty-state');
        // タグフィルタを設定する
        await act(async () => {
          await userEvent.click(screen.getByTestId('set-tag-filter'));
        });
        await waitFor(
          () => {
            expect(mockSearch).toHaveBeenCalled();
          },
          { timeout: 1000 },
        );
        // 空状態 UI が消える（結果ペインに切り替わる）
        await waitFor(() => {
          expect(screen.queryByTestId('search-empty-state')).not.toBeInTheDocument();
        });
      });

      it('フィルタ設定後の結果が 0 件のときは「見つかりませんでした」が表示される', async () => {
        mockSearch.mockResolvedValue({ messages: [] });
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
        await waitFor(() => {
          expect(screen.getByText(/見つかりませんでした/)).toBeInTheDocument();
        });
      });
    });

    describe('リセット動作', () => {
      it('クエリをクリアすると空状態 UI に戻る', async () => {
        mockSearch.mockResolvedValue({ messages: [] });
        renderSearch();
        const input = screen.getByLabelText('メッセージ検索') as HTMLInputElement;
        // クエリを入力して検索状態にする
        await userEvent.type(input, 'hi');
        await waitFor(
          () => {
            expect(mockSearch).toHaveBeenCalled();
          },
          { timeout: 1000 },
        );
        await waitFor(() => {
          expect(screen.getByText(/見つかりませんでした/)).toBeInTheDocument();
        });
        // クエリをクリア（debounce 待ち）
        await userEvent.clear(input);
        await waitFor(
          () => {
            expect(screen.queryByText(/見つかりませんでした/)).not.toBeInTheDocument();
          },
          { timeout: 1000 },
        );
        // 空状態 UI に戻る
        expect(screen.getByTestId('search-empty-state')).toBeInTheDocument();
      });

      it('クエリクリア後は「見つかりませんでした」が表示されない', async () => {
        mockSearch.mockResolvedValue({ messages: [] });
        renderSearch();
        const input = screen.getByLabelText('メッセージ検索') as HTMLInputElement;
        await userEvent.type(input, 'hi');
        await waitFor(
          () => {
            expect(mockSearch).toHaveBeenCalled();
          },
          { timeout: 1000 },
        );
        await userEvent.clear(input);
        await waitFor(
          () => {
            expect(screen.queryByText(/見つかりませんでした/)).not.toBeInTheDocument();
          },
          { timeout: 1000 },
        );
      });
    });
  });

  // Issue #318: 検索ページのサイドバー表示ポリシー
  describe('Issue #318: サイドバー表示ポリシー', () => {
    beforeEach(() => {
      localStorage.removeItem('sidebar.open');
    });

    it('SearchPage は AppLayout に defaultSidebarOpen={false} を渡す（折り畳み既定）', () => {
      renderSearch();
      const layout = screen.getByTestId('app-layout-stub');
      expect(layout).toHaveAttribute('data-default-sidebar-open', 'false');
    });

    it('SearchPage は AppLayout に forceSidebarClosed を渡さない（ユーザーが手動で開ける）', () => {
      renderSearch();
      const layout = screen.getByTestId('app-layout-stub');
      expect(layout).toHaveAttribute('data-force-sidebar-closed', 'false');
    });

    it('localStorage["sidebar.open"] に値が無い場合、検索ページではサイドバーが折り畳まれた状態で起動する', () => {
      // defaultSidebarOpen={false} かつ localStorage に値なし → 折り畳み既定
      renderSearch();
      const layout = screen.getByTestId('app-layout-stub');
      expect(layout).toHaveAttribute('data-default-sidebar-open', 'false');
    });

    it('localStorage["sidebar.open"]="true" の場合、検索ページでもサイドバーが開いた状態で起動する（永続化値優先）', () => {
      // AppLayout の実装が localStorage 値を defaultSidebarOpen より優先する仕様
      // スタブでは実際の開閉制御は行わないため、localStorage 値の存在を確認する
      localStorage.setItem('sidebar.open', 'true');
      renderSearch();
      const layout = screen.getByTestId('app-layout-stub');
      expect(layout).toHaveAttribute('data-default-sidebar-open', 'false');
      // 実際の開閉動作は AppLayout.test.tsx の「localStorage["sidebar.open"]="true" なら表示」テストで保証される
      expect(localStorage.getItem('sidebar.open')).toBe('true');
    });
  });
});
