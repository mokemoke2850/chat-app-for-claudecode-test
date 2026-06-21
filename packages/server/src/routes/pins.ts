import { Router } from 'express';
import { createError } from '../middleware/errorHandler';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import * as pinService from '../services/pinMessageService';

const router = Router({ mergeParams: true });

function parseChannelId(value: string): number | null {
  const channelId = Number(value);
  return Number.isInteger(channelId) && channelId > 0 ? channelId : null;
}

function parseMessageId(value: string): number | null {
  const messageId = Number(value);
  return Number.isInteger(messageId) && messageId > 0 ? messageId : null;
}

router.get('/categories', authenticateToken, async (req, res, next) => {
  const channelId = parseChannelId(req.params.channelId);
  const userId = (req as AuthenticatedRequest).userId;
  if (channelId === null) return next(createError('Invalid channelId', 400));
  try {
    const categories = await pinService.getPinCategories(channelId, userId);
    return res.json({ categories });
  } catch (error) {
    if ((error as Error).message === 'Channel not found')
      return next(createError('Channel not found', 404));
    if ((error as Error).message === 'Forbidden') return next(createError('Forbidden', 403));
    return next(createError('Internal server error', 500));
  }
});

router.post('/categories', authenticateToken, async (req, res, next) => {
  const channelId = parseChannelId(req.params.channelId);
  const userId = (req as AuthenticatedRequest).userId;
  if (channelId === null) return next(createError('Invalid channelId', 400));
  if (typeof req.body.name !== 'string') return next(createError('Invalid category name', 400));
  try {
    const category = await pinService.createPinCategory(channelId, req.body.name, userId);
    return res.status(201).json({ category });
  } catch (error) {
    const message = (error as Error).message;
    if (message === 'Channel not found') return next(createError(message, 404));
    if (message === 'Forbidden') return next(createError(message, 403));
    if (message === 'Invalid category name') return next(createError(message, 400));
    if (message === 'Pin category already exists') return next(createError(message, 409));
    return next(createError('Internal server error', 500));
  }
});

router.get('/', authenticateToken, async (req, res, next) => {
  const channelId = parseInt(req.params.channelId, 10);
  if (isNaN(channelId)) {
    return next(createError('Invalid channelId', 400));
  }
  const userId = (req as AuthenticatedRequest).userId;
  try {
    const pinnedMessages = await pinService.getPinnedMessages(channelId, userId);
    return res.json({ pinnedMessages });
  } catch (error) {
    const message = (error as Error).message;
    if (message === 'Channel not found') return next(createError(message, 404));
    if (message === 'Forbidden') return next(createError(message, 403));
    return next(createError('Internal server error', 500));
  }
});

router.post('/:messageId', authenticateToken, async (req, res, next) => {
  const channelId = parseChannelId(req.params.channelId);
  const messageId = parseMessageId(req.params.messageId);
  const userId = (req as AuthenticatedRequest).userId;

  if (channelId === null || messageId === null) {
    return next(createError('Invalid parameters', 400));
  }
  const { categoryId } = req.body as { categoryId?: unknown };
  if (
    categoryId !== undefined &&
    categoryId !== null &&
    (!Number.isInteger(categoryId) || (categoryId as number) <= 0)
  ) {
    return next(createError('Invalid categoryId', 400));
  }

  try {
    const pinned = await pinService.pinMessage(
      messageId,
      channelId,
      userId,
      categoryId as number | null | undefined,
    );
    return res.status(201).json({ pinnedMessage: pinned });
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === 'Message not found') {
      return next(createError(error.message, 404));
    }
    if (error.message === 'Message is already pinned in this channel') {
      return next(createError(error.message, 409));
    }
    if (error.message === 'Cannot pin a deleted message') {
      return next(createError(error.message, 400));
    }
    if (
      error.message === 'Pin category does not belong to channel' ||
      error.message === 'Message does not belong to channel'
    ) {
      return next(createError(error.message, 400));
    }
    if (error.message === 'Pin category not found') return next(createError(error.message, 404));
    if (error.message === 'Forbidden') return next(createError(error.message, 403));
    return next(createError('Internal server error', 500));
  }
});

router.patch('/:messageId/category', authenticateToken, async (req, res, next) => {
  const channelId = parseChannelId(req.params.channelId);
  const messageId = parseMessageId(req.params.messageId);
  const userId = (req as AuthenticatedRequest).userId;
  if (channelId === null || messageId === null) return next(createError('Invalid parameters', 400));
  if (!Object.prototype.hasOwnProperty.call(req.body, 'categoryId')) {
    return next(createError('categoryId is required', 400));
  }
  const { categoryId } = req.body as { categoryId: unknown };
  if (categoryId !== null && (!Number.isInteger(categoryId) || (categoryId as number) <= 0)) {
    return next(createError('Invalid categoryId', 400));
  }
  try {
    const pinnedMessage = await pinService.updatePinCategory(
      messageId,
      channelId,
      categoryId as number | null,
      userId,
    );
    return res.json({ pinnedMessage });
  } catch (error) {
    const message = (error as Error).message;
    if (message === 'Pin not found' || message === 'Pin category not found') {
      return next(createError(message, 404));
    }
    if (message === 'Pin category does not belong to channel') {
      return next(createError(message, 400));
    }
    if (message === 'Forbidden') return next(createError(message, 403));
    return next(createError('Internal server error', 500));
  }
});

router.delete('/:messageId', authenticateToken, async (req, res, next) => {
  const channelId = parseInt(req.params.channelId, 10);
  const messageId = parseInt(req.params.messageId, 10);
  const userId = (req as AuthenticatedRequest).userId;

  if (isNaN(channelId) || isNaN(messageId)) {
    return next(createError('Invalid parameters', 400));
  }

  try {
    await pinService.unpinMessage(messageId, channelId, userId);
    return res.status(204).send();
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === 'Message not found' || error.message === 'Pin not found') {
      return next(createError(error.message, 404));
    }
    if (error.message === 'Forbidden') return next(createError(error.message, 403));
    return next(createError('Internal server error', 500));
  }
});

export default router;
