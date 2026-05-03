import { useEffect, useMemo } from 'react';
import { Box, Chip, TextField, Typography } from '@mui/material';
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

/**
 * 検索ページ上部のチップ式フィルタ入力欄 (純粋コンポーネント)。
 * マスタデータ (users / channels / tags) は親 (ChipFilterSection) が Suspense 経由で取得して渡す。
 *
 * 動作:
 *   1. 入力テキストを `parseSearchChips` で同期解析
 *   2. fromUsername / inChannelName / tagName を ID に変換 (大文字小文字無視で照合)
 *   3. `{ keyword, filters }` を親に通知
 *   4. 解析結果のチップを TextField の下に表示 (読み取り専用)
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

  // マスタ照合 → SearchFilters への変換
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

  // resolved が変わるたび親に通知
  useEffect(() => {
    onResolved(resolved);
  }, [resolved, onResolved]);

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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <TextField
        fullWidth
        size="small"
        placeholder="例: from:alice has:file 議事録"
        value={value}
        onChange={(e) => onTextChange(e.target.value)}
        inputProps={{ 'aria-label': 'メッセージ検索' }}
        autoFocus
      />
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
