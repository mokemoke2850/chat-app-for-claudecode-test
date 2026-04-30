import { useState, useMemo, use, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import LinkIcon from '@mui/icons-material/Link';
import {
  DndContext,
  closestCorners,
  DragEndEvent,
  DragOverEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task, TaskStatus, Channel } from '@chat-app/shared';
import { api } from '../api/client';
import CreateTaskDialog from '../components/Task/CreateTaskDialog';
import AppLayout from '../components/Layout/AppLayout';

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: '未着手',
  in_progress: '進行中',
  done: '完了',
};
const STATUS_COLUMNS: TaskStatus[] = ['todo', 'in_progress', 'done'];

// 期限切れ判定
function isOverdue(dueAt: string | null): boolean {
  if (!dueAt) return false;
  return new Date(dueAt) < new Date();
}

interface SortableTaskCardProps {
  task: Task;
  onDelete: (id: number) => void;
}

function SortableTaskCard({ task, onDelete }: SortableTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const overdue = isOverdue(task.dueAt);

  return (
    <Paper
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      sx={{
        p: 1.5,
        mb: 1,
        cursor: 'grab',
        border: overdue ? '1px solid' : 'none',
        borderColor: overdue ? 'error.main' : undefined,
        '&:active': { cursor: 'grabbing' },
      }}
      data-testid={`task-card-${task.id}`}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Typography variant="body2" fontWeight="medium" sx={{ flex: 1, mr: 1 }}>
          {task.title}
        </Typography>
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(task.id);
          }}
          aria-label="タスクを削除"
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>

      {task.assigneeUsername && (
        <Typography variant="caption" color="text.secondary" display="block">
          担当: {task.assigneeUsername}
        </Typography>
      )}

      {task.dueAt && (
        <Typography variant="caption" color={overdue ? 'error' : 'text.secondary'} display="block">
          期限: {new Date(task.dueAt).toLocaleDateString('ja-JP')}
        </Typography>
      )}

      {task.sourceMessageId != null && (
        <Box sx={{ mt: 0.5 }}>
          <Tooltip title="元メッセージへ">
            <Chip
              icon={<LinkIcon />}
              label="元メッセージ"
              size="small"
              variant="outlined"
              onClick={(e) => {
                e.stopPropagation();
                if (task.sourceChannelId != null) {
                  window.location.href = `/?channel=${task.sourceChannelId}#message-${task.sourceMessageId}`;
                }
              }}
            />
          </Tooltip>
        </Box>
      )}
    </Paper>
  );
}

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
  onDelete: (id: number) => void;
}

function KanbanColumn({ status, tasks, onDelete }: KanbanColumnProps) {
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 280,
        bgcolor: 'background.default',
        borderRadius: 1,
        p: 1.5,
      }}
      data-testid={`column-${status}`}
    >
      <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
        {STATUS_LABELS[status]}
        <Chip label={tasks.length} size="small" sx={{ ml: 1 }} />
      </Typography>

      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        {tasks.map((task) => (
          <SortableTaskCard key={task.id} task={task} onDelete={onDelete} />
        ))}
      </SortableContext>

      {tasks.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 2 }}>
          タスクなし
        </Typography>
      )}
    </Box>
  );
}

// tasksPromise を受け取って実際のボードを描画する（Suspense 内側）
function TaskBoardContent({
  tasksPromise,
  channels,
  channelFilter,
  onChannelFilterChange,
}: {
  tasksPromise: Promise<{ tasks: Task[] }>;
  channels: Channel[];
  channelFilter: number | '';
  onChannelFilterChange: (v: number | '') => void;
}) {
  const navigate = useNavigate();
  const { tasks: initialTasks } = use(tasksPromise);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // チャンネルフィルタ適用後のタスク
  const filteredTasks = useMemo(() => {
    if (channelFilter === '') return tasks;
    return tasks.filter((t) => t.sourceChannelId === channelFilter);
  }, [tasks, channelFilter]);

  const tasksByStatus = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = { todo: [], in_progress: [], done: [] };
    for (const t of filteredTasks) {
      if (map[t.status]) {
        map[t.status].push(t);
      }
    }
    // position 順にソート
    for (const key of STATUS_COLUMNS) {
      map[key].sort((a, b) => a.position - b.position);
    }
    return map;
  }, [filteredTasks]);

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    setActiveId(active.id as number);

    // over が列(status)かカード(id)かを判定
    const overStatusKey = STATUS_COLUMNS.find((s) => s === over.id);
    const overTask = tasks.find((t) => t.id === over.id);
    const activeTask = tasks.find((t) => t.id === active.id);
    if (!activeTask) return;

    const targetStatus: TaskStatus = overStatusKey ?? overTask?.status ?? activeTask.status;
    if (targetStatus !== activeTask.status) {
      // 楽観的にステータスを変更
      setTasks((prev) =>
        prev.map((t) => (t.id === activeTask.id ? { ...t, status: targetStatus } : t)),
      );
    }
    void activeId; // suppress unused warning
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const activeTask = tasks.find((t) => t.id === active.id);
    if (!activeTask) return;

    const overTask = tasks.find((t) => t.id === over.id);
    const overStatus = STATUS_COLUMNS.find((s) => s === over.id);
    const targetStatus: TaskStatus = overStatus ?? overTask?.status ?? activeTask.status;

    // 同一列内の並べ替え
    let newTasks = [...tasks];
    if (overTask && activeTask.status === targetStatus && activeTask.id !== overTask.id) {
      const col = newTasks.filter((t) => t.status === targetStatus);
      const oldIndex = col.findIndex((t) => t.id === activeTask.id);
      const newIndex = col.findIndex((t) => t.id === overTask.id);
      const reordered = arrayMove(col, oldIndex, newIndex);
      newTasks = newTasks.filter((t) => t.status !== targetStatus).concat(reordered);
    }

    // ステータス変更（列またぎ）
    if (targetStatus !== activeTask.status) {
      newTasks = newTasks.map((t) => (t.id === activeTask.id ? { ...t, status: targetStatus } : t));
    }

    // position を再計算
    const orderItems = STATUS_COLUMNS.flatMap((s) => {
      return newTasks
        .filter((t) => t.status === s)
        .map((t, i) => ({ id: t.id, status: s, position: i }));
    });

    const prevTasks = tasks;
    setTasks(
      newTasks.map((t) => {
        const item = orderItems.find((o) => o.id === t.id);
        return item ? { ...t, position: item.position } : t;
      }),
    );

    try {
      await api.tasks.updateOrder(orderItems);
    } catch {
      // 失敗時はロールバック
      setTasks(prevTasks);
    }
  };

  const handleDelete = async (taskId: number) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    try {
      await api.tasks.delete(taskId);
    } catch {
      // 失敗時は再フェッチ
      const { tasks: fresh } = await api.tasks.list();
      setTasks(fresh);
    }
  };

  const handleCreated = async () => {
    const { tasks: fresh } = await api.tasks.list();
    setTasks(fresh);
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* ツールバー */}
      <Box sx={{ display: 'flex', gap: 2, p: 2, alignItems: 'center', flexShrink: 0 }}>
        <Button
          variant="text"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/')}
          aria-label="チャットに戻る"
        >
          チャットに戻る
        </Button>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          タスクボード
        </Typography>

        {/* チャンネル絞り込み */}
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>チャンネルで絞り込み</InputLabel>
          <Select
            value={channelFilter}
            label="チャンネルで絞り込み"
            onChange={(e) => onChannelFilterChange(e.target.value as number | '')}
            inputProps={{ 'aria-label': 'チャンネルで絞り込み' }}
          >
            <MenuItem value="">すべて</MenuItem>
            {channels.map((ch) => (
              <MenuItem key={ch.id} value={ch.id}>
                #{ch.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
        >
          新規タスク作成
        </Button>
      </Box>

      {/* カンバンボード */}
      <Box sx={{ flexGrow: 1, overflow: 'auto', px: 2, pb: 2 }}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragOver={handleDragOver}
          onDragEnd={(e) => void handleDragEnd(e)}
        >
          <Box sx={{ display: 'flex', gap: 2, height: '100%' }}>
            {STATUS_COLUMNS.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                tasks={tasksByStatus[status]}
                onDelete={(id) => void handleDelete(id)}
              />
            ))}
          </Box>
        </DndContext>
      </Box>

      <CreateTaskDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onCreated={() => void handleCreated()}
      />
    </Box>
  );
}

// Promise をキャッシュして安定させる
let _tasksPromise: Promise<{ tasks: Task[] }> | null = null;
function getTasksPromise() {
  if (!_tasksPromise) {
    _tasksPromise = api.tasks.list().catch(() => ({ tasks: [] }));
  }
  return _tasksPromise;
}

export default function TaskBoardPage() {
  const [tasksPromise] = useState(() => getTasksPromise());
  const [channels] = useState<Channel[]>([]);
  const [channelFilter, setChannelFilter] = useState<number | ''>('');

  return (
    <AppLayout sidebar={<div />}>
      <Suspense
        fallback={
          <Box
            sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}
          >
            <CircularProgress />
          </Box>
        }
      >
        <TaskBoardContent
          tasksPromise={tasksPromise}
          channels={channels}
          channelFilter={channelFilter}
          onChannelFilterChange={setChannelFilter}
        />
      </Suspense>
    </AppLayout>
  );
}
