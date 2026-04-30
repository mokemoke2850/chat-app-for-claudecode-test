import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import * as savedViewService from '../services/savedViewService';

const router = Router();

/** query フィールドの最低限バリデーション */
const savedViewQuerySchema = z
  .object({
    keyword: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    userId: z.number().int().positive().optional(),
    channelId: z.number().int().positive().optional(),
    hasAttachment: z.boolean().optional(),
    tagIds: z.array(z.number().int().positive()).optional(),
  })
  .strict();

const createBodySchema = z.object({
  name: z.string().min(1),
  query: savedViewQuerySchema,
});

const updateBodySchema = z.object({
  name: z.string().min(1).optional(),
  query: savedViewQuerySchema.optional(),
});

const reorderBodySchema = z.object({
  ids: z.array(z.number().int().positive()).min(1),
});

// GET /saved-views
router.get('/', authenticateToken, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const savedViews = await savedViewService.getSavedViews(userId);
  return res.json({ savedViews });
});

// PUT /saved-views/order — 並べ替え（:id より前に定義して優先させる）
router.put('/order', authenticateToken, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const parsed = reorderBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: '無効なリクエストです', details: parsed.error.issues });
  }

  try {
    await savedViewService.reorderSavedViews(userId, parsed.data.ids);
    return res.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '並べ替えに失敗しました';
    if (msg.includes('他ユーザー')) return res.status(403).json({ error: msg });
    return res.status(400).json({ error: msg });
  }
});

// POST /saved-views
router.post('/', authenticateToken, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const parsed = createBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: '無効なリクエストです', details: parsed.error.issues });
  }

  try {
    const savedView = await savedViewService.createSavedView(
      userId,
      parsed.data.name,
      parsed.data.query,
    );
    return res.status(201).json({ savedView });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '保存ビューの作成に失敗しました';
    // unique constraint violation
    if (
      msg.includes('unique') ||
      msg.includes('duplicate') ||
      msg.includes('一意制約') ||
      msg.toLowerCase().includes('already exists')
    ) {
      return res.status(409).json({ error: '同じ名前の保存ビューが既に存在します' });
    }
    return res.status(500).json({ error: msg });
  }
});

// PUT /saved-views/:id
router.put('/:id', authenticateToken, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const viewId = parseInt(req.params.id, 10);
  if (isNaN(viewId)) return res.status(400).json({ error: '無効な id です' });

  const parsed = updateBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: '無効なリクエストです', details: parsed.error.issues });
  }

  try {
    const savedView = await savedViewService.updateSavedView(userId, viewId, parsed.data);
    return res.json({ savedView });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '更新に失敗しました';
    if (msg.includes('見つかりません')) return res.status(404).json({ error: msg });
    if (msg.includes('他ユーザー')) return res.status(403).json({ error: msg });
    if (
      msg.includes('unique') ||
      msg.includes('duplicate') ||
      msg.includes('一意制約') ||
      msg.toLowerCase().includes('already exists')
    ) {
      return res.status(409).json({ error: '同じ名前の保存ビューが既に存在します' });
    }
    return res.status(500).json({ error: msg });
  }
});

// DELETE /saved-views/:id
router.delete('/:id', authenticateToken, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const viewId = parseInt(req.params.id, 10);
  if (isNaN(viewId)) return res.status(400).json({ error: '無効な id です' });

  try {
    await savedViewService.deleteSavedView(userId, viewId);
    return res.status(204).send();
  } catch (err) {
    const msg = err instanceof Error ? err.message : '削除に失敗しました';
    if (msg.includes('見つかりません')) return res.status(404).json({ error: msg });
    if (msg.includes('他ユーザー')) return res.status(403).json({ error: msg });
    return res.status(500).json({ error: msg });
  }
});

export default router;
