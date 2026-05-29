import { Router } from 'express';
import { createError } from '../middleware/errorHandler';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { createRateLimitMiddleware } from '../middleware/rateLimit';
import * as dmService from '../services/dmService';

const router = Router();

router.post('/conversations', authenticateToken, async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).userId;
  const { targetUserId } = req.body as { targetUserId?: number };

  if (!targetUserId || isNaN(Number(targetUserId))) {
    return next(createError('targetUserId is required', 400));
  }

  try {
    const conversation = await dmService.getOrCreateConversation(userId, Number(targetUserId));
    return res.status(201).json({ conversation });
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === 'User not found') {
      return next(createError(error.message, 404));
    }
    if (error.message === 'Cannot create DM with yourself') {
      return next(createError(error.message, 400));
    }
    return next(createError('Internal server error', 500));
  }
});

router.get('/conversations', authenticateToken, async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).userId;
  const conversations = await dmService.getConversations(userId);
  return res.json({ conversations });
});

router.get('/conversations/:conversationId/messages', authenticateToken, async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).userId;
  const conversationId = parseInt(req.params.conversationId, 10);

  if (isNaN(conversationId)) {
    return next(createError('Invalid conversationId', 400));
  }

  const conv = await dmService.getConversationWithDetails(conversationId, userId);
  if (!conv) {
    return next(createError('Conversation not found', 404));
  }

  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  const before = req.query.before ? parseInt(req.query.before as string, 10) : undefined;

  try {
    const messages = await dmService.getMessages(conversationId, userId, { limit, before });
    return res.json({ messages });
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === 'Conversation not found or access denied') {
      return next(createError(error.message, 403));
    }
    return next(createError('Internal server error', 500));
  }
});

router.post(
  '/conversations/:conversationId/messages',
  authenticateToken,
  createRateLimitMiddleware('dm'),
  async (req, res, next) => {
    const userId = (req as AuthenticatedRequest).userId;
    const conversationId = parseInt(req.params.conversationId, 10);

    if (isNaN(conversationId)) {
      return next(createError('Invalid conversationId', 400));
    }

    const { content } = req.body as { content?: string };
    if (!content || content.trim() === '') {
      return next(createError('Content is required', 400));
    }

    if (!(await dmService.checkAccess(conversationId, userId))) {
      return next(createError('Access denied', 403));
    }

    try {
      const message = await dmService.sendMessage(conversationId, userId, content);
      return res.status(201).json({ message });
    } catch (err: unknown) {
      const error = err as Error;
      if (error.message === 'Conversation not found or access denied') {
        return next(createError(error.message, 403));
      }
      if (error.message === 'Content is required') {
        return next(createError(error.message, 400));
      }
      return next(createError('Internal server error', 500));
    }
  },
);

router.put('/conversations/:conversationId/read', authenticateToken, async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).userId;
  const conversationId = parseInt(req.params.conversationId, 10);

  if (isNaN(conversationId)) {
    return next(createError('Invalid conversationId', 400));
  }

  try {
    await dmService.markAsRead(conversationId, userId);
    return res.status(204).send();
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === 'Conversation not found or access denied') {
      return next(createError(error.message, 403));
    }
    return next(createError('Internal server error', 500));
  }
});

export default router;
