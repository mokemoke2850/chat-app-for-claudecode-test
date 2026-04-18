import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import * as controller from '../controllers/categoryController';

const router = Router();

// GET /api/channel-categories - ログインユーザーのカテゴリ一覧（チャンネル割当込み）
router.get('/', authenticateToken, controller.getCategories);

// POST /api/channel-categories - カテゴリ作成
router.post('/', authenticateToken, controller.createCategory);

// PATCH /api/channel-categories/reorder - 並び替え（/:id より前に定義が必要）
router.patch('/reorder', authenticateToken, controller.reorderCategories);

// PATCH /api/channel-categories/:id - カテゴリ更新
router.patch('/:id', authenticateToken, controller.updateCategory);

// DELETE /api/channel-categories/:id - カテゴリ削除
router.delete('/:id', authenticateToken, controller.deleteCategory);

export default router;
