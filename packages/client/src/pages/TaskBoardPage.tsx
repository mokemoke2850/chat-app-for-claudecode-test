import { useState, useMemo, use, Suspense } from 'react';
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
  FormControlLabel,
  Switch,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import LinkIcon from '@mui/icons-material/Link';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import VisibilityIcon from '@mui/icons-material/Visibility';
import {
  DndContext,
  closestCorners,
  DragEndEvent,
  DragOverEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task, TaskStatus, Channel, User } from '@chat-app/shared';
import { api } from '../api/client';
import CreateTaskDialog from '../components/Task/CreateTaskDialog';
import EditTaskDialog from '../components/Task/EditTaskDialog';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/Layout/AppLayout';
import ChannelList from '../components/Channel/ChannelList';
import SidebarDmList from '../components/Layout/SidebarDmList';

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
  onEdit: (task: Task) => void;
  onToggleHidden: (task: Task) => void;
}

function SortableTaskCard({ task, onDelete, onEdit, onToggleHidden }: SortableTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : task.isHidden ? 0.5 : 1,
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
        <Box sx={{ display: 'flex', flexShrink: 0 }}>
          <Tooltip title={task.isHidden ? '表示する' : '非表示にする'}>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onToggleHidden(task);
              }}
              aria-label={task.isHidden ? 'タスクを表示' : 'タスクを非表示'}
            >
              {task.isHidden ? (
                <VisibilityIcon fontSize="small" />
              ) : (
                <VisibilityOffIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(task);
            }}
            aria-label="タスクを編集"
          >
            <EditIcon fontSize="small" />
          </IconButton>
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
  onEdit: (task: Task) => void;
  onToggleHidden: (task: Task) => void;
}

function KanbanColumn({ status, tasks, onDelete, onEdit, onToggleHidden }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({ id: status });

  return (
    <Box
      ref={setNodeRef}
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
          <SortableTaskCard
            key={task.id}
            task={task}
            onDelete={onDelete}
            onEdit={onEdit}
            onToggleHidden={onToggleHidden}
          />
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
  usersPromise,
  channelsPromise,
  channelFilter,
  onChannelFilterChange,
  includeHidden,
  onIncludeHiddenChange,
}: {
  tasksPromise: Promise<{ tasks: Task[] }>;
  usersPromise: Promise<{ users: User[] }>;
  channelsPromise: Promise<{ channels: Channel[] }>;
  channelFilter: number | '';
  onChannelFilterChange: (v: number | '') => void;
  includeHidden: boolean;
  onIncludeHiddenChange: (v: boolean) => void;
}) {
  const { tasks: initialTasks } = use(tasksPromise);
  const { users } = use(usersPromise);
  const { channels } = use(channelsPromise);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
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
    const { tasks: fresh } = await api.tasks.list(includeHidden ? { includeHidden: true } : {});
    setTasks(fresh);
  };

  const handleUpdated = async () => {
    const { tasks: fresh } = await api.tasks.list(includeHidden ? { includeHidden: true } : {});
    setTasks(fresh);
  };

  const handleIncludeHiddenChange = async (checked: boolean) => {
    onIncludeHiddenChange(checked);
    const { tasks: fresh } = await api.tasks.list(checked ? { includeHidden: true } : {});
    setTasks(fresh);
  };

  const handleToggleHidden = async (task: Task) => {
    const newIsHidden = !task.isHidden;
    // 楽観的更新
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, isHidden: newIsHidden } : t)));
    try {
      await api.tasks.update(task.id, { isHidden: newIsHidden });
    } catch {
      // 失敗時ロールバック
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, isHidden: task.isHidden } : t)),
      );
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* ツールバー */}
      <Box sx={{ display: 'flex', gap: 2, p: 2, alignItems: 'center', flexShrink: 0 }}>
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

        {/* 非表示タスクを表示するか */}
        <FormControlLabel
          control={
            <Switch
              checked={includeHidden}
              onChange={(e) => void handleIncludeHiddenChange(e.target.checked)}
              size="small"
              inputProps={{ 'aria-label': '非表示タスクも表示' }}
            />
          }
          label="非表示も表示"
          sx={{ mr: 0 }}
        />

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
                onEdit={(task) => setEditingTask(task)}
                onToggleHidden={(task) => void handleToggleHidden(task)}
              />
            ))}
          </Box>
        </DndContext>
      </Box>

      <CreateTaskDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onCreated={() => void handleCreated()}
        users={users}
        channels={channels}
        initialChannelId={channelFilter !== '' ? channelFilter : undefined}
      />

      {editingTask && (
        <EditTaskDialog
          open={editingTask !== null}
          task={editingTask}
          users={users}
          onClose={() => setEditingTask(null)}
          onUpdated={() => void handleUpdated()}
        />
      )}
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

let _usersPromise: Promise<{ users: User[] }> | null = null;
function getUsersPromise() {
  if (!_usersPromise) {
    _usersPromise = api.auth.users().catch(() => ({ users: [] }));
  }
  return _usersPromise;
}

let _channelsPromise: Promise<{ channels: Channel[] }> | null = null;
function getChannelsPromise() {
  if (!_channelsPromise) {
    _channelsPromise = api.channels.list().catch(() => ({ channels: [] }));
  }
  return _channelsPromise;
}

export default function TaskBoardPage() {
  const [tasksPromise] = useState(() => getTasksPromise());
  const [usersPromise] = useState(() => getUsersPromise());
  const [channelsPromise] = useState(() => getChannelsPromise());
  const [channelFilter, setChannelFilter] = useState<number | ''>('');
  const [includeHidden, setIncludeHidden] = useState(false);

  const navigate = useNavigate();

  return (
    <AppLayout
      defaultSidebarOpen={false}
      sidebar={
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
          <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
            <ChannelList
              activeChannelId={null}
              onSelect={(id) => navigate(`/chat?channel=${id}`)}
            />
          </Box>
          <SidebarDmList />
        </Box>
      }
    >
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
          usersPromise={usersPromise}
          channelsPromise={channelsPromise}
          channelFilter={channelFilter}
          onChannelFilterChange={setChannelFilter}
          includeHidden={includeHidden}
          onIncludeHiddenChange={setIncludeHidden}
        />
      </Suspense>
    </AppLayout>
  );
}
