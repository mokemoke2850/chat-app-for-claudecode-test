import type { AppNotification, AppNotificationPage, AppNotificationType } from '@chat-app/shared';
import { execute, query, queryOne } from '../db/database';

type Row = {
  id: number; type: AppNotificationType; source_id: number; title: string; body: string;
  channel_id: number | null; message_id: number | null; conversation_id: number | null;
  is_read: boolean; created_at: Date;
};

function rowToNotification(row: Row): AppNotification {
  return { id: row.id, type: row.type, sourceId: row.source_id, title: row.title, body: row.body,
    channelId: row.channel_id, messageId: row.message_id, conversationId: row.conversation_id,
    isRead: row.is_read, createdAt: row.created_at.toISOString() };
}

export async function create(input: Omit<AppNotification, 'id' | 'isRead' | 'createdAt'> & { userId: number }): Promise<AppNotification> {
  const row = await queryOne<Row>(`INSERT INTO app_notifications
    (user_id,type,source_id,title,body,channel_id,message_id,conversation_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    ON CONFLICT (user_id,type,source_id) DO UPDATE SET title=EXCLUDED.title
    RETURNING *`, [input.userId, input.type, input.sourceId, input.title, input.body, input.channelId, input.messageId, input.conversationId]);
  if (!row) throw new Error('Notification creation failed');
  return rowToNotification(row);
}

export async function list(userId: number, rawLimit?: number, rawOffset?: number): Promise<AppNotificationPage> {
  const limit = Math.min(Math.max(rawLimit ?? 20, 1), 100);
  const offset = Math.max(rawOffset ?? 0, 0);
  const [rows, totalRow] = await Promise.all([
    query<Row>('SELECT * FROM app_notifications WHERE user_id=$1 ORDER BY created_at DESC, id DESC LIMIT $2 OFFSET $3', [userId, limit, offset]),
    queryOne<{ count: string }>('SELECT COUNT(*) AS count FROM app_notifications WHERE user_id=$1', [userId]),
  ]);
  return { items: rows.map(rowToNotification), total: Number(totalRow?.count ?? 0), limit, offset, unreadCount: await getUnreadCount(userId) };
}

export async function markRead(userId: number, id: number): Promise<AppNotification> {
  const row = await queryOne<Row>('UPDATE app_notifications SET is_read=true WHERE id=$1 AND user_id=$2 RETURNING *', [id, userId]);
  if (!row) throw new Error('Notification not found');
  return rowToNotification(row);
}

export async function markAllRead(userId: number): Promise<void> {
  await execute('UPDATE app_notifications SET is_read=true WHERE user_id=$1 AND is_read=false', [userId]);
}

export async function getUnreadCount(userId: number): Promise<number> {
  const row = await queryOne<{ count: string }>('SELECT COUNT(*) AS count FROM app_notifications WHERE user_id=$1 AND is_read=false', [userId]);
  return Number(row?.count ?? 0);
}
