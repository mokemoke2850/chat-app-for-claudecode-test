import { useState } from 'react';
import { Box, Paper, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import type { Task } from '@chat-app/shared';

interface Props {
  tasks: Task[];
}

const DAY = 24 * 60 * 60 * 1000;
const TASK_COLUMN_WIDTH = 220;

type GanttScale = 'day' | 'week' | 'month';

const SCALE_LABELS: Record<GanttScale, string> = {
  day: '日',
  week: '週',
  month: '月',
};

const SCALE_MIN_WIDTH: Record<GanttScale, number> = {
  day: 56,
  week: 96,
  month: 132,
};

function startOfDay(value: string): number {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function startOfToday(): number {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function addDays(value: number, amount: number): number {
  const date = new Date(value);
  date.setDate(date.getDate() + amount);
  return date.getTime();
}

function addMonths(value: number, amount: number): number {
  const date = new Date(value);
  date.setMonth(date.getMonth() + amount);
  return date.getTime();
}

function startOfWeek(value: number): number {
  const date = new Date(value);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function startOfMonth(value: number): number {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
}

function addScaleUnit(value: number, scale: GanttScale): number {
  if (scale === 'month') return addMonths(value, 1);
  return addDays(value, scale === 'week' ? 7 : 1);
}

function roundRangeStart(value: number, scale: GanttScale): number {
  if (scale === 'week') return startOfWeek(value);
  if (scale === 'month') return startOfMonth(value);
  return value;
}

function roundRangeEndExclusive(value: number, scale: GanttScale): number {
  return addScaleUnit(roundRangeStart(value, scale), scale);
}

function formatDate(value: number): string {
  return new Date(value).toLocaleDateString('ja-JP');
}

function formatAxisLabel(value: number, scale: GanttScale): string {
  const date = new Date(value);
  if (scale === 'month') {
    return `${date.getFullYear()}/${date.getMonth() + 1}`;
  }
  const monthDay = `${date.getMonth() + 1}/${date.getDate()}`;
  return scale === 'week' ? `${monthDay}週` : monthDay;
}

function buildTicks(rangeStart: number, rangeEndExclusive: number, scale: GanttScale): number[] {
  const ticks: number[] = [];
  let cursor = rangeStart;
  while (cursor < rangeEndExclusive) {
    ticks.push(cursor);
    cursor = addScaleUnit(cursor, scale);
  }
  return ticks;
}

export default function TaskGanttChart({ tasks }: Props) {
  const [scale, setScale] = useState<GanttScale>('day');
  const scheduled = tasks.filter((task) => task.dueAt != null);
  const unscheduledCount = tasks.length - scheduled.length;

  if (scheduled.length === 0) {
    return (
      <Box data-testid="gantt-empty" sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">期限が設定されたタスクはありません</Typography>
        {unscheduledCount > 0 && (
          <Typography variant="caption">期限なし: {unscheduledCount}件</Typography>
        )}
      </Box>
    );
  }

  const spans = scheduled.map((task) => {
    const created = startOfDay(task.createdAt);
    const due = startOfDay(task.dueAt!);
    return { task, start: Math.min(created, due), end: Math.max(created, due) };
  });
  const min = Math.min(...spans.map((span) => span.start));
  const max = Math.max(...spans.map((span) => span.end));
  const rangeStart = roundRangeStart(min, scale);
  const rangeEndExclusive = roundRangeEndExclusive(max, scale);
  const totalDuration = Math.max(DAY, rangeEndExclusive - rangeStart);
  const ticks = buildTicks(rangeStart, rangeEndExclusive, scale);
  const timelineWidth = Math.max(720, ticks.length * SCALE_MIN_WIDTH[scale]);
  const today = startOfToday();
  const todayVisible = today >= rangeStart && today < rangeEndExclusive;
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const gridTemplateColumns = `${TASK_COLUMN_WIDTH}px minmax(720px, 1fr)`;
  const gridLinePositions = ticks.map((tick) => ((tick - rangeStart) / totalDuration) * 100);

  return (
    <Box data-testid="task-gantt-chart" data-scale={scale} sx={{ minWidth: 920, p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {formatDate(min)} — {formatDate(max)}
        </Typography>
        <ToggleButtonGroup
          value={scale}
          exclusive
          size="small"
          aria-label="ガント表示粒度"
          onChange={(_, value: GanttScale | null) => {
            if (value) setScale(value);
          }}
        >
          {(['day', 'week', 'month'] as const).map((value) => (
            <ToggleButton key={value} value={value} aria-label={SCALE_LABELS[value]}>
              {SCALE_LABELS[value]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      <Box sx={{ overflowX: 'auto' }}>
        <Box sx={{ minWidth: TASK_COLUMN_WIDTH + timelineWidth }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns,
              alignItems: 'stretch',
              position: 'sticky',
              top: 0,
              zIndex: 1,
              bgcolor: 'background.paper',
            }}
          >
            <Box
              data-testid="gantt-task-column-header"
              sx={{
                p: 1,
                borderBottom: 1,
                borderColor: 'divider',
                color: 'text.secondary',
                fontSize: '0.75rem',
                fontWeight: 700,
              }}
            >
              タスク
            </Box>
            <Box
              data-testid="gantt-timeline-column-header"
              sx={{
                p: 1,
                borderBottom: 1,
                borderColor: 'divider',
                color: 'text.secondary',
                fontSize: '0.75rem',
                fontWeight: 700,
              }}
            >
              期間
            </Box>
          </Box>

          <Box
            data-testid="gantt-date-axis"
            data-timeline-start={String(rangeStart)}
            data-timeline-end={String(rangeEndExclusive)}
            sx={{ display: 'grid', gridTemplateColumns, minHeight: 36 }}
          >
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }} />
            <Box sx={{ position: 'relative', borderBottom: 1, borderColor: 'divider' }}>
              {ticks.map((tick, index) => {
                const next = addScaleUnit(tick, scale);
                const left = ((tick - rangeStart) / totalDuration) * 100;
                const width = ((next - tick) / totalDuration) * 100;
                return (
                  <Typography
                    key={tick}
                    variant="caption"
                    data-testid={`gantt-axis-label-${index}`}
                    sx={{
                      position: 'absolute',
                      left: `${left}%`,
                      width: `${width}%`,
                      p: 0.75,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      color: 'text.secondary',
                      borderLeft: index === 0 ? 1 : 0,
                      borderRight: 1,
                      borderColor: 'divider',
                    }}
                  >
                    {formatAxisLabel(tick, scale)}
                  </Typography>
                );
              })}
            </Box>
          </Box>

          <Box
            data-testid="gantt-grid"
            data-grid-count={ticks.length}
            sx={{ position: 'relative' }}
          >
            {gridLinePositions.map((left, index) => (
              <Box
                key={`${ticks[index]}-${index}`}
                data-testid={`gantt-grid-line-${index}`}
                sx={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: `calc(${TASK_COLUMN_WIDTH}px + ${left}%)`,
                  width: 1,
                  bgcolor: 'divider',
                  opacity: 0.9,
                  pointerEvents: 'none',
                }}
              />
            ))}
            {todayVisible && (
              <Box
                data-testid="gantt-today-line"
                aria-label="今日"
                sx={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: `calc(${TASK_COLUMN_WIDTH}px + ${((today - rangeStart) / totalDuration) * 100}%)`,
                  width: 2,
                  bgcolor: 'error.main',
                  pointerEvents: 'none',
                }}
              />
            )}

            {spans.map(({ task, start, end }) => {
              const startPercent = ((start - rangeStart) / totalDuration) * 100;
              const widthPercent = Math.max(
                (DAY / totalDuration) * 100,
                ((end + DAY - start) / totalDuration) * 100,
              );
              const dependencyNames = (task.dependencyIds ?? [])
                .map((id) => taskById.get(id)?.title)
                .filter((title): title is string => Boolean(title));

              return (
                <Paper
                  key={task.id}
                  data-testid={`gantt-row-${task.id}`}
                  data-layout="task-and-timeline"
                  variant="outlined"
                  sx={{
                    display: 'grid',
                    gridTemplateColumns,
                    position: 'relative',
                    overflow: 'hidden',
                    mt: 1,
                  }}
                >
                  <Box sx={{ p: 1, borderRight: 1, borderColor: 'divider' }}>
                    <Typography variant="body2" fontWeight={600}>
                      {task.title}
                    </Typography>
                    <Typography
                      data-testid={`gantt-period-label-${task.id}`}
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', mt: 0.5 }}
                    >
                      {formatDate(start)} — {formatDate(end)}
                    </Typography>
                    {dependencyNames.length > 0 && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block' }}
                      >
                        先行: {dependencyNames.join('、')}
                      </Typography>
                    )}
                  </Box>
                  <Box
                    sx={{
                      position: 'relative',
                      minHeight: 54,
                      bgcolor: 'action.hover',
                    }}
                  >
                    <Box
                      data-testid={`gantt-bar-${task.id}`}
                      data-start-percent={startPercent.toFixed(2)}
                      data-width-percent={widthPercent.toFixed(2)}
                      data-timeline-start={String(rangeStart)}
                      data-timeline-end={String(rangeEndExclusive)}
                      sx={{
                        position: 'absolute',
                        left: `${startPercent}%`,
                        width: `${widthPercent}%`,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        minWidth: 12,
                        height: 24,
                        bgcolor: 'primary.main',
                        borderRadius: 1,
                        boxShadow: 1,
                      }}
                    />
                  </Box>
                </Paper>
              );
            })}
          </Box>
        </Box>
      </Box>

      {unscheduledCount > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          期限なし: {unscheduledCount}件
        </Typography>
      )}
    </Box>
  );
}
