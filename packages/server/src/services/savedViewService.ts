import { query, queryOne, execute } from '../db/database';
import type { SavedView, SavedViewQuery } from '@chat-app/shared';

interface SavedViewRow {
  id: number;
  user_id: number;
  name: string;
  query: SavedViewQuery;
  position: number;
  created_at: string;
  updated_at: string;
}

function toSavedView(row: SavedViewRow): SavedView {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    query: row.query,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * 指定ユーザーの保存ビュー一覧を position 昇順で取得する
 */
export async function getSavedViews(userId: number): Promise<SavedView[]> {
  const rows = await query<SavedViewRow>(
    'SELECT id, user_id, name, query, position, created_at, updated_at FROM saved_views WHERE user_id = $1 ORDER BY position ASC, id ASC',
    [userId],
  );
  return rows.map(toSavedView);
}

/**
 * 保存ビューを作成する
 */
export async function createSavedView(
  userId: number,
  name: string,
  savedQuery: SavedViewQuery,
): Promise<SavedView> {
  const row = await queryOne<SavedViewRow>(
    `INSERT INTO saved_views (user_id, name, query, position)
     VALUES ($1, $2, $3, 0)
     RETURNING id, user_id, name, query, position, created_at, updated_at`,
    [userId, name, JSON.stringify(savedQuery)],
  );
  if (!row) throw new Error('保存ビューの作成に失敗しました');
  return toSavedView(row);
}

/**
 * 保存ビューを更新する
 * 自分以外の保存ビューを更新しようとするとエラーになる
 * 存在しない id はエラーになる
 */
export async function updateSavedView(
  userId: number,
  viewId: number,
  updates: { name?: string; query?: SavedViewQuery },
): Promise<SavedView> {
  // 存在確認と所有者確認
  const existing = await queryOne<SavedViewRow>(
    'SELECT id, user_id, name, query, position, created_at, updated_at FROM saved_views WHERE id = $1',
    [viewId],
  );
  if (!existing) throw new Error('保存ビューが見つかりません');
  if (existing.user_id !== userId) throw new Error('他ユーザーの保存ビューは更新できません');

  const newName = updates.name !== undefined ? updates.name : existing.name;
  const newQuery = updates.query !== undefined ? updates.query : existing.query;

  const row = await queryOne<SavedViewRow>(
    `UPDATE saved_views
     SET name = $1, query = $2, updated_at = NOW()
     WHERE id = $3 AND user_id = $4
     RETURNING id, user_id, name, query, position, created_at, updated_at`,
    [newName, JSON.stringify(newQuery), viewId, userId],
  );
  if (!row) throw new Error('保存ビューの更新に失敗しました');
  return toSavedView(row);
}

/**
 * 保存ビューを削除する
 * 自分以外の保存ビューを削除しようとするとエラーになる
 * 存在しない id はエラーになる
 */
export async function deleteSavedView(userId: number, viewId: number): Promise<void> {
  const existing = await queryOne<{ id: number; user_id: number }>(
    'SELECT id, user_id FROM saved_views WHERE id = $1',
    [viewId],
  );
  if (!existing) throw new Error('保存ビューが見つかりません');
  if (existing.user_id !== userId) throw new Error('他ユーザーの保存ビューは削除できません');

  await execute('DELETE FROM saved_views WHERE id = $1 AND user_id = $2', [viewId, userId]);
}

/**
 * 保存ビューの順序を id 配列で指定して並べ替える
 * 自分の保存ビューのみ並べ替えでき、他ユーザーの id が含まれるとエラー
 */
export async function reorderSavedViews(userId: number, orderedIds: number[]): Promise<void> {
  if (orderedIds.length === 0) return;

  // 全 id が自分のものかチェック
  // pg-mem との互換性のため ANY($1::int[]) ではなく IN (…) で動的プレースホルダーを生成
  const placeholders = orderedIds.map((_, i) => `$${i + 1}`).join(', ');
  const rows = await query<{ id: number; user_id: number }>(
    `SELECT id, user_id FROM saved_views WHERE id IN (${placeholders})`,
    orderedIds,
  );

  for (const row of rows) {
    if (row.user_id !== userId) {
      throw new Error('他ユーザーの保存ビューは並べ替えできません');
    }
  }

  // 見つかった数が指定 id 数と一致しない（存在しない id が含まれる）場合もエラー
  if (rows.length !== orderedIds.length) {
    throw new Error('指定された保存ビューが見つかりません');
  }

  // position を更新
  for (let i = 0; i < orderedIds.length; i++) {
    await execute('UPDATE saved_views SET position = $1, updated_at = NOW() WHERE id = $2', [
      i,
      orderedIds[i],
    ]);
  }
}
