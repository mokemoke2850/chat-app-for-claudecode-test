import { Router, NextFunction, Response } from 'express';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import * as controller from '../controllers/adminController';
import * as channelController from '../controllers/channelController';
import * as moderationController from '../controllers/moderationController';

const router = Router();

router.use(authenticateToken);
router.use(requireAdmin);

router.get('/users', (req, res, next) =>
  controller.getUsers(req as unknown as AuthenticatedRequest, res, next),
);
router.patch('/users/:id/role', (req, res, next) =>
  controller.updateUserRole(req as unknown as AuthenticatedRequest, res, next),
);
router.patch('/users/:id/status', (req, res, next) =>
  controller.updateUserStatus(req as unknown as AuthenticatedRequest, res, next),
);
router.delete('/users/:id', (req, res, next) =>
  controller.deleteUser(req as unknown as AuthenticatedRequest, res, next),
);

router.get('/channels', (req, res, next) =>
  controller.getChannels(req as unknown as AuthenticatedRequest, res, next),
);
router.patch('/channels/:id/recommend', (req, res, next) =>
  controller.setChannelRecommended(req as unknown as AuthenticatedRequest, res, next),
);
router.delete('/channels/:id', (req, res, next) =>
  controller.deleteChannel(req as unknown as AuthenticatedRequest, res, next),
);
router.delete('/channels/:id/archive', (req, res, next) =>
  channelController.unarchiveChannel(req as unknown as AuthenticatedRequest, res, next),
);

router.get('/stats', (req, res, next) =>
  controller.getStats(req as unknown as AuthenticatedRequest, res, next),
);

router.get('/audit-logs/export', (req, res, next) =>
  controller.exportAuditLogs(req as unknown as AuthenticatedRequest, res, next),
);

router.get('/audit-logs', (req, res, next) =>
  controller.getAuditLogs(req as unknown as AuthenticatedRequest, res, next),
);

// #117 NG ワード
router.get('/ng-words', (req, res, next) =>
  moderationController.listNgWords(req as unknown as AuthenticatedRequest, res, next),
);
router.post('/ng-words', (req, res, next) =>
  moderationController.createNgWord(req as unknown as AuthenticatedRequest, res, next),
);
router.patch('/ng-words/:id', (req, res, next) =>
  moderationController.updateNgWord(req as unknown as AuthenticatedRequest, res, next),
);
router.delete('/ng-words/:id', (req, res, next) =>
  moderationController.deleteNgWord(req as unknown as AuthenticatedRequest, res, next),
);

// #117 添付拡張子ブロックリスト
router.get('/attachment-blocklist', (req, res, next) =>
  moderationController.listBlockedExtensions(req as unknown as AuthenticatedRequest, res, next),
);
router.post('/attachment-blocklist', (req, res, next) =>
  moderationController.createBlockedExtension(req as unknown as AuthenticatedRequest, res, next),
);
router.delete('/attachment-blocklist/:id', (req, res, next) =>
  moderationController.deleteBlockedExtension(req as unknown as AuthenticatedRequest, res, next),
);

export default router;
