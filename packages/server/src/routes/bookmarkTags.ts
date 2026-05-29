import { Router } from 'express';
import { createError } from '../middleware/errorHandler';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import * as bookmarkService from '../services/bookmarkService';

const router = Router();

router.get('/', authenticateToken, async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).userId;
  const tags = await bookmarkService.listTags(userId);
  return res.json({ tags });
});

router.post('/', authenticateToken, async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).userId;
  const body = (req.body as { name?: unknown; color?: unknown } | undefined) ?? {};
  const name = typeof body.name === 'string' ? body.name : '';
  const color = typeof body.color === 'string' ? body.color : body.color === null ? null : null;

  if (name.trim() === '') {
    return next(createError('Tag name is required', 400));
  }

  try {
    const tag = await bookmarkService.createTag(userId, name, color);
    return res.status(201).json({ tag });
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === 'Tag name already exists') {
      return next(createError(error.message, 409));
    }
    if (error.message === 'Tag name is required') {
      return next(createError(error.message, 400));
    }
    return next(createError('Internal server error', 500));
  }
});

router.patch('/:tagId', authenticateToken, async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).userId;
  const tagId = parseInt(req.params.tagId, 10);
  if (isNaN(tagId)) {
    return next(createError('Invalid tagId', 400));
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
      return next(createError(error.message, 404));
    }
    if (error.message === 'Forbidden') {
      return next(createError(error.message, 403));
    }
    if (error.message === 'Tag name already exists') {
      return next(createError(error.message, 409));
    }
    if (error.message === 'Tag name is required') {
      return next(createError(error.message, 400));
    }
    return next(createError('Internal server error', 500));
  }
});

router.delete('/:tagId', authenticateToken, async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).userId;
  const tagId = parseInt(req.params.tagId, 10);
  if (isNaN(tagId)) {
    return next(createError('Invalid tagId', 400));
  }

  try {
    await bookmarkService.deleteTag(userId, tagId);
    return res.status(204).send();
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === 'Tag not found') {
      return next(createError(error.message, 404));
    }
    if (error.message === 'Forbidden') {
      return next(createError(error.message, 403));
    }
    return next(createError('Internal server error', 500));
  }
});

export default router;
