import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Alert,
  Box,
  Typography,
} from '@mui/material';
import type { User, Channel } from '@chat-app/shared';
import { api } from '../../api/client';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
  users?: User[];
  channels?: Channel[];
  initialChannelId?: number;
  sourceMessageId?: number | null;
  sourceMessageContent?: string | null;
}

export default function CreateTaskDialog({
  open,
  onClose,
  onCreated,
  users = [],
  channels = [],
  initialChannelId,
  sourceMessageId = null,
  sourceMessageContent = null,
}: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState<number | ''>('');
  const [channelId, setChannelId] = useState<number | ''>(initialChannelId ?? '');
  const [dueAt, setDueAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleClose = () => {
    setTitle('');
    setDescription('');
    setAssigneeId('');
    setChannelId(initialChannelId ?? '');
    setDueAt('');
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('タイトルを入力してください');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.tasks.create({
        title: title.trim(),
        description: description || undefined,
        assigneeId: assigneeId !== '' ? assigneeId : null,
        dueAt: dueAt || null,
        sourceMessageId: sourceMessageId ?? null,
      });
      onCreated?.();
      handleClose();
    } catch (err: unknown) {
      setError((err as Error).message ?? 'タスクの作成に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>タスクを作成</DialogTitle>
      <DialogContent>
        {sourceMessageId != null && sourceMessageContent && (
          <Box
            sx={{
              mb: 2,
              p: 1.5,
              bgcolor: 'action.hover',
              borderRadius: 1,
              borderLeft: '3px solid',
              borderLeftColor: 'primary.main',
            }}
          >
            <Typography variant="caption" color="text.secondary">
              元メッセージ
            </Typography>
            <Typography variant="body2" noWrap>
              {sourceMessageContent}
            </Typography>
          </Box>
        )}

        {sourceMessageId != null && !sourceMessageContent && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary">
              メッセージID: {sourceMessageId}
            </Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          label="タイトル"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          fullWidth
          required
          sx={{ mb: 2, mt: 1 }}
          autoFocus
          error={!title.trim() && error !== null}
        />

        <TextField
          label="説明（任意）"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          fullWidth
          multiline
          rows={3}
          sx={{ mb: 2 }}
        />

        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>担当者（任意）</InputLabel>
          <Select
            value={assigneeId}
            label="担当者（任意）"
            onChange={(e) => setAssigneeId(e.target.value as number | '')}
            inputProps={{ 'aria-label': '担当者' }}
          >
            <MenuItem value="">未割り当て</MenuItem>
            {users.map((u) => (
              <MenuItem key={u.id} value={u.id}>
                {u.displayName ?? u.username}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {channels.length > 0 && (
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>チャンネル（任意）</InputLabel>
            <Select
              value={channelId}
              label="チャンネル（任意）"
              onChange={(e) => setChannelId(e.target.value as number | '')}
              inputProps={{ 'aria-label': 'チャンネル' }}
            >
              <MenuItem value="">未選択</MenuItem>
              {channels.map((ch) => (
                <MenuItem key={ch.id} value={ch.id}>
                  #{ch.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <TextField
          label="期限（任意）"
          type="datetime-local"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
          fullWidth
          InputLabelProps={{ shrink: true }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={submitting}>
          キャンセル
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSubmit()}
          disabled={!title.trim() || submitting}
        >
          作成
        </Button>
      </DialogActions>
    </Dialog>
  );
}
