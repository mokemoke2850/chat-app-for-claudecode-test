import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import * as scheduledMessageService from '../services/scheduledMessageService';

const router = Router();

// POST /api/scheduled-messages — 予約作成
router.post('/', authenticateToken, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const { channelId, content, scheduledAt } = req.body as {
    channelId?: number;
    content?: string;
    scheduledAt?: string;
  };

  if (!channelId || typeof channelId !== 'number') {
    return res.status(400).json({ error: 'channelId is required' });
  }
  if (!content || typeof content !== 'string' || content.trim() === '') {
    return res.status(400).json({ error: 'content is required' });
  }
  if (!scheduledAt) {
    return res.status(400).json({ error: 'scheduledAt is required' });
  }

  const scheduledAtDate = new Date(scheduledAt);
  if (isNaN(scheduledAtDate.getTime())) {
    return res.status(400).json({ error: 'scheduledAt is invalid date' });
  }
  if (scheduledAtDate <= new Date()) {
    return res.status(400).json({ error: 'scheduledAt must be a future date' });
  }

  try {
    const scheduledMessage = await scheduledMessageService.createScheduledMessage(userId, {
      channelId,
      content: content.trim(),
      scheduledAt,
    });
    return res.status(201).json({ scheduledMessage });
  } catch (err: unknown) {
    const error = err as Error & { statusCode?: number };
    return res.status(error.statusCode ?? 500).json({ error: error.message });
  }
});

// GET /api/scheduled-messages — 予約一覧取得
router.get('/', authenticateToken, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  try {
    const scheduledMessages = await scheduledMessageService.listScheduledMessages(userId);
    return res.json({ scheduledMessages });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/scheduled-messages/:id — 予約更新
router.patch('/:id', authenticateToken, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid id' });
  }

  const { content, scheduledAt } = req.body as {
    content?: string;
    scheduledAt?: string;
  };

  if (scheduledAt !== undefined) {
    const scheduledAtDate = new Date(scheduledAt);
    if (isNaN(scheduledAtDate.getTime())) {
      return res.status(400).json({ error: 'scheduledAt is invalid date' });
    }
    if (scheduledAtDate <= new Date()) {
      return res.status(400).json({ error: 'scheduledAt must be a future date' });
    }
  }

  try {
    const scheduledMessage = await scheduledMessageService.updateScheduledMessage(userId, id, {
      content,
      scheduledAt,
    });
    return res.json({ scheduledMessage });
  } catch (err: unknown) {
    const error = err as Error & { statusCode?: number };
    const status = error.statusCode ?? 500;
    return res.status(status).json({ error: error.message });
  }
});

// DELETE /api/scheduled-messages/:id — 予約キャンセル
router.delete('/:id', authenticateToken, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid id' });
  }

  try {
    const scheduledMessage = await scheduledMessageService.cancelScheduledMessage(userId, id);
    return res.json({ scheduledMessage });
  } catch (err: unknown) {
    const error = err as Error & { statusCode?: number };
    const status = error.statusCode ?? 500;
    return res.status(status).json({ error: error.message });
  }
});

export default router;
