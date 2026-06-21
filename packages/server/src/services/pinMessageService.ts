import { query, queryOne, execute } from '../db/database';
import { isChannelMember } from './permissionService';
import type { PinnedMessage, Message, PinCategory } from '@chat-app/shared';

const DEFAULT_CATEGORY_NAMES = ['決定事項', 'リンク', 'FAQ'] as const;

interface PinCategoryRow {
  id: number;
  channel_id: number;
  name: string;
  is_default: boolean;
  position: number;
}

interface PinnedMessageRow {
  id: number;
  message_id: number;
  channel_id: number;
  pinned_by: number;
  pinned_at: string;
  category_id: number | null;
  category_name: string | null;
  category_is_default: boolean | null;
  category_position: number | null;
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

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function rowToPinCategory(row: PinCategoryRow): PinCategory {
  return {
    id: row.id,
    channelId: row.channel_id,
    name: row.name,
    isDefault: row.is_default,
    position: row.position,
  };
}

function rowToPinnedMessage(row: PinnedMessageRow): PinnedMessage {
  const category =
    row.category_id === null
      ? null
      : {
          id: row.category_id,
          channelId: row.channel_id,
          name: row.category_name ?? '',
          isDefault: row.category_is_default === true,
          position: row.category_position ?? 0,
        };
  const pinned: PinnedMessage = {
    id: row.id,
    messageId: row.message_id,
    channelId: row.channel_id,
    pinnedBy: row.pinned_by,
    pinnedAt: toIsoString(row.pinned_at),
    categoryId: row.category_id,
    category,
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
    pinned.message = message;
  }

  if (row.pinned_by_username !== null) {
    pinned.pinnedByUser = {
      id: row.pinned_by,
      username: row.pinned_by_username,
      email: '',
      avatarUrl: row.pinned_by_avatar_url,
      displayName: null,
      location: null,
      createdAt: '',
      role: 'user',
      isActive: true,
      onboardingCompletedAt: null,
    };
  }
  return pinned;
}

const PIN_SELECT = `SELECT
  pm.id, pm.message_id, pm.channel_id, pm.pinned_by, pm.pinned_at, pm.category_id,
  pc.name AS category_name, pc.is_default AS category_is_default,
  pc.position AS category_position,
  m.id AS msg_id, m.channel_id AS msg_channel_id, m.user_id AS msg_user_id,
  u.username AS msg_username, u.avatar_url AS msg_avatar_url,
  m.content AS msg_content, m.is_edited AS msg_is_edited, m.is_deleted AS msg_is_deleted,
  m.created_at AS msg_created_at, m.updated_at AS msg_updated_at,
  pu.username AS pinned_by_username, pu.avatar_url AS pinned_by_avatar_url
FROM pinned_messages pm
LEFT JOIN pin_categories pc ON pc.id = pm.category_id
LEFT JOIN messages m ON m.id = pm.message_id AND m.is_deleted = false
LEFT JOIN users u ON u.id = m.user_id
LEFT JOIN users pu ON pu.id = pm.pinned_by`;

async function assertChannelAccess(channelId: number, userId: number): Promise<void> {
  const channel = await queryOne<{ is_private: boolean }>(
    'SELECT is_private FROM channels WHERE id = $1',
    [channelId],
  );
  if (!channel) throw new Error('Channel not found');
  if (channel.is_private && !(await isChannelMember(userId, channelId))) {
    throw new Error('Forbidden');
  }
}

async function validateCategory(channelId: number, categoryId: number): Promise<void> {
  const category = await queryOne<{ channel_id: number }>(
    'SELECT channel_id FROM pin_categories WHERE id = $1',
    [categoryId],
  );
  if (!category) throw new Error('Pin category not found');
  if (category.channel_id !== channelId) throw new Error('Pin category does not belong to channel');
}

async function getPinnedMessageById(id: number): Promise<PinnedMessage> {
  const row = await queryOne<PinnedMessageRow>(`${PIN_SELECT} WHERE pm.id = $1`, [id]);
  if (!row) throw new Error('Pin not found');
  return rowToPinnedMessage(row);
}

export async function getPinCategories(channelId: number, userId: number): Promise<PinCategory[]> {
  await assertChannelAccess(channelId, userId);
  for (let position = 0; position < DEFAULT_CATEGORY_NAMES.length; position += 1) {
    await execute(
      `INSERT INTO pin_categories (channel_id, name, is_default, position)
       VALUES ($1, $2, true, $3) ON CONFLICT (channel_id, name) DO NOTHING`,
      [channelId, DEFAULT_CATEGORY_NAMES[position], position],
    );
  }
  const rows = await query<PinCategoryRow>(
    'SELECT id, channel_id, name, is_default, position FROM pin_categories WHERE channel_id = $1 ORDER BY position, id',
    [channelId],
  );
  return rows.map(rowToPinCategory);
}

export async function createPinCategory(
  channelId: number,
  name: string,
  userId: number,
): Promise<PinCategory> {
  const normalized = name.trim();
  if (normalized.length === 0 || normalized.length > 50) throw new Error('Invalid category name');
  await getPinCategories(channelId, userId);
  try {
    const row = await queryOne<PinCategoryRow>(
      `INSERT INTO pin_categories (channel_id, name, position)
       VALUES ($1, $2, COALESCE((SELECT MAX(position) + 1 FROM pin_categories WHERE channel_id = $1), 0))
       RETURNING id, channel_id, name, is_default, position`,
      [channelId, normalized],
    );
    return rowToPinCategory(row!);
  } catch (error) {
    if ((error as { code?: string }).code === '23505')
      throw new Error('Pin category already exists');
    throw error;
  }
}

export async function pinMessage(
  messageId: number,
  channelId: number,
  pinnedBy: number,
  categoryId?: number | null,
): Promise<PinnedMessage> {
  await assertChannelAccess(channelId, pinnedBy);
  const message = await queryOne<{ id: number; channel_id: number; is_deleted: boolean }>(
    'SELECT id, channel_id, is_deleted FROM messages WHERE id = $1',
    [messageId],
  );
  if (!message) throw new Error('Message not found');
  if (message.channel_id !== channelId) throw new Error('Message does not belong to channel');
  if (message.is_deleted) throw new Error('Cannot pin a deleted message');
  if (categoryId !== undefined && categoryId !== null)
    await validateCategory(channelId, categoryId);

  try {
    const result = await queryOne<{ id: number }>(
      `INSERT INTO pinned_messages (message_id, channel_id, pinned_by, category_id)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [messageId, channelId, pinnedBy, categoryId ?? null],
    );
    return getPinnedMessageById(result!.id);
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      throw new Error('Message is already pinned in this channel');
    }
    throw error;
  }
}

export async function updatePinCategory(
  messageId: number,
  channelId: number,
  categoryId: number | null,
  userId: number,
): Promise<PinnedMessage> {
  await assertChannelAccess(channelId, userId);
  if (categoryId !== null) await validateCategory(channelId, categoryId);
  const result = await queryOne<{ id: number }>(
    `UPDATE pinned_messages SET category_id = $1
     WHERE message_id = $2 AND channel_id = $3 RETURNING id`,
    [categoryId, messageId, channelId],
  );
  if (!result) throw new Error('Pin not found');
  return getPinnedMessageById(result.id);
}

export async function unpinMessage(
  messageId: number,
  channelId: number,
  userId: number,
): Promise<void> {
  await assertChannelAccess(channelId, userId);
  if (!(await queryOne('SELECT id FROM messages WHERE id = $1', [messageId]))) {
    throw new Error('Message not found');
  }
  const result = await execute(
    'DELETE FROM pinned_messages WHERE message_id = $1 AND channel_id = $2',
    [messageId, channelId],
  );
  if (result.rowCount === 0) throw new Error('Pin not found');
}

export async function getPinnedMessages(
  channelId: number,
  userId: number,
): Promise<PinnedMessage[]> {
  await assertChannelAccess(channelId, userId);
  const rows = await query<PinnedMessageRow>(
    `${PIN_SELECT} WHERE pm.channel_id = $1 AND m.id IS NOT NULL ORDER BY pm.pinned_at DESC`,
    [channelId],
  );
  return rows.map(rowToPinnedMessage);
}
