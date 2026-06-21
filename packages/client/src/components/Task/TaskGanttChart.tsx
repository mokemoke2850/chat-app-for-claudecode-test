import { Box, Paper, Typography } from '@mui/material';
import type { Task } from '@chat-app/shared';

interface Props {
  tasks: Task[];
}

const DAY = 24 * 60 * 60 * 1000;

function startOfDay(value: string): number {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export default function TaskGanttChart({ tasks }: Props) {
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
  const totalDays = Math.max(1, Math.round((max - min) / DAY) + 1);
  const taskById = new Map(tasks.map((task) => [task.id, task]));

  return (
    <Box data-testid="task-gantt-chart" sx={{ minWidth: 720, p: 2 }}>
      <Typography variant="caption" color="text.secondary">
        {new Date(min).toLocaleDateString('ja-JP')} — {new Date(max).toLocaleDateString('ja-JP')}
      </Typography>
      {spans.map(({ task, start, end }) => {
        const startPercent = ((start - min) / DAY / totalDays) * 100;
        const widthPercent = Math.max(
          100 / totalDays,
          (((end - start) / DAY + 1) / totalDays) * 100,
        );
        const dependencyNames = (task.dependencyIds ?? [])
          .map((id) => taskById.get(id)?.title)
          .filter((title): title is string => Boolean(title));
        return (
          <Paper
            key={task.id}
            data-testid={`gantt-row-${task.id}`}
            variant="outlined"
            sx={{ p: 1, mt: 1 }}
          >
            <Typography variant="body2" fontWeight={600}>
              {task.title}
            </Typography>
            <Box
              sx={{
                position: 'relative',
                height: 22,
                bgcolor: 'action.hover',
                borderRadius: 1,
                mt: 0.5,
              }}
            >
              <Box
                data-testid={`gantt-bar-${task.id}`}
                data-start-percent={startPercent.toFixed(2)}
                data-width-percent={widthPercent.toFixed(2)}
                sx={{
                  position: 'absolute',
                  left: `${startPercent}%`,
                  width: `${widthPercent}%`,
                  height: '100%',
                  bgcolor: 'primary.main',
                  borderRadius: 1,
                }}
              />
            </Box>
            {dependencyNames.length > 0 && (
              <Typography variant="caption" color="text.secondary">
                先行: {dependencyNames.join('、')}
              </Typography>
            )}
          </Paper>
        );
      })}
      {unscheduledCount > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          期限なし: {unscheduledCount}件
        </Typography>
      )}
    </Box>
  );
}
