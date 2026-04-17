import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import * as pinService from '../services/pinMessageService';

const router = Router({ mergeParams: true });

router.get('/', authenticateToken, async (req, res) => {
  const channelId = parseInt(req.params.channelId, 10);
  if (isNaN(channelId)) {
    return res.status(400).json({ error: 'Invalid channelId' });
  }
  const pinnedMessages = await pinService.getPinnedMessages(channelId);
  return res.json({ pinnedMessages });
});

router.post('/:messageId', authenticateToken, async (req, res) => {
  const channelId = parseInt(req.params.channelId, 10);
  const messageId = parseInt(req.params.messageId, 10);
  const userId = (req as AuthenticatedRequest).userId;

  if (isNaN(channelId) || isNaN(messageId)) {
    return res.status(400).json({ error: 'Invalid parameters' });
  }

  try {
    const pinned = await pinService.pinMessage(messageId, channelId, userId);
    return res.status(201).json({ pinnedMessage: pinned });
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === 'Message not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Message is already pinned in this channel') {
      return res.status(409).json({ error: error.message });
    }
    if (error.message === 'Cannot pin a deleted message') {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:messageId', authenticateToken, async (req, res) => {
  const channelId = parseInt(req.params.channelId, 10);
  const messageId = parseInt(req.params.messageId, 10);

  if (isNaN(channelId) || isNaN(messageId)) {
    return res.status(400).json({ error: 'Invalid parameters' });
  }

  try {
    await pinService.unpinMessage(messageId, channelId);
    return res.status(204).send();
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === 'Message not found' || error.message === 'Pin not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
