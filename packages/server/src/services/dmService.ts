import { getDatabase } from '../db/database';
import type { DmConversation, DmConversationWithDetails, DmMessage } from '@chat-app/shared';

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
  is_read: number;
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
    unreadCount: row.unread_count,
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
    isRead: row.is_read === 1,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * DM会話を作成する（冪等: 既存があれば返す）
 * user_a_id < user_b_id の正規化を行う
 */
export function getOrCreateConversation(
  userId: number,
  targetUserId: number,
): DmConversationWithDetails {
  const db = getDatabase();

  // 存在確認
  const targetUser = db.prepare('SELECT id FROM users WHERE id = ?').get(targetUserId) as
    | { id: number }
    | undefined;
  if (!targetUser) {
    throw new Error('User not found');
  }

  // 自分自身とのDMは禁止
  if (userId === targetUserId) {
    throw new Error('Cannot create DM with yourself');
  }

  const aId = Math.min(userId, targetUserId);
  const bId = Math.max(userId, targetUserId);

  // 既存確認
  const existing = db
    .prepare('SELECT id FROM dm_conversations WHERE user_a_id = ? AND user_b_id = ?')
    .get(aId, bId) as { id: number } | undefined;

  let conversationId: number;
  if (existing) {
    conversationId = existing.id;
  } else {
    const result = db
      .prepare('INSERT INTO dm_conversations (user_a_id, user_b_id) VALUES (?, ?)')
      .run(aId, bId);
    conversationId = result.lastInsertRowid as number;
  }

  return getConversationWithDetails(conversationId, userId)!;
}

/**
 * 指定ユーザーのDM会話一覧（未読数・最新メッセージ込み）を返す
 */
export function getConversations(userId: number): DmConversationWithDetails[] {
  const db = getDatabase();

  const rows = db
    .prepare(
      `SELECT
        c.id, c.user_a_id, c.user_b_id, c.created_at, c.updated_at,
        u.id          AS other_id,
        u.username    AS other_username,
        u.display_name AS other_display_name,
        u.avatar_url  AS other_avatar_url,
        (
          SELECT COUNT(*) FROM dm_messages m2
          WHERE m2.conversation_id = c.id
            AND m2.sender_id != ?
            AND m2.is_read = 0
        ) AS unread_count,
        lm.content     AS last_content,
        lm.created_at  AS last_created_at,
        lm.sender_id   AS last_sender_id
      FROM dm_conversations c
      JOIN users u ON u.id = CASE WHEN c.user_a_id = ? THEN c.user_b_id ELSE c.user_a_id END
      LEFT JOIN dm_messages lm ON lm.id = (
        SELECT id FROM dm_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1
      )
      WHERE c.user_a_id = ? OR c.user_b_id = ?
      ORDER BY COALESCE(lm.created_at, c.created_at) DESC`,
    )
    .all(userId, userId, userId, userId) as ConversationDetailRow[];

  return rows.map(toConversationWithDetails);
}

/**
 * 特定の会話詳細を1件取得する
 */
export function getConversationWithDetails(
  conversationId: number,
  userId: number,
): DmConversationWithDetails | null {
  const db = getDatabase();

  const row = db
    .prepare(
      `SELECT
        c.id, c.user_a_id, c.user_b_id, c.created_at, c.updated_at,
        u.id           AS other_id,
        u.username     AS other_username,
        u.display_name AS other_display_name,
        u.avatar_url   AS other_avatar_url,
        (
          SELECT COUNT(*) FROM dm_messages m2
          WHERE m2.conversation_id = c.id
            AND m2.sender_id != ?
            AND m2.is_read = 0
        ) AS unread_count,
        lm.content     AS last_content,
        lm.created_at  AS last_created_at,
        lm.sender_id   AS last_sender_id
      FROM dm_conversations c
      JOIN users u ON u.id = CASE WHEN c.user_a_id = ? THEN c.user_b_id ELSE c.user_a_id END
      LEFT JOIN dm_messages lm ON lm.id = (
        SELECT id FROM dm_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1
      )
      WHERE c.id = ? AND (c.user_a_id = ? OR c.user_b_id = ?)`,
    )
    .get(userId, userId, conversationId, userId, userId) as ConversationDetailRow | undefined;

  if (!row) return null;
  return toConversationWithDetails(row);
}

/**
 * 会話のメッセージ一覧（cursor ベースページネーション）を返す
 */
export function getMessages(
  conversationId: number,
  userId: number,
  options: { limit?: number; before?: number } = {},
): DmMessage[] {
  const db = getDatabase();

  // 参加確認
  const conv = db
    .prepare('SELECT id FROM dm_conversations WHERE id = ? AND (user_a_id = ? OR user_b_id = ?)')
    .get(conversationId, userId, userId) as { id: number } | undefined;
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
    WHERE m.conversation_id = ?
  `;
  const params: (number | string)[] = [conversationId];

  if (options.before !== undefined) {
    sql += ' AND m.id < ?';
    params.push(options.before);
  }

  sql += ' ORDER BY m.id DESC LIMIT ?';
  params.push(limit);

  const rows = db.prepare(sql).all(...params) as DmMessageRow[];
  return rows.reverse().map(toDmMessage);
}

/**
 * DMメッセージを送信する
 */
export function sendMessage(conversationId: number, senderId: number, content: string): DmMessage {
  const db = getDatabase();

  // 参加確認
  const conv = db
    .prepare('SELECT id FROM dm_conversations WHERE id = ? AND (user_a_id = ? OR user_b_id = ?)')
    .get(conversationId, senderId, senderId) as { id: number } | undefined;
  if (!conv) {
    throw new Error('Conversation not found or access denied');
  }

  if (!content || content.trim() === '') {
    throw new Error('Content is required');
  }

  const result = db
    .prepare('INSERT INTO dm_messages (conversation_id, sender_id, content) VALUES (?, ?, ?)')
    .run(conversationId, senderId, content.trim());

  // updated_at を更新
  db.prepare("UPDATE dm_conversations SET updated_at = datetime('now') WHERE id = ?").run(
    conversationId,
  );

  const row = db
    .prepare(
      `SELECT
        m.id, m.conversation_id, m.sender_id, m.content, m.is_read, m.created_at,
        u.username AS sender_username,
        u.avatar_url AS sender_avatar_url
      FROM dm_messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.id = ?`,
    )
    .get(result.lastInsertRowid) as DmMessageRow;

  return toDmMessage(row);
}

/**
 * 会話の未読メッセージを既読にする
 */
export function markAsRead(conversationId: number, userId: number): void {
  const db = getDatabase();

  // 参加確認
  const conv = db
    .prepare('SELECT id FROM dm_conversations WHERE id = ? AND (user_a_id = ? OR user_b_id = ?)')
    .get(conversationId, userId, userId) as { id: number } | undefined;
  if (!conv) {
    throw new Error('Conversation not found or access denied');
  }

  db.prepare(
    'UPDATE dm_messages SET is_read = 1 WHERE conversation_id = ? AND sender_id != ? AND is_read = 0',
  ).run(conversationId, userId);
}

/**
 * 会話の相手ユーザーIDを返す
 */
export function getOtherUserId(conversationId: number, userId: number): number | null {
  const db = getDatabase();
  const conv = db
    .prepare('SELECT user_a_id, user_b_id FROM dm_conversations WHERE id = ?')
    .get(conversationId) as ConversationRow | undefined;
  if (!conv) return null;
  if (conv.user_a_id === userId) return conv.user_b_id;
  if (conv.user_b_id === userId) return conv.user_a_id;
  return null;
}

/**
 * 会話へのアクセス権を確認する
 */
export function checkAccess(conversationId: number, userId: number): boolean {
  const db = getDatabase();
  const conv = db
    .prepare('SELECT id FROM dm_conversations WHERE id = ? AND (user_a_id = ? OR user_b_id = ?)')
    .get(conversationId, userId, userId);
  return conv !== undefined;
}
