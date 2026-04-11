import { getDatabase } from '../db/database';
import { Message, MessageSearchResult } from '@chat-app/shared';
import { createError } from '../middleware/errorHandler';

interface MessageRow {
  id: number;
  channel_id: number;
  user_id: number;
  username: string;
  avatar_url: string | null;
  content: string;
  is_edited: number;
  is_deleted: number;
  created_at: string;
  updated_at: string;
}

const MESSAGE_SELECT = `
  SELECT m.id, m.channel_id, m.user_id, u.username, u.avatar_url,
         m.content, m.is_edited, m.is_deleted, m.created_at, m.updated_at
  FROM messages m
  JOIN users u ON m.user_id = u.id
`;

function getMentions(messageId: number): number[] {
  const db = getDatabase();
  const rows = db
    .prepare('SELECT mentioned_user_id FROM mentions WHERE message_id = ?')
    .all(messageId) as { mentioned_user_id: number }[];
  return rows.map((r) => r.mentioned_user_id);
}

function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    channelId: row.channel_id,
    userId: row.user_id,
    username: row.username,
    avatarUrl: row.avatar_url,
    content: row.content,
    isEdited: row.is_edited === 1,
    isDeleted: row.is_deleted === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    mentions: getMentions(row.id),
  };
}

export function getChannelMessages(channelId: number, limit = 50, before?: number): Message[] {
  const db = getDatabase();

  let query = MESSAGE_SELECT + ' WHERE m.channel_id = ?';
  const params: unknown[] = [channelId];

  if (before !== undefined) {
    query += ' AND m.id < ?';
    params.push(before);
  }

  query += ' ORDER BY m.created_at DESC, m.id DESC LIMIT ?';
  params.push(limit);

  const rows = (db.prepare(query).all(...params) as MessageRow[]).reverse();
  return rows.map(toMessage);
}

export function createMessage(
  channelId: number,
  userId: number,
  content: string,
  mentionedUserIds: number[] = [],
): Message {
  const db = getDatabase();

  const result = db
    .prepare('INSERT INTO messages (channel_id, user_id, content) VALUES (?, ?, ?)')
    .run(channelId, userId, content);

  const messageId = result.lastInsertRowid as number;

  if (mentionedUserIds.length > 0) {
    const insertMention = db.prepare(
      'INSERT OR IGNORE INTO mentions (message_id, mentioned_user_id) VALUES (?, ?)',
    );
    for (const uid of mentionedUserIds) insertMention.run(messageId, uid);
  }

  const row = db.prepare(MESSAGE_SELECT + ' WHERE m.id = ?').get(messageId) as MessageRow;
  return toMessage(row);
}

export function editMessage(
  messageId: number,
  userId: number,
  content: string,
  mentionedUserIds: number[] = [],
): Message {
  const db = getDatabase();

  const existing = db.prepare('SELECT user_id FROM messages WHERE id = ?').get(messageId) as
    | { user_id: number }
    | undefined;

  if (!existing) throw createError('Message not found', 404);
  if (existing.user_id !== userId) throw createError('Forbidden', 403);

  db.prepare(
    "UPDATE messages SET content = ?, is_edited = 1, updated_at = datetime('now') WHERE id = ?",
  ).run(content, messageId);

  db.prepare('DELETE FROM mentions WHERE message_id = ?').run(messageId);
  if (mentionedUserIds.length > 0) {
    const insertMention = db.prepare(
      'INSERT OR IGNORE INTO mentions (message_id, mentioned_user_id) VALUES (?, ?)',
    );
    for (const uid of mentionedUserIds) insertMention.run(messageId, uid);
  }

  const row = db.prepare(MESSAGE_SELECT + ' WHERE m.id = ?').get(messageId) as MessageRow;
  return toMessage(row);
}

export function deleteMessage(messageId: number, userId: number): void {
  const db = getDatabase();

  const existing = db.prepare('SELECT user_id FROM messages WHERE id = ?').get(messageId) as
    | { user_id: number }
    | undefined;

  if (!existing) throw createError('Message not found', 404);
  if (existing.user_id !== userId) throw createError('Forbidden', 403);

  db.prepare("UPDATE messages SET is_deleted = 1, updated_at = datetime('now') WHERE id = ?").run(
    messageId,
  );
}

export function searchMessages(query: string): MessageSearchResult[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT m.id, m.channel_id, m.user_id, u.username, u.avatar_url,
              m.content, m.is_edited, m.is_deleted, m.created_at, m.updated_at,
              c.name AS channel_name
       FROM messages m
       JOIN users u ON m.user_id = u.id
       JOIN channels c ON m.channel_id = c.id
       WHERE m.is_deleted = 0 AND m.content LIKE ?
       ORDER BY m.created_at DESC
       LIMIT 100`,
    )
    .all(`%${query}%`) as (MessageRow & { channel_name: string })[];

  return rows.map((row) => ({ ...toMessage(row), channelName: row.channel_name }));
}

export function getMessageById(messageId: number): Message | null {
  const db = getDatabase();
  const row = db.prepare(MESSAGE_SELECT + ' WHERE m.id = ?').get(messageId) as
    | MessageRow
    | undefined;
  return row ? toMessage(row) : null;
}
