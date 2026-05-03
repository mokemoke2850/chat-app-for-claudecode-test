import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import * as threadService from '../services/threadService';

const router = Router();

/**
 * GET /api/threads/subscribed
 * 自分が返信したスレッドのサマリー一覧を返す (Inbox のスレッドタブで使用)。
 */
router.get('/subscribed', authenticateToken, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  try {
    const threads = await threadService.listSubscribedThreads(userId);
    return res.json({ threads });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/threads/:rootMessageId/read
 * 指定スレッドを既読にする (thread_reads を UPSERT して last_read_at を現在時刻に更新)。
 */
router.put('/:rootMessageId/read', authenticateToken, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const rootMessageId = Number(req.params.rootMessageId);
  if (isNaN(rootMessageId)) {
    return res.status(400).json({ error: 'Invalid rootMessageId' });
  }
  try {
    await threadService.markThreadAsRead(userId, rootMessageId);
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
