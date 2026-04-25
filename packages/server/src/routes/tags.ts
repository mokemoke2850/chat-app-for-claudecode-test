import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import * as tagService from '../services/tagService';

const router = Router();

/**
 * GET /api/tags/suggestions?prefix=&limit=
 * ワークスペース内のタグ候補を use_count 降順で返す
 */
router.get('/tags/suggestions', authenticateToken, async (req, res, next) => {
  try {
    const prefix = typeof req.query.prefix === 'string' ? req.query.prefix : '';
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const suggestions = await tagService.listSuggestions(prefix, limit);
    return res.json({ suggestions });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/messages/:id/tags
 * body: { names: string[] }
 * メッセージにタグを付与する（findOrCreate → attachToMessage）
 */
router.post('/messages/:id/tags', authenticateToken, async (req, res, next) => {
  try {
    const messageId = parseInt(req.params.id, 10);
    const userId = (req as AuthenticatedRequest).userId;
    const names: string[] = Array.isArray(req.body.names) ? req.body.names : [];

    if (isNaN(messageId)) return res.status(400).json({ error: 'Invalid message ID' });

    const tags = await Promise.all(names.map((n) => tagService.findOrCreate(n, userId)));
    const tagIds = tags.map((t) => t.id);
    await tagService.attachToMessage(messageId, tagIds, userId);
    return res.json({ tags });
  } catch (err) {
    return next(err);
  }
});

/**
 * DELETE /api/messages/:id/tags/:tagId
 * メッセージからタグを解除する
 */
router.delete('/messages/:id/tags/:tagId', authenticateToken, async (req, res, next) => {
  try {
    const messageId = parseInt(req.params.id, 10);
    const tagId = parseInt(req.params.tagId, 10);

    if (isNaN(messageId) || isNaN(tagId)) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }

    await tagService.detachFromMessage(messageId, [tagId]);
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/channels/:id/tags
 * body: { names: string[] }
 * チャンネルにタグを付与する
 */
router.post('/channels/:id/tags', authenticateToken, async (req, res, next) => {
  try {
    const channelId = parseInt(req.params.id, 10);
    const userId = (req as AuthenticatedRequest).userId;
    const names: string[] = Array.isArray(req.body.names) ? req.body.names : [];

    if (isNaN(channelId)) return res.status(400).json({ error: 'Invalid channel ID' });

    const tags = await Promise.all(names.map((n) => tagService.findOrCreate(n, userId)));
    const tagIds = tags.map((t) => t.id);
    await tagService.attachToChannel(channelId, tagIds);
    return res.json({ tags });
  } catch (err) {
    return next(err);
  }
});

/**
 * DELETE /api/channels/:id/tags/:tagId
 * チャンネルからタグを解除する
 */
router.delete('/channels/:id/tags/:tagId', authenticateToken, async (req, res, next) => {
  try {
    const channelId = parseInt(req.params.id, 10);
    const tagId = parseInt(req.params.tagId, 10);

    if (isNaN(channelId) || isNaN(tagId)) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }

    await tagService.detachFromChannel(channelId, [tagId]);
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

export default router;
