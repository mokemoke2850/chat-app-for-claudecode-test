import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import * as bookmarkService from '../services/bookmarkService';

const router = Router();

router.get('/', authenticateToken, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const bookmarks = await bookmarkService.getBookmarks(userId);
  return res.json({ bookmarks });
});

router.post('/:messageId', authenticateToken, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const messageId = parseInt(req.params.messageId, 10);

  if (isNaN(messageId)) {
    return res.status(400).json({ error: 'Invalid messageId' });
  }

  try {
    const bookmark = await bookmarkService.addBookmark(userId, messageId);
    return res.status(201).json({ bookmark });
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === 'Message not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Message is already bookmarked') {
      return res.status(409).json({ error: error.message });
    }
    if (error.message === 'Cannot bookmark a deleted message') {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:messageId', authenticateToken, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const messageId = parseInt(req.params.messageId, 10);

  if (isNaN(messageId)) {
    return res.status(400).json({ error: 'Invalid messageId' });
  }

  try {
    await bookmarkService.removeBookmark(userId, messageId);
    return res.status(204).send();
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === 'Message not found' || error.message === 'Bookmark not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
