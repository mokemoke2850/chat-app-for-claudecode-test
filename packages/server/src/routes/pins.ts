import { Router } from 'express';
import { createError } from '../middleware/errorHandler';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import * as pinService from '../services/pinMessageService';

const router = Router({ mergeParams: true });

router.get('/', authenticateToken, async (req, res, next) => {
  const channelId = parseInt(req.params.channelId, 10);
  if (isNaN(channelId)) {
    return next(createError('Invalid channelId', 400));
  }
  const pinnedMessages = await pinService.getPinnedMessages(channelId);
  return res.json({ pinnedMessages });
});

router.post('/:messageId', authenticateToken, async (req, res, next) => {
  const channelId = parseInt(req.params.channelId, 10);
  const messageId = parseInt(req.params.messageId, 10);
  const userId = (req as AuthenticatedRequest).userId;

  if (isNaN(channelId) || isNaN(messageId)) {
    return next(createError('Invalid parameters', 400));
  }

  try {
    const pinned = await pinService.pinMessage(messageId, channelId, userId);
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
    return next(createError('Internal server error', 500));
  }
});

router.delete('/:messageId', authenticateToken, async (req, res, next) => {
  const channelId = parseInt(req.params.channelId, 10);
  const messageId = parseInt(req.params.messageId, 10);

  if (isNaN(channelId) || isNaN(messageId)) {
    return next(createError('Invalid parameters', 400));
  }

  try {
    await pinService.unpinMessage(messageId, channelId);
    return res.status(204).send();
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === 'Message not found' || error.message === 'Pin not found') {
      return next(createError(error.message, 404));
    }
    return next(createError('Internal server error', 500));
  }
});

export default router;
