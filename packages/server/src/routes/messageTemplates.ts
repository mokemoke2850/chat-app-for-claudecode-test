import { Router } from 'express';
import { createError } from '../middleware/errorHandler';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import * as templateService from '../services/messageTemplateService';

const router = Router();

// GET /api/templates — テンプレート一覧取得
router.get('/', authenticateToken, async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).userId;
  const templates = await templateService.listTemplates(userId);
  return res.json({ templates });
});

// POST /api/templates — テンプレート作成
router.post('/', authenticateToken, async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).userId;
  const { title, body } = req.body as { title?: string; body?: string };

  if (!title || String(title).trim() === '') {
    return next(createError('Title is required', 400));
  }
  if (!body || String(body).trim() === '') {
    return next(createError('Body is required', 400));
  }

  try {
    const template = await templateService.createTemplate(userId, { title, body });
    return res.status(201).json({ template });
  } catch (err: unknown) {
    const error = err as Error;
    return next(createError(error.message, 400));
  }
});

// PATCH /api/templates/:id — テンプレート更新
router.patch('/:id', authenticateToken, async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).userId;
  const templateId = parseInt(req.params.id, 10);

  if (isNaN(templateId)) {
    return next(createError('Invalid template id', 400));
  }

  const { title, body, position } = req.body as {
    title?: string;
    body?: string;
    position?: number;
  };

  try {
    const template = await templateService.updateTemplate(userId, templateId, {
      title,
      body,
      position,
    });
    return res.json({ template });
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === 'Template not found') {
      return next(createError(error.message, 404));
    }
    return next(createError(error.message, 400));
  }
});

// DELETE /api/templates/:id — テンプレート削除
router.delete('/:id', authenticateToken, async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).userId;
  const templateId = parseInt(req.params.id, 10);

  if (isNaN(templateId)) {
    return next(createError('Invalid template id', 400));
  }

  try {
    await templateService.removeTemplate(userId, templateId);
    return res.status(204).send();
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === 'Template not found') {
      return next(createError(error.message, 404));
    }
    return next(createError('Internal server error', 500));
  }
});

// PUT /api/templates/reorder — 並び替え
router.put('/reorder', authenticateToken, async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).userId;
  const { orderedIds } = req.body as { orderedIds?: unknown };

  if (!Array.isArray(orderedIds)) {
    return next(createError('orderedIds must be an array', 400));
  }

  try {
    await templateService.reorderTemplates(userId, orderedIds as number[]);
    return res.json({ success: true });
  } catch (err: unknown) {
    const error = err as Error;
    return next(createError(error.message, 400));
  }
});

export default router;
