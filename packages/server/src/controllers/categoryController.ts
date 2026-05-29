import { Request, Response, NextFunction } from 'express';
import { createError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';
import * as categoryService from '../services/categoryService';

export async function getCategories(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const categories = await categoryService.getCategoriesForUser(userId);
    res.json({ categories });
  } catch (err) {
    next(err);
  }
}

export async function createCategory(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const { name, position } = req.body as { name?: string; position?: number };

    if (!name || String(name).trim() === '') {
      next(createError('name is required', 400));
      return;
    }

    const category = await categoryService.createCategory(userId, name, position);
    res.status(201).json({ category });
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === 'Category name already exists') {
      next(createError(error.message, 409));
      return;
    }
    if (error.message === 'Category name is required') {
      next(createError(error.message, 400));
      return;
    }
    next(err);
  }
}

export async function updateCategory(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const categoryId = Number(req.params.id);
    const { name, position, isCollapsed } = req.body as {
      name?: string;
      position?: number;
      isCollapsed?: boolean;
    };

    const category = await categoryService.updateCategory(userId, categoryId, {
      name,
      position,
      isCollapsed,
    });
    res.json({ category });
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === 'Category not found') {
      next(createError(error.message, 404));
      return;
    }
    if (error.message === 'Forbidden') {
      next(createError(error.message, 403));
      return;
    }
    next(err);
  }
}

export async function deleteCategory(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const categoryId = Number(req.params.id);

    await categoryService.deleteCategory(userId, categoryId);
    res.status(204).send();
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === 'Category not found') {
      next(createError(error.message, 404));
      return;
    }
    if (error.message === 'Forbidden') {
      next(createError(error.message, 403));
      return;
    }
    next(err);
  }
}

export async function reorderCategories(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const { categoryIds } = req.body as { categoryIds?: number[] };

    if (!Array.isArray(categoryIds)) {
      next(createError('categoryIds is required', 400));
      return;
    }

    await categoryService.reorderCategories(userId, categoryIds);
    res.json({ success: true });
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message.startsWith('Invalid category_ids')) {
      next(createError(error.message, 400));
      return;
    }
    next(err);
  }
}

export async function assignChannelToCategory(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const channelId = Number(req.params.channelId);
    const { categoryId } = req.body as { categoryId?: number | null };

    if (categoryId === null || categoryId === undefined) {
      // 割当解除
      try {
        await categoryService.unassignChannelFromCategory(userId, channelId);
      } catch (err: unknown) {
        const error = err as Error;
        if (error.message === 'Assignment not found') {
          // 既に未割当なら成功扱い
          res.json({ success: true });
          return;
        }
        throw err;
      }
      res.json({ success: true });
      return;
    }

    await categoryService.assignChannelToCategory(userId, channelId, categoryId);
    res.json({ success: true });
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === 'Channel not found') {
      next(createError(error.message, 404));
      return;
    }
    if (error.message === 'Category not found') {
      next(createError(error.message, 404));
      return;
    }
    if (error.message === 'Forbidden') {
      next(createError(error.message, 403));
      return;
    }
    next(err);
  }
}
