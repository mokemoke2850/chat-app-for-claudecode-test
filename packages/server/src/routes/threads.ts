import { Router } from 'express';
import { createError } from '../middleware/errorHandler';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import * as threadService from '../services/threadService';

const router = Router();

/**
 * GET /api/threads/subscribed
 * 自分が返信したスレッドのサマリー一覧を返す (Inbox のスレッドタブで使用)。
 */
router.get('/subscribed', authenticateToken, async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).userId;
  try {
    const threads = await threadService.listSubscribedThreads(userId);
    return res.json({ threads });
  } catch {
    return next(createError('Internal server error', 500));
  }
});

/**
 * PUT /api/threads/:rootMessageId/read
 * 指定スレッドを既読にする (thread_reads を UPSERT して last_read_at を現在時刻に更新)。
 */
router.put('/:rootMessageId/read', authenticateToken, async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).userId;
  const rootMessageId = Number(req.params.rootMessageId);
  if (isNaN(rootMessageId)) {
    return next(createError('Invalid rootMessageId', 400));
  }
  try {
    await threadService.markThreadAsRead(userId, rootMessageId);
    return res.status(204).send();
  } catch {
    return next(createError('Internal server error', 500));
  }
});

export default router;
