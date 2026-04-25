// #108 会話イベント投稿 — イベント作成ダイアログ
// タイトル / 開始日時 / 終了日時 / 説明を受け取り api.events.create を呼ぶ。

import { useState } from 'react';
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

interface Props {
  open: boolean;
  channelId: number;
  onClose: () => void;
  onCreated?: (event: ChatEvent) => void;
}

export default function CreateEventDialog({ open, channelId, onClose, onCreated }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showError } = useSnackbar();

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
    } catch (err) {
      const msg =
        err instanceof Error && err.message ? err.message : 'イベントの作成に失敗しました';
      setError(msg);
      showError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>イベントを作成</DialogTitle>
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
          作成
        </Button>
      </DialogActions>
    </Dialog>
  );
}
