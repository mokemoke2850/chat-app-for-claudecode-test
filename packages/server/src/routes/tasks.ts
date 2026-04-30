import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import * as taskService from '../services/taskService';

const router = Router();

// GET /tasks
router.get('/', authenticateToken, async (req, res) => {
  const { status, assignee, channel } = req.query;

  const filters: { status?: string; assigneeId?: number; channelId?: number } = {};
  if (status) filters.status = String(status);
  if (assignee) {
    const id = parseInt(String(assignee), 10);
    if (!isNaN(id)) filters.assigneeId = id;
  }
  if (channel) {
    const id = parseInt(String(channel), 10);
    if (!isNaN(id)) filters.channelId = id;
  }

  try {
    const tasks = await taskService.getTasks(filters);
    return res.json({ tasks });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /tasks
router.post('/', authenticateToken, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const { title, description, assigneeId, dueAt, sourceMessageId } = req.body as {
    title?: string;
    description?: string;
    assigneeId?: number | null;
    dueAt?: string | null;
    sourceMessageId?: number | null;
  };

  if (!title || String(title).trim() === '') {
    return res.status(400).json({ error: 'Title is required' });
  }

  try {
    const task = await taskService.createTask(userId, {
      title,
      description,
      assigneeId,
      dueAt,
      sourceMessageId,
    });
    return res.status(201).json({ task });
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === 'Assignee not found' || error.message === 'Source message not found') {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /tasks/order — 並べ替え（PATCH /:id より先に定義する必要がある）
router.put('/order', authenticateToken, async (req, res) => {
  const { items } = req.body as {
    items?: { id: number; status: string; position: number }[];
  };

  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'items must be an array' });
  }

  for (const item of items) {
    if (typeof item.id !== 'number' || typeof item.position !== 'number' || !item.status) {
      return res.status(400).json({ error: 'Invalid item format' });
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
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /tasks/:id
router.patch('/:id', authenticateToken, async (req, res) => {
  const taskId = parseInt(req.params.id, 10);
  if (isNaN(taskId)) {
    return res.status(400).json({ error: 'Invalid task ID' });
  }

  const { title, description, status, assigneeId, dueAt } = req.body as {
    title?: string;
    description?: string | null;
    status?: string;
    assigneeId?: number | null;
    dueAt?: string | null;
  };

  try {
    const task = await taskService.updateTask(taskId, {
      title,
      description,
      status: status as import('@chat-app/shared').TaskStatus | undefined,
      assigneeId,
      dueAt,
    });
    return res.json({ task });
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === 'Task not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Invalid status') {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /tasks/:id
router.delete('/:id', authenticateToken, async (req, res) => {
  const taskId = parseInt(req.params.id, 10);
  if (isNaN(taskId)) {
    return res.status(400).json({ error: 'Invalid task ID' });
  }

  // 存在チェック
  const tasks = await taskService.getTasks();
  const exists = tasks.some((t) => t.id === taskId);
  if (!exists) {
    return res.status(404).json({ error: 'Task not found' });
  }

  try {
    await taskService.deleteTask(taskId);
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
