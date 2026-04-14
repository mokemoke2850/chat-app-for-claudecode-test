import { getDatabase } from '../db/database';
import type { Bookmark, Message } from '@chat-app/shared';

interface BookmarkRow {
  id: number;
  user_id: number;
  message_id: number;
  bookmarked_at: string;
  // メッセージ情報（JOIN結果）
  msg_id: number | null;
  msg_channel_id: number | null;
  msg_user_id: number | null;
  msg_username: string | null;
  msg_avatar_url: string | null;
  msg_content: string | null;
  msg_is_edited: number | null;
  msg_is_deleted: number | null;
  msg_created_at: string | null;
  msg_updated_at: string | null;
  channel_name: string | null;
}

function rowToBookmark(row: BookmarkRow): Bookmark {
  const bookmark: Bookmark = {
    id: row.id,
    userId: row.user_id,
    messageId: row.message_id,
    bookmarkedAt: row.bookmarked_at,
    channelName: row.channel_name ?? undefined,
  };

  if (row.msg_id !== null && row.msg_content !== null) {
    const message: Message = {
      id: row.msg_id,
      channelId: row.msg_channel_id!,
      userId: row.msg_user_id,
      username: row.msg_username ?? '',
      avatarUrl: row.msg_avatar_url,
      content: row.msg_content,
      isEdited: row.msg_is_edited === 1,
      isDeleted: row.msg_is_deleted === 1,
      createdAt: row.msg_created_at!,
      updatedAt: row.msg_updated_at!,
      mentions: [],
      reactions: [],
      parentMessageId: null,
      rootMessageId: null,
      replyCount: 0,
    };
    bookmark.message = message;
  }

  return bookmark;
}

/**
 * メッセージをブックマーク登録する
 * 削除済みメッセージはブックマーク不可
 * 同一ユーザー・メッセージの重複はエラー
 */
export function addBookmark(userId: number, messageId: number): Bookmark {
  const db = getDatabase();

  // メッセージの存在確認
  const msg = db.prepare('SELECT id, is_deleted FROM messages WHERE id = ?').get(messageId) as
    | { id: number; is_deleted: number }
    | undefined;
  if (!msg) {
    throw new Error('Message not found');
  }
  if (msg.is_deleted === 1) {
    throw new Error('Cannot bookmark a deleted message');
  }

  try {
    const result = db
      .prepare('INSERT INTO bookmarks (user_id, message_id) VALUES (?, ?)')
      .run(userId, messageId);

    const row = db
      .prepare(
        `SELECT
          b.id, b.user_id, b.message_id, b.bookmarked_at,
          m.id AS msg_id, m.channel_id AS msg_channel_id, m.user_id AS msg_user_id,
          u.username AS msg_username, u.avatar_url AS msg_avatar_url,
          m.content AS msg_content, m.is_edited AS msg_is_edited, m.is_deleted AS msg_is_deleted,
          m.created_at AS msg_created_at, m.updated_at AS msg_updated_at,
          c.name AS channel_name
        FROM bookmarks b
        LEFT JOIN messages m ON m.id = b.message_id
        LEFT JOIN users u ON u.id = m.user_id
        LEFT JOIN channels c ON c.id = m.channel_id
        WHERE b.id = ?`,
      )
      .get(result.lastInsertRowid) as BookmarkRow;

    return rowToBookmark(row);
  } catch (err: unknown) {
    const error = err as { code?: string };
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new Error('Message is already bookmarked');
    }
    throw err;
  }
}

/**
 * ブックマークを解除する
 */
export function removeBookmark(userId: number, messageId: number): void {
  const db = getDatabase();

  // メッセージの存在確認
  const msg = db.prepare('SELECT id FROM messages WHERE id = ?').get(messageId);
  if (!msg) {
    throw new Error('Message not found');
  }

  const result = db
    .prepare('DELETE FROM bookmarks WHERE user_id = ? AND message_id = ?')
    .run(userId, messageId);

  if (result.changes === 0) {
    throw new Error('Bookmark not found');
  }
}

/**
 * ユーザーのブックマーク一覧を取得する
 * 削除済みメッセージは除外し、bookmarked_at DESC で返す
 */
export function getBookmarks(userId: number): Bookmark[] {
  const db = getDatabase();

  const rows = db
    .prepare(
      `SELECT
        b.id, b.user_id, b.message_id, b.bookmarked_at,
        m.id AS msg_id, m.channel_id AS msg_channel_id, m.user_id AS msg_user_id,
        u.username AS msg_username, u.avatar_url AS msg_avatar_url,
        m.content AS msg_content, m.is_edited AS msg_is_edited, m.is_deleted AS msg_is_deleted,
        m.created_at AS msg_created_at, m.updated_at AS msg_updated_at,
        c.name AS channel_name
      FROM bookmarks b
      LEFT JOIN messages m ON m.id = b.message_id AND m.is_deleted = 0
      LEFT JOIN users u ON u.id = m.user_id
      LEFT JOIN channels c ON c.id = m.channel_id
      WHERE b.user_id = ?
        AND m.id IS NOT NULL
      ORDER BY b.bookmarked_at DESC`,
    )
    .all(userId) as BookmarkRow[];

  return rows.map(rowToBookmark);
}
