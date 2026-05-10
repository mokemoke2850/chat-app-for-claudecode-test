// Issue #152 — カレンダー月表示（7×6 グリッド）
// Issue #267 — 期限付きタスクの表示と DnD による期限変更

import { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import RepeatIcon from '@mui/icons-material/Repeat';
import { useDroppable, useDraggable } from '@dnd-kit/core';

import { WEEKDAYS_JA, fmtTime, sameDay, startOfMonthGrid } from '../../utils/calendar';
import type { CalendarEvent, Task } from '@chat-app/shared';

interface Props {
  cursor: Date;
  today: Date;
  events: CalendarEvent[];
  tasks?: Task[];
  channelColors: Map<number, string>;
  onEventClick: (event: CalendarEvent) => void;
  onDayClick: (date: Date) => void;
  onTaskClick?: (task: Task) => void;
}

const GRID_DAYS = 42;
const MAX_ITEMS_PER_CELL = 3;

// タスク用の固定色（イベントとは異なる）
const TASK_COLOR_BG = '#9c27b0'; // 紫系
const TASK_COLOR_DONE = '#9e9e9e'; // 完了は灰色
const TASK_COLOR_IN_PROGRESS = '#ed6c02'; // 進行中はオレンジ系

function taskColorByStatus(status: Task['status']): string {
  if (status === 'done') return TASK_COLOR_DONE;
  if (status === 'in_progress') return TASK_COLOR_IN_PROGRESS;
  return TASK_COLOR_BG;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

interface DayCellProps {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  isSunday: boolean;
  isSaturday: boolean;
  cellKey: string;
  borderRight: boolean;
  borderBottom: boolean;
  dayEvents: CalendarEvent[];
  dayTasks: Task[];
  channelColors: Map<number, string>;
  onEventClick: (event: CalendarEvent) => void;
  onDayClick: (date: Date) => void;
  onTaskClick?: (task: Task) => void;
}

function DayCell({
  date,
  inMonth,
  isToday,
  isSunday,
  isSaturday,
  cellKey,
  borderRight,
  borderBottom,
  dayEvents,
  dayTasks,
  channelColors,
  onEventClick,
  onDayClick,
  onTaskClick,
}: DayCellProps) {
  const { setNodeRef } = useDroppable({ id: `day-${cellKey}` });

  // 表示優先度: イベント先、タスクが続く。合計上限 3。
  const totalCount = dayEvents.length + dayTasks.length;
  const eventsToShow = dayEvents.slice(0, MAX_ITEMS_PER_CELL);
  const remainingSlots = Math.max(0, MAX_ITEMS_PER_CELL - eventsToShow.length);
  const tasksToShow = dayTasks.slice(0, remainingSlots);
  const overflow = totalCount - eventsToShow.length - tasksToShow.length;

  return (
    <Box
      ref={setNodeRef}
      data-testid={`day-cell-${cellKey}`}
      data-in-month={inMonth ? 'true' : 'false'}
      data-today={isToday ? 'true' : 'false'}
      onClick={() => onDayClick(date)}
      sx={{
        borderRight: borderRight ? 1 : 0,
        borderBottom: borderBottom ? 1 : 0,
        borderColor: 'divider',
        p: 0.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.25,
        minWidth: 0,
        minHeight: 0,
        cursor: 'pointer',
        bgcolor: inMonth
          ? 'transparent'
          : (t) => (t.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'),
        '&:hover': {
          bgcolor: (t) =>
            t.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
        },
      }}
    >
      <Box sx={{ display: 'flex' }}>
        <Box
          sx={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: isToday ? 700 : 500,
            color: isToday
              ? 'primary.contrastText'
              : !inMonth
                ? 'text.disabled'
                : isSunday
                  ? 'error.main'
                  : isSaturday
                    ? 'primary.main'
                    : 'text.primary',
            bgcolor: isToday ? 'primary.main' : 'transparent',
          }}
        >
          {date.getDate()}
        </Box>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, overflow: 'hidden' }}>
        {eventsToShow.map((ev) => {
          const color =
            ev.channelId !== null ? (channelColors.get(ev.channelId) ?? '#1976d2') : '#1976d2';
          const startDate = new Date(ev.startsAt);
          return (
            <Box
              key={ev.id}
              data-testid={`event-block-${ev.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onEventClick(ev);
              }}
              sx={{
                bgcolor: color,
                color: '#fff',
                px: 0.75,
                py: 0.25,
                borderRadius: 0.5,
                fontSize: 11,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                cursor: 'pointer',
                '&:hover': { opacity: 0.85 },
              }}
              title={`${fmtTime(startDate)} ${ev.title}`}
            >
              <Box component="span" sx={{ opacity: 0.85, fontWeight: 500, mr: 0.5 }}>
                {fmtTime(startDate)}
              </Box>
              {(ev.recurrenceRule !== null || ev.recurrenceMasterId !== null) && (
                <RepeatIcon
                  data-testid={`event-recurrence-icon-${ev.id}`}
                  sx={{ fontSize: 11, mr: 0.25, verticalAlign: 'text-bottom' }}
                />
              )}
              {ev.title}
            </Box>
          );
        })}

        {tasksToShow.map((task) => (
          <DraggableTaskBlock key={task.id} task={task} onTaskClick={onTaskClick} />
        ))}

        {overflow > 0 && (
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 10, pl: 0.5 }}>
            +{overflow} 件
          </Typography>
        )}
      </Box>
    </Box>
  );
}

interface DraggableTaskBlockProps {
  task: Task;
  onTaskClick?: (task: Task) => void;
}

function DraggableTaskBlock({ task, onTaskClick }: DraggableTaskBlockProps) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: `task-${task.id}` });
  const due = task.dueAt ? new Date(task.dueAt) : null;
  const dueText = due ? `${due.getFullYear()}/${due.getMonth() + 1}/${due.getDate()}` : '';
  const titleAttr = [task.title, task.assigneeUsername ?? '', dueText].filter(Boolean).join(' / ');
  const bg = taskColorByStatus(task.status);

  return (
    <Box
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      data-testid={`task-block-${task.id}`}
      data-task-status={task.status}
      onClick={(e) => {
        e.stopPropagation();
        onTaskClick?.(task);
      }}
      title={titleAttr}
      sx={{
        bgcolor: bg,
        color: '#fff',
        px: 0.75,
        py: 0.25,
        borderRadius: 0.5,
        fontSize: 11,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        cursor: 'grab',
        opacity: isDragging ? 0.5 : 1,
        textDecoration: task.status === 'done' ? 'line-through' : 'none',
        '&:hover': { opacity: 0.85 },
      }}
    >
      <Box component="span" sx={{ opacity: 0.85, fontWeight: 500, mr: 0.5 }}>
        [タスク]
      </Box>
      {task.title}
    </Box>
  );
}

export function MonthView({
  cursor,
  today,
  events,
  tasks = [],
  channelColors,
  onEventClick,
  onDayClick,
  onTaskClick,
}: Props) {
  const gridStart = useMemo(() => startOfMonthGrid(cursor), [cursor]);

  const days = useMemo(() => {
    const out: Date[] = [];
    for (let i = 0; i < GRID_DAYS; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      out.push(d);
    }
    return out;
  }, [gridStart]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const start = new Date(e.startsAt);
      const key = dayKey(start);
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    }
    return map;
  }, [events]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.dueAt) continue;
      const due = new Date(t.dueAt);
      const key = dayKey(due);
      const list = map.get(key) ?? [];
      list.push(t);
      map.set(key, list);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => {
        const ad = a.dueAt ? Date.parse(a.dueAt) : 0;
        const bd = b.dueAt ? Date.parse(b.dueAt) : 0;
        return ad - bd;
      });
    }
    return map;
  }, [tasks]);

  return (
    <Box
      sx={{
        flexGrow: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {/* 曜日ヘッダー */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        {WEEKDAYS_JA.map((w, i) => (
          <Box
            key={w}
            sx={{
              px: 1,
              py: 0.75,
              textAlign: 'center',
              fontSize: 12,
              fontWeight: 500,
              color: i === 0 ? 'error.main' : i === 6 ? 'primary.main' : 'text.secondary',
            }}
          >
            {w}
          </Box>
        ))}
      </Box>

      <Box
        sx={{
          flexGrow: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gridTemplateRows: 'repeat(6, 1fr)',
          minHeight: 0,
        }}
        data-testid="calendar-month-grid"
      >
        {days.map((d, idx) => {
          const inMonth = d.getMonth() === cursor.getMonth();
          const isToday = sameDay(d, today);
          const key = dayKey(d);
          const dayEvents = eventsByDay.get(key) ?? [];
          const dayTasks = tasksByDay.get(key) ?? [];
          const isSunday = d.getDay() === 0;
          const isSaturday = d.getDay() === 6;
          return (
            <DayCell
              key={idx}
              date={d}
              inMonth={inMonth}
              isToday={isToday}
              isSunday={isSunday}
              isSaturday={isSaturday}
              cellKey={key}
              borderRight={(idx + 1) % 7 !== 0}
              borderBottom={idx < 35}
              dayEvents={dayEvents}
              dayTasks={dayTasks}
              channelColors={channelColors}
              onEventClick={onEventClick}
              onDayClick={onDayClick}
              onTaskClick={onTaskClick}
            />
          );
        })}
      </Box>
    </Box>
  );
}
