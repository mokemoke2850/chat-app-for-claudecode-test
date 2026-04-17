import { Router, NextFunction, Response } from 'express';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import * as controller from '../controllers/adminController';

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
router.delete('/channels/:id', (req, res, next) =>
  controller.deleteChannel(req as unknown as AuthenticatedRequest, res, next),
);

router.get('/stats', (req, res, next) =>
  controller.getStats(req as unknown as AuthenticatedRequest, res, next),
);

export default router;
