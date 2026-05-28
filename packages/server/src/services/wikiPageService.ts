import { query, queryOne, execute } from '../db/database';
import { createError } from '../middleware/errorHandler';
import type {
  WikiPage,
  WikiPageSummary,
  CreateWikiPageInput,
  UpdateWikiPageInput,
  Tag,
} from '@chat-app/shared';

interface WikiPageRow {
  id: number;
  channel_id: number;
  title: string;
  content: string;
  created_by: number | null;
  created_by_username: string | null;
  updated_by: number | null;
  updated_by_username: string | null;
  created_at: string;
  updated_at: string;
}

interface TagRow {
  id: number;
  name: string;
  created_by: number | null;
  use_count: number;
  created_at: string;
}

const BASE_SELECT = `
  SELECT
    w.id, w.channel_id, w.title, w.content,
    w.created_by, cu.username AS created_by_username,
    w.updated_by, uu.username AS updated_by_username,
    w.created_at, w.updated_at
  FROM wiki_pages w
  LEFT JOIN users cu ON cu.id = w.created_by
  LEFT JOIN users uu ON uu.id = w.updated_by
`;

function rowToTag(row: TagRow): Tag {
  return {
    id: row.id,
    name: row.name,
    useCount: row.use_count,
    createdAt: row.created_at,
  };
}

async function loadTagsForPage(pageId: number): Promise<Tag[]> {
  const rows = await query<TagRow>(
    `SELECT t.id, t.name, t.created_by, t.use_count, t.created_at
     FROM tags t
     JOIN wiki_page_tags wpt ON wpt.tag_id = t.id
     WHERE wpt.wiki_page_id = $1
     ORDER BY t.name ASC`,
    [pageId],
  );
  return rows.map(rowToTag);
}

async function loadTagsForPages(pageIds: number[]): Promise<Map<number, Tag[]>> {
  const map = new Map<number, Tag[]>();
  if (pageIds.length === 0) return map;
  const placeholders = pageIds.map((_, i) => `$${i + 1}`).join(', ');
  const rows = await query<TagRow & { wiki_page_id: number }>(
    `SELECT wpt.wiki_page_id, t.id, t.name, t.created_by, t.use_count, t.created_at
     FROM wiki_page_tags wpt
     JOIN tags t ON t.id = wpt.tag_id
     WHERE wpt.wiki_page_id IN (${placeholders})
     ORDER BY t.name ASC`,
    pageIds,
  );
  for (const r of rows) {
    const list = map.get(r.wiki_page_id) ?? [];
    list.push(rowToTag(r));
    map.set(r.wiki_page_id, list);
  }
  return map;
}

function rowToPage(row: WikiPageRow, tags: Tag[]): WikiPage {
  return {
    id: row.id,
    channelId: row.channel_id,
    title: row.title,
    content: row.content,
    createdBy: row.created_by,
    createdByUsername: row.created_by_username,
    updatedBy: row.updated_by,
    updatedByUsername: row.updated_by_username,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tags,
  };
}

function rowToSummary(row: WikiPageRow, tags: Tag[]): WikiPageSummary {
  return {
    id: row.id,
    channelId: row.channel_id,
    title: row.title,
    createdBy: row.created_by,
    createdByUsername: row.created_by_username,
    updatedBy: row.updated_by,
    updatedByUsername: row.updated_by_username,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tags,
  };
}

async function assertTagsExist(tagIds: number[]): Promise<void> {
  if (tagIds.length === 0) return;
  const unique = Array.from(new Set(tagIds));
  const placeholders = unique.map((_, i) => `$${i + 1}`).join(', ');
  const rows = await query<{ id: number }>(
    `SELECT id FROM tags WHERE id IN (${placeholders})`,
    unique,
  );
  if (rows.length !== unique.length) {
    throw createError('指定されたタグが存在しません', 400);
  }
}

async function replaceTags(pageId: number, tagIds: number[], userId: number): Promise<void> {
  await execute(`DELETE FROM wiki_page_tags WHERE wiki_page_id = $1`, [pageId]);
  if (tagIds.length === 0) return;
  const unique = Array.from(new Set(tagIds));
  for (const tagId of unique) {
    await execute(
      `INSERT INTO wiki_page_tags (wiki_page_id, tag_id, created_by) VALUES ($1, $2, $3)`,
      [pageId, tagId, userId],
    );
  }
}

export async function createWikiPage(
  channelId: number,
  userId: number,
  input: CreateWikiPageInput,
): Promise<WikiPage> {
  const title = (input.title ?? '').trim();
  if (title.length === 0) {
    throw createError('タイトルは空にできません', 400);
  }
  const content = input.content ?? '';
  const tagIds = input.tagIds ?? [];

  const channel = await queryOne<{ id: number }>(`SELECT id FROM channels WHERE id = $1`, [
    channelId,
  ]);
  if (!channel) {
    throw createError('チャンネルが見つかりません', 404);
  }

  await assertTagsExist(tagIds);

  const inserted = await queryOne<{ id: number }>(
    `INSERT INTO wiki_pages (channel_id, title, content, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $4) RETURNING id`,
    [channelId, title, content, userId],
  );
  if (!inserted) {
    throw createError('Wikiページの作成に失敗しました', 500);
  }
  await replaceTags(inserted.id, tagIds, userId);

  const page = await getWikiPage(inserted.id);
  if (!page) {
    throw createError('Wikiページの取得に失敗しました', 500);
  }
  return page;
}

export async function getWikiPage(id: number): Promise<WikiPage | null> {
  const row = await queryOne<WikiPageRow>(`${BASE_SELECT} WHERE w.id = $1`, [id]);
  if (!row) return null;
  const tags = await loadTagsForPage(row.id);
  return rowToPage(row, tags);
}

export async function listWikiPages(channelId: number, q?: string): Promise<WikiPageSummary[]> {
  const params: unknown[] = [channelId];
  let where = `WHERE w.channel_id = $1`;
  if (q && q.trim().length > 0) {
    params.push(`%${q.trim()}%`);
    where += ` AND (w.title ILIKE $${params.length} OR w.content ILIKE $${params.length})`;
  }
  const rows = await query<WikiPageRow>(
    `${BASE_SELECT} ${where} ORDER BY w.updated_at DESC`,
    params,
  );
  const tagMap = await loadTagsForPages(rows.map((r) => r.id));
  return rows.map((r) => rowToSummary(r, tagMap.get(r.id) ?? []));
}

export async function updateWikiPage(
  id: number,
  userId: number,
  input: UpdateWikiPageInput,
): Promise<WikiPage> {
  const existing = await queryOne<WikiPageRow>(`${BASE_SELECT} WHERE w.id = $1`, [id]);
  if (!existing) {
    throw createError('Wikiページが見つかりません', 404);
  }

  const currentUpdatedAtIso = new Date(existing.updated_at).toISOString();
  const expectedIso = new Date(input.expectedUpdatedAt).toISOString();
  if (currentUpdatedAtIso !== expectedIso) {
    throw createError('他のユーザーによる更新と競合しました', 409);
  }

  const newTitle = input.title !== undefined ? input.title.trim() : existing.title;
  if (newTitle.length === 0) {
    throw createError('タイトルは空にできません', 400);
  }
  const newContent = input.content !== undefined ? input.content : existing.content;

  if (input.tagIds !== undefined) {
    await assertTagsExist(input.tagIds);
  }

  await execute(
    `UPDATE wiki_pages
     SET title = $1, content = $2, updated_by = $3, updated_at = NOW()
     WHERE id = $4`,
    [newTitle, newContent, userId, id],
  );

  if (input.tagIds !== undefined) {
    await replaceTags(id, input.tagIds, userId);
  }

  const updated = await getWikiPage(id);
  if (!updated) {
    throw createError('Wikiページの取得に失敗しました', 500);
  }
  return updated;
}

export async function deleteWikiPage(id: number): Promise<void> {
  const result = await execute(`DELETE FROM wiki_pages WHERE id = $1`, [id]);
  if (result.rowCount === 0) {
    throw createError('Wikiページが見つかりません', 404);
  }
}

interface AuthContext {
  userId: number;
  userRole: string;
}

interface PageAuthInfo {
  pageId: number;
  channelId: number;
  pageCreatedBy: number | null;
  channelCreatedBy: number | null;
}

export async function loadPageAuthInfo(id: number): Promise<PageAuthInfo | null> {
  const row = await queryOne<{
    id: number;
    channel_id: number;
    created_by: number | null;
    channel_created_by: number | null;
  }>(
    `SELECT w.id, w.channel_id, w.created_by, c.created_by AS channel_created_by
     FROM wiki_pages w JOIN channels c ON c.id = w.channel_id
     WHERE w.id = $1`,
    [id],
  );
  if (!row) return null;
  return {
    pageId: row.id,
    channelId: row.channel_id,
    pageCreatedBy: row.created_by,
    channelCreatedBy: row.channel_created_by,
  };
}

export function canEdit(info: PageAuthInfo, auth: AuthContext): boolean {
  if (auth.userRole === 'admin') return true;
  if (info.pageCreatedBy === auth.userId) return true;
  if (info.channelCreatedBy === auth.userId) return true;
  return false;
}

export function canDelete(info: PageAuthInfo, auth: AuthContext): boolean {
  if (auth.userRole === 'admin') return true;
  if (info.channelCreatedBy === auth.userId) return true;
  return false;
}

export async function isChannelMember(channelId: number, userId: number): Promise<boolean> {
  const row = await queryOne<{ user_id: number }>(
    `SELECT user_id FROM channel_members WHERE channel_id = $1 AND user_id = $2`,
    [channelId, userId],
  );
  return row !== null;
}
