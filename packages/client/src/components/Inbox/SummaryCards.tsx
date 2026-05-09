import { Box, Card, CardActionArea, CardContent, Typography } from '@mui/material';
import type { CalendarEvent, Channel, Task } from '@chat-app/shared';

export type SummaryData = [{ channels: Channel[] }, { events: CalendarEvent[] }, { tasks: Task[] }];

interface Props {
  data: SummaryData;
  onUnreadClick?: () => void;
  onEventsClick?: () => void;
  onTasksClick?: () => void;
}

/**
 * Inbox 上部のサマリーカード 3 連 (未読 / 今日の予定 / 未完タスク)。
 *
 * 純粋コンポーネントとして data を受け取って描画するだけにし、Promise の解決は親
 * (InboxPage の Suspense ラッパー) に委譲する責務分離パターン。
 *
 * 各カードは onClick ハンドラを受け取り、クリック時に対応するビューへ遷移できる。
 */
export default function SummaryCards({ data, onUnreadClick, onEventsClick, onTasksClick }: Props) {
  const [{ channels }, { events }, { tasks }] = data;

  const unreadTotal = channels.reduce((sum, ch) => sum + (ch.unreadCount ?? 0), 0);
  const eventsCount = events.length;
  const todoCount = tasks.filter((t) => t.status !== 'done').length;

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
      <Card data-testid="summary-unread" variant="outlined">
        <CardActionArea onClick={onUnreadClick} aria-label="未読メッセージを見る">
          <CardContent>
            <Typography variant="caption" color="text.secondary">
              未読
            </Typography>
            <Typography variant="h4" fontWeight={600}>
              {unreadTotal}
            </Typography>
          </CardContent>
        </CardActionArea>
      </Card>
      <Card data-testid="summary-events" variant="outlined">
        <CardActionArea onClick={onEventsClick} aria-label="今日の予定を見る">
          <CardContent>
            <Typography variant="caption" color="text.secondary">
              今日の予定
            </Typography>
            <Typography variant="h4" fontWeight={600}>
              {eventsCount}
            </Typography>
          </CardContent>
        </CardActionArea>
      </Card>
      <Card data-testid="summary-tasks" variant="outlined">
        <CardActionArea onClick={onTasksClick} aria-label="未完タスクを見る">
          <CardContent>
            <Typography variant="caption" color="text.secondary">
              未完タスク
            </Typography>
            <Typography variant="h4" fontWeight={600}>
              {todoCount}
            </Typography>
          </CardContent>
        </CardActionArea>
      </Card>
    </Box>
  );
}
