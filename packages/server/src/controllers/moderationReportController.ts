/**
 * #116 通報 / モデレーションキュー コントローラー
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import * as moderationReportService from '../services/moderationReportService';
import type { ReportMessageInput, ReportStatus } from '@chat-app/shared';

// ─── POST /api/messages/:id/report ───────────────────────────

export async function reportMessage(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const messageId = Number(req.params.id);
    const input = req.body as ReportMessageInput;
    const created = await moderationReportService.report(req.userId, messageId, input);
    // 通報者情報を一般ユーザーに返さない（自分の通報IDのみ返す）
    res.status(201).json({
      report: {
        id: created.id,
        messageId: created.messageId,
        reason: created.reason,
        comment: created.comment,
        status: created.status,
        createdAt: created.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/admin/reports ───────────────────────────────────

export async function listReports(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const status = req.query.status as ReportStatus | undefined;
    const reports = await moderationReportService.listQueue(status ? { status } : undefined);
    res.json({ reports });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/admin/reports/:id/dismiss ─────────────────────

export async function dismissReport(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const reportId = Number(req.params.id);
    const updated = await moderationReportService.dismiss(reportId, req.userId);
    res.json({ report: updated });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/admin/reports/:id/action ──────────────────────

export async function actionReport(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const reportId = Number(req.params.id);
    const { actionType } = req.body as { actionType: string };

    if (actionType === 'delete_message') {
      const updated = await moderationReportService.actionDeleteMessage(reportId, req.userId);
      res.json({ report: updated });
    } else {
      res.status(400).json({ error: 'Invalid action type' });
    }
  } catch (err) {
    next(err);
  }
}
