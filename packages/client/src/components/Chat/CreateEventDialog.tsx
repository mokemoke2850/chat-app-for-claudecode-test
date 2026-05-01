// #108 会話イベント投稿 — イベント作成・編集ダイアログ
// タイトル / 開始日時 / 終了日時 / 説明を受け取り api.events.create または api.events.update を呼ぶ。
// #179: editEvent prop を渡すと編集モードになる。

import { useState, useEffect } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material';
import type { ChatEvent } from '@chat-app/shared';
import { api } from '../../api/client';
import { useSnackbar } from '../../contexts/SnackbarContext';

/** datetime-local input 用フォーマット (YYYY-MM-DDTHH:mm) */
function toDateTimeLocal(isoString: string): string {
  // ISO 文字列を datetime-local input の値形式に変換する
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Props {
  open: boolean;
  channelId: number;
  onClose: () => void;
  onCreated?: (event: ChatEvent) => void;
  /** 渡すと編集モードになる */
  editEvent?: ChatEvent;
  onUpdated?: (event: ChatEvent) => void;
}

export default function CreateEventDialog({
  open,
  channelId,
  onClose,
  onCreated,
  editEvent,
  onUpdated,
}: Props) {
  const isEditMode = editEvent !== undefined;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showError } = useSnackbar();

  // 編集モード時は開くたびに既存値をセット
  useEffect(() => {
    if (open && isEditMode && editEvent) {
      setTitle(editEvent.title);
      setDescription(editEvent.description ?? '');
      setStartsAt(toDateTimeLocal(editEvent.startsAt));
      setEndsAt(editEvent.endsAt ? toDateTimeLocal(editEvent.endsAt) : '');
      setError(null);
    } else if (open && !isEditMode) {
      setTitle('');
      setDescription('');
      setStartsAt('');
      setEndsAt('');
      setError(null);
    }
  }, [open, isEditMode, editEvent]);

  const reset = () => {
    setTitle('');
    setDescription('');
    setStartsAt('');
    setEndsAt('');
    setError(null);
  };

  const handleSubmit = async () => {
    setError(null);
    if (!title.trim()) {
      setError('タイトルを入力してください');
      return;
    }
    if (!startsAt) {
      setError('開始日時を入力してください');
      return;
    }
    if (endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
      setError('終了日時は開始日時より後にしてください');
      return;
    }

    setSubmitting(true);
    try {
      if (isEditMode && editEvent) {
        const res = await api.events.update(editEvent.id, {
          title: title.trim(),
          description: description || null,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: endsAt ? new Date(endsAt).toISOString() : null,
        });
        onUpdated?.(res.event);
        onClose();
      } else {
        const res = await api.events.create({
          channelId,
          title: title.trim(),
          description: description || undefined,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
        });
        onCreated?.(res.event);
        reset();
        onClose();
      }
    } catch (err) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : isEditMode
            ? 'イベントの更新に失敗しました'
            : 'イベントの作成に失敗しました';
      setError(msg);
      showError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{isEditMode ? 'イベントを編集' : 'イベントを作成'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="タイトル"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            inputProps={{ 'aria-label': 'event-title' }}
          />
          <TextField
            label="開始日時"
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            InputLabelProps={{ shrink: true }}
            required
            inputProps={{ 'aria-label': 'event-starts-at' }}
          />
          <TextField
            label="終了日時"
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            InputLabelProps={{ shrink: true }}
            inputProps={{ 'aria-label': 'event-ends-at' }}
          />
          <TextField
            label="説明（任意）"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            minRows={2}
            inputProps={{ 'aria-label': 'event-description' }}
          />
          {error && (
            <div role="alert" style={{ color: 'red' }}>
              {error}
            </div>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          キャンセル
        </Button>
        <Button onClick={() => void handleSubmit()} variant="contained" disabled={submitting}>
          {isEditMode ? '保存' : '作成'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
