import { Box, Card, CardContent, Typography } from '@mui/material';
import type { CalendarEvent, Channel, Task } from '@chat-app/shared';

export type SummaryData = [{ channels: Channel[] }, { events: CalendarEvent[] }, { tasks: Task[] }];

interface Props {
  data: SummaryData;
}

/**
 * Step 6a: Inbox 上部のサマリーカード 3 連 (未読 / 今日の予定 / 未完タスク)。
 *
 * 純粋コンポーネントとして data 配列を受け取って描画するだけにし、Promise の解決は
 * 親 (InboxPage 内の Suspense ラッパー) で行う。テスト容易性のためこの分離を採用。
 */
export default function SummaryCards({ data }: Props) {
  const [{ channels }, { events }, { tasks }] = data;

  const unreadTotal = channels.reduce((sum, ch) => sum + (ch.unreadCount ?? 0), 0);
  const eventsCount = events.length;
  const todoCount = tasks.filter((t) => t.status !== 'done').length;

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
      <Card data-testid="summary-unread" variant="outlined">
        <CardContent>
          <Typography variant="caption" color="text.secondary">
            未読
          </Typography>
          <Typography variant="h4" fontWeight={600}>
            {unreadTotal}
          </Typography>
        </CardContent>
      </Card>
      <Card data-testid="summary-events" variant="outlined">
        <CardContent>
          <Typography variant="caption" color="text.secondary">
            今日の予定
          </Typography>
          <Typography variant="h4" fontWeight={600}>
            {eventsCount}
          </Typography>
        </CardContent>
      </Card>
      <Card data-testid="summary-tasks" variant="outlined">
        <CardContent>
          <Typography variant="caption" color="text.secondary">
            未完タスク
          </Typography>
          <Typography variant="h4" fontWeight={600}>
            {todoCount}
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
