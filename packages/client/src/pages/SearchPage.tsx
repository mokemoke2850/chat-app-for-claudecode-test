import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/Layout/AppLayout';
import ChannelList from '../components/Channel/ChannelList';
import SidebarDmList from '../components/Layout/SidebarDmList';
import SearchResults from '../components/Chat/SearchResults';
import SearchFilterPanel, { type SearchFilters } from '../components/Chat/SearchFilterPanel';
import SavedViewsSection from '../components/Search/SavedViewsSection';
import ChipFilterSection from '../components/Search/ChipFilterSection';
import { api } from '../api/client';
import type { MessageSearchResult, SavedView } from '@chat-app/shared';
import { useSnackbar } from '../contexts/SnackbarContext';

/**
 * Step 7a: 検索ページ。
 * これまで ChatPage 内で `isSearchMode` 切替表示していた検索 UI を独立ページに分離する。
 * Rail の検索アイコン (Step 7a で disabled 解除) からも本ページへ遷移する。
 *
 * Step 7b: 保存ビューのピル一覧をクエリ入力欄の下に配置。
 *   - ピルクリックで `view.query` から `searchQuery` / `searchFilters` を反映
 *   - 削除アイコンで `api.savedViews.delete(id)` + 再フェッチ
 *
 * スコープ:
 *   - 既存 SearchFilterPanel / SearchResults を流用
 *   - クエリ入力 (TextField) + フィルタの両方が空のときは API を呼ばない
 *   - 結果クリックで /chat?channel=X#message-Y へ navigate
 *   - 「保存」ボタン押下で api.savedViews.create を呼ぶ
 *
 * Step 7b スコープ外 (後続):
 *   - チップ式フィルタ入力 (`from:` `in:` 等) + スニペットハイライト → Step 7c
 */
export default function SearchPage() {
  const navigate = useNavigate();
  const { showSuccess, showError } = useSnackbar();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({});
  // Step 7c-1: チップ入力で指定されたフィルタ（SearchFilterPanel と独立に管理し、effective ではマージ）
  const [chipFilters, setChipFilters] = useState<Partial<SearchFilters>>({});
  // Step 7c-1: チップ入力欄の生テキスト
  const [rawSearchText, setRawSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<MessageSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Step 7b: 保存ビュー一覧 promise。削除/作成後に savedViewsKey をインクリメントして再フェッチ
  const [savedViewsKey, setSavedViewsKey] = useState(0);
  const savedViewsPromise = useMemo(() => api.savedViews.list(), [savedViewsKey]);

  // Step 7c-1: SearchFilterPanel 由来のフィルタとチップ由来のフィルタをマージ
  const effectiveFilters: SearchFilters = useMemo(
    () => ({ ...searchFilters, ...chipFilters }),
    [searchFilters, chipFilters],
  );

  const hasAnyFilter =
    (effectiveFilters.tagIds?.length ?? 0) > 0 ||
    !!effectiveFilters.dateFrom ||
    !!effectiveFilters.dateTo ||
    effectiveFilters.userId !== undefined ||
    effectiveFilters.hasAttachment !== undefined ||
    effectiveFilters.channelId !== undefined;

  // 検索クエリ or フィルタが変わったら API を呼ぶ（300ms debounce）
  useEffect(() => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery && !hasAnyFilter) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    const timer = setTimeout(() => {
      setSearching(true);
      api.messages
        .search(trimmedQuery, effectiveFilters)
        .then(({ messages }) => setSearchResults(messages))
        .catch((err) => {
          console.error(err);
        })
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, effectiveFilters, hasAnyFilter]);

  const handleNavigate = useCallback(
    (channelId: number, messageId: number) => {
      navigate(`/chat?channel=${channelId}#message-${messageId}`);
    },
    [navigate],
  );

  const handleSaveView = useCallback(
    async ({ name, filters }: { name: string; filters: SearchFilters }) => {
      try {
        await api.savedViews.create({
          name,
          query: {
            keyword: searchQuery || undefined,
            dateFrom: filters.dateFrom,
            dateTo: filters.dateTo,
            userId: filters.userId,
            hasAttachment: filters.hasAttachment,
            tagIds: filters.tagIds,
          },
        });
        showSuccess(`保存ビュー「${name}」を保存しました`);
        // 保存ビュー一覧を再フェッチ
        setSavedViewsKey((k) => k + 1);
      } catch (err) {
        showError(err instanceof Error ? err.message : '保存ビューの作成に失敗しました');
      }
    },
    [searchQuery, showSuccess, showError],
  );

  // Step 7b: ピルクリックで保存ビューの query を state に反映
  // Step 7c-1: チップ入力欄もリセットして保存ビューの内容に揃える
  const handleSelectSavedView = useCallback((view: SavedView) => {
    setSearchQuery(view.query.keyword ?? '');
    setSearchFilters({
      dateFrom: view.query.dateFrom,
      dateTo: view.query.dateTo,
      userId: view.query.userId,
      hasAttachment: view.query.hasAttachment,
      tagIds: view.query.tagIds,
    });
    setChipFilters({});
    setRawSearchText(view.query.keyword ?? '');
  }, []);

  // Step 7c-1: ChipFilterSection から resolved を受け取って searchQuery と chipFilters に反映
  const handleChipResolved = useCallback(
    ({ keyword, filters }: { keyword: string; filters: Partial<SearchFilters> }) => {
      setSearchQuery(keyword);
      setChipFilters(filters);
    },
    [],
  );

  // Step 7b: 保存ビュー削除
  const handleDeleteSavedView = useCallback(
    async (id: number) => {
      try {
        await api.savedViews.delete(id);
        setSavedViewsKey((k) => k + 1);
      } catch (err) {
        showError(err instanceof Error ? err.message : '保存ビューの削除に失敗しました');
      }
    },
    [showError],
  );

  return (
    <AppLayout
      sidebar={
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
          <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
            <ChannelList activeChannelId={null} onSelect={() => {}} />
          </Box>
          <SidebarDmList />
        </Box>
      }
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <Box
          sx={{
            p: 2,
            borderBottom: 1,
            borderColor: 'divider',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          }}
        >
          <Suspense fallback={null}>
            <ChipFilterSection
              value={rawSearchText}
              onTextChange={setRawSearchText}
              onResolved={handleChipResolved}
            />
          </Suspense>
          <Suspense fallback={null}>
            <SavedViewsSection
              promise={savedViewsPromise}
              onSelect={handleSelectSavedView}
              onDelete={handleDeleteSavedView}
            />
          </Suspense>
        </Box>
        <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
          <Box
            sx={{
              width: 240,
              flexShrink: 0,
              borderRight: 1,
              borderColor: 'divider',
              overflowY: 'auto',
            }}
          >
            <Suspense fallback={null}>
              <SearchFilterPanel
                key={JSON.stringify(searchFilters)}
                filters={searchFilters}
                onFilterChange={setSearchFilters}
                searchResults={searchResults}
                onSaveView={handleSaveView}
              />
            </Suspense>
          </Box>
          <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
            {searching ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress size={24} />
              </Box>
            ) : (
              <SearchResults
                results={searchResults}
                onNavigate={handleNavigate}
                keyword={searchQuery}
              />
            )}
          </Box>
        </Box>
      </Box>
    </AppLayout>
  );
}
