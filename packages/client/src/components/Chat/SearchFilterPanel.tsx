import { useState } from 'react';
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import type { User } from '@chat-app/shared';
import { use } from 'react';
import { api } from '../../api/client';

// モジュールレベルでPromiseを一度だけ生成（Suspenseによるアンマウント時のリセットを防ぐ）
const usersPromise = api.auth.users();

export interface SearchFilters {
  dateFrom?: string;
  dateTo?: string;
  userId?: number;
  hasAttachment?: boolean;
}

interface Props {
  onFilterChange: (filters: SearchFilters) => void;
}

function UserSelectInner({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { users } = use(usersPromise);

  return (
    <FormControl size="small" fullWidth>
      <InputLabel id="sender-label" htmlFor="sender-select">送信者</InputLabel>
      <Select
        labelId="sender-label"
        inputProps={{ id: 'sender-select' }}
        label="送信者"
        value={value}
        onChange={(e) => onChange(e.target.value as string)}
        native
      >
        <option value="">すべて</option>
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

  function buildFilters(
    from: string,
    to: string,
    uid: string,
    attach: string,
  ): SearchFilters {
    return {
      dateFrom: from || undefined,
      dateTo: to || undefined,
      userId: uid ? Number(uid) : undefined,
      hasAttachment:
        attach === 'true' ? true : attach === 'false' ? false : undefined,
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
    onFilterChange(buildFilters(value, dateTo, userId, hasAttachment));
  }

  function handleDateToChange(value: string) {
    setDateTo(value);
    validate(dateFrom, value);
    onFilterChange(buildFilters(dateFrom, value, userId, hasAttachment));
  }

  function handleUserChange(value: string) {
    setUserId(value);
    onFilterChange(buildFilters(dateFrom, dateTo, value, hasAttachment));
  }

  function handleAttachmentChange(value: string) {
    setHasAttachment(value);
    onFilterChange(buildFilters(dateFrom, dateTo, userId, value));
  }

  function handleReset() {
    setDateFrom('');
    setDateTo('');
    setUserId('');
    setHasAttachment('');
    setDateError('');
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
        <InputLabel id="attachment-label" htmlFor="attachment-select">添付ファイル</InputLabel>
        <Select
          labelId="attachment-label"
          inputProps={{ id: 'attachment-select' }}
          label="添付ファイル"
          value={hasAttachment}
          onChange={(e) => handleAttachmentChange(e.target.value as string)}
          native
        >
          <option value="">すべて</option>
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
