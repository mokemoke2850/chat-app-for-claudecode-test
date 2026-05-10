import { Router } from 'express';
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

router.get('/', authenticateToken, async (req, res) => {
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

router.post('/:messageId', authenticateToken, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const messageId = parseInt(req.params.messageId, 10);

  if (isNaN(messageId)) {
    return res.status(400).json({ error: 'Invalid messageId' });
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
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Message is already bookmarked') {
      return res.status(409).json({ error: error.message });
    }
    if (error.message === 'Cannot bookmark a deleted message') {
      return res.status(400).json({ error: error.message });
    }
    if (error.message === 'Invalid tag ids') {
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

// #304 ブックマークのタグ更新
router.patch('/:messageId/tags', authenticateToken, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const messageId = parseInt(req.params.messageId, 10);
  if (isNaN(messageId)) {
    return res.status(400).json({ error: 'Invalid messageId' });
  }

  const rawTagIds = (req.body as { tagIds?: unknown } | undefined)?.tagIds;
  if (!Array.isArray(rawTagIds)) {
    return res.status(400).json({ error: 'tagIds must be an array' });
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
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Invalid tag ids') {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
