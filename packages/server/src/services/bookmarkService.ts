import { query, queryOne, execute } from '../db/database';
import type { Bookmark, BookmarkTag, BookmarkListFilters, Message } from '@chat-app/shared';

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

interface BookmarkTagRow {
  id: number;
  user_id: number;
  name: string;
  color: string | null;
  created_at: string;
}

interface BookmarkTagWithBookmarkIdRow extends BookmarkTagRow {
  bookmark_id: number;
}

function rowToBookmark(row: BookmarkRow): Bookmark {
  const bookmark: Bookmark = {
    id: row.id,
    userId: row.user_id,
    messageId: row.message_id,
    bookmarkedAt: row.bookmarked_at,
    channelName: row.channel_name ?? undefined,
    tags: [],
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

function rowToBookmarkTag(row: BookmarkTagRow & { bookmark_count?: number }): BookmarkTag {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
    bookmarkCount: row.bookmark_count !== undefined ? Number(row.bookmark_count) : undefined,
  };
}

/** 指定ユーザーが所有するタグ ID をすべて検証する。所有していないものがあれば名前を返す。 */
async function validateUserOwnsTags(userId: number, tagIds: number[]): Promise<void> {
  if (tagIds.length === 0) return;
  const placeholders = tagIds.map((_, i) => `$${i + 2}`).join(',');
  const rows = await query<{ id: number }>(
    `SELECT id FROM bookmark_tags WHERE user_id = $1 AND id IN (${placeholders})`,
    [userId, ...tagIds],
  );
  const uniqueTagIds = Array.from(new Set(tagIds));
  if (rows.length !== uniqueTagIds.length) {
    throw new Error('Invalid tag ids');
  }
}

async function attachTagsToBookmarks(userId: number, bookmarks: Bookmark[]): Promise<void> {
  if (bookmarks.length === 0) return;
  const bookmarkIds = bookmarks.map((b) => b.id);
  const placeholders = bookmarkIds.map((_, i) => `$${i + 2}`).join(',');
  const rows = await query<BookmarkTagWithBookmarkIdRow>(
    `SELECT btr.bookmark_id, t.id, t.user_id, t.name, t.color, t.created_at
     FROM bookmark_tag_relations btr
     INNER JOIN bookmark_tags t ON t.id = btr.tag_id
     WHERE t.user_id = $1 AND btr.bookmark_id IN (${placeholders})
     ORDER BY t.name ASC`,
    [userId, ...bookmarkIds],
  );

  const map = new Map<number, BookmarkTag[]>();
  for (const row of rows) {
    const tag = rowToBookmarkTag(row);
    const arr = map.get(row.bookmark_id) ?? [];
    arr.push(tag);
    map.set(row.bookmark_id, arr);
  }

  for (const bookmark of bookmarks) {
    bookmark.tags = map.get(bookmark.id) ?? [];
  }
}

export async function addBookmark(
  userId: number,
  messageId: number,
  tagIds: number[] = [],
): Promise<Bookmark> {
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

  if (tagIds.length > 0) {
    await validateUserOwnsTags(userId, tagIds);
  }

  try {
    const result = await queryOne<{ id: number }>(
      'INSERT INTO bookmarks (user_id, message_id) VALUES ($1, $2) RETURNING id',
      [userId, messageId],
    );

    const bookmarkId = result!.id;

    if (tagIds.length > 0) {
      for (const tagId of tagIds) {
        await execute(
          `INSERT INTO bookmark_tag_relations (bookmark_id, tag_id) VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [bookmarkId, tagId],
        );
      }
    }

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
      [bookmarkId],
    );

    const bookmark = rowToBookmark(row!);
    await attachTagsToBookmarks(userId, [bookmark]);
    return bookmark;
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

  const result = await execute('DELETE FROM bookmarks WHERE user_id = $1 AND message_id = $2', [
    userId,
    messageId,
  ]);

  if (result.rowCount === 0) {
    throw new Error('Bookmark not found');
  }
}

export async function getBookmarks(
  userId: number,
  filters: BookmarkListFilters = {},
): Promise<Bookmark[]> {
  // 1) タグフィルタは事前計算: 該当する bookmark.id の集合を取得して
  //    pg-mem が苦手な相関サブクエリを避ける。
  const tagIds = (filters.tagIds ?? []).filter(
    (id): id is number => Number.isInteger(id) && id > 0,
  );

  let allowedBookmarkIds: number[] | null = null;
  if (filters.untagged === true) {
    // ユーザーのブックマーク全件から、関連を持たないものを抽出
    const all = await query<{ id: number }>(`SELECT id FROM bookmarks WHERE user_id = $1`, [
      userId,
    ]);
    const tagged = await query<{ bookmark_id: number }>(
      `SELECT DISTINCT btr.bookmark_id
       FROM bookmark_tag_relations btr
       INNER JOIN bookmarks b ON b.id = btr.bookmark_id
       WHERE b.user_id = $1`,
      [userId],
    );
    const taggedSet = new Set(tagged.map((r) => r.bookmark_id));
    allowedBookmarkIds = all.map((r) => r.id).filter((id) => !taggedSet.has(id));
    if (allowedBookmarkIds.length === 0) return [];
  } else if (tagIds.length > 0) {
    const mode = filters.tagMode ?? 'or';
    const params2: unknown[] = [userId];
    const ids: string[] = [];
    for (const id of tagIds) {
      params2.push(id);
      ids.push(`$${params2.length}`);
    }
    const rows = await query<{ bookmark_id: number; tag_count: number }>(
      `SELECT btr.bookmark_id, COUNT(DISTINCT btr.tag_id) AS tag_count
       FROM bookmark_tag_relations btr
       INNER JOIN bookmarks b ON b.id = btr.bookmark_id
       WHERE b.user_id = $1 AND btr.tag_id IN (${ids.join(',')})
       GROUP BY btr.bookmark_id`,
      params2,
    );
    if (mode === 'and') {
      allowedBookmarkIds = rows
        .filter((r) => Number(r.tag_count) === tagIds.length)
        .map((r) => r.bookmark_id);
    } else {
      allowedBookmarkIds = rows.map((r) => r.bookmark_id);
    }
    if (allowedBookmarkIds.length === 0) return [];
  }

  // 2) メイン取得
  const params: unknown[] = [userId];
  const conditions: string[] = ['b.user_id = $1', 'm.id IS NOT NULL'];

  if (filters.search && filters.search.trim() !== '') {
    params.push(`%${filters.search}%`);
    const idx = params.length;
    conditions.push(`(m.content ILIKE $${idx} OR u.username ILIKE $${idx})`);
  }

  if (allowedBookmarkIds !== null) {
    const idsSql: string[] = [];
    for (const id of allowedBookmarkIds) {
      params.push(id);
      idsSql.push(`$${params.length}`);
    }
    conditions.push(`b.id IN (${idsSql.join(',')})`);
  }

  const whereClause = conditions.join(' AND ');

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
    WHERE ${whereClause}
    ORDER BY b.bookmarked_at DESC`,
    params,
  );

  const bookmarks = rows.map(rowToBookmark);
  await attachTagsToBookmarks(userId, bookmarks);
  return bookmarks;
}

// ===========================================================================
// #304 タグ CRUD
// ===========================================================================

export async function listTags(userId: number): Promise<BookmarkTag[]> {
  const rows = await query<BookmarkTagRow & { bookmark_count: number }>(
    `SELECT t.id, t.user_id, t.name, t.color, t.created_at,
            COUNT(btr.bookmark_id) AS bookmark_count
     FROM bookmark_tags t
     LEFT JOIN bookmark_tag_relations btr ON btr.tag_id = t.id
     WHERE t.user_id = $1
     GROUP BY t.id, t.user_id, t.name, t.color, t.created_at
     ORDER BY t.created_at ASC, t.id ASC`,
    [userId],
  );
  return rows.map(rowToBookmarkTag);
}

export async function createTag(
  userId: number,
  name: string,
  color: string | null = null,
): Promise<BookmarkTag> {
  const trimmed = name.trim();
  if (trimmed === '') {
    throw new Error('Tag name is required');
  }

  try {
    const row = await queryOne<BookmarkTagRow>(
      `INSERT INTO bookmark_tags (user_id, name, color) VALUES ($1, $2, $3)
       RETURNING id, user_id, name, color, created_at`,
      [userId, trimmed, color],
    );
    return rowToBookmarkTag(row!);
  } catch (err: unknown) {
    const error = err as { code?: string };
    if (error.code === '23505') {
      throw new Error('Tag name already exists');
    }
    throw err;
  }
}

export async function updateTag(
  userId: number,
  tagId: number,
  data: { name?: string; color?: string | null },
): Promise<BookmarkTag> {
  const existing = await queryOne<BookmarkTagRow>(
    `SELECT id, user_id, name, color, created_at FROM bookmark_tags WHERE id = $1`,
    [tagId],
  );
  if (!existing) {
    throw new Error('Tag not found');
  }
  if (existing.user_id !== userId) {
    throw new Error('Forbidden');
  }

  const newName = data.name !== undefined ? data.name.trim() : existing.name;
  if (newName === '') {
    throw new Error('Tag name is required');
  }
  const newColor = data.color !== undefined ? data.color : existing.color;

  try {
    const row = await queryOne<BookmarkTagRow>(
      `UPDATE bookmark_tags SET name = $1, color = $2 WHERE id = $3 AND user_id = $4
       RETURNING id, user_id, name, color, created_at`,
      [newName, newColor, tagId, userId],
    );
    return rowToBookmarkTag(row!);
  } catch (err: unknown) {
    const error = err as { code?: string };
    if (error.code === '23505') {
      throw new Error('Tag name already exists');
    }
    throw err;
  }
}

export async function deleteTag(userId: number, tagId: number): Promise<void> {
  const existing = await queryOne<{ id: number; user_id: number }>(
    `SELECT id, user_id FROM bookmark_tags WHERE id = $1`,
    [tagId],
  );
  if (!existing) {
    throw new Error('Tag not found');
  }
  if (existing.user_id !== userId) {
    throw new Error('Forbidden');
  }

  await execute(`DELETE FROM bookmark_tags WHERE id = $1 AND user_id = $2`, [tagId, userId]);
}

// ===========================================================================
// #304 ブックマーク × タグ 関連
// ===========================================================================

/**
 * ブックマークに対してタグを置き換える（既存の関連は削除して指定 ID に再構築）。
 * messageId（チャット側の ID）から内部 bookmark.id を引いて行う。
 */
export async function setBookmarkTags(
  userId: number,
  messageId: number,
  tagIds: number[],
): Promise<Bookmark> {
  const bookmark = await queryOne<{ id: number }>(
    `SELECT id FROM bookmarks WHERE user_id = $1 AND message_id = $2`,
    [userId, messageId],
  );
  if (!bookmark) {
    throw new Error('Bookmark not found');
  }

  // 不正なタグ ID（他ユーザー所有 or 存在しない）を弾く
  await validateUserOwnsTags(userId, tagIds);

  await execute(`DELETE FROM bookmark_tag_relations WHERE bookmark_id = $1`, [bookmark.id]);
  for (const tagId of tagIds) {
    await execute(
      `INSERT INTO bookmark_tag_relations (bookmark_id, tag_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [bookmark.id, tagId],
    );
  }

  // 更新後のブックマークを返す
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
    [bookmark.id],
  );
  const result = rowToBookmark(row!);
  await attachTagsToBookmarks(userId, [result]);
  return result;
}
