import { Router } from 'express';
import { createError } from '../middleware/errorHandler';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { createRateLimitMiddleware } from '../middleware/rateLimit';
import * as scheduledMessageService from '../services/scheduledMessageService';

const router = Router();

// POST /api/scheduled-messages — 予約作成
router.post('/', authenticateToken, createRateLimitMiddleware('scheduled'), async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).userId;
  const { channelId, content, scheduledAt } = req.body as {
    channelId?: number;
    content?: string;
    scheduledAt?: string;
  };

  if (!channelId || typeof channelId !== 'number') {
    return next(createError('channelId is required', 400));
  }
  if (!content || typeof content !== 'string' || content.trim() === '') {
    return next(createError('content is required', 400));
  }
  if (!scheduledAt) {
    return next(createError('scheduledAt is required', 400));
  }

  const scheduledAtDate = new Date(scheduledAt);
  if (isNaN(scheduledAtDate.getTime())) {
    return next(createError('scheduledAt is invalid date', 400));
  }
  if (scheduledAtDate <= new Date()) {
    return next(createError('scheduledAt must be a future date', 400));
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
    return next(createError(error.message, error.statusCode ?? 500));
  }
});

// GET /api/scheduled-messages — 予約一覧取得
router.get('/', authenticateToken, async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).userId;
  try {
    const scheduledMessages = await scheduledMessageService.listScheduledMessages(userId);
    return res.json({ scheduledMessages });
  } catch {
    return next(createError('Internal server error', 500));
  }
});

// PATCH /api/scheduled-messages/:id — 予約更新
router.patch('/:id', authenticateToken, async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).userId;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return next(createError('Invalid id', 400));
  }

  const { content, scheduledAt } = req.body as {
    content?: string;
    scheduledAt?: string;
  };

  if (scheduledAt !== undefined) {
    const scheduledAtDate = new Date(scheduledAt);
    if (isNaN(scheduledAtDate.getTime())) {
      return next(createError('scheduledAt is invalid date', 400));
    }
    if (scheduledAtDate <= new Date()) {
      return next(createError('scheduledAt must be a future date', 400));
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
    return next(createError(error.message, status));
  }
});

// DELETE /api/scheduled-messages/:id — 予約キャンセル
router.delete('/:id', authenticateToken, async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).userId;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return next(createError('Invalid id', 400));
  }

  try {
    const scheduledMessage = await scheduledMessageService.cancelScheduledMessage(userId, id);
    return res.json({ scheduledMessage });
  } catch (err: unknown) {
    const error = err as Error & { statusCode?: number };
    const status = error.statusCode ?? 500;
    return next(createError(error.message, status));
  }
});

export default router;
