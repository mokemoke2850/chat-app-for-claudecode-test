import { query, queryOne, execute } from '../db/database';
import type { ChannelCategory } from '@chat-app/shared';

interface CategoryRow {
  id: number;
  user_id: number;
  name: string;
  position: number;
  is_collapsed: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

function toIsoString(val: unknown): string {
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

function rowToCategory(row: CategoryRow, channelIds?: number[]): ChannelCategory {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    position: row.position,
    isCollapsed: row.is_collapsed,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
    channelIds,
  };
}

/**
 * ユーザーのカテゴリ一覧をチャンネルID割当込みで返す
 */
export async function getCategoriesForUser(userId: number): Promise<ChannelCategory[]> {
  const rows = await query<CategoryRow>(
    `SELECT id, user_id, name, position, is_collapsed, created_at, updated_at
     FROM channel_categories
     WHERE user_id = $1
     ORDER BY position ASC, id ASC`,
    [userId],
  );

  if (rows.length === 0) return [];

  // 割当情報を一括取得
  const categoryIds = rows.map((r) => r.id);
  const assignRows = await query<{ category_id: number; channel_id: number }>(
    `SELECT category_id, channel_id
     FROM channel_category_assignments
     WHERE user_id = $1 AND category_id = ANY($2::int[])`,
    [userId, categoryIds],
  );

  // categoryId → channelIds のマップを構築
  const assignMap = new Map<number, number[]>();
  for (const ar of assignRows) {
    const existing = assignMap.get(ar.category_id) ?? [];
    existing.push(ar.channel_id);
    assignMap.set(ar.category_id, existing);
  }

  return rows.map((row) => rowToCategory(row, assignMap.get(row.id) ?? []));
}

/**
 * カテゴリを作成する
 */
export async function createCategory(
  userId: number,
  name: string,
  position?: number,
): Promise<ChannelCategory> {
  if (!name || name.trim() === '') {
    throw new Error('Category name is required');
  }

  // position が未指定の場合は末尾に追加
  let pos = position;
  if (pos === undefined) {
    const maxRow = await queryOne<{ max: number | null }>(
      'SELECT MAX(position) as max FROM channel_categories WHERE user_id = $1',
      [userId],
    );
    pos = (maxRow?.max ?? -1) + 1;
  }

  try {
    const result = await queryOne<CategoryRow>(
      `INSERT INTO channel_categories (user_id, name, position)
       VALUES ($1, $2, $3)
       RETURNING id, user_id, name, position, is_collapsed, created_at, updated_at`,
      [userId, name.trim(), pos],
    );
    return rowToCategory(result!, []);
  } catch (err: unknown) {
    const error = err as { code?: string };
    if (error.code === '23505') {
      throw new Error('Category name already exists');
    }
    throw err;
  }
}

/**
 * カテゴリを更新する
 */
export async function updateCategory(
  userId: number,
  categoryId: number,
  data: { name?: string; position?: number; isCollapsed?: boolean },
): Promise<ChannelCategory> {
  const existing = await queryOne<CategoryRow>(
    'SELECT id, user_id, name, position, is_collapsed, created_at, updated_at FROM channel_categories WHERE id = $1',
    [categoryId],
  );

  if (!existing) {
    throw new Error('Category not found');
  }
  if (existing.user_id !== userId) {
    throw new Error('Forbidden');
  }

  const updatedName = data.name !== undefined ? data.name.trim() : existing.name;
  const updatedPosition = data.position !== undefined ? data.position : existing.position;
  const updatedCollapsed = data.isCollapsed !== undefined ? data.isCollapsed : existing.is_collapsed;

  const result = await queryOne<CategoryRow>(
    `UPDATE channel_categories
     SET name = $1, position = $2, is_collapsed = $3, updated_at = NOW()
     WHERE id = $4
     RETURNING id, user_id, name, position, is_collapsed, created_at, updated_at`,
    [updatedName, updatedPosition, updatedCollapsed, categoryId],
  );

  // 更新後の割当チャンネルIDを取得
  const assignRows = await query<{ channel_id: number }>(
    'SELECT channel_id FROM channel_category_assignments WHERE user_id = $1 AND category_id = $2',
    [userId, categoryId],
  );

  return rowToCategory(result!, assignRows.map((r) => r.channel_id));
}

/**
 * カテゴリを削除する（割当は CASCADE で自動削除）
 */
export async function deleteCategory(userId: number, categoryId: number): Promise<void> {
  const existing = await queryOne<{ id: number; user_id: number }>(
    'SELECT id, user_id FROM channel_categories WHERE id = $1',
    [categoryId],
  );

  if (!existing) {
    throw new Error('Category not found');
  }
  if (existing.user_id !== userId) {
    throw new Error('Forbidden');
  }

  await execute('DELETE FROM channel_categories WHERE id = $1', [categoryId]);
}

/**
 * カテゴリの並び順を一括更新する
 */
export async function reorderCategories(userId: number, categoryIds: number[]): Promise<void> {
  if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
    throw new Error('Invalid category_ids');
  }

  // ユーザーのカテゴリ一覧を取得してバリデーション
  const userCategories = await query<{ id: number }>(
    'SELECT id FROM channel_categories WHERE user_id = $1',
    [userId],
  );
  const userCategoryIds = new Set(userCategories.map((r) => r.id));

  for (const id of categoryIds) {
    if (!userCategoryIds.has(id)) {
      throw new Error('Invalid category_ids: contains unknown or other user category');
    }
  }

  if (categoryIds.length !== userCategoryIds.size) {
    throw new Error('Invalid category_ids: must include all categories');
  }

  // 一括更新
  for (let i = 0; i < categoryIds.length; i++) {
    await execute(
      'UPDATE channel_categories SET position = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3',
      [i, categoryIds[i], userId],
    );
  }
}

/**
 * チャンネルをカテゴリに割り当てる
 */
export async function assignChannelToCategory(
  userId: number,
  channelId: number,
  categoryId: number,
): Promise<void> {
  // チャンネルの存在確認
  const channel = await queryOne<{ id: number }>(
    'SELECT id FROM channels WHERE id = $1',
    [channelId],
  );
  if (!channel) {
    throw new Error('Channel not found');
  }

  // カテゴリの存在・所有権確認
  const category = await queryOne<{ id: number; user_id: number }>(
    'SELECT id, user_id FROM channel_categories WHERE id = $1',
    [categoryId],
  );
  if (!category) {
    throw new Error('Category not found');
  }
  if (category.user_id !== userId) {
    throw new Error('Forbidden');
  }

  // UPSERT（既存割当があれば上書き）
  await execute(
    `INSERT INTO channel_category_assignments (user_id, channel_id, category_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, channel_id) DO UPDATE SET category_id = EXCLUDED.category_id`,
    [userId, channelId, categoryId],
  );
}

/**
 * チャンネルのカテゴリ割当を解除する（「その他」に戻す）
 */
export async function unassignChannelFromCategory(
  userId: number,
  channelId: number,
): Promise<void> {
  const result = await execute(
    'DELETE FROM channel_category_assignments WHERE user_id = $1 AND channel_id = $2',
    [userId, channelId],
  );
  if (result.rowCount === 0) {
    throw new Error('Assignment not found');
  }
}

/**
 * ユーザーのチャンネル一覧をカテゴリID情報付きで返す
 */
export async function getChannelsWithCategory(
  userId: number,
): Promise<{ channelId: number; categoryId: number | null }[]> {
  const channelRows = await query<{ id: number }>(
    'SELECT id FROM channels WHERE is_archived = false ORDER BY name ASC',
    [],
  );

  if (channelRows.length === 0) return [];

  const assignRows = await query<{ channel_id: number; category_id: number }>(
    'SELECT channel_id, category_id FROM channel_category_assignments WHERE user_id = $1',
    [userId],
  );

  const assignMap = new Map<number, number>();
  for (const ar of assignRows) {
    assignMap.set(ar.channel_id, ar.category_id);
  }

  return channelRows.map((row) => ({
    channelId: row.id,
    categoryId: assignMap.get(row.id) ?? null,
  }));
}
