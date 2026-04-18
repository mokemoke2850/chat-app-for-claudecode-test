import { query, queryOne, execute } from '../db/database';
import type { AuditLog, AuditActionType, AuditTargetType } from '@chat-app/shared';

export interface RecordAuditLogInput {
  actorUserId: number | null;
  actionType: AuditActionType;
  targetType?: AuditTargetType | null;
  targetId?: number | null;
  metadata?: Record<string, unknown> | null;
}

export interface ListAuditLogsFilter {
  actionType?: string;
  actorUserId?: number;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

interface AuditLogRow {
  id: number;
  actor_user_id: number | null;
  actor_username: string | null;
  action_type: string;
  target_type: string | null;
  target_id: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

/**
 * 監査ログを INSERT する。
 * DB書き込みに失敗しても呼び出し元へ例外を伝播させず、console.error でログするのみ。
 */
export async function record(input: RecordAuditLogInput): Promise<void> {
  try {
    await execute(
      `INSERT INTO audit_logs (actor_user_id, action_type, target_type, target_id, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        input.actorUserId,
        input.actionType,
        input.targetType ?? null,
        input.targetId ?? null,
        input.metadata ? JSON.stringify(input.metadata) : null,
      ],
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[auditLogService.record] failed to record audit log', err);
  }
}

function toAuditLog(row: AuditLogRow): AuditLog {
  // pg-mem/postgres どちらでも metadata は jsonb なので object になるが、
  // 念のため文字列で返ってきた場合はパースする
  let metadata: Record<string, unknown> | null = null;
  if (row.metadata !== null && row.metadata !== undefined) {
    if (typeof row.metadata === 'string') {
      try {
        metadata = JSON.parse(row.metadata) as Record<string, unknown>;
      } catch {
        metadata = null;
      }
    } else {
      metadata = row.metadata;
    }
  }

  return {
    id: row.id,
    actorUserId: row.actor_user_id,
    actorUsername: row.actor_username,
    actionType: row.action_type as AuditActionType,
    targetType: row.target_type as AuditTargetType | null,
    targetId: row.target_id,
    metadata,
    createdAt: row.created_at,
  };
}

export async function listAuditLogs(
  filter: ListAuditLogsFilter = {},
): Promise<{ logs: AuditLog[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter.actionType) {
    params.push(filter.actionType);
    conditions.push(`al.action_type = $${params.length}`);
  }
  if (filter.actorUserId !== undefined && !Number.isNaN(filter.actorUserId)) {
    params.push(filter.actorUserId);
    conditions.push(`al.actor_user_id = $${params.length}`);
  }
  if (filter.from) {
    params.push(filter.from);
    conditions.push(`al.created_at >= $${params.length}`);
  }
  if (filter.to) {
    params.push(filter.to);
    conditions.push(`al.created_at <= $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // total
  const totalRow = await queryOne<{ cnt: string }>(
    `SELECT COUNT(*) AS cnt FROM audit_logs al ${whereClause}`,
    params,
  );
  const total = Number(totalRow?.cnt ?? 0);

  // ページングパラメータは別番号で追加
  const rawLimit = filter.limit ?? 50;
  const limit = Math.min(Math.max(rawLimit, 1), 200);
  const offset = Math.max(filter.offset ?? 0, 0);

  params.push(limit);
  const limitIndex = params.length;
  params.push(offset);
  const offsetIndex = params.length;

  const rows = await query<AuditLogRow>(
    `SELECT al.id, al.actor_user_id, u.username AS actor_username,
            al.action_type, al.target_type, al.target_id, al.metadata, al.created_at
     FROM audit_logs al
     LEFT JOIN users u ON u.id = al.actor_user_id
     ${whereClause}
     ORDER BY al.created_at DESC, al.id DESC
     LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    params,
  );

  return { logs: rows.map(toAuditLog), total };
}
