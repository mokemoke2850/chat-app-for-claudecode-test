import { useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  FormControl,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import type { TagSuggestion, User } from '@chat-app/shared';
import { use } from 'react';
import { api } from '../../api/client';
import { useTagSuggestions } from '../../hooks/useTagSuggestions';

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
  // Autocomplete の入力値（候補取得 prefix）
  const [tagInput, setTagInput] = useState('');
  // 選択済みタグ（id 付き）
  const [filterTags, setFilterTags] = useState<TagSuggestion[]>([]);
  // 既存タグ候補（前方一致・use_count 降順）
  const tagSuggestions = useTagSuggestions(tagInput);

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

  function handleTagsChange(newTags: TagSuggestion[]) {
    // 同一 ID 重複を除去（候補リスト再取得時に同じタグが再選択された場合のガード）
    const dedup = newTags.filter((t, i) => newTags.findIndex((x) => x.id === t.id) === i);
    setFilterTags(dedup);
    onFilterChange(buildFilters(dateFrom, dateTo, userId, hasAttachment, dedup));
  }

  function handleReset() {
    setDateFrom('');
    setDateTo('');
    setUserId('');
    setHasAttachment('');
    setDateError('');
    setTagInput('');
    setFilterTags([]);
    onFilterChange({});
  }

  // 既に選択済みの ID は候補から除外する（重複選択防止）
  const selectedIds = new Set(filterTags.map((t) => t.id));
  const optionsForAutocomplete = tagSuggestions.filter((s) => !selectedIds.has(s.id));

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

      {/* タグフィルタ — Autocomplete (multiple, freeSolo=false) */}
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
          タグで絞り込み
        </Typography>
        <Autocomplete
          multiple
          size="small"
          value={filterTags}
          onChange={(_, newValue) => handleTagsChange(newValue)}
          inputValue={tagInput}
          onInputChange={(_, newInput, reason) => {
            // 選択直後に reset で空入力に戻されるのは想定動作
            if (reason !== 'reset') setTagInput(newInput);
            else setTagInput('');
          }}
          options={optionsForAutocomplete}
          getOptionLabel={(option) => option.name}
          isOptionEqualToValue={(o, v) => o.id === v.id}
          filterOptions={(x) => x} // サーバー側の前方一致候補をそのまま使う
          noOptionsText={tagInput ? '一致するタグなし' : 'タグ名を入力...'}
          renderOption={(props, option) => (
            <li {...props} key={option.id}>
              <Box>
                <Typography variant="body2">#{option.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {option.useCount} 件
                </Typography>
              </Box>
            </li>
          )}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder="タグで絞り込み..."
              inputProps={{
                ...params.inputProps,
                'aria-label': 'タグで絞り込み',
                'data-testid': 'tag-filter-input',
              }}
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {tagInput && tagSuggestions.length === 0 ? (
                      <CircularProgress size={14} />
                    ) : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
        />
      </Box>

      <Button variant="outlined" size="small" onClick={handleReset}>
        リセット
      </Button>
    </Box>
  );
}
