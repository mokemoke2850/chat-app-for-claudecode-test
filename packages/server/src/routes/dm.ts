import { Router } from 'express';
import { createError } from '../middleware/errorHandler';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { createRateLimitMiddleware } from '../middleware/rateLimit';
import * as dmService from '../services/dmService';
import { parseCursorParams, buildCursorPage } from '../utils/pagination';

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

  // #386 ページング標準仕様（カーソル系）: { items, nextCursor, hasMore }
  const { limit, before } = parseCursorParams(req);

  try {
    // hasMore 判定のため limit+1 件取得して共通ヘルパーで封筒化する
    const fetched = await dmService.getMessages(conversationId, userId, {
      limit: limit + 1,
      before,
    });
    return res.json(buildCursorPage(fetched, limit));
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === 'Conversation not found or access denied') {
      return next(createError(error.message, 403));
    }
    return next(createError('Internal server error', 500));
  }
});

router.get(
  '/conversations/:conversationId/messages/:messageId/context',
  authenticateToken,
  async (req, res, next) => {
    const userId = (req as AuthenticatedRequest).userId;
    const conversationId = Number(req.params.conversationId);
    const messageId = Number(req.params.messageId);
    if (!Number.isInteger(conversationId) || !Number.isInteger(messageId)) {
      return next(createError('Invalid message context parameters', 400));
    }
    const items = await dmService.getMessageContext(conversationId, messageId, userId);
    if (!items) return next(createError('Message not found or unavailable', 404));
    return res.json({ items, targetMessageId: messageId });
  },
);

router.patch(
  '/conversations/:conversationId/messages/:messageId',
  authenticateToken,
  async (req, res, next) => {
    const userId = (req as AuthenticatedRequest).userId;
    const conversationId = Number(req.params.conversationId);
    const messageId = Number(req.params.messageId);
    if (
      !Number.isInteger(conversationId) ||
      conversationId <= 0 ||
      !Number.isInteger(messageId) ||
      messageId <= 0
    ) {
      return next(createError('Invalid DM message parameters', 400));
    }
    const { content } = req.body as { content?: unknown };
    if (typeof content !== 'string' || content.trim() === '') {
      return next(createError('Content is required', 400));
    }
    try {
      const message = await dmService.editMessage(conversationId, messageId, userId, content);
      return res.json({ message });
    } catch (err) {
      return next(err);
    }
  },
);

router.get(
  '/conversations/:conversationId/messages/:messageId/history',
  authenticateToken,
  async (req, res, next) => {
    const userId = (req as AuthenticatedRequest).userId;
    const conversationId = Number(req.params.conversationId);
    const messageId = Number(req.params.messageId);
    if (
      !Number.isInteger(conversationId) ||
      conversationId <= 0 ||
      !Number.isInteger(messageId) ||
      messageId <= 0
    ) {
      return next(createError('Invalid DM message parameters', 400));
    }
    try {
      const items = await dmService.getMessageEditHistory(conversationId, messageId, userId);
      return res.json({ items });
    } catch (err) {
      return next(err);
    }
  },
);

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
