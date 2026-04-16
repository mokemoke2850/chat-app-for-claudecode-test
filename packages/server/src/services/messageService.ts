import { getDatabase } from '../db/database';
import { Attachment, Message, MessageSearchResult, QuotedMessage, Reaction } from '@chat-app/shared';
import { createError } from '../middleware/errorHandler';

interface MessageRow {
  id: number;
  channel_id: number;
  user_id: number | null;
  username: string | null;
  avatar_url: string | null;
  content: string;
  is_edited: number;
  is_deleted: number;
  created_at: string;
  updated_at: string;
  parent_message_id: number | null;
  root_message_id: number | null;
  quoted_message_id: number | null;
}

const MESSAGE_SELECT = `
  SELECT m.id, m.channel_id, m.user_id, u.username, u.avatar_url,
         m.content, m.is_edited, m.is_deleted, m.created_at, m.updated_at,
         m.parent_message_id, m.root_message_id, m.quoted_message_id
  FROM messages m
  LEFT JOIN users u ON m.user_id = u.id
`;

function getReactionsForMessage(messageId: number): Reaction[] {
  const db = getDatabase();
  const rows = db
    .prepare('SELECT emoji, user_id FROM message_reactions WHERE message_id = ? ORDER BY emoji')
    .all(messageId) as { emoji: string; user_id: number }[];

  const map = new Map<string, number[]>();
  for (const row of rows) {
    const userIds = map.get(row.emoji) ?? [];
    userIds.push(row.user_id);
    map.set(row.emoji, userIds);
  }

  return Array.from(map.entries()).map(([emoji, userIds]) => ({
    emoji,
    count: userIds.length,
    userIds,
  }));
}

function getMentions(messageId: number): number[] {
  const db = getDatabase();
  const rows = db
    .prepare('SELECT mentioned_user_id FROM mentions WHERE message_id = ?')
    .all(messageId) as { mentioned_user_id: number }[];
  return rows.map((r) => r.mentioned_user_id);
}

function getAttachments(messageId: number): Attachment[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      'SELECT id, url, original_name, size, mime_type FROM message_attachments WHERE message_id = ?',
    )
    .all(messageId) as {
    id: number;
    url: string;
    original_name: string;
    size: number;
    mime_type: string;
  }[];
  return rows.map((r) => ({
    id: r.id,
    url: r.url,
    originalName: r.original_name,
    size: r.size,
    mimeType: r.mime_type,
  }));
}

function getReplyCount(messageId: number): number {
  const db = getDatabase();
  const row = db
    .prepare('SELECT COUNT(*) as cnt FROM messages WHERE root_message_id = ?')
    .get(messageId) as { cnt: number };
  return row.cnt;
}

function getQuotedMessage(quotedMessageId: number | null): QuotedMessage | null {
  if (quotedMessageId === null) return null;
  const db = getDatabase();
  const row = db
    .prepare(
      `SELECT m.id, m.content, u.username, m.created_at
       FROM messages m
       LEFT JOIN users u ON m.user_id = u.id
       WHERE m.id = ?`,
    )
    .get(quotedMessageId) as
    | { id: number; content: string; username: string | null; created_at: string }
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    content: row.content,
    username: row.username ?? '削除済みユーザー',
    createdAt: row.created_at,
  };
}

function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    channelId: row.channel_id,
    userId: row.user_id,
    username: row.username ?? '削除済みユーザー',
    avatarUrl: row.avatar_url,
    content: row.content,
    isEdited: row.is_edited === 1,
    isDeleted: row.is_deleted === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    mentions: getMentions(row.id),
    attachments: getAttachments(row.id),
    reactions: getReactionsForMessage(row.id),
    parentMessageId: row.parent_message_id,
    rootMessageId: row.root_message_id,
    replyCount: row.root_message_id === null ? getReplyCount(row.id) : 0,
    quotedMessageId: row.quoted_message_id,
    quotedMessage: getQuotedMessage(row.quoted_message_id),
  };
}

export function getChannelMessages(channelId: number, limit = 50, before?: number): Message[] {
  const db = getDatabase();

  let query = MESSAGE_SELECT + ' WHERE m.channel_id = ? AND m.root_message_id IS NULL';
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

export function createThreadReply(
  parentMessageId: number,
  rootMessageId: number,
  userId: number,
  content: string,
  mentionedUserIds: number[] = [],
  attachmentIds: number[] = [],
): Message {
  const db = getDatabase();

  const parent = db.prepare('SELECT channel_id FROM messages WHERE id = ?').get(parentMessageId) as
    | { channel_id: number }
    | undefined;
  if (!parent) throw createError('Parent message not found', 404);

  const result = db
    .prepare(
      'INSERT INTO messages (channel_id, user_id, content, parent_message_id, root_message_id) VALUES (?, ?, ?, ?, ?)',
    )
    .run(parent.channel_id, userId, content, parentMessageId, rootMessageId);

  const messageId = result.lastInsertRowid as number;

  if (mentionedUserIds.length > 0) {
    const insertMention = db.prepare(
      'INSERT OR IGNORE INTO mentions (message_id, mentioned_user_id, channel_id) VALUES (?, ?, ?)',
    );
    for (const uid of mentionedUserIds) insertMention.run(messageId, uid, parent.channel_id);
  }

  if (attachmentIds.length > 0) {
    const updateAttachment = db.prepare(
      'UPDATE message_attachments SET message_id = ? WHERE id = ?',
    );
    for (const aid of attachmentIds) updateAttachment.run(messageId, aid);
  }

  const row = db.prepare(MESSAGE_SELECT + ' WHERE m.id = ?').get(messageId) as MessageRow;
  return toMessage(row);
}

export function getThreadReplies(rootMessageId: number): Message[] {
  const db = getDatabase();
  const rows = db
    .prepare(MESSAGE_SELECT + ' WHERE m.root_message_id = ? ORDER BY m.created_at ASC, m.id ASC')
    .all(rootMessageId) as MessageRow[];
  return rows.map(toMessage);
}

export function createMessage(
  channelId: number,
  userId: number,
  content: string,
  mentionedUserIds: number[] = [],
  attachmentIds: number[] = [],
  quotedMessageId?: number,
): Message {
  const db = getDatabase();

  // 引用元メッセージのバリデーション
  if (quotedMessageId !== undefined) {
    const quoted = db
      .prepare('SELECT id, channel_id, is_deleted FROM messages WHERE id = ?')
      .get(quotedMessageId) as { id: number; channel_id: number; is_deleted: number } | undefined;
    if (!quoted) throw createError('Quoted message not found', 404);
    if (quoted.is_deleted === 1) throw createError('Cannot quote a deleted message', 400);
    if (quoted.channel_id !== channelId) throw createError('Cannot quote a message from a different channel', 400);
  }

  const result = db
    .prepare(
      'INSERT INTO messages (channel_id, user_id, content, quoted_message_id) VALUES (?, ?, ?, ?)',
    )
    .run(channelId, userId, content, quotedMessageId ?? null);

  const messageId = result.lastInsertRowid as number;

  if (mentionedUserIds.length > 0) {
    const insertMention = db.prepare(
      'INSERT OR IGNORE INTO mentions (message_id, mentioned_user_id, channel_id) VALUES (?, ?, ?)',
    );
    for (const uid of mentionedUserIds) insertMention.run(messageId, uid, channelId);
  }

  if (attachmentIds.length > 0) {
    const updateAttachment = db.prepare(
      'UPDATE message_attachments SET message_id = ? WHERE id = ?',
    );
    for (const aid of attachmentIds) updateAttachment.run(messageId, aid);
  }

  const row = db.prepare(MESSAGE_SELECT + ' WHERE m.id = ?').get(messageId) as MessageRow;
  return toMessage(row);
}

export function editMessage(
  messageId: number,
  userId: number,
  content: string,
  mentionedUserIds: number[] = [],
  attachmentIds: number[] = [],
): Message {
  const db = getDatabase();

  const existing = db
    .prepare('SELECT user_id, channel_id FROM messages WHERE id = ?')
    .get(messageId) as { user_id: number; channel_id: number } | undefined;

  if (!existing) throw createError('Message not found', 404);
  if (existing.user_id !== userId) throw createError('Forbidden', 403);

  db.prepare(
    "UPDATE messages SET content = ?, is_edited = 1, updated_at = datetime('now') WHERE id = ?",
  ).run(content, messageId);

  db.prepare('DELETE FROM mentions WHERE message_id = ?').run(messageId);
  if (mentionedUserIds.length > 0) {
    const insertMention = db.prepare(
      'INSERT OR IGNORE INTO mentions (message_id, mentioned_user_id, channel_id) VALUES (?, ?, ?)',
    );
    for (const uid of mentionedUserIds) insertMention.run(messageId, uid, existing.channel_id);
  }

  // 既存添付を一旦すべて切り離し、今回指定されたIDのみ紐付ける
  db.prepare('UPDATE message_attachments SET message_id = NULL WHERE message_id = ?').run(
    messageId,
  );
  if (attachmentIds.length > 0) {
    const updateAttachment = db.prepare(
      'UPDATE message_attachments SET message_id = ? WHERE id = ?',
    );
    for (const aid of attachmentIds) updateAttachment.run(messageId, aid);
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

export function restoreMessage(messageId: number, userId: number): Message {
  const db = getDatabase();

  const existing = db.prepare('SELECT user_id FROM messages WHERE id = ?').get(messageId) as
    | { user_id: number }
    | undefined;

  if (!existing) throw createError('Message not found', 404);
  if (existing.user_id !== userId) throw createError('Forbidden', 403);

  db.prepare("UPDATE messages SET is_deleted = 0, updated_at = datetime('now') WHERE id = ?").run(
    messageId,
  );

  const row = db.prepare(MESSAGE_SELECT + ' WHERE m.id = ?').get(messageId) as MessageRow;
  return toMessage(row);
}

export function searchMessages(query: string): MessageSearchResult[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT m.id, m.channel_id, m.user_id, u.username, u.avatar_url,
              m.content, m.is_edited, m.is_deleted, m.created_at, m.updated_at,
              m.parent_message_id, m.root_message_id,
              c.name AS channel_name,
              rm.content AS root_message_content
       FROM messages m
       LEFT JOIN users u ON m.user_id = u.id
       JOIN channels c ON m.channel_id = c.id
       LEFT JOIN messages rm ON m.root_message_id = rm.id
       WHERE m.is_deleted = 0 AND m.content LIKE ?
       ORDER BY m.created_at DESC
       LIMIT 100`,
    )
    .all(`%${query}%`) as (MessageRow & {
    channel_name: string;
    root_message_content: string | null;
  })[];

  return rows.map((row) => ({
    ...toMessage(row),
    channelName: row.channel_name,
    rootMessageContent: row.root_message_content ?? null,
  }));
}

export function getMessageById(messageId: number): Message | null {
  const db = getDatabase();
  const row = db.prepare(MESSAGE_SELECT + ' WHERE m.id = ?').get(messageId) as
    | MessageRow
    | undefined;
  return row ? toMessage(row) : null;
}

export function getReactions(messageId: number): Reaction[] {
  return getReactionsForMessage(messageId);
}

export function addReaction(messageId: number, userId: number, emoji: string): Reaction[] {
  const db = getDatabase();

  const message = db.prepare('SELECT id FROM messages WHERE id = ?').get(messageId);
  if (!message) throw createError('Message not found', 404);

  db.prepare(
    'INSERT OR IGNORE INTO message_reactions (message_id, user_id, emoji) VALUES (?, ?, ?)',
  ).run(messageId, userId, emoji);

  return getReactionsForMessage(messageId);
}

export function removeReaction(messageId: number, userId: number, emoji: string): Reaction[] {
  const db = getDatabase();

  db.prepare(
    'DELETE FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?',
  ).run(messageId, userId, emoji);

  return getReactionsForMessage(messageId);
}
