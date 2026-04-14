import { getDatabase } from '../db/database';
import type { PinnedMessage, Message } from '@chat-app/shared';

interface PinnedMessageRow {
  id: number;
  message_id: number;
  channel_id: number;
  pinned_by: number;
  pinned_at: string;
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
  // ピン留めユーザー情報（JOIN結果）
  pinned_by_username: string | null;
  pinned_by_avatar_url: string | null;
}

function rowToPinnedMessage(row: PinnedMessageRow): PinnedMessage {
  const pm: PinnedMessage = {
    id: row.id,
    messageId: row.message_id,
    channelId: row.channel_id,
    pinnedBy: row.pinned_by,
    pinnedAt: row.pinned_at,
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
    pm.message = message;
  }

  if (row.pinned_by_username !== null) {
    pm.pinnedByUser = {
      id: row.pinned_by,
      username: row.pinned_by_username,
      email: '',
      avatarUrl: row.pinned_by_avatar_url,
      displayName: null,
      location: null,
      createdAt: '',
      role: 'user',
      isActive: true,
    };
  }

  return pm;
}

/**
 * メッセージをピン留めする
 * 削除済みメッセージはピン留め不可
 * 同一 (message_id, channel_id) の重複はエラー
 */
export function pinMessage(messageId: number, channelId: number, pinnedBy: number): PinnedMessage {
  const db = getDatabase();

  // メッセージの存在確認
  const msg = db.prepare('SELECT id, is_deleted FROM messages WHERE id = ?').get(messageId) as
    | { id: number; is_deleted: number }
    | undefined;
  if (!msg) {
    throw new Error('Message not found');
  }
  if (msg.is_deleted === 1) {
    throw new Error('Cannot pin a deleted message');
  }

  try {
    const result = db
      .prepare(
        'INSERT INTO pinned_messages (message_id, channel_id, pinned_by) VALUES (?, ?, ?)',
      )
      .run(messageId, channelId, pinnedBy);

    const row = db
      .prepare(
        `SELECT
          pm.id, pm.message_id, pm.channel_id, pm.pinned_by, pm.pinned_at,
          m.id AS msg_id, m.channel_id AS msg_channel_id, m.user_id AS msg_user_id,
          u.username AS msg_username, u.avatar_url AS msg_avatar_url,
          m.content AS msg_content, m.is_edited AS msg_is_edited, m.is_deleted AS msg_is_deleted,
          m.created_at AS msg_created_at, m.updated_at AS msg_updated_at,
          pu.username AS pinned_by_username, pu.avatar_url AS pinned_by_avatar_url
        FROM pinned_messages pm
        LEFT JOIN messages m ON m.id = pm.message_id
        LEFT JOIN users u ON u.id = m.user_id
        LEFT JOIN users pu ON pu.id = pm.pinned_by
        WHERE pm.id = ?`,
      )
      .get(result.lastInsertRowid) as PinnedMessageRow;

    return rowToPinnedMessage(row);
  } catch (err: unknown) {
    const error = err as { code?: string };
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new Error('Message is already pinned in this channel');
    }
    throw err;
  }
}

/**
 * ピン留めを解除する
 */
export function unpinMessage(messageId: number, channelId: number): void {
  const db = getDatabase();

  // メッセージの存在確認
  const msg = db.prepare('SELECT id FROM messages WHERE id = ?').get(messageId);
  if (!msg) {
    throw new Error('Message not found');
  }

  const result = db
    .prepare('DELETE FROM pinned_messages WHERE message_id = ? AND channel_id = ?')
    .run(messageId, channelId);

  if (result.changes === 0) {
    throw new Error('Pin not found');
  }
}

/**
 * チャンネルのピン留めメッセージ一覧を取得する
 * 削除済みメッセージは除外し、pinned_at DESC で返す
 */
export function getPinnedMessages(channelId: number): PinnedMessage[] {
  const db = getDatabase();

  const rows = db
    .prepare(
      `SELECT
        pm.id, pm.message_id, pm.channel_id, pm.pinned_by, pm.pinned_at,
        m.id AS msg_id, m.channel_id AS msg_channel_id, m.user_id AS msg_user_id,
        u.username AS msg_username, u.avatar_url AS msg_avatar_url,
        m.content AS msg_content, m.is_edited AS msg_is_edited, m.is_deleted AS msg_is_deleted,
        m.created_at AS msg_created_at, m.updated_at AS msg_updated_at,
        pu.username AS pinned_by_username, pu.avatar_url AS pinned_by_avatar_url
      FROM pinned_messages pm
      LEFT JOIN messages m ON m.id = pm.message_id AND m.is_deleted = 0
      LEFT JOIN users u ON u.id = m.user_id
      LEFT JOIN users pu ON pu.id = pm.pinned_by
      WHERE pm.channel_id = ?
        AND m.id IS NOT NULL
      ORDER BY pm.pinned_at DESC`,
    )
    .all(channelId) as PinnedMessageRow[];

  return rows.map(rowToPinnedMessage);
}
