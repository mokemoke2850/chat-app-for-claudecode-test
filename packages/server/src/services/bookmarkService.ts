import { query, queryOne, execute } from '../db/database';
import type { Bookmark, Message } from '@chat-app/shared';

interface BookmarkRow {
  id: number;
  user_id: number;
  message_id: number;
  bookmarked_at: string;
  msg_id: number | null;
  msg_channel_id: number | null;
  msg_user_id: number | null;
  msg_username: string | null;
  msg_avatar_url: string | null;
  msg_content: string | null;
  msg_is_edited: boolean | null;
  msg_is_deleted: boolean | null;
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
      isEdited: row.msg_is_edited === true,
      isDeleted: row.msg_is_deleted === true,
      createdAt: row.msg_created_at!,
      updatedAt: row.msg_updated_at!,
      mentions: [],
      reactions: [],
      parentMessageId: null,
      rootMessageId: null,
      replyCount: 0,
      quotedMessageId: null,
      quotedMessage: null,
    };
    bookmark.message = message;
  }

  return bookmark;
}

export async function addBookmark(userId: number, messageId: number): Promise<Bookmark> {
  const msg = await queryOne<{ id: number; is_deleted: boolean }>(
    'SELECT id, is_deleted FROM messages WHERE id = $1',
    [messageId],
  );
  if (!msg) {
    throw new Error('Message not found');
  }
  if (msg.is_deleted) {
    throw new Error('Cannot bookmark a deleted message');
  }

  try {
    const result = await queryOne<{ id: number }>(
      'INSERT INTO bookmarks (user_id, message_id) VALUES ($1, $2) RETURNING id',
      [userId, messageId],
    );

    const row = await queryOne<BookmarkRow>(
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
      WHERE b.id = $1`,
      [result!.id],
    );

    return rowToBookmark(row!);
  } catch (err: unknown) {
    const error = err as { code?: string };
    if (error.code === '23505') {
      throw new Error('Message is already bookmarked');
    }
    throw err;
  }
}

export async function removeBookmark(userId: number, messageId: number): Promise<void> {
  const msg = await queryOne('SELECT id FROM messages WHERE id = $1', [messageId]);
  if (!msg) {
    throw new Error('Message not found');
  }

  const result = await execute(
    'DELETE FROM bookmarks WHERE user_id = $1 AND message_id = $2',
    [userId, messageId],
  );

  if (result.rowCount === 0) {
    throw new Error('Bookmark not found');
  }
}

export async function getBookmarks(userId: number): Promise<Bookmark[]> {
  const rows = await query<BookmarkRow>(
    `SELECT
      b.id, b.user_id, b.message_id, b.bookmarked_at,
      m.id AS msg_id, m.channel_id AS msg_channel_id, m.user_id AS msg_user_id,
      u.username AS msg_username, u.avatar_url AS msg_avatar_url,
      m.content AS msg_content, m.is_edited AS msg_is_edited, m.is_deleted AS msg_is_deleted,
      m.created_at AS msg_created_at, m.updated_at AS msg_updated_at,
      c.name AS channel_name
    FROM bookmarks b
    LEFT JOIN messages m ON m.id = b.message_id AND m.is_deleted = false
    LEFT JOIN users u ON u.id = m.user_id
    LEFT JOIN channels c ON c.id = m.channel_id
    WHERE b.user_id = $1
      AND m.id IS NOT NULL
    ORDER BY b.bookmarked_at DESC`,
    [userId],
  );

  return rows.map(rowToBookmark);
}
