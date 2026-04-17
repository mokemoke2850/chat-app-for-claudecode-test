import { query, queryOne, execute } from '../db/database';
import type { PinnedMessage, Message } from '@chat-app/shared';

interface PinnedMessageRow {
  id: number;
  message_id: number;
  channel_id: number;
  pinned_by: number;
  pinned_at: string;
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
  pinned_by_username: string | null;
  pinned_by_avatar_url: string | null;
}

function toIsoString(val: unknown): string {
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

function rowToPinnedMessage(row: PinnedMessageRow): PinnedMessage {
  const pm: PinnedMessage = {
    id: row.id,
    messageId: row.message_id,
    channelId: row.channel_id,
    pinnedBy: row.pinned_by,
    pinnedAt: toIsoString(row.pinned_at),
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
      createdAt: toIsoString(row.msg_created_at),
      updatedAt: toIsoString(row.msg_updated_at),
      mentions: [],
      reactions: [],
      parentMessageId: null,
      rootMessageId: null,
      replyCount: 0,
      quotedMessageId: null,
      quotedMessage: null,
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

export async function pinMessage(messageId: number, channelId: number, pinnedBy: number): Promise<PinnedMessage> {
  const msg = await queryOne<{ id: number; is_deleted: boolean }>(
    'SELECT id, is_deleted FROM messages WHERE id = $1',
    [messageId],
  );
  if (!msg) {
    throw new Error('Message not found');
  }
  if (msg.is_deleted) {
    throw new Error('Cannot pin a deleted message');
  }

  try {
    const result = await queryOne<{ id: number }>(
      'INSERT INTO pinned_messages (message_id, channel_id, pinned_by) VALUES ($1, $2, $3) RETURNING id',
      [messageId, channelId, pinnedBy],
    );

    const row = await queryOne<PinnedMessageRow>(
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
      WHERE pm.id = $1`,
      [result!.id],
    );

    return rowToPinnedMessage(row!);
  } catch (err: unknown) {
    const error = err as { code?: string };
    if (error.code === '23505') {
      throw new Error('Message is already pinned in this channel');
    }
    throw err;
  }
}

export async function unpinMessage(messageId: number, channelId: number): Promise<void> {
  const msg = await queryOne('SELECT id FROM messages WHERE id = $1', [messageId]);
  if (!msg) {
    throw new Error('Message not found');
  }

  const result = await execute(
    'DELETE FROM pinned_messages WHERE message_id = $1 AND channel_id = $2',
    [messageId, channelId],
  );

  if (result.rowCount === 0) {
    throw new Error('Pin not found');
  }
}

export async function getPinnedMessages(channelId: number): Promise<PinnedMessage[]> {
  const rows = await query<PinnedMessageRow>(
    `SELECT
      pm.id, pm.message_id, pm.channel_id, pm.pinned_by, pm.pinned_at,
      m.id AS msg_id, m.channel_id AS msg_channel_id, m.user_id AS msg_user_id,
      u.username AS msg_username, u.avatar_url AS msg_avatar_url,
      m.content AS msg_content, m.is_edited AS msg_is_edited, m.is_deleted AS msg_is_deleted,
      m.created_at AS msg_created_at, m.updated_at AS msg_updated_at,
      pu.username AS pinned_by_username, pu.avatar_url AS pinned_by_avatar_url
    FROM pinned_messages pm
    LEFT JOIN messages m ON m.id = pm.message_id AND m.is_deleted = false
    LEFT JOIN users u ON u.id = m.user_id
    LEFT JOIN users pu ON pu.id = pm.pinned_by
    WHERE pm.channel_id = $1
      AND m.id IS NOT NULL
    ORDER BY pm.pinned_at DESC`,
    [channelId],
  );

  return rows.map(rowToPinnedMessage);
}
