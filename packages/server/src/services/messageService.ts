import { query, queryOne, execute } from '../db/database';
import {
  Attachment,
  Message,
  MessageSearchFilters,
  MessageSearchResult,
  QuotedMessage,
  Reaction,
  Tag,
} from '@chat-app/shared';
import { createError } from '../middleware/errorHandler';
import { getForMessages } from './tagService';

interface MessageRow {
  id: number;
  channel_id: number;
  user_id: number | null;
  username: string | null;
  avatar_url: string | null;
  content: string;
  is_edited: boolean;
  is_deleted: boolean;
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

async function getReactionsForMessage(messageId: number): Promise<Reaction[]> {
  const rows = await query<{ emoji: string; user_id: number }>(
    'SELECT emoji, user_id FROM message_reactions WHERE message_id = $1 ORDER BY emoji',
    [messageId],
  );

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

async function getMentions(messageId: number): Promise<number[]> {
  const rows = await query<{ mentioned_user_id: number }>(
    'SELECT mentioned_user_id FROM mentions WHERE message_id = $1',
    [messageId],
  );
  return rows.map((r) => r.mentioned_user_id);
}

async function getAttachments(messageId: number): Promise<Attachment[]> {
  const rows = await query<{
    id: number;
    url: string;
    original_name: string;
    size: number;
    mime_type: string;
  }>(
    'SELECT id, url, original_name, size, mime_type FROM message_attachments WHERE message_id = $1',
    [messageId],
  );
  return rows.map((r) => ({
    id: r.id,
    url: r.url,
    originalName: r.original_name,
    size: r.size,
    mimeType: r.mime_type,
  }));
}

async function getReplyCount(messageId: number): Promise<number> {
  const row = await queryOne<{ cnt: string }>(
    'SELECT COUNT(*) as cnt FROM messages WHERE root_message_id = $1',
    [messageId],
  );
  return Number(row?.cnt ?? 0);
}

async function getQuotedMessage(quotedMessageId: number | null): Promise<QuotedMessage | null> {
  if (quotedMessageId === null) return null;
  const row = await queryOne<{
    id: number;
    content: string;
    username: string | null;
    created_at: string;
  }>(
    `SELECT m.id, m.content, u.username, m.created_at
     FROM messages m
     LEFT JOIN users u ON m.user_id = u.id
     WHERE m.id = $1`,
    [quotedMessageId],
  );
  if (!row) return null;
  return {
    id: row.id,
    content: row.content,
    username: row.username ?? '削除済みユーザー',
    createdAt: row.created_at,
  };
}

async function toMessage(row: MessageRow): Promise<Message> {
  return {
    id: row.id,
    channelId: row.channel_id,
    userId: row.user_id,
    username: row.username ?? '削除済みユーザー',
    avatarUrl: row.avatar_url,
    content: row.content,
    isEdited: row.is_edited,
    isDeleted: row.is_deleted,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    mentions: await getMentions(row.id),
    attachments: await getAttachments(row.id),
    reactions: await getReactionsForMessage(row.id),
    parentMessageId: row.parent_message_id,
    rootMessageId: row.root_message_id,
    replyCount: row.root_message_id === null ? await getReplyCount(row.id) : 0,
    quotedMessageId: row.quoted_message_id,
    quotedMessage: await getQuotedMessage(row.quoted_message_id),
  };
}

export async function getChannelMessages(
  channelId: number,
  limit = 50,
  before?: number,
): Promise<Message[]> {
  let sql = MESSAGE_SELECT + ' WHERE m.channel_id = $1 AND m.root_message_id IS NULL';
  const params: unknown[] = [channelId];
  let idx = 2;

  if (before !== undefined) {
    sql += ` AND m.id < $${idx++}`;
    params.push(before);
  }

  sql += ` ORDER BY m.created_at DESC, m.id DESC LIMIT $${idx}`;
  params.push(limit);

  const rows = (await query<MessageRow>(sql, params)).reverse();
  const messages = await Promise.all(rows.map(toMessage));

  // タグを bulk fetch して各メッセージに付与（N+1 回避）
  const messageIds = messages.map((m) => m.id);
  if (messageIds.length > 0) {
    const tagsMap = await getForMessages(messageIds);
    return messages.map((msg) => ({ ...msg, tags: tagsMap.get(msg.id) ?? [] }));
  }

  return messages;
}

export async function createThreadReply(
  parentMessageId: number,
  rootMessageId: number,
  userId: number,
  content: string,
  mentionedUserIds: number[] = [],
  attachmentIds: number[] = [],
): Promise<Message> {
  const parent = await queryOne<{ channel_id: number }>(
    'SELECT channel_id FROM messages WHERE id = $1',
    [parentMessageId],
  );
  if (!parent) throw createError('Parent message not found', 404);

  const inserted = await queryOne<{ id: number }>(
    'INSERT INTO messages (channel_id, user_id, content, parent_message_id, root_message_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [parent.channel_id, userId, content, parentMessageId, rootMessageId],
  );
  const messageId = inserted!.id;

  for (const uid of mentionedUserIds) {
    await execute(
      'INSERT INTO mentions (message_id, mentioned_user_id, channel_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [messageId, uid, parent.channel_id],
    );
  }

  for (const aid of attachmentIds) {
    await execute('UPDATE message_attachments SET message_id = $1 WHERE id = $2', [messageId, aid]);
  }

  const row = await queryOne<MessageRow>(MESSAGE_SELECT + ' WHERE m.id = $1', [messageId]);
  return toMessage(row!);
}

export async function getThreadReplies(rootMessageId: number): Promise<Message[]> {
  const rows = await query<MessageRow>(
    MESSAGE_SELECT + ' WHERE m.root_message_id = $1 ORDER BY m.created_at ASC, m.id ASC',
    [rootMessageId],
  );
  return Promise.all(rows.map(toMessage));
}

export async function createMessage(
  channelId: number,
  userId: number,
  content: string,
  mentionedUserIds: number[] = [],
  attachmentIds: number[] = [],
  quotedMessageId?: number,
): Promise<Message> {
  if (quotedMessageId !== undefined) {
    const quoted = await queryOne<{ id: number; channel_id: number; is_deleted: boolean }>(
      'SELECT id, channel_id, is_deleted FROM messages WHERE id = $1',
      [quotedMessageId],
    );
    if (!quoted) throw createError('Quoted message not found', 404);
    if (quoted.is_deleted) throw createError('Cannot quote a deleted message', 400);
    if (quoted.channel_id !== channelId)
      throw createError('Cannot quote a message from a different channel', 400);
  }

  const inserted = await queryOne<{ id: number }>(
    'INSERT INTO messages (channel_id, user_id, content, quoted_message_id) VALUES ($1, $2, $3, $4) RETURNING id',
    [channelId, userId, content, quotedMessageId ?? null],
  );
  const messageId = inserted!.id;

  for (const uid of mentionedUserIds) {
    await execute(
      'INSERT INTO mentions (message_id, mentioned_user_id, channel_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [messageId, uid, channelId],
    );
  }

  for (const aid of attachmentIds) {
    await execute('UPDATE message_attachments SET message_id = $1 WHERE id = $2', [messageId, aid]);
  }

  const row = await queryOne<MessageRow>(MESSAGE_SELECT + ' WHERE m.id = $1', [messageId]);
  return toMessage(row!);
}

export async function editMessage(
  messageId: number,
  userId: number,
  content: string,
  mentionedUserIds: number[] = [],
  attachmentIds: number[] = [],
): Promise<Message> {
  const existing = await queryOne<{ user_id: number; channel_id: number }>(
    'SELECT user_id, channel_id FROM messages WHERE id = $1',
    [messageId],
  );

  if (!existing) throw createError('Message not found', 404);
  if (existing.user_id !== userId) throw createError('Forbidden', 403);

  await execute(
    'UPDATE messages SET content = $1, is_edited = true, updated_at = NOW() WHERE id = $2',
    [content, messageId],
  );

  await execute('DELETE FROM mentions WHERE message_id = $1', [messageId]);
  for (const uid of mentionedUserIds) {
    await execute(
      'INSERT INTO mentions (message_id, mentioned_user_id, channel_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [messageId, uid, existing.channel_id],
    );
  }

  await execute('UPDATE message_attachments SET message_id = NULL WHERE message_id = $1', [
    messageId,
  ]);
  for (const aid of attachmentIds) {
    await execute('UPDATE message_attachments SET message_id = $1 WHERE id = $2', [messageId, aid]);
  }

  const row = await queryOne<MessageRow>(MESSAGE_SELECT + ' WHERE m.id = $1', [messageId]);
  return toMessage(row!);
}

export async function deleteMessage(messageId: number, userId: number): Promise<void> {
  const existing = await queryOne<{ user_id: number }>(
    'SELECT user_id FROM messages WHERE id = $1',
    [messageId],
  );
  if (!existing) throw createError('Message not found', 404);
  if (existing.user_id !== userId) throw createError('Forbidden', 403);

  await execute('UPDATE messages SET is_deleted = true, updated_at = NOW() WHERE id = $1', [
    messageId,
  ]);
}

export async function restoreMessage(messageId: number, userId: number): Promise<Message> {
  const existing = await queryOne<{ user_id: number }>(
    'SELECT user_id FROM messages WHERE id = $1',
    [messageId],
  );
  if (!existing) throw createError('Message not found', 404);
  if (existing.user_id !== userId) throw createError('Forbidden', 403);

  await execute('UPDATE messages SET is_deleted = false, updated_at = NOW() WHERE id = $1', [
    messageId,
  ]);

  const row = await queryOne<MessageRow>(MESSAGE_SELECT + ' WHERE m.id = $1', [messageId]);
  return toMessage(row!);
}

export async function searchMessages(
  q: string,
  filters: MessageSearchFilters = {},
): Promise<MessageSearchResult[]> {
  const { dateFrom, dateTo, userId, hasAttachment, tagIds } = filters;

  // dateFrom > dateTo の場合は空を返す（早期リターン）
  if (
    dateFrom &&
    isValidDate(dateFrom) &&
    dateTo &&
    isValidDate(dateTo) &&
    new Date(dateFrom) > new Date(dateTo)
  ) {
    return [];
  }

  const params: unknown[] = [`%${q}%`];
  let idx = 2;

  // 添付ファイルフィルタに応じて JOIN 方法を切り替える
  let attachJoin = '';
  let attachWhere = '';
  if (hasAttachment === true) {
    attachJoin = 'JOIN message_attachments ma ON ma.message_id = m.id';
  } else if (hasAttachment === false) {
    attachJoin = 'LEFT JOIN message_attachments ma ON ma.message_id = m.id';
    attachWhere = 'AND ma.id IS NULL';
  }

  let sql = `SELECT DISTINCT m.id, m.channel_id, m.user_id, u.username, u.avatar_url,
            m.content, m.is_edited, m.is_deleted, m.created_at, m.updated_at,
            m.parent_message_id, m.root_message_id, m.quoted_message_id,
            c.name AS channel_name,
            rm.content AS root_message_content
     FROM messages m
     LEFT JOIN users u ON m.user_id = u.id
     JOIN channels c ON m.channel_id = c.id
     LEFT JOIN messages rm ON m.root_message_id = rm.id
     ${attachJoin}
     WHERE m.is_deleted = false AND m.content LIKE $1
     ${attachWhere}`;

  if (dateFrom && isValidDate(dateFrom)) {
    sql += ` AND m.created_at >= $${idx++}`;
    params.push(dateFrom);
  }

  if (dateTo && isValidDate(dateTo)) {
    sql += ` AND m.created_at <= $${idx++}`;
    params.push(`${dateTo}T23:59:59.999Z`);
  }

  if (userId !== undefined) {
    sql += ` AND m.user_id = $${idx++}`;
    params.push(userId);
  }

  if (tagIds && tagIds.length > 0) {
    // AND 条件: すべての指定タグが付与されているメッセージのみ
    for (const tagId of tagIds) {
      sql += ` AND EXISTS (SELECT 1 FROM message_tags mt WHERE mt.message_id = m.id AND mt.tag_id = $${idx++})`;
      params.push(tagId);
    }
  }

  sql += ` ORDER BY m.created_at DESC LIMIT 100`;

  const rows = await query<
    MessageRow & { channel_name: string; root_message_content: string | null }
  >(sql, params);

  const baseResults = await Promise.all(
    rows.map(async (row) => ({
      ...(await toMessage(row)),
      channelName: row.channel_name,
      rootMessageContent: row.root_message_content ?? null,
    })),
  );

  // タグを bulk fetch して各メッセージに付与（N+1 回避）
  const messageIds = baseResults.map((r) => r.id);
  if (messageIds.length === 0) return baseResults;

  const tagsMap = await getForMessages(messageIds);
  return baseResults.map((msg) => ({ ...msg, tags: tagsMap.get(msg.id) ?? [] }));
}

function isValidDate(dateStr: string): boolean {
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
}

export async function getMessageById(messageId: number): Promise<Message | null> {
  const row = await queryOne<MessageRow>(MESSAGE_SELECT + ' WHERE m.id = $1', [messageId]);
  return row ? toMessage(row) : null;
}

export async function getReactions(messageId: number): Promise<Reaction[]> {
  return getReactionsForMessage(messageId);
}

export async function addReaction(
  messageId: number,
  userId: number,
  emoji: string,
): Promise<Reaction[]> {
  const message = await queryOne('SELECT id FROM messages WHERE id = $1', [messageId]);
  if (!message) throw createError('Message not found', 404);

  await execute(
    'INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
    [messageId, userId, emoji],
  );

  return getReactionsForMessage(messageId);
}

export async function removeReaction(
  messageId: number,
  userId: number,
  emoji: string,
): Promise<Reaction[]> {
  await execute(
    'DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
    [messageId, userId, emoji],
  );

  return getReactionsForMessage(messageId);
}
