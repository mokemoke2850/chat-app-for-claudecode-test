import { useState, useEffect, useCallback, useMemo, Suspense, use } from 'react';
import { Box, Button, CircularProgress, Collapse, Stack, Typography } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/Layout/AppLayout';
import ChannelList from '../components/Channel/ChannelList';
import SidebarDmList from '../components/Layout/SidebarDmList';
import SearchResults, { type AppliedFilter } from '../components/Chat/SearchResults';
import SearchFilterPanel, { type SearchFilters } from '../components/Chat/SearchFilterPanel';
import SavedViewsSection from '../components/Search/SavedViewsSection';
import ChipFilterSection, {
  getOrCreateMasterDataPromise,
} from '../components/Search/ChipFilterSection';
import { api } from '../api/client';
import type { MessageSearchResult, SavedView } from '@chat-app/shared';
import { useSnackbar } from '../contexts/SnackbarContext';

function buildAppliedFilters(
  searchQuery: string,
  effective: SearchFilters,
  lookup: {
    users: { id: number; username: string }[];
    channels: { id: number; name: string }[];
    tags: { id: number; name: string }[];
  },
): AppliedFilter[] {
  const filters: AppliedFilter[] = [];
  const trimmed = searchQuery.trim();
  if (trimmed) {
    filters.push({ type: 'keyword', label: `キーワード: ${trimmed}` });
  }
  if (effective.dateFrom) {
    filters.push({ type: 'dateFrom', label: `開始日: ${effective.dateFrom}` });
  }
  if (effective.dateTo) {
    filters.push({ type: 'dateTo', label: `終了日: ${effective.dateTo}` });
  }
  if (effective.userId !== undefined) {
    const u = lookup.users.find((x) => x.id === effective.userId);
    filters.push({ type: 'sender', label: `送信者: ${u?.username ?? `#${effective.userId}`}` });
  }
  if (effective.hasAttachment !== undefined) {
    filters.push({
      type: 'attachment',
      label: `添付ファイル: ${effective.hasAttachment ? 'あり' : 'なし'}`,
    });
  }
  if (effective.channelId !== undefined) {
    const c = lookup.channels.find((x) => x.id === effective.channelId);
    filters.push({
      type: 'channel',
      label: `チャンネル: ${c?.name ?? `#${effective.channelId}`}`,
    });
  }
  if (effective.tagIds && effective.tagIds.length > 0) {
    for (const tagId of effective.tagIds) {
      const t = lookup.tags.find((x) => x.id === tagId);
      filters.push({ type: 'tag', label: `タグ: ${t?.name ?? `#${tagId}`}`, value: tagId });
    }
  }
  return filters;
}

interface SearchResultsAreaProps {
  results: MessageSearchResult[];
  onNavigate: (channelId: number, messageId: number) => void;
  keyword: string;
  hasSearched: boolean;
  searchQuery: string;
  effectiveFilters: SearchFilters;
  onRemoveFilter: (filter: AppliedFilter) => void;
  onResetAll: () => void;
}

/**
 * 結果が 0 件のときだけ master data を解決してチップラベルを構築する。
 * 検索ヒット時は appliedFilters を計算しないため、無駄な suspend を発生させない。
 */
function SearchResultsArea({
  results,
  onNavigate,
  keyword,
  hasSearched,
  searchQuery,
  effectiveFilters,
  onRemoveFilter,
  onResetAll,
}: SearchResultsAreaProps) {
  const showSuggestions = hasSearched && results.length === 0;
  return showSuggestions ? (
    <Suspense
      fallback={
        <SearchResults
          results={results}
          onNavigate={onNavigate}
          keyword={keyword}
          hasSearched={hasSearched}
        />
      }
    >
      <SearchResultsWithSuggestions
        results={results}
        onNavigate={onNavigate}
        keyword={keyword}
        hasSearched={hasSearched}
        searchQuery={searchQuery}
        effectiveFilters={effectiveFilters}
        onRemoveFilter={onRemoveFilter}
        onResetAll={onResetAll}
      />
    </Suspense>
  ) : (
    <SearchResults
      results={results}
      onNavigate={onNavigate}
      keyword={keyword}
      hasSearched={hasSearched}
    />
  );
}

function SearchResultsWithSuggestions({
  results,
  onNavigate,
  keyword,
  hasSearched,
  searchQuery,
  effectiveFilters,
  onRemoveFilter,
  onResetAll,
}: SearchResultsAreaProps) {
  const master = use(getOrCreateMasterDataPromise());
  const appliedFilters = useMemo(
    () => buildAppliedFilters(searchQuery, effectiveFilters, master),
    [searchQuery, effectiveFilters, master],
  );
  return (
    <SearchResults
      results={results}
      onNavigate={onNavigate}
      keyword={keyword}
      hasSearched={hasSearched}
      appliedFilters={appliedFilters}
      onRemoveFilter={onRemoveFilter}
      onResetAll={onResetAll}
    />
  );
}

/**
 * 検索ページ。クエリ入力 + チップ式フィルタ + 保存ビューを統合した独立ページ。
 *
 * - クエリ入力 (TextField) + フィルタの両方が空のときは API を呼ばない (300ms debounce)
 * - 結果クリックで `/chat?channel=X#message-Y` へ navigate
 * - 「保存」ボタンで `api.savedViews.create`、ピル削除で `api.savedViews.delete` + 再フェッチ
 * - チップ入力 (`from:` `in:` `has:` `before:` `after:` `tag:`) は ChipFilterSection で別管理し
 *   `effectiveFilters` で SearchFilterPanel 由来のフィルタとマージする
 */
export default function SearchPage() {
  const navigate = useNavigate();
  const { showSuccess, showError } = useSnackbar();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({});
  // チップ入力で指定されたフィルタ (SearchFilterPanel と独立に管理し effective でマージ)
  const [chipFilters, setChipFilters] = useState<Partial<SearchFilters>>({});
  // チップ入力欄の生テキスト
  const [rawSearchText, setRawSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<MessageSearchResult[]>([]);
  // #375 検索結果の総ヒット件数（オフセット系ページングの total）
  const [searchTotal, setSearchTotal] = useState(0);
  const [searching, setSearching] = useState(false);
  // Issue #325: 検索構文ヘルプパネルの開閉状態
  const [helpOpen, setHelpOpen] = useState(false);

  // 保存ビュー一覧 promise。削除/作成後に savedViewsKey をインクリメントして再フェッチする
  const [savedViewsKey, setSavedViewsKey] = useState(0);
  // savedViewsKey は関数 body では未使用だが、再フェッチトリガーとして deps に含める意図
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const savedViewsPromise = useMemo(() => api.savedViews.list(), [savedViewsKey]);

  // SearchFilterPanel 由来のフィルタとチップ由来のフィルタをマージ
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

  // Issue #249: クエリ or フィルタの何かが入力されたら「検索済み」とみなす。
  // false のときは SearchResults 側で空状態 UI を表示し、「見つかりませんでした」は出さない。
  const hasSearched = !!searchQuery.trim() || hasAnyFilter;

  // 検索クエリ or フィルタが変わったら API を呼ぶ（300ms debounce）
  useEffect(() => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery && !hasAnyFilter) {
      setSearchResults([]);
      setSearchTotal(0);
      setSearching(false);
      return;
    }
    const timer = setTimeout(() => {
      setSearching(true);
      api.messages
        .search(trimmedQuery, effectiveFilters)
        .then(({ items, total }) => {
          setSearchResults(items);
          setSearchTotal(total);
        })
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

  // ピルクリックで保存ビューの query を state に反映 (チップ入力欄もリセットして揃える)
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

  // ChipFilterSection が解決した keyword / filters を searchQuery / chipFilters に反映
  const handleChipResolved = useCallback(
    ({ keyword, filters }: { keyword: string; filters: Partial<SearchFilters> }) => {
      setSearchQuery(keyword);
      setChipFilters(filters);
    },
    [],
  );

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

  /**
   * Issue #327: ゼロ件サジェスチョンからの個別解除。
   * SearchFilterPanel 由来とチップ入力由来の両方を辿って該当フィルタを落とす。
   * tag は配列の要素ごとに value で識別する。
   */
  const handleRemoveFilter = useCallback((filter: AppliedFilter) => {
    switch (filter.type) {
      case 'keyword':
        setSearchQuery('');
        setRawSearchText('');
        break;
      case 'dateFrom':
        setSearchFilters((prev) => ({ ...prev, dateFrom: undefined }));
        setChipFilters((prev) => ({ ...prev, dateFrom: undefined }));
        break;
      case 'dateTo':
        setSearchFilters((prev) => ({ ...prev, dateTo: undefined }));
        setChipFilters((prev) => ({ ...prev, dateTo: undefined }));
        break;
      case 'sender':
        setSearchFilters((prev) => ({ ...prev, userId: undefined }));
        setChipFilters((prev) => ({ ...prev, userId: undefined }));
        break;
      case 'attachment':
        setSearchFilters((prev) => ({ ...prev, hasAttachment: undefined }));
        setChipFilters((prev) => ({ ...prev, hasAttachment: undefined }));
        break;
      case 'channel':
        setSearchFilters((prev) => ({ ...prev, channelId: undefined }));
        setChipFilters((prev) => ({ ...prev, channelId: undefined }));
        break;
      case 'tag': {
        const dropTagId = filter.value;
        const without = (ids?: number[]) =>
          ids && ids.length > 0 ? ids.filter((id) => id !== dropTagId) : undefined;
        setSearchFilters((prev) => ({
          ...prev,
          tagIds: without(prev.tagIds)?.length ? without(prev.tagIds) : undefined,
        }));
        setChipFilters((prev) => ({
          ...prev,
          tagIds: without(prev.tagIds)?.length ? without(prev.tagIds) : undefined,
        }));
        break;
      }
    }
  }, []);

  const handleResetAll = useCallback(() => {
    setSearchQuery('');
    setRawSearchText('');
    setSearchFilters({});
    setChipFilters({});
  }, []);

  return (
    <AppLayout
      defaultSidebarOpen={false}
      sidebar={
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
          <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
            <ChannelList
              activeChannelId={null}
              onSelect={(id) => navigate(`/chat?channel=${id}`)}
            />
          </Box>
          <SidebarDmList />
        </Box>
      }
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <Box
          sx={{
            px: 2,
            pt: 2,
            pb: 0.5,
            flexShrink: 0,
          }}
        >
          <Typography variant="h5" component="h1" sx={{ fontWeight: 600 }}>
            検索
          </Typography>
        </Box>
        <Box
          sx={{
            px: 2,
            pb: 2,
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
          <Box>
            <Button
              size="small"
              variant="text"
              startIcon={<HelpOutlineIcon fontSize="small" />}
              aria-expanded={helpOpen}
              aria-controls="search-syntax-help-panel"
              onClick={() => setHelpOpen((v) => !v)}
              sx={{ textTransform: 'none', color: 'text.secondary' }}
            >
              検索構文ヘルプ
            </Button>
            <Collapse in={helpOpen} unmountOnExit>
              <Box
                id="search-syntax-help-panel"
                data-testid="search-syntax-help-panel"
                sx={{
                  mt: 1,
                  p: 1.5,
                  borderRadius: 1,
                  bgcolor: 'action.hover',
                  fontSize: 13,
                }}
              >
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                  使用できる検索構文
                </Typography>
                <Stack spacing={0.5} component="ul" sx={{ pl: 2, m: 0 }}>
                  <li>
                    <code>from:ユーザー名</code> — 投稿者で絞り込み
                  </li>
                  <li>
                    <code>in:チャンネル名</code> — チャンネルで絞り込み
                  </li>
                  <li>
                    <code>has:link</code> / <code>has:file</code> — 添付の有無で絞り込み
                  </li>
                  <li>
                    <code>before:YYYY-MM-DD</code> / <code>after:YYYY-MM-DD</code> — 日付で絞り込み
                  </li>
                  <li>
                    <code>tag:タグ名</code> — タグで絞り込み
                  </li>
                </Stack>
              </Box>
            </Collapse>
          </Box>
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
              <>
                {hasSearched && searchTotal > 0 && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', px: 2, pt: 1 }}
                    data-testid="search-hit-count"
                  >
                    {searchTotal}件ヒット
                  </Typography>
                )}
                <SearchResultsArea
                  results={searchResults}
                  onNavigate={handleNavigate}
                  keyword={searchQuery}
                  hasSearched={hasSearched}
                  searchQuery={searchQuery}
                  effectiveFilters={effectiveFilters}
                  onRemoveFilter={handleRemoveFilter}
                  onResetAll={handleResetAll}
                />
              </>
            )}
          </Box>
        </Box>
      </Box>
    </AppLayout>
  );
}
