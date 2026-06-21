import { Router } from 'express';
import { createError } from '../middleware/errorHandler';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import * as taskService from '../services/taskService';

const router = Router();

// GET /tasks
router.get('/', authenticateToken, async (req, res, next) => {
  const { status, assignee, channel, includeHidden } = req.query;

  const filters: {
    status?: string;
    assigneeId?: number;
    channelId?: number;
    includeHidden?: boolean;
  } = {};
  if (status) filters.status = String(status);
  if (assignee) {
    const id = parseInt(String(assignee), 10);
    if (!isNaN(id)) filters.assigneeId = id;
  }
  if (channel) {
    const id = parseInt(String(channel), 10);
    if (!isNaN(id)) filters.channelId = id;
  }
  if (includeHidden === 'true') filters.includeHidden = true;

  try {
    const tasks = await taskService.getTasks(filters);
    return res.json({ tasks });
  } catch {
    return next(createError('Internal server error', 500));
  }
});

// POST /tasks
router.post('/', authenticateToken, async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).userId;
  const {
    title,
    description,
    assigneeId,
    dueAt,
    sourceMessageId,
    sourceChannelId,
    parentTaskId,
    dependencyIds,
  } = req.body as {
    title?: string;
    description?: string;
    assigneeId?: number | null;
    dueAt?: string | null;
    sourceMessageId?: number | null;
    sourceChannelId?: number | null;
    parentTaskId?: number | null;
    dependencyIds?: number[];
  };

  if (!title || String(title).trim() === '') {
    return next(createError('Title is required', 400));
  }

  try {
    const task = await taskService.createTask(userId, {
      title,
      description,
      assigneeId,
      dueAt,
      sourceMessageId,
      sourceChannelId,
      parentTaskId,
      dependencyIds,
    });
    return res.status(201).json({ task });
  } catch (err: unknown) {
    const error = err as Error;
    if (
      error.message === 'Assignee not found' ||
      error.message === 'Source message not found' ||
      error.message === 'Source channel not found' ||
      error.message === 'Parent task not found' ||
      error.message === 'Dependency task not found' ||
      error.message === 'Invalid dependency IDs'
    ) {
      return next(createError(error.message, 400));
    }
    return next(createError('Internal server error', 500));
  }
});

// PUT /tasks/order — 並べ替え（PATCH /:id より先に定義する必要がある）
router.put('/order', authenticateToken, async (req, res, next) => {
  const { items } = req.body as {
    items?: { id: number; status: string; position: number }[];
  };

  if (!Array.isArray(items)) {
    return next(createError('items must be an array', 400));
  }

  for (const item of items) {
    if (typeof item.id !== 'number' || typeof item.position !== 'number' || !item.status) {
      return next(createError('Invalid item format', 400));
    }
  }

  try {
    await taskService.updateTaskOrder(
      items.map((i) => ({
        id: i.id,
        status: i.status as import('@chat-app/shared').TaskStatus,
        position: i.position,
      })),
    );
    return res.json({ success: true });
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === 'Invalid status') {
      return next(createError(error.message, 400));
    }
    return next(createError('Internal server error', 500));
  }
});

// PATCH /tasks/:id
router.patch('/:id', authenticateToken, async (req, res, next) => {
  const taskId = parseInt(req.params.id, 10);
  if (isNaN(taskId)) {
    return next(createError('Invalid task ID', 400));
  }

  const { title, description, status, assigneeId, dueAt, isHidden, parentTaskId, dependencyIds } =
    req.body as {
      title?: string;
      description?: string | null;
      status?: string;
      assigneeId?: number | null;
      dueAt?: string | null;
      isHidden?: boolean;
      parentTaskId?: number | null;
      dependencyIds?: number[];
    };

  try {
    const task = await taskService.updateTask(taskId, {
      title,
      description,
      status: status as import('@chat-app/shared').TaskStatus | undefined,
      assigneeId,
      dueAt,
      isHidden,
      parentTaskId,
      dependencyIds,
    });
    return res.json({ task });
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === 'Task not found') {
      return next(createError(error.message, 404));
    }
    if (
      error.message === 'Invalid status' ||
      error.message === 'Parent task not found' ||
      error.message === 'Dependency task not found' ||
      error.message === 'Invalid dependency IDs' ||
      error.message === 'Task relationship cycle detected' ||
      error.message === 'Task dependency cycle detected'
    ) {
      return next(createError(error.message, 400));
    }
    return next(createError('Internal server error', 500));
  }
});

// DELETE /tasks/:id
router.delete('/:id', authenticateToken, async (req, res, next) => {
  const taskId = parseInt(req.params.id, 10);
  if (isNaN(taskId)) {
    return next(createError('Invalid task ID', 400));
  }

  // 存在チェック
  const tasks = await taskService.getTasks();
  const exists = tasks.some((t) => t.id === taskId);
  if (!exists) {
    return next(createError('Task not found', 404));
  }

  try {
    await taskService.deleteTask(taskId);
    return res.status(204).send();
  } catch {
    return next(createError('Internal server error', 500));
  }
});

export default router;
