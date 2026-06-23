import { useState, useMemo, use, Suspense, useRef, useEffect } from 'react';
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
  TextField,
  useMediaQuery,
  ButtonGroup,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import LinkIcon from '@mui/icons-material/Link';
import EventIcon from '@mui/icons-material/Event';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
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
import TaskGanttChart from '../components/Task/TaskGanttChart';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/Layout/AppLayout';
import ChannelList from '../components/Channel/ChannelList';
import SidebarDmList from '../components/Layout/SidebarDmList';
import { useSnackbar } from '../contexts/SnackbarContext';
import { useAuth } from '../contexts/AuthContext';

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: '未着手',
  in_progress: '進行中',
  done: '完了',
};
const STATUS_COLUMNS: TaskStatus[] = ['todo', 'in_progress', 'done'];
type ColumnSummaryFilter = 'overdue' | 'today' | 'mine';

// 期限切れ判定
function isOverdue(dueAt: string | null): boolean {
  if (!dueAt) return false;
  return new Date(dueAt) < new Date();
}

function isDueToday(dueAt: string | null): boolean {
  if (!dueAt) return false;
  const due = new Date(dueAt);
  const today = new Date();
  return (
    due.getFullYear() === today.getFullYear() &&
    due.getMonth() === today.getMonth() &&
    due.getDate() === today.getDate()
  );
}

interface SortableTaskCardProps {
  task: Task;
  onDelete: (id: number) => void;
  onEdit: (task: Task) => void;
  onToggleHidden: (task: Task) => void;
  onJumpToCalendar: (task: Task) => void;
  tasks: Task[];
}

// Issue #267: dueAt をローカル日付の YYYY-MM-DD 形式にフォーマット
function formatDueDateForJump(dueAt: string): string {
  const d = new Date(dueAt);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function SortableTaskCard({
  task,
  onDelete,
  onEdit,
  onToggleHidden,
  onJumpToCalendar,
  tasks,
}: SortableTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : task.isHidden ? 0.5 : 1,
  };

  const overdue = isOverdue(task.dueAt);
  const parentTitle = tasks.find((candidate) => candidate.id === task.parentTaskId)?.title;

  return (
    <Paper
      ref={setNodeRef}
      style={style}
      sx={{
        p: 1.5,
        mb: 1,
        cursor: 'pointer',
        border: overdue ? '1px solid' : 'none',
        borderColor: overdue ? 'error.main' : undefined,
      }}
      data-testid={`task-card-${task.id}`}
      onClick={() => onEdit(task)}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        {/* Issue #329: ドラッグハンドルを左端に分離。dnd-kit の attributes/listeners をここに限定 */}
        <Box
          component="button"
          type="button"
          aria-label="ドラッグして並べ替え"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          style={{ cursor: 'grab' }}
          sx={{
            border: 'none',
            bgcolor: 'transparent',
            color: 'text.secondary',
            display: 'flex',
            alignItems: 'center',
            p: 0.5,
            mr: 0.5,
            mt: -0.25,
            touchAction: 'none',
            '&:active': { cursor: 'grabbing' },
            '&:focus-visible': { outline: 'auto' },
          }}
        >
          <DragIndicatorIcon fontSize="small" />
        </Box>
        <Typography variant="body2" fontWeight="medium" sx={{ flex: 1, mr: 1 }}>
          {task.title}
        </Typography>
        <Box sx={{ display: 'flex', flexShrink: 0 }}>
          {task.dueAt && (
            <Tooltip title="カレンダーで表示">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onJumpToCalendar(task);
                }}
                aria-label="カレンダーで表示"
              >
                <EventIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
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
      {parentTitle && (
        <Typography variant="caption" color="text.secondary" display="block">
          親: {parentTitle}
        </Typography>
      )}
      {(task.subtaskCount ?? 0) > 0 && (
        <Box sx={{ mt: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            サブタスク {task.completedSubtaskCount ?? 0}/{task.subtaskCount}（{task.progress ?? 0}
            %）
          </Typography>
          <Box sx={{ height: 4, bgcolor: 'action.hover', borderRadius: 2 }}>
            <Box
              sx={{
                height: '100%',
                width: `${task.progress ?? 0}%`,
                bgcolor: 'primary.main',
                borderRadius: 2,
              }}
            />
          </Box>
        </Box>
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
  currentUserId: number | null;
  onDelete: (id: number) => void;
  onEdit: (task: Task) => void;
  onToggleHidden: (task: Task) => void;
  onInlineCreate: (status: TaskStatus, title: string) => Promise<void>;
  onJumpToCalendar: (task: Task) => void;
  allTasks: Task[];
}

function KanbanColumn({
  status,
  tasks,
  currentUserId,
  onDelete,
  onEdit,
  onToggleHidden,
  onInlineCreate,
  onJumpToCalendar,
  allTasks,
}: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({ id: status });
  const [inlineOpen, setInlineOpen] = useState(false);
  const [inlineTitle, setInlineTitle] = useState('');
  const [inlineSubmitting, setInlineSubmitting] = useState(false);
  const [summaryFilter, setSummaryFilter] = useState<ColumnSummaryFilter | null>(null);
  const [wipLimit, setWipLimit] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const wipLimitValue = wipLimit === '' ? null : Number(wipLimit);
  const wipExceeded =
    wipLimitValue !== null && Number.isFinite(wipLimitValue) && tasks.length > wipLimitValue;

  const summaryCounts = useMemo(
    () => ({
      overdue: tasks.filter((task) => isOverdue(task.dueAt)).length,
      today: tasks.filter((task) => isDueToday(task.dueAt)).length,
      mine:
        currentUserId == null
          ? 0
          : tasks.filter((task) => task.assigneeId === currentUserId).length,
    }),
    [currentUserId, tasks],
  );

  const visibleTasks = useMemo(() => {
    if (!summaryFilter) return tasks;
    if (summaryFilter === 'overdue') return tasks.filter((task) => isOverdue(task.dueAt));
    if (summaryFilter === 'today') return tasks.filter((task) => isDueToday(task.dueAt));
    if (currentUserId == null) return [];
    return tasks.filter((task) => task.assigneeId === currentUserId);
  }, [currentUserId, summaryFilter, tasks]);

  const toggleSummaryFilter = (filter: ColumnSummaryFilter) => {
    setSummaryFilter((current) => (current === filter ? null : filter));
  };

  // 入力フィールドを開いたときオートフォーカス
  useEffect(() => {
    if (inlineOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [inlineOpen]);

  const submit = async () => {
    const trimmed = inlineTitle.trim();
    if (!trimmed) return;
    setInlineSubmitting(true);
    try {
      await onInlineCreate(status, trimmed);
      setInlineTitle('');
    } catch {
      // エラー通知は親側で行い、入力内容は再送信できるよう保持する。
    } finally {
      setInlineSubmitting(false);
    }
  };

  const handleBlur = () => {
    window.setTimeout(() => {
      if (!inputRef.current) return;
      if (inlineTitle.trim()) return;
      if (document.activeElement?.closest('[data-kanban-board="true"]')) return;
      setInlineOpen(false);
    }, 0);
  };

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
      <Box sx={{ mb: 1 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 1,
          }}
        >
          <Typography
            variant="subtitle1"
            fontWeight="bold"
            color={wipExceeded ? 'error.main' : 'text.primary'}
            data-testid={`task-column-heading-${status}`}
            data-wip-exceeded={wipExceeded ? 'true' : 'false'}
          >
            {STATUS_LABELS[status]}
            <Chip
              label={tasks.length}
              size="small"
              sx={{ ml: 1 }}
              color={wipExceeded ? 'error' : 'default'}
            />
          </Typography>
          <TextField
            label={`${STATUS_LABELS[status]}の WIP リミット`}
            value={wipLimit}
            type="number"
            size="small"
            onChange={(e) => setWipLimit(e.target.value)}
            inputProps={{ min: 0, 'aria-label': `${STATUS_LABELS[status]}の WIP リミット` }}
            sx={{ width: 112 }}
          />
        </Box>

        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
          {summaryCounts.overdue > 0 && (
            <Chip
              label={`期限切れ ${summaryCounts.overdue}`}
              size="small"
              color={summaryFilter === 'overdue' ? 'error' : 'default'}
              variant={summaryFilter === 'overdue' ? 'filled' : 'outlined'}
              onClick={() => toggleSummaryFilter('overdue')}
              data-testid={`summary-badge-${status}-overdue`}
            />
          )}
          {summaryCounts.today > 0 && (
            <Chip
              label={`今日 ${summaryCounts.today}`}
              size="small"
              color={summaryFilter === 'today' ? 'primary' : 'default'}
              variant={summaryFilter === 'today' ? 'filled' : 'outlined'}
              onClick={() => toggleSummaryFilter('today')}
              data-testid={`summary-badge-${status}-today`}
            />
          )}
          {summaryCounts.mine > 0 && (
            <Chip
              label={`担当自分 ${summaryCounts.mine}`}
              size="small"
              color={summaryFilter === 'mine' ? 'success' : 'default'}
              variant={summaryFilter === 'mine' ? 'filled' : 'outlined'}
              onClick={() => toggleSummaryFilter('mine')}
              data-testid={`summary-badge-${status}-mine`}
            />
          )}
        </Box>
      </Box>

      <SortableContext items={visibleTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        {visibleTasks.map((task) => (
          <SortableTaskCard
            key={task.id}
            task={task}
            onDelete={onDelete}
            onEdit={onEdit}
            onToggleHidden={onToggleHidden}
            onJumpToCalendar={onJumpToCalendar}
            tasks={allTasks}
          />
        ))}
      </SortableContext>

      {visibleTasks.length === 0 && !inlineOpen && (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 2 }}>
          タスクなし
        </Typography>
      )}

      {/* インライン作成 UI */}
      {inlineOpen ? (
        <TextField
          inputRef={inputRef}
          data-testid={`inline-create-input-${status}`}
          size="small"
          fullWidth
          placeholder="タスク名を入力 (Enter で作成 / Esc でキャンセル)"
          value={inlineTitle}
          disabled={inlineSubmitting}
          onChange={(e) => setInlineTitle(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            // IME 変換確定の Enter は無視
            if (
              e.key === 'Enter' &&
              !(e.nativeEvent as KeyboardEvent & { isComposing?: boolean }).isComposing
            ) {
              e.preventDefault();
              void submit();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              setInlineTitle('');
              setInlineOpen(false);
            }
          }}
          sx={{ mt: 1 }}
        />
      ) : (
        <Button
          startIcon={<AddIcon />}
          size="small"
          fullWidth
          onClick={() => setInlineOpen(true)}
          sx={{ mt: 1, justifyContent: 'flex-start', color: 'text.secondary' }}
        >
          タスク追加
        </Button>
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
  const [viewMode, setViewMode] = useState<'kanban' | 'gantt'>('kanban');
  const isMobile = useMediaQuery('(max-width: 767px)');
  const navigate = useNavigate();
  const { showError } = useSnackbar();
  const { user } = useAuth();

  // Issue #267: タスクからカレンダーへジャンプ
  const handleJumpToCalendar = (task: Task) => {
    if (!task.dueAt) return;
    navigate(`/calendar?date=${formatDueDateForJump(task.dueAt)}`);
  };

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

  const handleInlineCreate = async (newStatus: TaskStatus, title: string) => {
    try {
      const { task: created } = await api.tasks.create({
        title,
        sourceChannelId: channelFilter !== '' ? channelFilter : null,
      });
      // todo 以外はサーバが status を受け取らないため、作成後に status を更新する
      if (newStatus !== 'todo') {
        await api.tasks.update(created.id, { status: newStatus });
      }
      // 一覧再取得
      const { tasks: fresh } = await api.tasks.list(includeHidden ? { includeHidden: true } : {});
      setTasks(fresh);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'タスクの作成に失敗しました');
      throw err;
    }
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

  const handleGanttDueAtChange = async (task: Task, dueAt: string | null) => {
    const prevTasks = tasks;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, dueAt } : t)));
    try {
      await api.tasks.update(task.id, { dueAt });
    } catch {
      setTasks(prevTasks);
      showError('タスクの期限を更新できませんでした');
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* ツールバー: モバイル時は縦スタック、デスクトップ時は横一列 */}
      <Box
        data-testid="task-toolbar"
        sx={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? 1 : 2,
          p: 2,
          alignItems: isMobile ? 'stretch' : 'center',
          flexShrink: 0,
        }}
      >
        <Typography variant="h6" sx={{ flexGrow: isMobile ? 0 : 1 }}>
          タスクボード
        </Typography>

        {/* チャンネル絞り込み */}
        <FormControl
          size="small"
          data-testid="task-channel-filter"
          sx={{ width: isMobile ? '100%' : undefined, minWidth: isMobile ? undefined : 160 }}
        >
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
          fullWidth={isMobile}
        >
          新規タスク作成
        </Button>
        <ButtonGroup size="small" aria-label="タスク表示切替">
          <Button
            variant={viewMode === 'kanban' ? 'contained' : 'outlined'}
            onClick={() => setViewMode('kanban')}
          >
            カンバン
          </Button>
          <Button
            variant={viewMode === 'gantt' ? 'contained' : 'outlined'}
            onClick={() => setViewMode('gantt')}
          >
            ガント
          </Button>
        </ButtonGroup>
      </Box>

      {/* カンバンボード: 横スクロール対応 */}
      {viewMode === 'kanban' ? (
        <Box
          data-testid="kanban-container"
          data-kanban-board="true"
          sx={{ flexGrow: 1, overflow: 'auto', overflowX: 'auto', px: 2, pb: 2 }}
        >
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragOver={handleDragOver}
            onDragEnd={(e) => void handleDragEnd(e)}
          >
            <Box sx={{ display: 'flex', gap: 2, height: '100%', minWidth: 'max-content' }}>
              {STATUS_COLUMNS.map((status) => (
                <KanbanColumn
                  key={status}
                  status={status}
                  tasks={tasksByStatus[status]}
                  currentUserId={user?.id ?? null}
                  onDelete={(id) => void handleDelete(id)}
                  onEdit={(task) => setEditingTask(task)}
                  onToggleHidden={(task) => void handleToggleHidden(task)}
                  onInlineCreate={handleInlineCreate}
                  onJumpToCalendar={handleJumpToCalendar}
                  allTasks={tasks}
                />
              ))}
            </Box>
          </DndContext>
        </Box>
      ) : (
        <Box data-testid="gantt-container" sx={{ flexGrow: 1, overflow: 'auto' }}>
          <TaskGanttChart tasks={filteredTasks} onDueAtChange={handleGanttDueAtChange} />
        </Box>
      )}

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
          tasks={tasks}
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
