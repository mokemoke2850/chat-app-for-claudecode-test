import { useState, useCallback } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ScheduleSendIcon from '@mui/icons-material/ScheduleSend';
import type { CreateScheduledMessageInput } from '@chat-app/shared';
import { api } from '../../api/client';
import { useSnackbar } from '../../contexts/SnackbarContext';

interface Props {
  channelId: number;
  content: string;
  disabled?: boolean;
  onScheduled?: () => void;
}

/** datetime-local input の value を UTC ISO 文字列に変換する */
function localDatetimeToUtcIso(localDatetime: string): string {
  return new Date(localDatetime).toISOString();
}

/** 現在時刻 + 1時間を datetime-local input の初期値として返す */
function defaultDatetimeLocal(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  // yyyy-MM-ddTHH:mm 形式
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

export default function ScheduleSendButton({ channelId, content, disabled, onScheduled }: Props) {
  const [open, setOpen] = useState(false);
  const [datetimeLocal, setDatetimeLocal] = useState(defaultDatetimeLocal);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { showSuccess, showError } = useSnackbar();

  const handleOpen = useCallback(() => {
    setDatetimeLocal(defaultDatetimeLocal());
    setError(null);
    setOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    setError(null);
  }, []);

  const handleSchedule = useCallback(async () => {
    const scheduledAt = localDatetimeToUtcIso(datetimeLocal);
    if (new Date(scheduledAt) <= new Date()) {
      setError('未来の日時を指定してください');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const input: CreateScheduledMessageInput = {
        channelId,
        content,
        scheduledAt,
      };
      await api.scheduledMessages.create(input);
      const localStr = new Date(scheduledAt).toLocaleString();
      showSuccess(`${localStr} に予約しました`);
      setOpen(false);
      onScheduled?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '予約に失敗しました';
      showError(msg);
    } finally {
      setLoading(false);
    }
  }, [channelId, content, datetimeLocal, onScheduled, showSuccess, showError]);

  const canSchedule = content.trim().length > 0;

  return (
    <>
      <Tooltip title="送信日時を予約">
        <span>
          <IconButton
            size="small"
            aria-label="送信日時を予約"
            disabled={disabled}
            onMouseDown={(e) => {
              e.preventDefault();
              handleOpen();
            }}
            sx={{ p: 0.25 }}
          >
            <ScheduleSendIcon fontSize="small" sx={{ color: 'text.secondary' }} />
          </IconButton>
        </span>
      </Tooltip>

      <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
        <DialogTitle>送信日時を予約</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="送信日時"
              type="datetime-local"
              value={datetimeLocal}
              onChange={(e) => {
                setDatetimeLocal(e.target.value);
                setError(null);
              }}
              InputLabelProps={{ shrink: true }}
              fullWidth
              size="small"
            />
            {error && (
              <Typography variant="caption" color="error">
                {error}
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>閉じる</Button>
          <Button
            variant="contained"
            onClick={() => void handleSchedule()}
            disabled={!canSchedule || loading}
          >
            予約する
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
