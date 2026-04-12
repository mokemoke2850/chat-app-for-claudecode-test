import { Router } from 'express';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import * as controller from '../controllers/adminController';

const router = Router();

// すべての管理者ルートに認証 + 管理者チェックを適用
router.use(authenticateToken);
router.use(requireAdmin);

// ユーザー管理
router.get('/users', (req, res) =>
  controller.getUsers(req as unknown as AuthenticatedRequest, res),
);
router.patch('/users/:id/role', (req, res) =>
  controller.updateUserRole(req as unknown as AuthenticatedRequest, res),
);
router.patch('/users/:id/status', (req, res) =>
  controller.updateUserStatus(req as unknown as AuthenticatedRequest, res),
);
router.delete('/users/:id', (req, res) =>
  controller.deleteUser(req as unknown as AuthenticatedRequest, res),
);

// チャンネル管理
router.get('/channels', (req, res) =>
  controller.getChannels(req as unknown as AuthenticatedRequest, res),
);
router.delete('/channels/:id', (req, res) =>
  controller.deleteChannel(req as unknown as AuthenticatedRequest, res),
);

// 統計
router.get('/stats', (req, res) =>
  controller.getStats(req as unknown as AuthenticatedRequest, res),
);

export default router;
