import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import * as bookmarkService from '../services/bookmarkService';

const router = Router();

/**
 * @swagger
 * /api/bookmarks:
 *   get:
 *     summary: 自分のブックマーク一覧を取得する
 *     tags: [Bookmarks]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: ブックマーク一覧
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/', authenticateToken, (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const bookmarks = bookmarkService.getBookmarks(userId);
  return res.json({ bookmarks });
});

/**
 * @swagger
 * /api/bookmarks/{messageId}:
 *   post:
 *     summary: メッセージをブックマーク登録する
 *     tags: [Bookmarks]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       201:
 *         description: ブックマーク登録成功
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
router.post('/:messageId', authenticateToken, (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const messageId = parseInt(req.params.messageId, 10);

  if (isNaN(messageId)) {
    return res.status(400).json({ error: 'Invalid messageId' });
  }

  try {
    const bookmark = bookmarkService.addBookmark(userId, messageId);
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

/**
 * @swagger
 * /api/bookmarks/{messageId}:
 *   delete:
 *     summary: ブックマークを解除する
 *     tags: [Bookmarks]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204:
 *         description: ブックマーク解除成功
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/:messageId', authenticateToken, (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const messageId = parseInt(req.params.messageId, 10);

  if (isNaN(messageId)) {
    return res.status(400).json({ error: 'Invalid messageId' });
  }

  try {
    bookmarkService.removeBookmark(userId, messageId);
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
