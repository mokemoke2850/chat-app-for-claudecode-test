import { query, queryOne, execute } from '../db/database';
import type { DmConversationWithDetails, DmMessage } from '@chat-app/shared';

// ---------------------------------------------------------------------------
// 内部 Row 型
// ---------------------------------------------------------------------------

interface ConversationRow {
  id: number;
  user_a_id: number;
  user_b_id: number;
  created_at: string;
  updated_at: string;
}

interface ConversationDetailRow extends ConversationRow {
  other_id: number;
  other_username: string;
  other_display_name: string | null;
  other_avatar_url: string | null;
  unread_count: number;
  last_content: string | null;
  last_created_at: string | null;
  last_sender_id: number | null;
}

interface DmMessageRow {
  id: number;
  conversation_id: number;
  sender_id: number;
  sender_username: string;
  sender_avatar_url: string | null;
  content: string;
  is_read: boolean;
  created_at: string;
}

// ---------------------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------------------

function toConversationWithDetails(row: ConversationDetailRow): DmConversationWithDetails {
  return {
    id: row.id,
    userAId: row.user_a_id,
    userBId: row.user_b_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    otherUser: {
      id: row.other_id,
      username: row.other_username,
      displayName: row.other_display_name,
      avatarUrl: row.other_avatar_url,
    },
    unreadCount: Number(row.unread_count),
    lastMessage:
      row.last_content !== null && row.last_created_at !== null && row.last_sender_id !== null
        ? {
            content: row.last_content,
            createdAt: row.last_created_at,
            senderId: row.last_sender_id,
          }
        : null,
  };
}

function toDmMessage(row: DmMessageRow): DmMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    senderUsername: row.sender_username,
    senderAvatarUrl: row.sender_avatar_url,
    content: row.content,
    isRead: row.is_read,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getOrCreateConversation(
  userId: number,
  targetUserId: number,
): Promise<DmConversationWithDetails> {
  const targetUser = await queryOne('SELECT id FROM users WHERE id = $1', [targetUserId]);
  if (!targetUser) {
    throw new Error('User not found');
  }

  if (userId === targetUserId) {
    throw new Error('Cannot create DM with yourself');
  }

  const aId = Math.min(userId, targetUserId);
  const bId = Math.max(userId, targetUserId);

  const existing = await queryOne<{ id: number }>(
    'SELECT id FROM dm_conversations WHERE user_a_id = $1 AND user_b_id = $2',
    [aId, bId],
  );

  let conversationId: number;
  if (existing) {
    conversationId = existing.id;
  } else {
    const result = await queryOne<{ id: number }>(
      'INSERT INTO dm_conversations (user_a_id, user_b_id) VALUES ($1, $2) RETURNING id',
      [aId, bId],
    );
    conversationId = result!.id;
  }

  return (await getConversationWithDetails(conversationId, userId))!;
}

interface BaseConversationRow {
  id: number;
  user_a_id: number;
  user_b_id: number;
  created_at: string;
  updated_at: string;
  other_id: number;
  other_username: string;
  other_display_name: string | null;
  other_avatar_url: string | null;
}

interface UnreadRow {
  conversation_id: number;
  cnt: string | number;
}

interface LastMessageRow {
  conversation_id: number;
  content: string;
  created_at: string;
  sender_id: number;
}

async function enrichConversations(
  baseRows: BaseConversationRow[],
  userId: number,
): Promise<DmConversationWithDetails[]> {
  if (baseRows.length === 0) return [];

  const convIds = baseRows.map((r) => r.id);
  const placeholders = convIds.map((_, i) => `$${i + 1}`).join(',');

  // 各会話の未読数を一括取得
  const unreadRows = await query<UnreadRow>(
    `SELECT conversation_id, COUNT(*) AS cnt
     FROM dm_messages
     WHERE conversation_id IN (${placeholders})
       AND sender_id != $${convIds.length + 1}
       AND is_read = false
     GROUP BY conversation_id`,
    [...convIds, userId],
  );
  const unreadMap = new Map<number, number>(
    unreadRows.map((r) => [r.conversation_id, Number(r.cnt)]),
  );

  // 各会話の最新メッセージを一括取得（各 conversation_id の中で MAX(id) を使用）
  const lastMessageRows = await query<LastMessageRow>(
    `SELECT dm.conversation_id, dm.content, dm.created_at, dm.sender_id
     FROM dm_messages dm
     WHERE dm.id IN (
       SELECT MAX(id) FROM dm_messages
       WHERE conversation_id IN (${placeholders})
       GROUP BY conversation_id
     )`,
    convIds,
  );
  const lastMessageMap = new Map<number, LastMessageRow>(
    lastMessageRows.map((r) => [r.conversation_id, r]),
  );

  const result: DmConversationWithDetails[] = baseRows.map((row) => {
    const lm = lastMessageMap.get(row.id);
    const detail: ConversationDetailRow = {
      id: row.id,
      user_a_id: row.user_a_id,
      user_b_id: row.user_b_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      other_id: row.other_id,
      other_username: row.other_username,
      other_display_name: row.other_display_name,
      other_avatar_url: row.other_avatar_url,
      unread_count: unreadMap.get(row.id) ?? 0,
      last_content: lm?.content ?? null,
      last_created_at: lm?.created_at ?? null,
      last_sender_id: lm?.sender_id ?? null,
    };
    return toConversationWithDetails(detail);
  });

  // 最新メッセージ日時（なければ会話作成日時）の降順でソート
  result.sort((a, b) => {
    const aTime = a.lastMessage?.createdAt ?? a.createdAt;
    const bTime = b.lastMessage?.createdAt ?? b.createdAt;
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  });

  return result;
}

export async function getConversations(userId: number): Promise<DmConversationWithDetails[]> {
  const baseRows = await query<BaseConversationRow>(
    `SELECT
      c.id, c.user_a_id, c.user_b_id, c.created_at, c.updated_at,
      u.id          AS other_id,
      u.username    AS other_username,
      u.display_name AS other_display_name,
      u.avatar_url  AS other_avatar_url
    FROM dm_conversations c
    JOIN users u ON u.id = CASE WHEN c.user_a_id = $1 THEN c.user_b_id ELSE c.user_a_id END
    WHERE c.user_a_id = $2 OR c.user_b_id = $3`,
    [userId, userId, userId],
  );

  return enrichConversations(baseRows, userId);
}

export async function getConversationWithDetails(
  conversationId: number,
  userId: number,
): Promise<DmConversationWithDetails | null> {
  const baseRow = await queryOne<BaseConversationRow>(
    `SELECT
      c.id, c.user_a_id, c.user_b_id, c.created_at, c.updated_at,
      u.id           AS other_id,
      u.username     AS other_username,
      u.display_name AS other_display_name,
      u.avatar_url   AS other_avatar_url
    FROM dm_conversations c
    JOIN users u ON u.id = CASE WHEN c.user_a_id = $1 THEN c.user_b_id ELSE c.user_a_id END
    WHERE c.id = $2 AND (c.user_a_id = $3 OR c.user_b_id = $4)`,
    [userId, conversationId, userId, userId],
  );

  if (!baseRow) return null;
  const [result] = await enrichConversations([baseRow], userId);
  return result;
}

export async function getMessages(
  conversationId: number,
  userId: number,
  options: { limit?: number; before?: number } = {},
): Promise<DmMessage[]> {
  const conv = await queryOne(
    'SELECT id FROM dm_conversations WHERE id = $1 AND (user_a_id = $2 OR user_b_id = $3)',
    [conversationId, userId, userId],
  );
  if (!conv) {
    throw new Error('Conversation not found or access denied');
  }

  const limit = options.limit ?? 50;
  let sql = `
    SELECT
      m.id, m.conversation_id, m.sender_id, m.content, m.is_read, m.created_at,
      u.username AS sender_username,
      u.avatar_url AS sender_avatar_url
    FROM dm_messages m
    JOIN users u ON u.id = m.sender_id
    WHERE m.conversation_id = $1
  `;
  const params: (number | string)[] = [conversationId];
  let idx = 2;

  if (options.before !== undefined) {
    sql += ` AND m.id < $${idx++}`;
    params.push(options.before);
  }

  sql += ` ORDER BY m.id DESC LIMIT $${idx}`;
  params.push(limit);

  const rows = await query<DmMessageRow>(sql, params);
  return rows.reverse().map(toDmMessage);
}

export async function sendMessage(conversationId: number, senderId: number, content: string): Promise<DmMessage> {
  const conv = await queryOne(
    'SELECT id FROM dm_conversations WHERE id = $1 AND (user_a_id = $2 OR user_b_id = $3)',
    [conversationId, senderId, senderId],
  );
  if (!conv) {
    throw new Error('Conversation not found or access denied');
  }

  if (!content || content.trim() === '') {
    throw new Error('Content is required');
  }

  const inserted = await queryOne<{ id: number }>(
    'INSERT INTO dm_messages (conversation_id, sender_id, content) VALUES ($1, $2, $3) RETURNING id',
    [conversationId, senderId, content.trim()],
  );

  await execute("UPDATE dm_conversations SET updated_at = NOW() WHERE id = $1", [conversationId]);

  const row = await queryOne<DmMessageRow>(
    `SELECT
      m.id, m.conversation_id, m.sender_id, m.content, m.is_read, m.created_at,
      u.username AS sender_username,
      u.avatar_url AS sender_avatar_url
    FROM dm_messages m
    JOIN users u ON u.id = m.sender_id
    WHERE m.id = $1`,
    [inserted!.id],
  );

  return toDmMessage(row!);
}

export async function markAsRead(conversationId: number, userId: number): Promise<void> {
  const conv = await queryOne(
    'SELECT id FROM dm_conversations WHERE id = $1 AND (user_a_id = $2 OR user_b_id = $3)',
    [conversationId, userId, userId],
  );
  if (!conv) {
    throw new Error('Conversation not found or access denied');
  }

  await execute(
    'UPDATE dm_messages SET is_read = true WHERE conversation_id = $1 AND sender_id != $2 AND is_read = false',
    [conversationId, userId],
  );
}

export async function getOtherUserId(conversationId: number, userId: number): Promise<number | null> {
  const conv = await queryOne<ConversationRow>(
    'SELECT user_a_id, user_b_id FROM dm_conversations WHERE id = $1',
    [conversationId],
  );
  if (!conv) return null;
  if (conv.user_a_id === userId) return conv.user_b_id;
  if (conv.user_b_id === userId) return conv.user_a_id;
  return null;
}

export async function checkAccess(conversationId: number, userId: number): Promise<boolean> {
  const conv = await queryOne(
    'SELECT id FROM dm_conversations WHERE id = $1 AND (user_a_id = $2 OR user_b_id = $3)',
    [conversationId, userId, userId],
  );
  return conv !== null;
}
