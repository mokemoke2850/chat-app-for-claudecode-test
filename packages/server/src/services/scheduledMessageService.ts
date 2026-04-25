import { query, queryOne, execute } from '../db/database';
import type {
  ScheduledMessage,
  ScheduledMessageStatus,
  CreateScheduledMessageInput,
  UpdateScheduledMessageInput,
} from '@chat-app/shared';
import { createError } from '../middleware/errorHandler';

interface ScheduledMessageRow {
  id: number;
  user_id: number;
  channel_id: number;
  content: string;
  scheduled_at: string;
  status: ScheduledMessageStatus;
  error: string | null;
  sent_message_id: number | null;
  created_at: string;
  updated_at: string;
}

function toScheduledMessage(row: ScheduledMessageRow): ScheduledMessage {
  return {
    id: row.id,
    userId: row.user_id,
    channelId: row.channel_id,
    content: row.content,
    scheduledAt: row.scheduled_at,
    status: row.status,
    error: row.error,
    sentMessageId: row.sent_message_id,
    attachments: [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createScheduledMessage(
  userId: number,
  input: CreateScheduledMessageInput,
): Promise<ScheduledMessage> {
  const { channelId, content, scheduledAt } = input;

  const scheduledAtDate = new Date(scheduledAt);
  if (isNaN(scheduledAtDate.getTime())) {
    throw createError('scheduledAt is invalid date', 400);
  }
  if (scheduledAtDate <= new Date()) {
    throw createError('scheduledAt must be a future date', 400);
  }

  const row = await queryOne<ScheduledMessageRow>(
    `INSERT INTO scheduled_messages (user_id, channel_id, content, scheduled_at, status)
     VALUES ($1, $2, $3, $4, 'pending')
     RETURNING *`,
    [userId, channelId, content, scheduledAtDate.toISOString()],
  );

  return toScheduledMessage(row!);
}

export async function listScheduledMessages(userId: number): Promise<ScheduledMessage[]> {
  const rows = await query<ScheduledMessageRow>(
    `SELECT * FROM scheduled_messages
     WHERE user_id = $1
     ORDER BY scheduled_at ASC`,
    [userId],
  );
  return rows.map(toScheduledMessage);
}

export async function updateScheduledMessage(
  userId: number,
  id: number,
  input: UpdateScheduledMessageInput,
): Promise<ScheduledMessage> {
  const existing = await queryOne<ScheduledMessageRow>(
    'SELECT * FROM scheduled_messages WHERE id = $1',
    [id],
  );

  if (!existing) throw createError('Scheduled message not found', 404);
  if (existing.user_id !== userId) throw createError('Forbidden', 403);
  if (existing.status !== 'pending') {
    throw createError('Only pending scheduled messages can be updated', 400);
  }

  if (input.scheduledAt !== undefined) {
    const scheduledAtDate = new Date(input.scheduledAt);
    if (isNaN(scheduledAtDate.getTime())) {
      throw createError('scheduledAt is invalid date', 400);
    }
    if (scheduledAtDate <= new Date()) {
      throw createError('scheduledAt must be a future date', 400);
    }
  }

  const newContent = input.content ?? existing.content;
  const newScheduledAt = input.scheduledAt
    ? new Date(input.scheduledAt).toISOString()
    : existing.scheduled_at;

  const row = await queryOne<ScheduledMessageRow>(
    `UPDATE scheduled_messages
     SET content = $1, scheduled_at = $2, updated_at = NOW()
     WHERE id = $3
     RETURNING *`,
    [newContent, newScheduledAt, id],
  );

  return toScheduledMessage(row!);
}

export async function cancelScheduledMessage(
  userId: number,
  id: number,
): Promise<ScheduledMessage> {
  const existing = await queryOne<ScheduledMessageRow>(
    'SELECT * FROM scheduled_messages WHERE id = $1',
    [id],
  );

  if (!existing) throw createError('Scheduled message not found', 404);
  if (existing.user_id !== userId) throw createError('Forbidden', 403);
  if (existing.status === 'sent') {
    throw createError('Cannot cancel a sent scheduled message', 400);
  }
  if (existing.status === 'canceled') {
    return toScheduledMessage(existing);
  }

  const row = await queryOne<ScheduledMessageRow>(
    `UPDATE scheduled_messages
     SET status = 'canceled', updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id],
  );

  return toScheduledMessage(row!);
}

/**
 * scheduled_at <= NOW() かつ status='pending' のレコードを
 * アトミックに status='sending' へ UPDATE してから返す。
 * 二重ピックを防ぐため、SELECT で対象 ID を取得してから UPDATE する。
 * pg-mem では UPDATE...WHERE id IN (SELECT...LIMIT N) の LIMIT が無視されるため
 * 2段階で処理する。本番 PostgreSQL でも正常に動作する。
 */
export async function pickDue(limit: number): Promise<ScheduledMessage[]> {
  // 1. 対象 ID を LIMIT 付きで取得
  const candidates = await query<{ id: number }>(
    `SELECT id FROM scheduled_messages
     WHERE status = 'pending' AND scheduled_at <= NOW()
     ORDER BY scheduled_at ASC
     LIMIT $1`,
    [limit],
  );
  if (candidates.length === 0) return [];

  const ids = candidates.map((r) => r.id);

  // 2. 取得した ID のみを sending に更新（アトミック）
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
  const rows = await query<ScheduledMessageRow>(
    `UPDATE scheduled_messages
     SET status = 'sending', updated_at = NOW()
     WHERE id IN (${placeholders}) AND status = 'pending'
     RETURNING *`,
    ids,
  );
  return rows.map(toScheduledMessage);
}

export async function markSent(id: number, messageId: number): Promise<void> {
  await execute(
    `UPDATE scheduled_messages
     SET status = 'sent', sent_message_id = $1, updated_at = NOW()
     WHERE id = $2`,
    [messageId, id],
  );
}

export async function markFailed(id: number, error: string): Promise<void> {
  await execute(
    `UPDATE scheduled_messages
     SET status = 'failed', error = $1, updated_at = NOW()
     WHERE id = $2`,
    [error, id],
  );
}
