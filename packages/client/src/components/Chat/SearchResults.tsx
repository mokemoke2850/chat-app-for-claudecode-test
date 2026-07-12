import { useState, useCallback } from 'react';
import {
  Box,
  List,
  Typography,
  IconButton,
  Tooltip,
  Divider,
  Stack,
  Chip,
  Collapse,
  ButtonGroup,
  Button,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CancelIcon from '@mui/icons-material/Cancel';
import type { MessageSearchResult } from '@chat-app/shared';
import TagChip from './TagChip';
import { extractMessageText } from '../../utils/extractMessageText';
import { buildSnippet } from '../../utils/buildSnippet';

/**
 * Issue #327: 検索結果ゼロ件時の「条件を広げる」サジェスチョン用フィルタ種別。
 * tag のみ複数同時適用されうるため value (タグ ID) で個別識別する。
 */
export type AppliedFilterType =
  | 'keyword'
  | 'sender'
  | 'attachment'
  | 'dateFrom'
  | 'dateTo'
  | 'tag'
  | 'channel';

export interface AppliedFilter {
  type: AppliedFilterType;
  /** 解除チップ上に表示するラベル（例: "送信者: alice"） */
  label: string;
  /** 同一 type 内で複数同時に存在しうる場合の識別子（現状はタグ ID） */
  value?: number | string;
}

type GroupBy = 'flat' | 'channel' | 'sender' | 'date';

const GROUP_BY_STORAGE_KEY = 'search-results-group-by';
const GROUP_BY_VALUES: GroupBy[] = ['flat', 'channel', 'sender', 'date'];

function readStoredGroupBy(): GroupBy {
  if (typeof window === 'undefined') return 'flat';
  try {
    const stored = window.localStorage.getItem(GROUP_BY_STORAGE_KEY);
    if (stored !== null && (GROUP_BY_VALUES as string[]).includes(stored)) {
      return stored as GroupBy;
    }
  } catch {
    // localStorage 利用不可（SSR / プライベートモード等）はデフォルト値にフォールバック
  }
  return 'flat';
}

interface Props {
  results: MessageSearchResult[];
  onNavigate: (channelId: number, messageId: number, result?: MessageSearchResult) => void;
  /**
   * マッチ部分のハイライト + スニペット切り出し用のキーワード。
   * 未指定 / 空のときは本文先頭抜粋を表示しハイライトしない。
   */
  keyword?: string;
  /**
   * 検索が実行されたか（クエリ or フィルタが設定済みか）。
   * - `false`: 初期状態。空状態 UI（使い方ヒント）を表示し、「見つかりませんでした」は出さない。
   * - `true` (デフォルト): 既存挙動。0 件のときは「見つかりませんでした」、結果ありなら一覧表示。
   *
   * Issue #249 対応で追加。後方互換のためデフォルトを `true` にして既存呼び出し側に影響しない。
   */
  hasSearched?: boolean;
  /**
   * Issue #327: 結果ゼロ件時に「条件を広げる」セクション内で個別解除できる現適用フィルタ一覧。
   * 未指定 / 空配列のときはサジェスチョンセクションを描画しない。
   */
  appliedFilters?: AppliedFilter[];
  /** チップの解除アイコン押下時に呼ばれる。`AppliedFilter` をそのまま渡す。 */
  onRemoveFilter?: (filter: AppliedFilter) => void;
  /** 「すべての条件をリセット」ボタン押下時に呼ばれる。 */
  onResetAll?: () => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateOnly(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
}

interface Group {
  key: string;
  label: string;
  items: MessageSearchResult[];
}

function groupResults(results: MessageSearchResult[], groupBy: GroupBy): Group[] {
  if (groupBy === 'flat') {
    return [{ key: '_flat', label: '', items: results }];
  }

  const map = new Map<string, MessageSearchResult[]>();

  for (const r of results) {
    let key: string;
    if (groupBy === 'channel') {
      key = r.channelName;
    } else if (groupBy === 'sender') {
      key = r.username;
    } else {
      // date
      key = formatDateOnly(r.createdAt);
    }

    const existing = map.get(key);
    if (existing) {
      existing.push(r);
    } else {
      map.set(key, [r]);
    }
  }

  return Array.from(map.entries()).map(([key, items]) => ({
    key,
    label: key,
    items,
  }));
}

function ResultItem({
  result,
  keyword,
  onCopy,
  onNavigate,
}: {
  result: MessageSearchResult;
  keyword: string;
  onCopy: (r: MessageSearchResult) => void;
  onNavigate: (channelId: number, messageId: number, result?: MessageSearchResult) => void;
}) {
  const snippet = buildSnippet(extractMessageText(result.content), keyword);
  return (
    <Box component="li" sx={{ listStyle: 'none' }}>
      <Box sx={{ px: 2, py: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5, gap: 1 }}>
          <Typography variant="caption" color="primary" fontWeight="bold">
            # {result.channelName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {result.username}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {formatDate(result.createdAt)}
          </Typography>
          <Box sx={{ ml: 'auto', display: 'flex', gap: 0.5 }}>
            <Tooltip title="リンクをコピー">
              <IconButton size="small" onClick={() => onCopy(result)}>
                <ContentCopyIcon fontSize="inherit" />
              </IconButton>
            </Tooltip>
            <Tooltip title="投稿へ移動">
              <IconButton
                size="small"
                onClick={() =>
                  result.resultType === 'dm'
                    ? onNavigate(result.channelId, result.id, result)
                    : onNavigate(result.channelId, result.id)
                }
              >
                <OpenInNewIcon fontSize="inherit" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        {result.rootMessageContent && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              display: 'block',
              mb: 0.5,
              pl: 1,
              borderLeft: 2,
              borderColor: 'divider',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {extractMessageText(result.rootMessageContent)}
          </Typography>
        )}
        <Typography
          variant="body2"
          sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
          data-testid="search-result-snippet"
        >
          {snippet.before}
          {snippet.match && (
            <Box
              component="mark"
              sx={{
                bgcolor: 'var(--accent-soft, #fff59d)',
                color: 'inherit',
                px: 0.25,
                borderRadius: 0.5,
              }}
            >
              {snippet.match}
            </Box>
          )}
          {snippet.after}
        </Typography>
        {result.tags && result.tags.length > 0 && (
          <Box
            sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}
            data-testid="search-result-tags"
          >
            {result.tags.map((tag) => (
              <TagChip key={tag.id} tag={tag} readOnly={true} />
            ))}
          </Box>
        )}
      </Box>
      <Divider />
    </Box>
  );
}

const GROUP_BY_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'flat', label: 'フラット' },
  { value: 'channel', label: 'チャンネル' },
  { value: 'sender', label: '送信者' },
  { value: 'date', label: '日付' },
];

export default function SearchResults({
  results,
  onNavigate,
  keyword = '',
  hasSearched = true,
  appliedFilters,
  onRemoveFilter,
  onResetAll,
}: Props) {
  const [groupBy, setGroupBy] = useState<GroupBy>(() => readStoredGroupBy());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const handleCopy = (result: MessageSearchResult) => {
    const path = result.resultType === 'dm'
      ? `/dm?conv=${result.conversationId}&message=${result.id}`
      : `/chat?channel=${result.channelId}&message=${result.id}`;
    const url = `${window.location.origin}${path}`;
    void navigator.clipboard.writeText(url);
  };

  const handleGroupByChange = useCallback((newGroupBy: GroupBy) => {
    setGroupBy(newGroupBy);
    setCollapsedGroups(new Set()); // 切り替え時に全展開
    try {
      window.localStorage.setItem(GROUP_BY_STORAGE_KEY, newGroupBy);
    } catch {
      // localStorage 書き込み失敗は無視（UI 状態は維持される）
    }
  }, []);

  const toggleGroup = useCallback((key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // Issue #249: 未検索時 (クエリ・フィルタ共に空) は「見つかりませんでした」を出さず、
  // 検索構文の使い方ヒントを表示する空状態 UI を出す
  if (!hasSearched) {
    return (
      <Box
        data-testid="search-empty-state"
        sx={{
          p: 4,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          color: 'text.secondary',
        }}
      >
        <SearchIcon sx={{ fontSize: 48, opacity: 0.4 }} />
        <Typography variant="body1" align="center">
          キーワードやフィルタを指定してメッセージを検索できます
        </Typography>
        <Stack spacing={0.5} sx={{ alignItems: 'flex-start' }}>
          <Typography variant="caption" color="text.secondary">
            検索構文の例:
          </Typography>
          <Typography variant="caption" component="code" sx={{ fontFamily: 'monospace' }}>
            from:alice 議事録
          </Typography>
          <Typography variant="caption" component="code" sx={{ fontFamily: 'monospace' }}>
            in:general has:file
          </Typography>
          <Typography variant="caption" component="code" sx={{ fontFamily: 'monospace' }}>
            tag:仕様 after:2024-01-01
          </Typography>
        </Stack>
      </Box>
    );
  }

  if (results.length === 0) {
    const hasAppliedFilters = (appliedFilters?.length ?? 0) > 0;
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">見つかりませんでした</Typography>
        {hasAppliedFilters && (
          <Box
            data-testid="search-zero-suggestions"
            sx={{
              mt: 3,
              mx: 'auto',
              maxWidth: 480,
              textAlign: 'left',
              p: 2,
              borderRadius: 1,
              bgcolor: 'action.hover',
            }}
          >
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              条件を広げる
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              現在適用中のフィルタを個別に解除できます。
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
              {appliedFilters!.map((f) => {
                const testId =
                  f.value !== undefined
                    ? `applied-filter-${f.type}-${f.value}`
                    : `applied-filter-${f.type}`;
                const removeTestId =
                  f.value !== undefined
                    ? `remove-filter-${f.type}-${f.value}`
                    : `remove-filter-${f.type}`;
                return (
                  <Chip
                    key={testId}
                    data-testid={testId}
                    label={f.label}
                    size="small"
                    onDelete={onRemoveFilter ? () => onRemoveFilter(f) : undefined}
                    deleteIcon={
                      <CancelIcon data-testid={removeTestId} aria-label={`${f.label} を解除`} />
                    }
                  />
                );
              })}
            </Box>
            {onResetAll && (
              <Button size="small" variant="outlined" onClick={onResetAll}>
                すべての条件をリセット
              </Button>
            )}
          </Box>
        )}
      </Box>
    );
  }

  const groups = groupResults(results, groupBy);
  const isGrouped = groupBy !== 'flat';

  return (
    <Box>
      {/* グルーピング切替ボタン */}
      <Box sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}>
        <ButtonGroup size="small" variant="outlined">
          {GROUP_BY_OPTIONS.map(({ value, label }) => (
            <Button
              key={value}
              aria-pressed={groupBy === value}
              variant={groupBy === value ? 'contained' : 'outlined'}
              onClick={() => handleGroupByChange(value)}
            >
              {label}
            </Button>
          ))}
        </ButtonGroup>
      </Box>

      {/* 結果一覧 */}
      {isGrouped ? (
        <Box>
          {groups.map((group) => {
            const collapsed = collapsedGroups.has(group.key);
            return (
              <Box key={group.key} data-testid="group-container" data-collapsed={collapsed}>
                {/* グループヘッダー */}
                <Box
                  data-testid="group-header"
                  onClick={() => toggleGroup(group.key)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 2,
                    py: 1,
                    cursor: 'pointer',
                    bgcolor: 'action.hover',
                    '&:hover': { bgcolor: 'action.selected' },
                    userSelect: 'none',
                  }}
                >
                  {collapsed ? (
                    <ExpandMoreIcon fontSize="small" />
                  ) : (
                    <ExpandLessIcon fontSize="small" />
                  )}
                  <Typography variant="subtitle2" fontWeight="bold">
                    {group.label}
                  </Typography>
                  <Chip
                    data-testid="group-count"
                    label={group.items.length}
                    size="small"
                    sx={{ height: 20, fontSize: '0.7rem' }}
                  />
                </Box>

                {/* グループ内メッセージ */}
                <Collapse in={!collapsed}>
                  <List disablePadding>
                    {group.items.map((result) => (
                      <ResultItem
                        key={result.id}
                        result={result}
                        keyword={keyword}
                        onCopy={handleCopy}
                        onNavigate={onNavigate}
                      />
                    ))}
                  </List>
                </Collapse>
              </Box>
            );
          })}
        </Box>
      ) : (
        <List disablePadding>
          {results.map((result) => (
            <ResultItem
              key={result.id}
              result={result}
              keyword={keyword}
              onCopy={handleCopy}
              onNavigate={onNavigate}
            />
          ))}
        </List>
      )}
    </Box>
  );
}
