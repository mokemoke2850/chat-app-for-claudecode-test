// Issue #152 — カレンダーアジェンダ表示（cursor の月内のイベントを日付別グルーピング）

import { useMemo } from 'react';
import { Avatar, AvatarGroup, Box, Chip, Stack, Typography } from '@mui/material';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import PlaceIcon from '@mui/icons-material/Place';
import RepeatIcon from '@mui/icons-material/Repeat';

import { endOfMonth, fmtDateLong, fmtTime, sameDay, startOfMonth } from '../../utils/calendar';
import { getAvatarColor } from '../../utils/avatarColor';
import type { CalendarEvent, Channel, Task, User } from '@chat-app/shared';

interface Props {
  cursor: Date;
  today: Date;
  events: CalendarEvent[];
  tasks?: Task[];
  channels: Channel[];
  channelColors: Map<number, string>;
  users: User[];
  currentUserId: number;
  onEventClick: (event: CalendarEvent) => void;
  onTaskClick?: (task: Task) => void;
}

interface Group {
  date: Date;
  items: AgendaItem[];
}

type AgendaItem =
  | { kind: 'event'; event: CalendarEvent; time: number }
  | { kind: 'task'; task: Task; time: number; hasTime: boolean };

const TASK_COLOR_BG = '#9c27b0';
const TASK_COLOR_DONE = '#9e9e9e';
const TASK_COLOR_IN_PROGRESS = '#ed6c02';

function taskColorByStatus(status: Task['status']): string {
  if (status === 'done') return TASK_COLOR_DONE;
  if (status === 'in_progress') return TASK_COLOR_IN_PROGRESS;
  return TASK_COLOR_BG;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function rsvpChipColor(status: string): 'success' | 'warning' | 'error' | 'default' {
  if (status === 'accepted') return 'success';
  if (status === 'maybe') return 'warning';
  if (status === 'declined') return 'error';
  return 'default';
}

function rsvpChipLabel(status: string): string {
  if (status === 'accepted') return '参加';
  if (status === 'maybe') return '未定';
  if (status === 'declined') return '不参加';
  return '未回答';
}

export function AgendaView({
  cursor,
  today,
  events,
  tasks = [],
  channels,
  channelColors,
  users,
  currentUserId,
  onEventClick,
  onTaskClick,
}: Props) {
  const groups: Group[] = useMemo(() => {
    const start = startOfMonth(cursor).getTime();
    const end = endOfMonth(cursor).getTime();
    const eventItems: AgendaItem[] = events
      .filter((e) => {
        const t = Date.parse(e.startsAt);
        return t >= start && t <= end;
      })
      .map((event) => ({ kind: 'event' as const, event, time: Date.parse(event.startsAt) }));

    const taskItems: AgendaItem[] = tasks
      .filter((task) => {
        if (!task.dueAt) return false;
        const t = Date.parse(task.dueAt);
        return t >= start && t <= end;
      })
      .map((task) => {
        const due = new Date(task.dueAt!);
        const hasTime =
          due.getHours() !== 0 ||
          due.getMinutes() !== 0 ||
          due.getSeconds() !== 0 ||
          due.getMilliseconds() !== 0;
        return {
          kind: 'task' as const,
          task,
          time: hasTime ? due.getTime() : Number.POSITIVE_INFINITY,
          hasTime,
        };
      });

    const map = new Map<string, Group>();
    for (const item of [...eventItems, ...taskItems]) {
      const d = new Date(item.kind === 'event' ? item.event.startsAt : item.task.dueAt!);
      const key = dayKey(d);
      const existing = map.get(key);
      if (existing) {
        existing.items.push(item);
      } else {
        const groupDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        map.set(key, { date: groupDate, items: [item] });
      }
    }
    for (const group of map.values()) {
      group.items.sort((a, b) => a.time - b.time);
    }
    return Array.from(map.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [events, tasks, cursor]);

  const channelById = useMemo(() => {
    const m = new Map<number, Channel>();
    for (const c of channels) m.set(c.id, c);
    return m;
  }, [channels]);

  const userById = useMemo(() => {
    const m = new Map<number, User>();
    for (const u of users) m.set(u.id, u);
    return m;
  }, [users]);

  if (groups.length === 0) {
    return (
      <Box
        sx={{
          flexGrow: 1,
          overflow: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        data-testid="calendar-agenda-view"
      >
        <Box sx={{ py: 8, textAlign: 'center', color: 'text.secondary' }}>
          <EventBusyIcon sx={{ fontSize: 48 }} />
          <Typography sx={{ mt: 1 }}>この月には予定がありません</Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{ flexGrow: 1, overflow: 'auto', px: { xs: 2, md: 4 }, py: 2 }}
      data-testid="calendar-agenda-view"
    >
      <Box sx={{ maxWidth: 760, mx: 'auto' }}>
        {groups.map((group) => {
          const isToday = sameDay(group.date, today);
          const groupKey = `${group.date.getFullYear()}-${group.date.getMonth()}-${group.date.getDate()}`;
          return (
            <Box key={groupKey} data-testid={`agenda-group-${groupKey}`} sx={{ mb: 3 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 1,
                  mb: 1,
                  position: 'sticky',
                  top: 0,
                  py: 1,
                  bgcolor: 'background.default',
                  zIndex: 1,
                }}
              >
                <Typography variant="h6" sx={{ fontSize: 16, fontWeight: 600 }}>
                  {fmtDateLong(group.date)}
                </Typography>
                {isToday && (
                  <Chip
                    label="今日"
                    size="small"
                    color="primary"
                    sx={{ height: 20, fontSize: 11 }}
                  />
                )}
                <Typography variant="caption" color="text.secondary">
                  {group.items.length} 件
                </Typography>
              </Box>

              <Stack spacing={1}>
                {group.items.map((item) => {
                  if (item.kind === 'task') {
                    const task = item.task;
                    const due = task.dueAt ? new Date(task.dueAt) : null;
                    const color = taskColorByStatus(task.status);
                    return (
                      <Box
                        key={`task-${task.id}`}
                        data-testid={`agenda-task-${task.id}`}
                        onClick={() => onTaskClick?.(task)}
                        sx={{
                          display: 'flex',
                          gap: 2,
                          p: 1.5,
                          borderRadius: 1.5,
                          border: 1,
                          borderColor: 'divider',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          '&:hover': {
                            borderColor: 'primary.main',
                            bgcolor: (t) =>
                              t.palette.mode === 'dark'
                                ? 'rgba(255,255,255,0.03)'
                                : 'rgba(0,0,0,0.02)',
                          },
                        }}
                      >
                        <Box
                          data-testid={`agenda-task-color-${task.id}`}
                          sx={{
                            width: 4,
                            alignSelf: 'stretch',
                            bgcolor: color,
                            borderRadius: 2,
                          }}
                        />
                        <Box sx={{ minWidth: 80 }}>
                          <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                            {due && item.hasTime ? fmtTime(due) : '終日'}
                          </Typography>
                        </Box>
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                          <Typography
                            sx={{
                              fontSize: 14,
                              fontWeight: 600,
                              mb: 0.5,
                              textDecoration: task.status === 'done' ? 'line-through' : 'none',
                            }}
                          >
                            {task.title}
                          </Typography>
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                            <Chip
                              label="タスク"
                              size="small"
                              sx={{ height: 20, fontSize: 11, bgcolor: color, color: '#fff' }}
                            />
                            {task.assigneeUsername && (
                              <Typography variant="caption" color="text.secondary">
                                {task.assigneeUsername}
                              </Typography>
                            )}
                          </Stack>
                        </Box>
                      </Box>
                    );
                  }
                  const ev = item.event;
                  const start = new Date(ev.startsAt);
                  const end = new Date(ev.endsAt);
                  const myAttendee = ev.attendees.find((a) => a.userId === currentUserId);
                  const myStatus = myAttendee?.status;
                  const channel = ev.channelId !== null ? channelById.get(ev.channelId) : null;
                  const color =
                    ev.channelId !== null
                      ? (channelColors.get(ev.channelId) ?? '#1976d2')
                      : '#1976d2';
                  return (
                    <Box
                      key={`event-${ev.id}`}
                      data-testid={`agenda-event-${ev.id}`}
                      onClick={() => onEventClick(ev)}
                      sx={{
                        display: 'flex',
                        gap: 2,
                        p: 1.5,
                        borderRadius: 1.5,
                        border: 1,
                        borderColor: 'divider',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        '&:hover': {
                          borderColor: 'primary.main',
                          bgcolor: (t) =>
                            t.palette.mode === 'dark'
                              ? 'rgba(255,255,255,0.03)'
                              : 'rgba(0,0,0,0.02)',
                        },
                      }}
                    >
                      <Box
                        sx={{
                          width: 4,
                          alignSelf: 'stretch',
                          bgcolor: color,
                          borderRadius: 2,
                        }}
                      />
                      <Box sx={{ minWidth: 80 }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                          {fmtTime(start)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {fmtTime(end)}
                        </Typography>
                      </Box>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: 14, fontWeight: 600, mb: 0.5 }}>
                          {(ev.recurrenceRule !== null || ev.recurrenceMasterId !== null) && (
                            <RepeatIcon
                              data-testid={`agenda-event-recurrence-icon-${ev.id}`}
                              sx={{ fontSize: 13, mr: 0.5, verticalAlign: 'text-bottom' }}
                            />
                          )}
                          {ev.title}
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                          {channel && (
                            <Chip
                              label={`# ${channel.name}`}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: 11,
                                bgcolor: color,
                                color: '#fff',
                              }}
                            />
                          )}
                          {ev.location && (
                            <Stack direction="row" spacing={0.5} alignItems="center">
                              <PlaceIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                              <Typography variant="caption" color="text.secondary">
                                {ev.location}
                              </Typography>
                            </Stack>
                          )}
                        </Stack>
                      </Box>
                      <Box
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-end',
                          gap: 0.5,
                        }}
                      >
                        <AvatarGroup
                          max={4}
                          sx={{
                            '& .MuiAvatar-root': { width: 22, height: 22, fontSize: 10 },
                          }}
                        >
                          {ev.attendees.map((a) => {
                            const u = userById.get(a.userId);
                            const initial = u?.displayName?.[0] ?? u?.username[0] ?? '?';
                            const bg = u ? getAvatarColor(u.email) : '#999';
                            return (
                              <Avatar key={a.userId} sx={{ bgcolor: bg }}>
                                {initial}
                              </Avatar>
                            );
                          })}
                        </AvatarGroup>
                        {myStatus && (
                          <Chip
                            data-testid={`agenda-rsvp-${ev.id}`}
                            size="small"
                            label={rsvpChipLabel(myStatus)}
                            color={rsvpChipColor(myStatus)}
                            variant={myStatus === 'pending' ? 'outlined' : 'filled'}
                            sx={{ height: 20, fontSize: 10 }}
                          />
                        )}
                      </Box>
                    </Box>
                  );
                })}
              </Stack>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
