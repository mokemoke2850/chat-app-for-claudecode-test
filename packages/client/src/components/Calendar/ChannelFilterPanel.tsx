// Issue #152 — カレンダー画面のチャンネル絞り込み + 今日の予定
// Issue #331 — 一括操作プリセット（全選択 / 全解除 / 未読関連のみ / 自分の参加予定のみ）

import { Box, Button, Checkbox, Divider, FormControlLabel, Stack, Typography } from '@mui/material';
import type { Channel } from '@chat-app/shared';
import type { CalendarEvent } from '@chat-app/shared';
import { fmtTime, sameDay } from '../../utils/calendar';

interface Props {
  channels: Channel[];
  channelColors: Map<number, string>;
  channelFilter: Set<number>;
  onToggleChannel: (channelId: number) => void;
  /** Issue #331: 一括操作（プリセット）で新しい絞り込み Set を親に通知 */
  onChannelFilterChange: (next: Set<number>) => void;
  events: CalendarEvent[];
  today: Date;
  /** Issue #331: 「自分の参加予定のみ」プリセットで使う */
  currentUserId: number;
  onEventClick: (event: CalendarEvent) => void;
  /** Drawer 内で使用する場合 true。幅制限を外す */
  isDrawer?: boolean;
}

/** Issue #331: 自分が「参加予定」のイベントの channelId 集合を抽出する。declined は除外 */
function computeMyAttendingChannels(events: CalendarEvent[], currentUserId: number): Set<number> {
  const ids = new Set<number>();
  for (const e of events) {
    if (e.channelId === null) continue;
    const me = e.attendees.find((a) => a.userId === currentUserId);
    if (!me) continue;
    if (me.status === 'declined') continue;
    ids.add(e.channelId);
  }
  return ids;
}

export function ChannelFilterPanel({
  channels,
  channelColors,
  channelFilter,
  onToggleChannel,
  onChannelFilterChange,
  events,
  today,
  currentUserId,
  onEventClick,
  isDrawer = false,
}: Props) {
  const todayEvents = events
    .filter((e) => sameDay(new Date(e.startsAt), today))
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));

  const handleSelectAll = () => onChannelFilterChange(new Set(channels.map((c) => c.id)));
  const handleClearAll = () => onChannelFilterChange(new Set());
  const handlePresetUnread = () =>
    onChannelFilterChange(new Set(channels.filter((c) => c.unreadCount > 0).map((c) => c.id)));
  const handlePresetMyAttending = () =>
    onChannelFilterChange(computeMyAttendingChannels(events, currentUserId));

  return (
    <Box
      data-testid="channel-filter-panel"
      sx={{
        width: isDrawer ? undefined : 220,
        flexShrink: 0,
        borderRight: isDrawer ? 'none' : 1,
        borderColor: 'divider',
        p: 2,
        overflow: 'auto',
      }}
    >
      <Typography
        variant="caption"
        sx={{
          display: 'block',
          fontWeight: 700,
          textTransform: 'uppercase',
          fontSize: 10,
          color: 'text.secondary',
          mb: 1,
        }}
      >
        チャンネル絞り込み
      </Typography>

      {/* Issue #331: 一括操作プリセット */}
      <Stack
        direction="row"
        spacing={0.5}
        sx={{ flexWrap: 'wrap', gap: 0.5, mb: 1 }}
        data-testid="channel-filter-presets"
      >
        <Button size="small" variant="outlined" onClick={handleSelectAll} sx={{ fontSize: 11 }}>
          全選択
        </Button>
        <Button size="small" variant="outlined" onClick={handleClearAll} sx={{ fontSize: 11 }}>
          全解除
        </Button>
        <Button size="small" variant="outlined" onClick={handlePresetUnread} sx={{ fontSize: 11 }}>
          未読関連のみ
        </Button>
        <Button
          size="small"
          variant="outlined"
          onClick={handlePresetMyAttending}
          sx={{ fontSize: 11 }}
        >
          自分の参加予定のみ
        </Button>
      </Stack>

      <Stack spacing={0.25}>
        {channels.map((c) => {
          const color = channelColors.get(c.id) ?? '#1976d2';
          return (
            <FormControlLabel
              key={c.id}
              control={
                <Checkbox
                  size="small"
                  checked={channelFilter.has(c.id)}
                  onChange={() => onToggleChannel(c.id)}
                  inputProps={{ 'aria-label': `channel-filter-${c.name}` }}
                  sx={{
                    color,
                    '&.Mui-checked': { color },
                    p: 0.5,
                  }}
                />
              }
              label={<Typography sx={{ fontSize: 13 }}># {c.name}</Typography>}
            />
          );
        })}
      </Stack>

      <Divider sx={{ my: 2 }} />

      <Typography
        variant="caption"
        sx={{
          display: 'block',
          fontWeight: 700,
          textTransform: 'uppercase',
          fontSize: 10,
          color: 'text.secondary',
          mb: 1,
        }}
      >
        今日の予定
      </Typography>
      <Stack spacing={0.75}>
        {todayEvents.length === 0 && (
          <Typography variant="caption" color="text.secondary">
            予定はありません
          </Typography>
        )}
        {todayEvents.map((e) => {
          const color =
            e.channelId !== null ? (channelColors.get(e.channelId) ?? '#1976d2') : '#1976d2';
          return (
            <Box
              key={e.id}
              onClick={() => onEventClick(e)}
              sx={{
                p: 0.75,
                borderLeft: `3px solid ${color}`,
                cursor: 'pointer',
                borderRadius: 0.5,
                '&:hover': {
                  bgcolor: (t) =>
                    t.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                },
              }}
            >
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                {fmtTime(new Date(e.startsAt))}
              </Typography>
              <Typography sx={{ fontSize: 12, fontWeight: 500 }} noWrap>
                {e.title}
              </Typography>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
