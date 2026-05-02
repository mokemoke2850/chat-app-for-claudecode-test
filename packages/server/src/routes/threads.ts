import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import * as threadService from '../services/threadService';

const router = Router();

/**
 * Step 6c: GET /api/threads/subscribed
 * 自分が返信したスレッドのサマリー一覧を返す（Inbox スレッドタブで使用）
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

export default router;
