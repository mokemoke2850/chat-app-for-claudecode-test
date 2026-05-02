import { Box, Card, CardContent, Typography } from '@mui/material';
import type { Reminder } from '@chat-app/shared';

interface Props {
  reminders: Reminder[];
}

function parseMessageContent(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { ops?: { insert?: string | object }[] };
    return (
      parsed.ops
        ?.map((op) => (typeof op.insert === 'string' ? op.insert : ''))
        .join('')
        .trim() ?? raw
    );
  } catch {
    return raw;
  }
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString([], {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Step 6a: Inbox の「リマインダー」タブ表示用の純粋コンポーネント。
 * Promise の解決は親 (InboxPage) の Suspense で行い、ここには配列を受け取って描画するだけにする。
 */
export default function RemindersList({ reminders }: Props) {
  if (reminders.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
        リマインダーはありません
      </Typography>
    );
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {reminders.map((r) => (
        <Card key={r.id} variant="outlined" data-testid="reminder-card">
          <CardContent>
            <Typography variant="caption" color="text.secondary">
              ⏰ {formatDateTime(r.remindAt)}
            </Typography>
            <Typography variant="body2">
              {r.message ? parseMessageContent(r.message.content) : '(メッセージが見つかりません)'}
            </Typography>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}
