import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Alert,
  Checkbox,
  ListItemText,
} from '@mui/material';
import type { Task, TaskStatus, User } from '@chat-app/shared';
import { api } from '../../api/client';

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: '未着手' },
  { value: 'in_progress', label: '進行中' },
  { value: 'done', label: '完了' },
];

interface Props {
  open: boolean;
  task: Task;
  users?: User[];
  onClose: () => void;
  onUpdated?: () => void;
  tasks?: Task[];
}

export default function EditTaskDialog({
  open,
  task,
  users = [],
  tasks = [],
  onClose,
  onUpdated,
}: Props) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [assigneeId, setAssigneeId] = useState<number | ''>(task.assigneeId ?? '');
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [dueAt, setDueAt] = useState(
    task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 16) : '',
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [parentTaskId, setParentTaskId] = useState<number | ''>(task.parentTaskId ?? '');
  const [dependencyIds, setDependencyIds] = useState<number[]>(task.dependencyIds ?? []);
  const relationshipCandidates = tasks.filter((candidate) => candidate.id !== task.id);

  // task が変わったとき（ダイアログを別タスクで開き直した場合）にフォームをリセット
  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description ?? '');
    setAssigneeId(task.assigneeId ?? '');
    setStatus(task.status);
    setDueAt(task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 16) : '');
    setError(null);
    setParentTaskId(task.parentTaskId ?? '');
    setDependencyIds(task.dependencyIds ?? []);
  }, [task]);

  const handleClose = () => {
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('タイトルを入力してください');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.tasks.update(task.id, {
        title: title.trim(),
        description: description || null,
        assigneeId: assigneeId !== '' ? assigneeId : null,
        status,
        dueAt: dueAt || null,
        parentTaskId: parentTaskId === '' ? null : parentTaskId,
        dependencyIds,
      });
      onUpdated?.();
      handleClose();
    } catch (err: unknown) {
      setError((err as Error).message ?? 'タスクの更新に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>タスクを編集</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          label="タイトル"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          fullWidth
          required
          sx={{ mb: 2, mt: 1 }}
          autoFocus
          error={!title.trim() && error !== null}
        />

        <TextField
          label="説明（任意）"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          fullWidth
          multiline
          rows={3}
          sx={{ mb: 2 }}
        />

        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>ステータス</InputLabel>
          <Select
            value={status}
            label="ステータス"
            onChange={(e) => setStatus(e.target.value as TaskStatus)}
            inputProps={{ 'aria-label': 'ステータス' }}
          >
            {STATUS_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>担当者（任意）</InputLabel>
          <Select
            value={assigneeId}
            label="担当者（任意）"
            onChange={(e) => setAssigneeId(e.target.value as number | '')}
            inputProps={{ 'aria-label': '担当者' }}
          >
            <MenuItem value="">未割り当て</MenuItem>
            {users.map((u) => (
              <MenuItem key={u.id} value={u.id}>
                {u.displayName ?? u.username}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          label="期限（任意）"
          type="datetime-local"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
          fullWidth
          InputLabelProps={{ shrink: true }}
          sx={{ mb: 2 }}
        />

        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>親タスク（任意）</InputLabel>
          <Select
            value={parentTaskId}
            label="親タスク（任意）"
            onChange={(event) => setParentTaskId(event.target.value as number | '')}
            inputProps={{ 'aria-label': '親タスク' }}
          >
            <MenuItem value="">なし</MenuItem>
            {relationshipCandidates.map((candidate) => (
              <MenuItem key={candidate.id} value={candidate.id}>
                {candidate.title}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth>
          <InputLabel>先行タスク（任意）</InputLabel>
          <Select
            multiple
            value={dependencyIds}
            label="先行タスク（任意）"
            onChange={(event) => setDependencyIds(event.target.value as number[])}
            renderValue={(selected) =>
              selected
                .map((id) => tasks.find((candidate) => candidate.id === id)?.title)
                .filter(Boolean)
                .join('、')
            }
            inputProps={{ 'aria-label': '先行タスク' }}
          >
            {relationshipCandidates.map((candidate) => (
              <MenuItem key={candidate.id} value={candidate.id}>
                <Checkbox checked={dependencyIds.includes(candidate.id)} />
                <ListItemText primary={candidate.title} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={submitting}>
          キャンセル
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSubmit()}
          disabled={!title.trim() || submitting}
        >
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
}
