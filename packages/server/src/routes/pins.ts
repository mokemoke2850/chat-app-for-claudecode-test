import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import * as pinService from '../services/pinMessageService';

const router = Router({ mergeParams: true });

/**
 * @swagger
 * /api/channels/{channelId}/pins:
 *   get:
 *     summary: チャンネルのピン留めメッセージ一覧を取得する
 *     tags: [Pins]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: channelId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: ピン留めメッセージ一覧
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/', authenticateToken, (req, res) => {
  const channelId = parseInt(req.params.channelId, 10);
  if (isNaN(channelId)) {
    return res.status(400).json({ error: 'Invalid channelId' });
  }
  const pinnedMessages = pinService.getPinnedMessages(channelId);
  return res.json({ pinnedMessages });
});

/**
 * @swagger
 * /api/channels/{channelId}/pins/{messageId}:
 *   post:
 *     summary: メッセージをピン留めする
 *     tags: [Pins]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: channelId
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       201:
 *         description: ピン留め成功
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
router.post('/:messageId', authenticateToken, (req, res) => {
  const channelId = parseInt(req.params.channelId, 10);
  const messageId = parseInt(req.params.messageId, 10);
  const userId = (req as AuthenticatedRequest).userId;

  if (isNaN(channelId) || isNaN(messageId)) {
    return res.status(400).json({ error: 'Invalid parameters' });
  }

  try {
    const pinned = pinService.pinMessage(messageId, channelId, userId);
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

/**
 * @swagger
 * /api/channels/{channelId}/pins/{messageId}:
 *   delete:
 *     summary: ピン留めを解除する
 *     tags: [Pins]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: channelId
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204:
 *         description: ピン留め解除成功
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/:messageId', authenticateToken, (req, res) => {
  const channelId = parseInt(req.params.channelId, 10);
  const messageId = parseInt(req.params.messageId, 10);

  if (isNaN(channelId) || isNaN(messageId)) {
    return res.status(400).json({ error: 'Invalid parameters' });
  }

  try {
    pinService.unpinMessage(messageId, channelId);
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
