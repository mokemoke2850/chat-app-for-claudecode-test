import { Box, Card, CardActionArea, CardContent, Chip, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import type { CalendarEvent, Channel, Task } from '@chat-app/shared';

export type SummaryData = [
  { channels: Channel[]; dmUnreadCount: number; threadUnreadCount: number },
  { events: CalendarEvent[] },
  { tasks: Task[] },
];

interface Props {
  data: SummaryData;
  currentUserId?: number;
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
 * Issue #320: 各カードに内訳チップを追加。件数 0 のチップは非表示。
 * チップクリックで対応ビューへ navigate する。
 */
export default function SummaryCards({
  data,
  currentUserId,
  onUnreadClick,
  onEventsClick,
  onTasksClick,
}: Props) {
  const navigate = useNavigate();
  const [{ channels, dmUnreadCount = 0, threadUnreadCount = 0 }, { events }, { tasks }] = data;

  const channelUnreadCount = channels.reduce((sum, ch) => sum + (ch.unreadCount ?? 0), 0);
  const unreadTotal = channelUnreadCount + dmUnreadCount + threadUnreadCount;
  const eventsCount = events.length;
  const todoCount = tasks.filter((t) => t.status !== 'done').length;

  // 今日の予定の主催 / 参加 内訳
  const organizerCount = currentUserId
    ? events.filter((e) => e.organizerId === currentUserId).length
    : 0;
  const attendeeCount = currentUserId
    ? events.filter(
        (e) =>
          e.organizerId !== currentUserId && e.attendees.some((a) => a.userId === currentUserId),
      ).length
    : 0;

  // 未完タスクの自分担当 / その他 内訳
  const incompleteTasks = tasks.filter((t) => t.status !== 'done');
  const myTaskCount = currentUserId
    ? incompleteTasks.filter((t) => t.assigneeId === currentUserId).length
    : 0;
  const othersTaskCount = currentUserId
    ? incompleteTasks.filter((t) => t.assigneeId !== currentUserId).length
    : incompleteTasks.length;

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
      {/* 未読カード */}
      <Card data-testid="summary-unread" variant="outlined">
        <CardActionArea onClick={onUnreadClick} aria-label="未読メッセージを見る">
          <CardContent>
            <Typography variant="caption" color="text.secondary">
              未読
            </Typography>
            <Typography variant="h4" fontWeight={600}>
              {unreadTotal}
            </Typography>
            {/* 内訳チップ: 件数 > 0 のもののみ表示 */}
            {(channelUnreadCount > 0 || dmUnreadCount > 0 || threadUnreadCount > 0) && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                {channelUnreadCount > 0 && (
                  <Chip
                    data-testid="chip-unread-channel"
                    label={`チャンネル ${channelUnreadCount}`}
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/?tab=mentions');
                    }}
                  />
                )}
                {dmUnreadCount > 0 && (
                  <Chip
                    data-testid="chip-unread-dm"
                    label={`DM ${dmUnreadCount}`}
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/dm');
                    }}
                  />
                )}
                {threadUnreadCount > 0 && (
                  <Chip
                    data-testid="chip-unread-thread"
                    label={`スレッド ${threadUnreadCount}`}
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/?tab=threads');
                    }}
                  />
                )}
              </Box>
            )}
          </CardContent>
        </CardActionArea>
      </Card>

      {/* 今日の予定カード */}
      <Card data-testid="summary-events" variant="outlined">
        <CardActionArea onClick={onEventsClick} aria-label="今日の予定を見る">
          <CardContent>
            <Typography variant="caption" color="text.secondary">
              今日の予定
            </Typography>
            <Typography variant="h4" fontWeight={600}>
              {eventsCount}
            </Typography>
            {/* 内訳チップ: 合計 > 0 のときのみ表示 */}
            {eventsCount > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                {organizerCount > 0 && (
                  <Chip
                    data-testid="chip-event-organizer"
                    label={`主催 ${organizerCount}`}
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/calendar?date=today&role=organizer');
                    }}
                  />
                )}
                {attendeeCount > 0 && (
                  <Chip
                    data-testid="chip-event-attendee"
                    label={`参加 ${attendeeCount}`}
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/calendar?date=today&role=attendee');
                    }}
                  />
                )}
              </Box>
            )}
          </CardContent>
        </CardActionArea>
      </Card>

      {/* 未完タスクカード */}
      <Card data-testid="summary-tasks" variant="outlined">
        <CardActionArea onClick={onTasksClick} aria-label="未完タスクを見る">
          <CardContent>
            <Typography variant="caption" color="text.secondary">
              未完タスク
            </Typography>
            <Typography variant="h4" fontWeight={600}>
              {todoCount}
            </Typography>
            {/* 内訳チップ: 未完タスク > 0 のときのみ表示 */}
            {todoCount > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                {myTaskCount > 0 && (
                  <Chip
                    data-testid="chip-task-mine"
                    label={`自分担当 ${myTaskCount}`}
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/tasks?status=open&mine=true');
                    }}
                  />
                )}
                {othersTaskCount > 0 && (
                  <Chip
                    data-testid="chip-task-others"
                    label={`その他 ${othersTaskCount}`}
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/tasks?status=open&mine=false');
                    }}
                  />
                )}
              </Box>
            )}
          </CardContent>
        </CardActionArea>
      </Card>
    </Box>
  );
}
