import { Router } from 'express';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import * as controller from '../controllers/adminController';
import * as channelController from '../controllers/channelController';
import * as moderationController from '../controllers/moderationController';
import * as moderationReportController from '../controllers/moderationReportController';

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

router.get('/orphan-files', (req, res, next) =>
  controller.getOrphanFiles(req as unknown as AuthenticatedRequest, res, next),
);
router.delete('/orphan-files', (req, res, next) =>
  controller.deleteOrphanFiles(req as unknown as AuthenticatedRequest, res, next),
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

router.get('/maintenance-mode', (req, res, next) =>
  controller.getMaintenanceMode(req as unknown as AuthenticatedRequest, res, next),
);
router.put('/maintenance-mode', (req, res, next) =>
  controller.updateMaintenanceMode(req as unknown as AuthenticatedRequest, res, next),
);

router.get('/health-details', (req, res, next) =>
  controller.getHealthDetails(req as unknown as AuthenticatedRequest, res, next),
);
router.get('/job-monitoring', (req, res, next) =>
  controller.getJobMonitoring(req as unknown as AuthenticatedRequest, res, next),
);

router.get('/settings/export', (req, res, next) =>
  controller.exportSettings(req as unknown as AuthenticatedRequest, res, next),
);
router.post('/settings/import/preview', (req, res, next) =>
  controller.previewSettingsImport(req as unknown as AuthenticatedRequest, res, next),
);
router.post('/settings/import', (req, res, next) =>
  controller.importSettings(req as unknown as AuthenticatedRequest, res, next),
);

router.get('/stats', (req, res, next) =>
  controller.getStats(req as unknown as AuthenticatedRequest, res, next),
);
router.get('/stats/timeseries', (req, res, next) =>
  controller.getStatsTimeseries(req as unknown as AuthenticatedRequest, res, next),
);
router.get('/stats/top-channels', (req, res, next) =>
  controller.getTopChannels(req as unknown as AuthenticatedRequest, res, next),
);

router.get('/timeseries', (req, res, next) =>
  controller.getTimeseries(req as unknown as AuthenticatedRequest, res, next),
);
router.get('/timeseries/channels', (req, res, next) =>
  controller.getMessagesByChannelTimeseries(req as unknown as AuthenticatedRequest, res, next),
);
router.get('/top-channels', (req, res, next) =>
  controller.getTopChannels(req as unknown as AuthenticatedRequest, res, next),
);

router.get('/audit-logs/export', (req, res, next) =>
  controller.exportAuditLogs(req as unknown as AuthenticatedRequest, res, next),
);

// #273 月次レポート CSV エクスポート
router.get('/reports/monthly', (req, res, next) =>
  controller.exportMonthlyReport(req as unknown as AuthenticatedRequest, res, next),
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

// #116 通報キュー
router.get('/reports', (req, res, next) =>
  moderationReportController.listReports(req as unknown as AuthenticatedRequest, res, next),
);
router.post('/reports/:id/dismiss', (req, res, next) =>
  moderationReportController.dismissReport(req as unknown as AuthenticatedRequest, res, next),
);
router.post('/reports/:id/action', (req, res, next) =>
  moderationReportController.actionReport(req as unknown as AuthenticatedRequest, res, next),
);

export default router;
