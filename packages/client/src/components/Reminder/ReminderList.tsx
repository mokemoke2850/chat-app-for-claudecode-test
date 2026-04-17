import { use, useState, Suspense } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  CircularProgress,
  Tooltip,
  Divider,
  Paper,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AlarmIcon from '@mui/icons-material/Alarm';
import { api } from '../../api/client';
import type { Reminder } from '@chat-app/shared';

let _remindersPromise: Promise<{ reminders: Reminder[] }> | null = null;

export function resetRemindersCache(): void {
  _remindersPromise = null;
}

function getOrCreateRemindersPromise(): Promise<{ reminders: Reminder[] }> {
  if (!_remindersPromise) {
    _remindersPromise = api.reminders.list();
  }
  return _remindersPromise;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('ja-JP', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getMessagePreview(content: string): string {
  try {
    const parsed = JSON.parse(content) as { ops?: { insert?: string | object }[] };
    return (
      parsed.ops
        ?.map((op) => (typeof op.insert === 'string' ? op.insert : ''))
        .join('')
        .trim()
        .slice(0, 80) ?? content
    );
  } catch {
    return content;
  }
}

interface ReminderListContentProps {
  remindersPromise: Promise<{ reminders: Reminder[] }>;
}

function ReminderListContent({ remindersPromise }: ReminderListContentProps) {
  const { reminders: initialReminders } = use(remindersPromise);
  const [reminders, setReminders] = useState<Reminder[]>(initialReminders);

  const handleDelete = async (id: number) => {
    await api.reminders.delete(id);
    setReminders((prev) => prev.filter((r) => r.id !== id));
  };

  if (reminders.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <AlarmIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
        <Typography color="text.secondary">リマインダーはありません</Typography>
      </Box>
    );
  }

  return (
    <List>
      {reminders.map((reminder, index) => {
        const preview = reminder.message
          ? getMessagePreview(reminder.message.content)
          : `メッセージID: ${reminder.messageId}`;

        return (
          <Box key={reminder.id}>
            <ListItem>
              <ListItemText
                primary={preview}
                secondary={formatDate(reminder.remindAt)}
              />
              <ListItemSecondaryAction>
                <Tooltip title="リマインダーを削除">
                  <IconButton
                    size="small"
                    aria-label="リマインダーを削除"
                    onClick={() => void handleDelete(reminder.id)}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </ListItemSecondaryAction>
            </ListItem>
            {index < reminders.length - 1 && <Divider />}
          </Box>
        );
      })}
    </List>
  );
}

export default function ReminderList() {
  const remindersPromise = getOrCreateRemindersPromise();

  return (
    <Paper sx={{ p: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.5 }}>
        <AlarmIcon color="primary" />
        <Typography variant="subtitle1" fontWeight="bold">
          リマインダー一覧
        </Typography>
      </Box>
      <Divider />
      <Suspense fallback={<Box sx={{ p: 2 }}><CircularProgress size={24} /></Box>}>
        <ReminderListContent remindersPromise={remindersPromise} />
      </Suspense>
    </Paper>
  );
}
