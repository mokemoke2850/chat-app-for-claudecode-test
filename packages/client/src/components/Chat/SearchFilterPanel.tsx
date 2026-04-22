import { useState } from 'react';
import { Box, Button, FormControl, Select, TextField, Typography } from '@mui/material';
import type { TagSuggestion, User } from '@chat-app/shared';
import { use } from 'react';
import { api } from '../../api/client';
import TagInput from './TagInput';
import TagChip from './TagChip';

// モジュールレベルでPromiseを一度だけ生成（Suspenseによるアンマウント時のリセットを防ぐ）
const usersPromise = api.auth.users();

export interface SearchFilters {
  dateFrom?: string;
  dateTo?: string;
  userId?: number;
  hasAttachment?: boolean;
  tagIds?: number[];
}

interface Props {
  onFilterChange: (filters: SearchFilters) => void;
}

function UserSelectInner({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { users } = use(usersPromise);

  return (
    <FormControl size="small" fullWidth>
      <Select
        inputProps={{ id: 'sender-select', 'aria-label': '送信者' }}
        value={value}
        onChange={(e) => onChange(e.target.value as string)}
        native
      >
        <option value="">送信者: すべて</option>
        {users.map((u: User) => (
          <option key={u.id} value={String(u.id)}>
            {u.username}
          </option>
        ))}
      </Select>
    </FormControl>
  );
}

export default function SearchFilterPanel({ onFilterChange }: Props) {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [userId, setUserId] = useState('');
  const [hasAttachment, setHasAttachment] = useState('');
  const [dateError, setDateError] = useState('');
  // タグフィルタ: 選択済みタグ（TagSuggestion は id を持つ）
  const [filterTags, setFilterTags] = useState<TagSuggestion[]>([]);
  // TagInput が扱う name[] - TagSuggestion から変換
  const [filterTagNames, setFilterTagNames] = useState<string[]>([]);

  function buildFilters(
    from: string,
    to: string,
    uid: string,
    attach: string,
    tags: TagSuggestion[],
  ): SearchFilters {
    return {
      dateFrom: from || undefined,
      dateTo: to || undefined,
      userId: uid ? Number(uid) : undefined,
      hasAttachment: attach === 'true' ? true : attach === 'false' ? false : undefined,
      tagIds: tags.length > 0 ? tags.map((t) => t.id) : undefined,
    };
  }

  function validate(from: string, to: string): boolean {
    if (from && to && new Date(from) > new Date(to)) {
      setDateError('開始日は終了日より前の日付を指定してください');
      return false;
    }
    setDateError('');
    return true;
  }

  function handleDateFromChange(value: string) {
    setDateFrom(value);
    validate(value, dateTo);
    onFilterChange(buildFilters(value, dateTo, userId, hasAttachment, filterTags));
  }

  function handleDateToChange(value: string) {
    setDateTo(value);
    validate(dateFrom, value);
    onFilterChange(buildFilters(dateFrom, value, userId, hasAttachment, filterTags));
  }

  function handleUserChange(value: string) {
    setUserId(value);
    onFilterChange(buildFilters(dateFrom, dateTo, value, hasAttachment, filterTags));
  }

  function handleAttachmentChange(value: string) {
    setHasAttachment(value);
    onFilterChange(buildFilters(dateFrom, dateTo, userId, value, filterTags));
  }

  async function handleTagNamesChange(names: string[]) {
    setFilterTagNames(names);
    // タグ名 → TagSuggestion (id 付き) に変換
    const resolved: TagSuggestion[] = [];
    for (const name of names) {
      const { suggestions } = await api.tags.suggestions(name, 1);
      const found = suggestions.find((s) => s.name === name);
      if (found) resolved.push(found);
    }
    setFilterTags(resolved);
    onFilterChange(buildFilters(dateFrom, dateTo, userId, hasAttachment, resolved));
  }

  function handleTagRemove(tagId: number) {
    const newTags = filterTags.filter((t) => t.id !== tagId);
    const newNames = newTags.map((t) => t.name);
    setFilterTags(newTags);
    setFilterTagNames(newNames);
    onFilterChange(buildFilters(dateFrom, dateTo, userId, hasAttachment, newTags));
  }

  function handleReset() {
    setDateFrom('');
    setDateTo('');
    setUserId('');
    setHasAttachment('');
    setDateError('');
    setFilterTagNames([]);
    setFilterTags([]);
    onFilterChange({});
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}>
      <TextField
        label="開始日"
        type="date"
        size="small"
        value={dateFrom}
        onChange={(e) => handleDateFromChange(e.target.value)}
        InputLabelProps={{ shrink: true }}
        inputProps={{ 'aria-label': '開始日' }}
      />
      <TextField
        label="終了日"
        type="date"
        size="small"
        value={dateTo}
        onChange={(e) => handleDateToChange(e.target.value)}
        InputLabelProps={{ shrink: true }}
        inputProps={{ 'aria-label': '終了日' }}
      />
      {dateError && (
        <Typography variant="caption" color="error">
          {dateError}
        </Typography>
      )}

      <UserSelectInner value={userId} onChange={handleUserChange} />

      <FormControl size="small" fullWidth>
        <Select
          inputProps={{ id: 'attachment-select', 'aria-label': '添付ファイル' }}
          value={hasAttachment}
          onChange={(e) => handleAttachmentChange(e.target.value as string)}
          native
        >
          <option value="">添付ファイル: すべて</option>
          <option value="true">添付ファイルあり</option>
          <option value="false">添付ファイルなし</option>
        </Select>
      </FormControl>

      {/* タグフィルタ */}
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
          タグで絞り込み
        </Typography>
        <TagInput
          value={filterTagNames}
          onChange={(names) => void handleTagNamesChange(names)}
          placeholder="タグ名を入力..."
        />
        {filterTags.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
            {filterTags.map((t) => (
              <TagChip
                key={t.id}
                tag={{ id: t.id, name: t.name, useCount: t.useCount, createdAt: '' }}
                readOnly={false}
                onDelete={handleTagRemove}
              />
            ))}
          </Box>
        )}
      </Box>

      <Button variant="outlined" size="small" onClick={handleReset}>
        リセット
      </Button>
    </Box>
  );
}
