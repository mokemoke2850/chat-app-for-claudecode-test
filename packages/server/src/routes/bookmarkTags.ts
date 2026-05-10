import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import * as bookmarkService from '../services/bookmarkService';

const router = Router();

router.get('/', authenticateToken, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const tags = await bookmarkService.listTags(userId);
  return res.json({ tags });
});

router.post('/', authenticateToken, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const body = (req.body as { name?: unknown; color?: unknown } | undefined) ?? {};
  const name = typeof body.name === 'string' ? body.name : '';
  const color = typeof body.color === 'string' ? body.color : body.color === null ? null : null;

  if (name.trim() === '') {
    return res.status(400).json({ error: 'Tag name is required' });
  }

  try {
    const tag = await bookmarkService.createTag(userId, name, color);
    return res.status(201).json({ tag });
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === 'Tag name already exists') {
      return res.status(409).json({ error: error.message });
    }
    if (error.message === 'Tag name is required') {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:tagId', authenticateToken, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const tagId = parseInt(req.params.tagId, 10);
  if (isNaN(tagId)) {
    return res.status(400).json({ error: 'Invalid tagId' });
  }

  const body = (req.body as { name?: unknown; color?: unknown } | undefined) ?? {};
  const data: { name?: string; color?: string | null } = {};
  if (typeof body.name === 'string') data.name = body.name;
  if (typeof body.color === 'string' || body.color === null) {
    data.color = body.color as string | null;
  }

  try {
    const tag = await bookmarkService.updateTag(userId, tagId, data);
    return res.status(200).json({ tag });
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === 'Tag not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Forbidden') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Tag name already exists') {
      return res.status(409).json({ error: error.message });
    }
    if (error.message === 'Tag name is required') {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:tagId', authenticateToken, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const tagId = parseInt(req.params.tagId, 10);
  if (isNaN(tagId)) {
    return res.status(400).json({ error: 'Invalid tagId' });
  }

  try {
    await bookmarkService.deleteTag(userId, tagId);
    return res.status(204).send();
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === 'Tag not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Forbidden') {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
