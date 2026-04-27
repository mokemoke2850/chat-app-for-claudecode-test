/**
 * #116 通報 / モデレーションキュー サービス層
 *
 * MVP仕様:
 *   - 通報作成: 自分のメッセージへの通報は 400, 削除済みメッセージは 404,
 *     二重通報（同一reporter×message）は 409
 *   - 対応アクション: dismiss / delete_message の 2 つのみ
 *   - 既に対応済み（dismissed / actioned）への再アクションは冪等（200で現状返却）
 *   - 監査ログは新規処理時のみ記録（冪等ケースでは記録しない）
 *   - 通報者情報（reporterId / reporterUsername）は管理者向け API のみ返却
 */

import { query, queryOne, execute } from '../db/database';
import type {
  MessageReport,
  ReportReason,
  ReportStatus,
  ReportMessageInput,
} from '@chat-app/shared';
import { createError } from '../middleware/errorHandler';
import * as auditLogService from './auditLogService';

interface MessageReportRow {
  id: number;
  message_id: number;
  channel_id: number;
  reporter_id: number | null;
  reporter_username: string | null;
  reason: string;
  comment: string | null;
  status: string;
  action_taken: string | null;
  handled_by: number | null;
  handled_at: string | null;
  created_at: string;
}

function toMessageReport(row: MessageReportRow): MessageReport {
  return {
    id: row.id,
    messageId: row.message_id,
    channelId: row.channel_id,
    reporterId: row.reporter_id,
    reporterUsername: row.reporter_username,
    reason: row.reason as ReportReason,
    comment: row.comment,
    status: row.status as ReportStatus,
    actionTaken: row.action_taken,
    handledBy: row.handled_by,
    handledAt: row.handled_at,
    createdAt: row.created_at,
  };
}

/**
 * メッセージを通報する
 */
export async function report(
  reporterId: number,
  messageId: number,
  input: ReportMessageInput,
): Promise<MessageReport> {
  // 通報理由バリデーション
  const validReasons: ReportReason[] = ['spam', 'harassment', 'other'];
  if (!validReasons.includes(input.reason)) {
    throw createError('Invalid reason', 400);
  }

  // メッセージ存在確認（削除済み含む）
  const msg = await queryOne<{ id: number; user_id: number | null; is_deleted: boolean }>(
    'SELECT id, user_id, is_deleted FROM messages WHERE id = $1',
    [messageId],
  );
  if (!msg) {
    throw createError('Message not found', 404);
  }
  // 削除済みメッセージは通報不可
  if (msg.is_deleted) {
    throw createError('Message not found', 404);
  }
  // 自分のメッセージは通報不可
  if (msg.user_id === reporterId) {
    throw createError('Cannot report your own message', 400);
  }

  // 重複通報チェック
  const existing = await queryOne<{ id: number }>(
    'SELECT id FROM message_reports WHERE message_id = $1 AND reporter_id = $2',
    [messageId, reporterId],
  );
  if (existing) {
    throw createError('Already reported', 409);
  }

  // INSERT して id を取得
  const newRow = await queryOne<{ id: number }>(
    `INSERT INTO message_reports (message_id, reporter_id, reason, comment)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [messageId, reporterId, input.reason, input.comment ?? null],
  );

  // reporter_username を JOIN して取得
  const inserted = await queryOne<MessageReportRow>(
    `SELECT mr.*, m.channel_id, u.username AS reporter_username
     FROM message_reports mr
     INNER JOIN messages m ON m.id = mr.message_id
     LEFT JOIN users u ON u.id = mr.reporter_id
     WHERE mr.id = $1`,
    [newRow!.id],
  );

  await auditLogService.record({
    actorUserId: reporterId,
    actionType: 'report.create',
    targetType: 'message',
    targetId: messageId,
    metadata: { reason: input.reason, reportId: inserted!.id },
  });

  return toMessageReport(inserted!);
}

/**
 * 通報キューを取得する（管理者向け）
 */
export async function listQueue(filter?: { status?: ReportStatus }): Promise<MessageReport[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter?.status) {
    params.push(filter.status);
    conditions.push(`mr.status = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = await query<MessageReportRow>(
    `SELECT mr.*, m.channel_id, u.username AS reporter_username
     FROM message_reports mr
     INNER JOIN messages m ON m.id = mr.message_id
     LEFT JOIN users u ON u.id = mr.reporter_id
     ${whereClause}
     ORDER BY mr.created_at DESC`,
    params,
  );

  return rows.map(toMessageReport);
}

/**
 * 通報を却下する（冪等）
 * 既に dismissed / actioned の場合はそのまま現状を返す（監査ログは記録しない）
 */
export async function dismiss(reportId: number, handlerUserId: number): Promise<MessageReport> {
  const existing = await queryOne<MessageReportRow>(
    `SELECT mr.*, m.channel_id, u.username AS reporter_username
     FROM message_reports mr
     INNER JOIN messages m ON m.id = mr.message_id
     LEFT JOIN users u ON u.id = mr.reporter_id
     WHERE mr.id = $1`,
    [reportId],
  );
  if (!existing) {
    throw createError('Report not found', 404);
  }

  // 冪等: 既に処理済みなら現状返却（監査ログなし）
  if (existing.status === 'dismissed' || existing.status === 'actioned') {
    return toMessageReport(existing);
  }

  const updated = await queryOne<MessageReportRow>(
    `UPDATE message_reports
     SET status = 'dismissed', handled_by = $1, handled_at = NOW()
     WHERE id = $2
     RETURNING id, message_id, reporter_id, reason, comment, status, action_taken,
               handled_by, handled_at, created_at`,
    [handlerUserId, reportId],
  );

  // reporter_username を JOIN して取得
  const result = await queryOne<MessageReportRow>(
    `SELECT mr.*, m.channel_id, u.username AS reporter_username
     FROM message_reports mr
     INNER JOIN messages m ON m.id = mr.message_id
     LEFT JOIN users u ON u.id = mr.reporter_id
     WHERE mr.id = $1`,
    [reportId],
  );
  void updated;

  await auditLogService.record({
    actorUserId: handlerUserId,
    actionType: 'report.dismiss',
    targetType: 'message',
    targetId: existing.message_id,
    metadata: { reportId },
  });

  return toMessageReport(result!);
}

/**
 * 通報に対して delete_message アクションを実行する（冪等）
 * 既に actioned / dismissed の場合はそのまま現状を返す（監査ログなし）
 */
export async function actionDeleteMessage(
  reportId: number,
  handlerUserId: number,
): Promise<MessageReport> {
  const existing = await queryOne<MessageReportRow>(
    `SELECT mr.*, m.channel_id, u.username AS reporter_username
     FROM message_reports mr
     INNER JOIN messages m ON m.id = mr.message_id
     LEFT JOIN users u ON u.id = mr.reporter_id
     WHERE mr.id = $1`,
    [reportId],
  );
  if (!existing) {
    throw createError('Report not found', 404);
  }

  // 冪等: 既に処理済みなら現状返却（監査ログなし）
  if (existing.status === 'actioned' || existing.status === 'dismissed') {
    return toMessageReport(existing);
  }

  // メッセージをソフトデリート
  await execute('UPDATE messages SET is_deleted = true, updated_at = NOW() WHERE id = $1', [
    existing.message_id,
  ]);

  // レポートを actioned に更新
  await execute(
    `UPDATE message_reports
     SET status = 'actioned', action_taken = 'delete_message', handled_by = $1, handled_at = NOW()
     WHERE id = $2`,
    [handlerUserId, reportId],
  );

  const result = await queryOne<MessageReportRow>(
    `SELECT mr.*, m.channel_id, u.username AS reporter_username
     FROM message_reports mr
     INNER JOIN messages m ON m.id = mr.message_id
     LEFT JOIN users u ON u.id = mr.reporter_id
     WHERE mr.id = $1`,
    [reportId],
  );

  await auditLogService.record({
    actorUserId: handlerUserId,
    actionType: 'report.action.delete_message',
    targetType: 'message',
    targetId: existing.message_id,
    metadata: { reportId },
  });

  return toMessageReport(result!);
}
