import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import * as dmService from '../services/dmService';

const router = Router();

/**
 * POST /api/dm/conversations
 * DM会話を作成する（冪等: 既存があれば返す）
 */
router.post('/conversations', authenticateToken, (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const { targetUserId } = req.body as { targetUserId?: number };

  if (!targetUserId || isNaN(Number(targetUserId))) {
    return res.status(400).json({ error: 'targetUserId is required' });
  }

  try {
    const conversation = dmService.getOrCreateConversation(userId, Number(targetUserId));
    return res.status(201).json({ conversation });
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === 'User not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Cannot create DM with yourself') {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/dm/conversations
 * 自分のDM会話一覧（未読数・最新メッセージ含む）
 */
router.get('/conversations', authenticateToken, (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const conversations = dmService.getConversations(userId);
  return res.json({ conversations });
});

/**
 * GET /api/dm/conversations/:conversationId/messages
 * DM会話のメッセージ一覧（cursorページネーション）
 */
router.get('/conversations/:conversationId/messages', authenticateToken, (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const conversationId = parseInt(req.params.conversationId, 10);

  if (isNaN(conversationId)) {
    return res.status(400).json({ error: 'Invalid conversationId' });
  }

  // 存在確認
  const conv = dmService.getConversationWithDetails(conversationId, userId);
  if (!conv) {
    // アクセス権がない場合はまず存在確認
    return res.status(404).json({ error: 'Conversation not found' });
  }

  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  const before = req.query.before ? parseInt(req.query.before as string, 10) : undefined;

  try {
    const messages = dmService.getMessages(conversationId, userId, { limit, before });
    return res.json({ messages });
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === 'Conversation not found or access denied') {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/dm/conversations/:conversationId/messages
 * DM会話にメッセージを送信する
 */
router.post('/conversations/:conversationId/messages', authenticateToken, (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const conversationId = parseInt(req.params.conversationId, 10);

  if (isNaN(conversationId)) {
    return res.status(400).json({ error: 'Invalid conversationId' });
  }

  const { content } = req.body as { content?: string };
  if (!content || content.trim() === '') {
    return res.status(400).json({ error: 'Content is required' });
  }

  // アクセス確認
  if (!dmService.checkAccess(conversationId, userId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const message = dmService.sendMessage(conversationId, userId, content);
    return res.status(201).json({ message });
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === 'Conversation not found or access denied') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Content is required') {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/dm/conversations/:conversationId/read
 * 会話の未読メッセージを既読に更新する
 */
router.put('/conversations/:conversationId/read', authenticateToken, (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const conversationId = parseInt(req.params.conversationId, 10);

  if (isNaN(conversationId)) {
    return res.status(400).json({ error: 'Invalid conversationId' });
  }

  try {
    dmService.markAsRead(conversationId, userId);
    return res.status(204).send();
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === 'Conversation not found or access denied') {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
