import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import * as service from '../services/appNotificationService';

const router = Router();
router.get('/', authenticateToken, async (req, res, next) => { try {
  const limit = req.query.limit === undefined ? undefined : Number(req.query.limit);
  const offset = req.query.offset === undefined ? undefined : Number(req.query.offset);
  if ((limit !== undefined && (!Number.isInteger(limit) || limit < 0)) || (offset !== undefined && (!Number.isInteger(offset) || offset < 0))) return next(createError('limit and offset must be non-negative integers', 400));
  res.json(await service.list((req as AuthenticatedRequest).userId, limit, offset));
} catch { next(createError('Internal server error', 500)); } });
router.put('/:id/read', authenticateToken, async (req, res, next) => { try {
  const id = Number(req.params.id); if (!Number.isInteger(id)) return next(createError('Invalid id', 400));
  const userId=(req as AuthenticatedRequest).userId; const notification=await service.markRead(userId, id); res.json({ notification, unreadCount: await service.getUnreadCount(userId) });
} catch (err) { next(createError(err instanceof Error && err.message === 'Notification not found' ? err.message : 'Internal server error', err instanceof Error && err.message === 'Notification not found' ? 404 : 500)); } });
router.put('/read-all', authenticateToken, async (req, res, next) => { try { const userId=(req as AuthenticatedRequest).userId; await service.markAllRead(userId); res.json({ unreadCount: await service.getUnreadCount(userId) }); } catch { next(createError('Internal server error', 500)); } });
export default router;
