import { Router } from 'express';
import { createError, createValidationError } from '../middleware/errorHandler';
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
router.get('/', authenticateToken, async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).userId;
  const savedViews = await savedViewService.getSavedViews(userId);
  return res.json({ savedViews });
});

// PUT /saved-views/order — 並べ替え（:id より前に定義して優先させる）
router.put('/order', authenticateToken, async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).userId;
  const parsed = reorderBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return next(createValidationError(parsed.error.issues, '無効なリクエストです'));
  }

  try {
    await savedViewService.reorderSavedViews(userId, parsed.data.ids);
    return res.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '並べ替えに失敗しました';
    if (msg.includes('他ユーザー')) return next(createError(msg, 403));
    return next(createError(msg, 400));
  }
});

// POST /saved-views
router.post('/', authenticateToken, async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).userId;
  const parsed = createBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return next(createValidationError(parsed.error.issues, '無効なリクエストです'));
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
      return next(createError('同じ名前の保存ビューが既に存在します', 409));
    }
    return next(createError(msg, 500));
  }
});

// PUT /saved-views/:id
router.put('/:id', authenticateToken, async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).userId;
  const viewId = parseInt(req.params.id, 10);
  if (isNaN(viewId)) return next(createError('無効な id です', 400));

  const parsed = updateBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return next(createValidationError(parsed.error.issues, '無効なリクエストです'));
  }

  try {
    const savedView = await savedViewService.updateSavedView(userId, viewId, parsed.data);
    return res.json({ savedView });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '更新に失敗しました';
    if (msg.includes('見つかりません')) return next(createError(msg, 404));
    if (msg.includes('他ユーザー')) return next(createError(msg, 403));
    if (
      msg.includes('unique') ||
      msg.includes('duplicate') ||
      msg.includes('一意制約') ||
      msg.toLowerCase().includes('already exists')
    ) {
      return next(createError('同じ名前の保存ビューが既に存在します', 409));
    }
    return next(createError(msg, 500));
  }
});

// DELETE /saved-views/:id
router.delete('/:id', authenticateToken, async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).userId;
  const viewId = parseInt(req.params.id, 10);
  if (isNaN(viewId)) return next(createError('無効な id です', 400));

  try {
    await savedViewService.deleteSavedView(userId, viewId);
    return res.status(204).send();
  } catch (err) {
    const msg = err instanceof Error ? err.message : '削除に失敗しました';
    if (msg.includes('見つかりません')) return next(createError(msg, 404));
    if (msg.includes('他ユーザー')) return next(createError(msg, 403));
    return next(createError(msg, 500));
  }
});

export default router;
