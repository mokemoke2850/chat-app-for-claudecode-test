import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  Box,
  Alert,
} from '@mui/material';
import type { Message } from '@chat-app/shared';
import { api } from '../../api/client';

interface Props {
  open: boolean;
  message: Message;
  onClose: () => void;
  onCreated: () => void;
}

type TimeOption = '30min' | '1hour' | 'tomorrow';

const TIME_OPTIONS: { value: TimeOption; label: string }[] = [
  { value: '30min', label: '30分後' },
  { value: '1hour', label: '1時間後' },
  { value: 'tomorrow', label: '明日' },
];

function getRemindAt(option: TimeOption): string {
  const now = new Date();
  switch (option) {
    case '30min':
      return new Date(now.getTime() + 30 * 60 * 1000).toISOString();
    case '1hour':
      return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    case 'tomorrow': {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      return tomorrow.toISOString();
    }
  }
}

function extractPlainText(content: string): string {
  try {
    const doc = JSON.parse(content);
    // Quill Delta 形式: { ops: [{ insert: string }, ...] }
    if (Array.isArray(doc.ops)) {
      return doc.ops
        .map((op: { insert?: unknown }) => (typeof op.insert === 'string' ? op.insert : ''))
        .join('');
    }
    // ProseMirror 形式: { type, content, text, ... }
    const texts: string[] = [];
    function walk(node: any) {
      if (node.type === 'text') texts.push(node.text ?? '');
      if (node.content) node.content.forEach(walk);
    }
    walk(doc);
    return texts.join('') || content;
  } catch {
    return content;
  }
}

function getMessagePreview(content: string): string {
  return extractPlainText(content).trim().slice(0, 100);
}

export default function ReminderDialog({ open, message, onClose, onCreated }: Props) {
  const [selectedOption, setSelectedOption] = useState<TimeOption>('30min');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = getMessagePreview(message.content);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const remindAt = getRemindAt(selectedOption);
      await api.reminders.create({ messageId: message.id, remindAt });
      onCreated();
      onClose();
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || 'リマインダーの設定に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>リマインダーを設定</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary">
            メッセージ
          </Typography>
          <Typography
            variant="body2"
            sx={{
              p: 1,
              bgcolor: 'grey.100',
              borderRadius: 1,
              mt: 0.5,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {preview}
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
          通知タイミング
        </Typography>
        <ToggleButtonGroup
          value={selectedOption}
          exclusive
          onChange={(_e, val: TimeOption | null) => {
            if (val !== null) setSelectedOption(val);
          }}
          sx={{ display: 'flex', gap: 1 }}
        >
          {TIME_OPTIONS.map((opt) => (
            <ToggleButton key={opt.value} value={opt.value} sx={{ flexGrow: 1 }}>
              {opt.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            エラー: {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          キャンセル
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSubmit()}
          disabled={loading}
          aria-label="リマインダーを設定"
        >
          リマインダーを設定
        </Button>
      </DialogActions>
    </Dialog>
  );
}
