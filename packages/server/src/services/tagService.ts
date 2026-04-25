import { query, queryOne, execute } from '../db/database';
import { Tag, TagSuggestion } from '@chat-app/shared';
import { createError } from '../middleware/errorHandler';

// ---------------------------------------------------------------------------
// 正規化・バリデーション
// ---------------------------------------------------------------------------

/** タグ名を正規化する（前後空白除去・小文字化）。exportしてユニットテストで直接検証可能にする。 */
export function normalizeTagName(name: string): string {
  return name.trim().toLowerCase();
}

/** タグ名バリデーション。違反時は HttpError を throw する。 */
export function validateTagName(name: string): void {
  if (!name || name.trim().length === 0) {
    throw createError('タグ名は空にできません', 400);
  }
  if (name.length > 50) {
    throw createError('タグ名は 50 文字以内にしてください', 400);
  }
  if (name.includes('#')) {
    throw createError('タグ名に # を含めることはできません', 400);
  }
  if (/\s/.test(name)) {
    throw createError('タグ名に空白文字を含めることはできません', 400);
  }
}

// ---------------------------------------------------------------------------
// findOrCreate
// ---------------------------------------------------------------------------

/**
 * 正規化済み名前でタグを検索し、なければ INSERT して ID を返す。
 * 並行 INSERT による UNIQUE 違反は ON CONFLICT で吸収する。
 */
export async function findOrCreate(rawName: string, userId?: number): Promise<Tag> {
  validateTagName(rawName);
  const name = normalizeTagName(rawName);

  const result = await queryOne<{
    id: number;
    name: string;
    use_count: number;
    created_at: string;
  }>(
    `INSERT INTO tags (name, created_by) VALUES ($1, $2)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id, name, use_count, created_at`,
    [name, userId ?? null],
  );

  return {
    id: result!.id,
    name: result!.name,
    useCount: result!.use_count,
    createdAt: result!.created_at,
  };
}

// ---------------------------------------------------------------------------
// listSuggestions
// ---------------------------------------------------------------------------

/** use_count 降順、同値は name 昇順でタグ候補を返す。prefix は前方一致（大文字小文字無視）。 */
export async function listSuggestions(prefix = '', limit = 10): Promise<TagSuggestion[]> {
  const normalizedPrefix = prefix.toLowerCase();
  const rows = await query<{ id: number; name: string; use_count: number }>(
    `SELECT id, name, use_count FROM tags
     WHERE ($1 = '' OR name LIKE $2)
     ORDER BY use_count DESC, name ASC
     LIMIT $3`,
    [normalizedPrefix, `${normalizedPrefix}%`, limit],
  );
  return rows.map((r) => ({ id: r.id, name: r.name, useCount: r.use_count }));
}

// ---------------------------------------------------------------------------
// メッセージへの付与・解除
// ---------------------------------------------------------------------------

/**
 * メッセージにタグを付与する。
 * - チャンネルメンバーチェックを行う
 * - ON CONFLICT DO NOTHING で重複付与を防ぐ
 * - 新規付与時のみ use_count を +1
 */
export async function attachToMessage(
  messageId: number,
  tagIds: number[],
  userId: number,
): Promise<void> {
  if (tagIds.length === 0) return;

  // メッセージ存在確認 & チャンネル取得（is_private も含めて JOIN）
  const msg = await queryOne<{ channel_id: number; is_private: boolean }>(
    `SELECT m.channel_id, c.is_private
     FROM messages m
     JOIN channels c ON c.id = m.channel_id
     WHERE m.id = $1 AND m.is_deleted = false`,
    [messageId],
  );
  if (!msg) throw createError('メッセージが見つかりません', 404);

  // チャンネルメンバーチェック: プライベートチャンネルのみメンバー限定
  // パブリックチャンネル (is_private=false) は全認証ユーザーにタグ付与を許可する
  if (msg.is_private) {
    const member = await queryOne<{ user_id: number }>(
      'SELECT user_id FROM channel_members WHERE channel_id = $1 AND user_id = $2',
      [msg.channel_id, userId],
    );
    if (!member) throw createError('チャンネルメンバーのみタグを付与できます', 403);
  }

  for (const tagId of tagIds) {
    const res = await execute(
      `INSERT INTO message_tags (message_id, tag_id, created_by)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [messageId, tagId, userId],
    );
    // 実際に INSERT された行のみ use_count を増やす
    if (res.rowCount > 0) {
      await execute('UPDATE tags SET use_count = use_count + 1 WHERE id = $1', [tagId]);
    }
  }
}

/**
 * メッセージからタグを解除する。
 * - 付与されていない場合は silent に無視（エラーなし）
 * - use_count は 0 未満にならないようガードする
 */
export async function detachFromMessage(messageId: number, tagIds: number[]): Promise<void> {
  if (tagIds.length === 0) return;

  for (const tagId of tagIds) {
    const res = await execute('DELETE FROM message_tags WHERE message_id = $1 AND tag_id = $2', [
      messageId,
      tagId,
    ]);
    if (res.rowCount > 0) {
      await execute('UPDATE tags SET use_count = GREATEST(0, use_count - 1) WHERE id = $1', [
        tagId,
      ]);
    }
  }
}

// ---------------------------------------------------------------------------
// チャンネルへの付与・解除
// ---------------------------------------------------------------------------

export async function attachToChannel(channelId: number, tagIds: number[]): Promise<void> {
  if (tagIds.length === 0) return;

  for (const tagId of tagIds) {
    const res = await execute(
      `INSERT INTO channel_tags (channel_id, tag_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [channelId, tagId],
    );
    if (res.rowCount > 0) {
      await execute('UPDATE tags SET use_count = use_count + 1 WHERE id = $1', [tagId]);
    }
  }
}

export async function detachFromChannel(channelId: number, tagIds: number[]): Promise<void> {
  if (tagIds.length === 0) return;

  for (const tagId of tagIds) {
    const res = await execute('DELETE FROM channel_tags WHERE channel_id = $1 AND tag_id = $2', [
      channelId,
      tagId,
    ]);
    if (res.rowCount > 0) {
      await execute('UPDATE tags SET use_count = GREATEST(0, use_count - 1) WHERE id = $1', [
        tagId,
      ]);
    }
  }
}

// ---------------------------------------------------------------------------
// bulk fetch（N+1 回避）
// ---------------------------------------------------------------------------

/** 複数メッセージ ID に紐づくタグを 1 クエリで取得し、messageId → Tag[] のマップで返す。 */
export async function getForMessages(messageIds: number[]): Promise<Map<number, Tag[]>> {
  const result = new Map<number, Tag[]>();
  for (const id of messageIds) {
    result.set(id, []);
  }

  if (messageIds.length === 0) return result;

  const rows = await query<{
    message_id: number;
    tag_id: number;
    name: string;
    use_count: number;
    created_at: string;
  }>(
    `SELECT mt.message_id, t.id AS tag_id, t.name, t.use_count, t.created_at
     FROM message_tags mt
     JOIN tags t ON mt.tag_id = t.id
     WHERE mt.message_id = ANY($1::int[])
     ORDER BY mt.message_id, t.use_count DESC, t.name ASC`,
    [messageIds],
  );

  for (const row of rows) {
    const tags = result.get(row.message_id) ?? [];
    tags.push({
      id: row.tag_id,
      name: row.name,
      useCount: row.use_count,
      createdAt: row.created_at,
    });
    result.set(row.message_id, tags);
  }

  return result;
}

/** チャンネルに紐づくタグ一覧を返す。 */
export async function getForChannel(channelId: number): Promise<Tag[]> {
  const rows = await query<{
    id: number;
    name: string;
    use_count: number;
    created_at: string;
  }>(
    `SELECT t.id, t.name, t.use_count, t.created_at
     FROM channel_tags ct
     JOIN tags t ON ct.tag_id = t.id
     WHERE ct.channel_id = $1
     ORDER BY t.use_count DESC, t.name ASC`,
    [channelId],
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    useCount: r.use_count,
    createdAt: r.created_at,
  }));
}
