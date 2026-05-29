import { Router } from 'express';
import { createError } from '../middleware/errorHandler';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import * as bookmarkService from '../services/bookmarkService';
import type { BookmarkListFilters } from '@chat-app/shared';

const router = Router();

function parseTagIds(raw: unknown): number[] {
  if (raw === undefined || raw === null || raw === '') return [];
  const str = String(raw);
  return str
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '')
    .map((s) => parseInt(s, 10))
    .filter((n) => Number.isInteger(n) && n > 0);
}

router.get('/', authenticateToken, async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).userId;

  const filters: BookmarkListFilters = {};
  if (typeof req.query.search === 'string') {
    filters.search = req.query.search;
  }
  const tagIds = parseTagIds(req.query.tagIds);
  if (tagIds.length > 0) {
    filters.tagIds = tagIds;
  }
  if (req.query.tagMode === 'and' || req.query.tagMode === 'or') {
    filters.tagMode = req.query.tagMode;
  }
  if (req.query.untagged === 'true' || req.query.untagged === '1') {
    filters.untagged = true;
  }

  const bookmarks = await bookmarkService.getBookmarks(userId, filters);
  return res.json({ bookmarks });
});

router.post('/:messageId', authenticateToken, async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).userId;
  const messageId = parseInt(req.params.messageId, 10);

  if (isNaN(messageId)) {
    return next(createError('Invalid messageId', 400));
  }

  // tagIds はオプション（後方互換）
  const rawTagIds = (req.body as { tagIds?: unknown } | undefined)?.tagIds;
  let tagIds: number[] = [];
  if (Array.isArray(rawTagIds)) {
    tagIds = rawTagIds
      .map((v) => (typeof v === 'number' ? v : parseInt(String(v), 10)))
      .filter((n) => Number.isInteger(n) && n > 0);
  }

  try {
    const bookmark = await bookmarkService.addBookmark(userId, messageId, tagIds);
    return res.status(201).json({ bookmark });
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === 'Message not found') {
      return next(createError(error.message, 404));
    }
    if (error.message === 'Message is already bookmarked') {
      return next(createError(error.message, 409));
    }
    if (error.message === 'Cannot bookmark a deleted message') {
      return next(createError(error.message, 400));
    }
    if (error.message === 'Invalid tag ids') {
      return next(createError(error.message, 400));
    }
    return next(createError('Internal server error', 500));
  }
});

router.delete('/:messageId', authenticateToken, async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).userId;
  const messageId = parseInt(req.params.messageId, 10);

  if (isNaN(messageId)) {
    return next(createError('Invalid messageId', 400));
  }

  try {
    await bookmarkService.removeBookmark(userId, messageId);
    return res.status(204).send();
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === 'Message not found' || error.message === 'Bookmark not found') {
      return next(createError(error.message, 404));
    }
    return next(createError('Internal server error', 500));
  }
});

// #304 ブックマークのタグ更新
router.patch('/:messageId/tags', authenticateToken, async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).userId;
  const messageId = parseInt(req.params.messageId, 10);
  if (isNaN(messageId)) {
    return next(createError('Invalid messageId', 400));
  }

  const rawTagIds = (req.body as { tagIds?: unknown } | undefined)?.tagIds;
  if (!Array.isArray(rawTagIds)) {
    return next(createError('tagIds must be an array', 400));
  }
  const tagIds = rawTagIds
    .map((v) => (typeof v === 'number' ? v : parseInt(String(v), 10)))
    .filter((n) => Number.isInteger(n) && n > 0);

  try {
    const bookmark = await bookmarkService.setBookmarkTags(userId, messageId, tagIds);
    return res.status(200).json({ bookmark });
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === 'Bookmark not found') {
      return next(createError(error.message, 404));
    }
    if (error.message === 'Invalid tag ids') {
      return next(createError(error.message, 400));
    }
    return next(createError('Internal server error', 500));
  }
});

export default router;
