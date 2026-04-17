import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import * as dmService from '../services/dmService';

const router = Router();

router.post('/conversations', authenticateToken, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const { targetUserId } = req.body as { targetUserId?: number };

  if (!targetUserId || isNaN(Number(targetUserId))) {
    return res.status(400).json({ error: 'targetUserId is required' });
  }

  try {
    const conversation = await dmService.getOrCreateConversation(userId, Number(targetUserId));
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

router.get('/conversations', authenticateToken, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const conversations = await dmService.getConversations(userId);
  return res.json({ conversations });
});

router.get('/conversations/:conversationId/messages', authenticateToken, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const conversationId = parseInt(req.params.conversationId, 10);

  if (isNaN(conversationId)) {
    return res.status(400).json({ error: 'Invalid conversationId' });
  }

  const conv = await dmService.getConversationWithDetails(conversationId, userId);
  if (!conv) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  const before = req.query.before ? parseInt(req.query.before as string, 10) : undefined;

  try {
    const messages = await dmService.getMessages(conversationId, userId, { limit, before });
    return res.json({ messages });
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === 'Conversation not found or access denied') {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/conversations/:conversationId/messages', authenticateToken, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const conversationId = parseInt(req.params.conversationId, 10);

  if (isNaN(conversationId)) {
    return res.status(400).json({ error: 'Invalid conversationId' });
  }

  const { content } = req.body as { content?: string };
  if (!content || content.trim() === '') {
    return res.status(400).json({ error: 'Content is required' });
  }

  if (!(await dmService.checkAccess(conversationId, userId))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const message = await dmService.sendMessage(conversationId, userId, content);
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

router.put('/conversations/:conversationId/read', authenticateToken, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const conversationId = parseInt(req.params.conversationId, 10);

  if (isNaN(conversationId)) {
    return res.status(400).json({ error: 'Invalid conversationId' });
  }

  try {
    await dmService.markAsRead(conversationId, userId);
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
