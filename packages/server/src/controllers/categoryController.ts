import { Request, Response, NextFunction } from 'express';
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
      res.status(400).json({ error: 'name is required' });
      return;
    }

    const category = await categoryService.createCategory(userId, name, position);
    res.status(201).json({ category });
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === 'Category name already exists') {
      res.status(409).json({ error: error.message });
      return;
    }
    if (error.message === 'Category name is required') {
      res.status(400).json({ error: error.message });
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
      res.status(404).json({ error: error.message });
      return;
    }
    if (error.message === 'Forbidden') {
      res.status(403).json({ error: error.message });
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
      res.status(404).json({ error: error.message });
      return;
    }
    if (error.message === 'Forbidden') {
      res.status(403).json({ error: error.message });
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
      res.status(400).json({ error: 'categoryIds is required' });
      return;
    }

    await categoryService.reorderCategories(userId, categoryIds);
    res.json({ success: true });
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message.startsWith('Invalid category_ids')) {
      res.status(400).json({ error: error.message });
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
      res.status(404).json({ error: error.message });
      return;
    }
    if (error.message === 'Category not found') {
      res.status(404).json({ error: error.message });
      return;
    }
    if (error.message === 'Forbidden') {
      res.status(403).json({ error: error.message });
      return;
    }
    next(err);
  }
}
