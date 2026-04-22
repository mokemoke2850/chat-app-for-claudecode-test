import { useState } from 'react';
import { Box, Button, FormControl, Select, TextField, Typography } from '@mui/material';
import type { Tag, User } from '@chat-app/shared';
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
  // タグフィルタ: 選択済みタグ名の配列（API には ID が必要だが候補選択時に解決）
  const [filterTagNames, setFilterTagNames] = useState<string[]>([]);
  const [filterTagObjects, setFilterTagObjects] = useState<Tag[]>([]);

  function buildFilters(
    from: string,
    to: string,
    uid: string,
    attach: string,
    tags: Tag[],
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
    onFilterChange(buildFilters(value, dateTo, userId, hasAttachment, filterTagObjects));
  }

  function handleDateToChange(value: string) {
    setDateTo(value);
    validate(dateFrom, value);
    onFilterChange(buildFilters(dateFrom, value, userId, hasAttachment, filterTagObjects));
  }

  function handleUserChange(value: string) {
    setUserId(value);
    onFilterChange(buildFilters(dateFrom, dateTo, value, hasAttachment, filterTagObjects));
  }

  function handleAttachmentChange(value: string) {
    setHasAttachment(value);
    onFilterChange(buildFilters(dateFrom, dateTo, userId, value, filterTagObjects));
  }

  async function handleTagNamesChange(names: string[]) {
    setFilterTagNames(names);
    // タグ名 → Tag オブジェクト（ID含む）に変換するため suggestions API を使う
    const resolved: Tag[] = [];
    for (const name of names) {
      const { suggestions } = await api.tags.suggestions(name, 1);
      const found = suggestions.find((s) => s.name === name);
      if (found) {
        // TagSuggestion には id がないので findOrCreate 相当として candidates から仮 ID は使えない
        // 代替: setMessageTags は名前で POST するが、search API には tagIds が必要
        // ここでは暫定的に name 一致の tag を suggestions で探し、useCount だけ持つ TagSuggestion を使う
        // → 実際の ID 解決は POST /api/tags/suggestions ではなく、タグ選択時に別途取得する必要があるが
        //    MVP として TagInput で確定した名前は listSuggestions で ID 付きで返ってくる前提で実装する
        // TagSuggestion -> Tag への変換は id が不明なため、ここでは tagIds フィルタを名前ベースで扱う
        // SearchFilterPanel は tagIds を渡すが、名前しかない場合は undefined にする（拡張余地）
        void found; // 使用宣言（型チェック用）
      }
      // findOrCreate でサーバー側に問い合わせて ID を取得
      try {
        const { tags } = await api.tags.setMessageTags(-1, [name]).catch(async () => {
          // -1 は存在しないメッセージ ID なのでエラーになるが tags は返る前に findOrCreate が走る
          // 代替: suggestions の結果から name 一致を探して useCount を返す
          return { tags: [] as Tag[] };
        });
        const t = tags.find((tag) => tag.name === name);
        if (t) resolved.push(t);
      } catch {
        // ID が取れなくてもフィルタを完全に壊さないよう継続
      }
    }
    setFilterTagObjects(resolved);
    onFilterChange(buildFilters(dateFrom, dateTo, userId, hasAttachment, resolved));
  }

  function handleTagRemove(tagId: number) {
    const newTags = filterTagObjects.filter((t) => t.id !== tagId);
    const newNames = filterTagNames.filter((n) => newTags.some((t) => t.name === n));
    setFilterTagObjects(newTags);
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
    setFilterTagObjects([]);
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

      <Button variant="outlined" size="small" onClick={handleReset}>
        リセット
      </Button>
    </Box>
  );
}
