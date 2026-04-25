import { use, useState, Suspense } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import CancelIcon from '@mui/icons-material/Cancel';
import EditIcon from '@mui/icons-material/Edit';
import type { ScheduledMessage } from '@chat-app/shared';
import { useSnackbar } from '../../contexts/SnackbarContext';

interface Props {
  open: boolean;
  onClose: () => void;
  promise: Promise<ScheduledMessage[]>;
  onCancel: (id: number) => Promise<ScheduledMessage>;
  onUpdate: (
    id: number,
    patch: { content?: string; scheduledAt?: string },
  ) => Promise<ScheduledMessage>;
  onRefresh: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  pending: '予約中',
  sending: '送信中',
  sent: '送信済み',
  failed: '失敗',
  canceled: 'キャンセル済み',
};

const STATUS_COLORS: Record<string, 'default' | 'primary' | 'success' | 'error' | 'warning'> = {
  pending: 'primary',
  sending: 'warning',
  sent: 'success',
  failed: 'error',
  canceled: 'default',
};

function ScheduledMessageList({
  promise,
  onCancel,
  onUpdate,
}: {
  promise: Promise<ScheduledMessage[]>;
  onCancel: (id: number) => Promise<void>;
  onUpdate: (id: number, patch: { content?: string; scheduledAt?: string }) => Promise<void>;
}) {
  const messages = use(promise);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editDatetime, setEditDatetime] = useState('');

  if (messages.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
        予約された送信はありません
      </Typography>
    );
  }

  const startEdit = (sm: ScheduledMessage) => {
    setEditingId(sm.id);
    setEditContent(sm.content);
    // UTC → datetime-local (yyyy-MM-ddTHH:mm)
    const d = new Date(sm.scheduledAt);
    const pad = (n: number) => String(n).padStart(2, '0');
    setEditDatetime(
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
    );
  };

  const saveEdit = async () => {
    if (editingId == null) return;
    const scheduledAt = new Date(editDatetime).toISOString();
    await onUpdate(editingId, { content: editContent, scheduledAt });
    setEditingId(null);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {messages.map((sm) => (
        <Box
          key={sm.id}
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            p: 1.5,
          }}
        >
          {editingId === sm.id ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <TextField
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                multiline
                minRows={2}
                size="small"
                fullWidth
                label="内容"
              />
              <TextField
                type="datetime-local"
                value={editDatetime}
                onChange={(e) => setEditDatetime(e.target.value)}
                size="small"
                InputLabelProps={{ shrink: true }}
                label="送信日時"
              />
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                <Button size="small" onClick={() => setEditingId(null)}>
                  キャンセル
                </Button>
                <Button size="small" variant="contained" onClick={() => void saveEdit()}>
                  保存
                </Button>
              </Box>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary" display="block">
                  {new Date(sm.scheduledAt).toLocaleString()}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ mt: 0.5, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}
                  noWrap={false}
                >
                  {sm.content}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                <Chip
                  label={STATUS_LABELS[sm.status] ?? sm.status}
                  color={STATUS_COLORS[sm.status] ?? 'default'}
                  size="small"
                />
                {sm.status === 'pending' && (
                  <>
                    <Tooltip title="編集">
                      <IconButton size="small" onClick={() => startEdit(sm)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="キャンセル">
                      <IconButton size="small" onClick={() => void onCancel(sm.id)}>
                        <CancelIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </>
                )}
              </Box>
            </Box>
          )}
        </Box>
      ))}
    </Box>
  );
}

export default function ScheduledMessagesDialog({
  open,
  onClose,
  promise,
  onCancel,
  onUpdate,
  onRefresh,
}: Props) {
  const { showSuccess, showError } = useSnackbar();

  const handleCancel = async (id: number) => {
    try {
      await onCancel(id);
      showSuccess('予約をキャンセルしました');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'キャンセルに失敗しました');
    }
  };

  const handleUpdate = async (id: number, patch: { content?: string; scheduledAt?: string }) => {
    try {
      await onUpdate(id, patch);
      showSuccess('予約を更新しました');
    } catch (err) {
      showError(err instanceof Error ? err.message : '更新に失敗しました');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>予約送信一覧</DialogTitle>
      <DialogContent>
        <Suspense
          fallback={<CircularProgress size={24} sx={{ display: 'block', mx: 'auto', my: 2 }} />}
        >
          <ScheduledMessageList promise={promise} onCancel={handleCancel} onUpdate={handleUpdate} />
        </Suspense>
      </DialogContent>
      <DialogActions>
        <Button onClick={onRefresh} size="small">
          更新
        </Button>
        <Button onClick={onClose}>閉じる</Button>
      </DialogActions>
    </Dialog>
  );
}
