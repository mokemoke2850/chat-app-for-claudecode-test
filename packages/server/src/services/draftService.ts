import { query, queryOne, execute } from '../db/database';
import type { Draft } from '@chat-app/shared';

interface DraftRow {
  id: number;
  user_id: number;
  channel_id: number | null;
  dm_conversation_id: number | null;
  content: string;
  updated_at: string;
}

function toDraft(row: DraftRow): Draft {
  return {
    id: row.id,
    userId: row.user_id,
    channelId: row.channel_id,
    dmConversationId: row.dm_conversation_id,
    content: row.content,
    updatedAt: row.updated_at,
  };
}

/**
 * 指定ユーザーの全下書きを取得する
 */
export async function getDraftsByUser(userId: number): Promise<Draft[]> {
  const rows = await query<DraftRow>(
    'SELECT id, user_id, channel_id, dm_conversation_id, content, updated_at FROM drafts WHERE user_id = $1 ORDER BY updated_at DESC',
    [userId],
  );
  return rows.map(toDraft);
}

/**
 * チャンネル下書きを保存（upsert）する。
 * content が空文字列の場合は下書きを削除する。
 */
export async function upsertChannelDraft(
  userId: number,
  channelId: number,
  content: string,
): Promise<Draft | null> {
  if (content.trim() === '') {
    await deleteChannelDraft(userId, channelId);
    return null;
  }

  const existing = await queryOne<DraftRow>(
    'SELECT id, user_id, channel_id, dm_conversation_id, content, updated_at FROM drafts WHERE user_id = $1 AND channel_id = $2',
    [userId, channelId],
  );

  let row: DraftRow | null;
  if (existing) {
    row = await queryOne<DraftRow>(
      'UPDATE drafts SET content = $1, updated_at = NOW() WHERE id = $2 RETURNING id, user_id, channel_id, dm_conversation_id, content, updated_at',
      [content, existing.id],
    );
  } else {
    row = await queryOne<DraftRow>(
      'INSERT INTO drafts (user_id, channel_id, content, updated_at) VALUES ($1, $2, $3, NOW()) RETURNING id, user_id, channel_id, dm_conversation_id, content, updated_at',
      [userId, channelId, content],
    );
  }
  return row ? toDraft(row) : null;
}

/**
 * DM下書きを保存（upsert）する。
 * content が空文字列の場合は下書きを削除する。
 */
export async function upsertDmDraft(
  userId: number,
  conversationId: number,
  content: string,
): Promise<Draft | null> {
  if (content.trim() === '') {
    await deleteDmDraft(userId, conversationId);
    return null;
  }

  const existing = await queryOne<DraftRow>(
    'SELECT id, user_id, channel_id, dm_conversation_id, content, updated_at FROM drafts WHERE user_id = $1 AND dm_conversation_id = $2',
    [userId, conversationId],
  );

  let row: DraftRow | null;
  if (existing) {
    row = await queryOne<DraftRow>(
      'UPDATE drafts SET content = $1, updated_at = NOW() WHERE id = $2 RETURNING id, user_id, channel_id, dm_conversation_id, content, updated_at',
      [content, existing.id],
    );
  } else {
    row = await queryOne<DraftRow>(
      'INSERT INTO drafts (user_id, dm_conversation_id, content, updated_at) VALUES ($1, $2, $3, NOW()) RETURNING id, user_id, channel_id, dm_conversation_id, content, updated_at',
      [userId, conversationId, content],
    );
  }
  return row ? toDraft(row) : null;
}

/**
 * チャンネル下書きを削除する。
 * 紐付く一時添付（draft_id）も CASCADE で削除される。
 */
export async function deleteChannelDraft(userId: number, channelId: number): Promise<void> {
  await execute('DELETE FROM drafts WHERE user_id = $1 AND channel_id = $2', [userId, channelId]);
}

/**
 * DM下書きを削除する。
 * 紐付く一時添付（draft_id）も CASCADE で削除される。
 */
export async function deleteDmDraft(userId: number, conversationId: number): Promise<void> {
  await execute('DELETE FROM drafts WHERE user_id = $1 AND dm_conversation_id = $2', [
    userId,
    conversationId,
  ]);
}

/**
 * 下書きIDで削除する（管理用）。
 */
export async function deleteDraft(draftId: number): Promise<void> {
  await execute('DELETE FROM drafts WHERE id = $1', [draftId]);
}
