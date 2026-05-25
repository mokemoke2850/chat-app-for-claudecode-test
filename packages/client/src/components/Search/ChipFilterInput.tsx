import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Chip,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import type { User, Channel, Tag } from '@chat-app/shared';
import { parseSearchChips, type ParsedSearchChips } from '../../utils/parseSearchChips';
import type { SearchFilters } from '../Chat/SearchFilterPanel';

interface Props {
  /** 入力中の生テキスト */
  value: string;
  /** テキスト変更時に親に通知 (TextField 直接入力分) */
  onTextChange: (text: string) => void;
  /** 解析 + マスタ照合の結果を親に通知 */
  onResolved: (params: { keyword: string; filters: Partial<SearchFilters> }) => void;
  /** ID 変換用のマスタデータ */
  users: User[];
  channels: Channel[];
  tags: Tag[];
}

const PREFIX_OPTIONS = ['from:', 'in:', 'has:', 'tag:', 'before:', 'after:'] as const;
const HAS_VALUES = ['file', 'link'] as const;
const HISTORY_NAMESPACE = 'searchChipHistory';
const HISTORY_MAX = 10;
type HistoryKey = 'from' | 'in' | 'tag';

function loadHistory(key: HistoryKey): string[] {
  try {
    const raw = localStorage.getItem(`${HISTORY_NAMESPACE}.${key}`);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function saveHistory(key: HistoryKey, value: string): void {
  try {
    const current = loadHistory(key);
    const next = [value, ...current.filter((v) => v !== value)].slice(0, HISTORY_MAX);
    localStorage.setItem(`${HISTORY_NAMESPACE}.${key}`, JSON.stringify(next));
  } catch {
    // localStorage 不可の環境では履歴を諦める
  }
}

/** カーソル位置を含むトークン（空白で区切られた現在編集中の単語）の範囲を返す */
function getActiveToken(
  value: string,
  cursorPos: number,
): { token: string; start: number; end: number } {
  let start = cursorPos;
  let end = cursorPos;
  while (start > 0 && !/\s/.test(value[start - 1])) start--;
  while (end < value.length && !/\s/.test(value[end])) end++;
  return { token: value.slice(start, end), start, end };
}

interface SuggestionItem {
  /** 候補リストに表示する文字列 (role=option の name) */
  display: string;
  /** 補完したときにトークンに置換される文字列 */
  insert: string;
  /** 履歴保存対象のときに記録するキー */
  historyKey?: HistoryKey;
}

interface SuggestionState {
  items: SuggestionItem[];
  tokenStart: number;
  tokenEnd: number;
}

/**
 * カーソル位置のトークンから補完候補を組み立てる。
 *
 * - トークンに `:` が含まれない → 構文プレフィックス (from:/in:/has:/tag:/before:/after:) を前方一致で返す
 * - `from:` / `in:` / `tag:` → マスタデータの名前を前方一致 (大小無視) で返す。履歴を先頭に並べ替える
 * - `has:` → file / link の固定候補を返す
 * - それ以外 (before: / after:) → 候補なし
 */
function buildSuggestions(
  value: string,
  cursorPos: number,
  users: User[],
  channels: Channel[],
  tags: Tag[],
): SuggestionState | null {
  const { token, start, end } = getActiveToken(value, cursorPos);
  const colonIdx = token.indexOf(':');

  if (colonIdx < 0) {
    const lower = token.toLowerCase();
    const items = PREFIX_OPTIONS.filter((p) => p.toLowerCase().startsWith(lower)).map((p) => ({
      display: p,
      insert: p,
    }));
    if (items.length === 0) return null;
    return { items, tokenStart: start, tokenEnd: end };
  }

  const prefix = token.slice(0, colonIdx);
  const valuePart = token.slice(colonIdx + 1);
  const lower = valuePart.toLowerCase();

  let pool: string[];
  let historyKey: HistoryKey | undefined;
  if (prefix === 'from') {
    pool = users.map((u) => u.username);
    historyKey = 'from';
  } else if (prefix === 'in') {
    pool = channels.map((c) => c.name);
    historyKey = 'in';
  } else if (prefix === 'tag') {
    pool = tags.map((t) => t.name);
    historyKey = 'tag';
  } else if (prefix === 'has') {
    pool = [...HAS_VALUES];
  } else {
    return null;
  }

  const filtered = pool.filter((n) => n.toLowerCase().startsWith(lower));
  if (filtered.length === 0) return null;

  const history = historyKey ? loadHistory(historyKey) : [];
  const historyHits = history.filter((h) => filtered.includes(h));
  const remaining = filtered.filter((n) => !historyHits.includes(n));
  const sorted = [...historyHits, ...remaining];

  return {
    items: sorted.map((name) => ({
      display: name,
      insert: `${prefix}:${name}`,
      historyKey,
    })),
    tokenStart: start,
    tokenEnd: end,
  };
}

/**
 * 検索ページ上部のチップ式フィルタ入力欄 (純粋コンポーネント)。
 * マスタデータ (users / channels / tags) は親 (ChipFilterSection) が Suspense 経由で取得して渡す。
 *
 * 動作:
 *   1. 入力テキストを `parseSearchChips` で同期解析
 *   2. fromUsername / inChannelName / tagName を ID に変換 (大文字小文字無視で照合)
 *   3. `{ keyword, filters }` を親に通知
 *   4. 解析結果のチップを TextField の下に表示 (読み取り専用)
 *   5. カーソル位置のトークンから補完候補をリストボックスに表示し
 *      ArrowUp/Down/Enter/Tab/Escape で操作可能 (Issue #326)
 *
 * `has:link` は未対応 (`hasFile` のみ対応)。
 */
export default function ChipFilterInput({
  value,
  onTextChange,
  onResolved,
  users,
  channels,
  tags,
}: Props) {
  const parsed: ParsedSearchChips = useMemo(() => parseSearchChips(value), [value]);

  const resolved = useMemo(() => {
    const filters: Partial<SearchFilters> = {};
    if (parsed.fromUsername) {
      const user = users.find(
        (u) => u.username.toLowerCase() === parsed.fromUsername!.toLowerCase(),
      );
      if (user) filters.userId = user.id;
    }
    if (parsed.inChannelName) {
      const channel = channels.find(
        (c) => c.name.toLowerCase() === parsed.inChannelName!.toLowerCase(),
      );
      if (channel) filters.channelId = channel.id;
    }
    if (parsed.tagName) {
      const tag = tags.find((t) => t.name.toLowerCase() === parsed.tagName!.toLowerCase());
      if (tag) filters.tagIds = [tag.id];
    }
    if (parsed.hasFile !== undefined) filters.hasAttachment = parsed.hasFile;
    if (parsed.beforeDate) filters.dateTo = parsed.beforeDate;
    if (parsed.afterDate) filters.dateFrom = parsed.afterDate;
    return { keyword: parsed.keyword, filters };
  }, [parsed, users, channels, tags]);

  useEffect(() => {
    onResolved(resolved);
  }, [resolved, onResolved]);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [escapeClosed, setEscapeClosed] = useState(false);
  const [cursorPos, setCursorPos] = useState(0);
  const [activeIdx, setActiveIdx] = useState(0);

  const suggestions = useMemo(() => {
    if (!isFocused || escapeClosed) return null;
    return buildSuggestions(value, cursorPos, users, channels, tags);
  }, [isFocused, escapeClosed, value, cursorPos, users, channels, tags]);

  useEffect(() => {
    setActiveIdx(0);
  }, [suggestions]);

  function applySuggestion(
    item: SuggestionItem,
    range: { tokenStart: number; tokenEnd: number },
  ): void {
    const newValue = value.slice(0, range.tokenStart) + item.insert + value.slice(range.tokenEnd);
    onTextChange(newValue);
    if (item.historyKey) saveHistory(item.historyKey, item.display);
    // 補完直後はカーソルを補完後トークンの末尾に移動
    const newCursor = range.tokenStart + item.insert.length;
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(newCursor, newCursor);
      }
    });
    setCursorPos(newCursor);
  }

  function updateCursor(): void {
    const el = inputRef.current;
    if (!el) return;
    setCursorPos(el.selectionStart ?? el.value.length);
  }

  // 解析結果のチップをまとめる (表示用)
  const chips: Array<{ key: string; label: string; matched: boolean }> = [];
  if (parsed.fromUsername) {
    chips.push({
      key: 'from',
      label: `送信者: ${parsed.fromUsername}`,
      matched: resolved.filters.userId !== undefined,
    });
  }
  if (parsed.inChannelName) {
    chips.push({
      key: 'in',
      label: `チャンネル: #${parsed.inChannelName}`,
      matched: resolved.filters.channelId !== undefined,
    });
  }
  if (parsed.hasFile) {
    chips.push({ key: 'has', label: '添付あり', matched: true });
  }
  if (parsed.beforeDate) {
    chips.push({ key: 'before', label: `〜 ${parsed.beforeDate}`, matched: true });
  }
  if (parsed.afterDate) {
    chips.push({ key: 'after', label: `${parsed.afterDate} 〜`, matched: true });
  }
  if (parsed.tagName) {
    chips.push({
      key: 'tag',
      label: `タグ: ${parsed.tagName}`,
      matched: resolved.filters.tagIds !== undefined && resolved.filters.tagIds.length > 0,
    });
  }

  const listboxId = 'chip-filter-suggestions';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, position: 'relative' }}>
      <TextField
        fullWidth
        size="small"
        placeholder="例: from:alice has:file 議事録"
        value={value}
        onChange={(e) => {
          onTextChange(e.target.value);
          setEscapeClosed(false);
          // onChange 後の selectionStart は最新位置
          const target = e.target as HTMLInputElement;
          setCursorPos(target.selectionStart ?? target.value.length);
        }}
        onFocus={() => {
          setIsFocused(true);
          setEscapeClosed(false);
          updateCursor();
        }}
        onBlur={() => setIsFocused(false)}
        onClick={updateCursor}
        onKeyUp={(e) => {
          // ArrowLeft / ArrowRight などのキャレット移動を反映
          if (e.key.startsWith('Arrow') && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') {
            updateCursor();
          }
        }}
        onKeyDown={(e) => {
          if (!suggestions || suggestions.items.length === 0) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIdx((i) => (i + 1) % suggestions.items.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIdx((i) => (i - 1 + suggestions.items.length) % suggestions.items.length);
          } else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            const item = suggestions.items[activeIdx] ?? suggestions.items[0];
            if (item) {
              applySuggestion(item, {
                tokenStart: suggestions.tokenStart,
                tokenEnd: suggestions.tokenEnd,
              });
            }
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setEscapeClosed(true);
          }
        }}
        inputRef={inputRef}
        inputProps={{
          'aria-label': 'メッセージ検索',
          'aria-autocomplete': 'list',
          'aria-controls': listboxId,
          'aria-expanded': !!suggestions,
        }}
        autoFocus
      />
      {suggestions && (
        <Paper
          elevation={3}
          sx={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 10,
            mt: 0.5,
            maxHeight: 280,
            overflowY: 'auto',
          }}
        >
          <List id={listboxId} role="listbox" dense disablePadding>
            {suggestions.items.map((item, idx) => {
              const active = idx === activeIdx;
              return (
                <ListItemButton
                  key={`${item.insert}:${idx}`}
                  role="option"
                  aria-label={item.display}
                  aria-selected={active}
                  selected={active}
                  // mousedown が blur より先に発生するため、blur で suggestions が消えないように抑止
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() =>
                    applySuggestion(item, {
                      tokenStart: suggestions.tokenStart,
                      tokenEnd: suggestions.tokenEnd,
                    })
                  }
                >
                  <ListItemText primary={item.display} primaryTypographyProps={{ fontSize: 14 }} />
                </ListItemButton>
              );
            })}
          </List>
        </Paper>
      )}
      {chips.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }} data-testid="chip-filter-chips">
          {chips.map((c) => (
            <Chip
              key={c.key}
              label={c.label}
              size="small"
              variant="outlined"
              color={c.matched ? 'primary' : 'default'}
              data-testid={`chip-${c.key}`}
            />
          ))}
          {chips.some((c) => !c.matched) && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ alignSelf: 'center', ml: 1 }}
            >
              （灰色のチップはマスタに該当が無いため絞り込みに反映されません）
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}
