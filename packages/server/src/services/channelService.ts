import { query, queryOne, execute } from '../db/database';
import { Channel, ChannelPostingPermission, User } from '@chat-app/shared';
import { createError } from '../middleware/errorHandler';

interface ChannelRow {
  id: number;
  name: string;
  description: string | null;
  topic: string | null;
  created_by: number | null;
  is_private: boolean;
  is_archived: boolean;
  is_recommended: boolean;
  posting_permission: ChannelPostingPermission;
  created_at: string;
}

const POSTING_PERMISSIONS: readonly ChannelPostingPermission[] = ['everyone', 'admins', 'readonly'];

function isValidPostingPermission(value: unknown): value is ChannelPostingPermission {
  return typeof value === 'string' && (POSTING_PERMISSIONS as readonly string[]).includes(value);
}

function toChannel(row: ChannelRow & { unread_count?: number; mention_count?: number }): Channel {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    topic: row.topic ?? null,
    createdBy: row.created_by,
    isPrivate: row.is_private,
    isArchived: row.is_archived,
    isRecommended: row.is_recommended ?? false,
    postingPermission: row.posting_permission ?? 'everyone',
    createdAt: row.created_at,
    unreadCount: Number(row.unread_count ?? 0),
    mentionCount: Number(row.mention_count ?? 0),
  };
}

export async function getAllChannels(): Promise<Channel[]> {
  return (await query<ChannelRow>('SELECT * FROM channels ORDER BY name')).map(toChannel);
}

export async function getChannelsForUser(userId: number): Promise<Channel[]> {
  // チャンネル一覧と各チャンネルの既読位置を取得
  const channelRows = await query<ChannelRow & { last_read_message_id: number | null }>(
    `SELECT c.id, c.name, c.description, c.created_by, c.is_private, c.is_archived, c.is_recommended,
            c.posting_permission, c.created_at, c.topic,
            crs.last_read_message_id
     FROM channels c
     LEFT JOIN channel_read_status crs ON crs.channel_id = c.id AND crs.user_id = $1
     WHERE c.is_archived = false
       AND (c.is_private = false
        OR c.id IN (
          SELECT cm.channel_id FROM channel_members cm WHERE cm.user_id = $2
        ))
     ORDER BY c.name`,
    [userId, userId],
  );

  if (channelRows.length === 0) return [];

  const channelIds = channelRows.map((r) => r.id);
  const placeholders = channelIds.map((_, i) => `$${i + 1}`).join(',');

  // 各チャンネルのメッセージID一覧を取得（未読数計算用）
  const msgRows = await query<{ channel_id: number; id: number }>(
    `SELECT channel_id, id FROM messages
     WHERE channel_id IN (${placeholders}) AND is_deleted = false`,
    channelIds,
  );

  // 各チャンネルのメンション一覧を取得
  const mentionRows = await query<{
    channel_id: number;
    message_id: number;
  }>(
    `SELECT channel_id, message_id FROM mentions
     WHERE channel_id IN (${placeholders})
       AND mentioned_user_id = $${channelIds.length + 1}
       AND is_read = false`,
    [...channelIds, userId],
  );

  return channelRows.map((row) => {
    const lastRead = row.last_read_message_id;
    const unreadCount = msgRows.filter(
      (m) => m.channel_id === row.id && (lastRead === null || m.id > lastRead),
    ).length;
    const mentionCount = mentionRows.filter(
      (mn) => mn.channel_id === row.id && (lastRead === null || mn.message_id > lastRead),
    ).length;
    return toChannel({
      ...row,
      unread_count: unreadCount,
      mention_count: mentionCount,
    });
  });
}

export async function markChannelAsRead(channelId: number, userId: number): Promise<void> {
  const lastMsg = await queryOne<{ id: number }>(
    'SELECT id FROM messages WHERE channel_id = $1 AND is_deleted = false ORDER BY id DESC LIMIT 1',
    [channelId],
  );

  await execute(
    `INSERT INTO channel_read_status (user_id, channel_id, last_read_message_id, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT(user_id, channel_id) DO UPDATE SET
       last_read_message_id = EXCLUDED.last_read_message_id,
       updated_at = EXCLUDED.updated_at`,
    [userId, channelId, lastMsg?.id ?? null],
  );

  await execute(
    'UPDATE mentions SET is_read = true WHERE channel_id = $1 AND mentioned_user_id = $2 AND is_read = false',
    [channelId, userId],
  );
}

export async function getChannelById(id: number): Promise<Channel | null> {
  const row = await queryOne<ChannelRow>('SELECT * FROM channels WHERE id = $1', [id]);
  return row ? toChannel(row) : null;
}

export async function createChannel(
  name: string,
  description: string | undefined,
  createdBy: number,
  postingPermission?: ChannelPostingPermission,
): Promise<Channel> {
  const existing = await queryOne('SELECT id FROM channels WHERE name = $1', [name]);
  if (existing) throw createError('Channel name already taken', 409);

  if (postingPermission !== undefined && !isValidPostingPermission(postingPermission)) {
    throw createError('Invalid postingPermission', 400);
  }

  const row = await queryOne<ChannelRow>(
    'INSERT INTO channels (name, description, created_by, posting_permission) VALUES ($1, $2, $3, $4) RETURNING *',
    [name, description ?? null, createdBy, postingPermission ?? 'everyone'],
  );

  await execute(
    'INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [row!.id, createdBy],
  );

  return toChannel(row!);
}

export async function createPrivateChannel(
  name: string,
  description: string | undefined,
  createdBy: number,
  memberIds: number[],
  postingPermission?: ChannelPostingPermission,
): Promise<Channel> {
  const existing = await queryOne('SELECT id FROM channels WHERE name = $1', [name]);
  if (existing) throw createError('Channel name already taken', 409);

  if (postingPermission !== undefined && !isValidPostingPermission(postingPermission)) {
    throw createError('Invalid postingPermission', 400);
  }

  const row = await queryOne<ChannelRow>(
    'INSERT INTO channels (name, description, created_by, is_private, posting_permission) VALUES ($1, $2, $3, true, $4) RETURNING *',
    [name, description ?? null, createdBy, postingPermission ?? 'everyone'],
  );

  const channelId = row!.id;

  await execute(
    'INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [channelId, createdBy],
  );

  for (const uid of memberIds) {
    await execute(
      'INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [channelId, uid],
    );
  }

  return toChannel(row!);
}

export async function addChannelMember(
  channelId: number,
  requesterId: number,
  userId: number,
): Promise<void> {
  const channel = await queryOne<ChannelRow>('SELECT * FROM channels WHERE id = $1', [channelId]);
  if (!channel) throw createError('Channel not found', 404);
  if (channel.created_by !== requesterId) throw createError('Forbidden', 403);

  await execute(
    'INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [channelId, userId],
  );
}

interface UserRow {
  id: number;
  username: string;
  email: string;
  avatar_url: string | null;
  display_name: string | null;
  location: string | null;
  role: 'user' | 'admin';
  is_active: boolean;
  created_at: string;
  onboarding_completed_at: string | null;
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    avatarUrl: row.avatar_url,
    displayName: row.display_name,
    location: row.location,
    createdAt: row.created_at,
    role: row.role,
    isActive: row.is_active,
    onboardingCompletedAt: row.onboarding_completed_at ?? null,
  };
}

export async function getChannelMembers(channelId: number): Promise<User[]> {
  return (
    await query<UserRow>(
      `SELECT u.* FROM users u
       INNER JOIN channel_members cm ON cm.user_id = u.id
       WHERE cm.channel_id = $1
       ORDER BY u.username`,
      [channelId],
    )
  ).map(toUser);
}

export async function removeChannelMember(
  channelId: number,
  requesterId: number,
  userId: number,
): Promise<void> {
  const channel = await queryOne<ChannelRow>('SELECT * FROM channels WHERE id = $1', [channelId]);
  if (!channel) throw createError('Channel not found', 404);
  if (channel.created_by !== requesterId) throw createError('Forbidden', 403);

  await execute('DELETE FROM channel_members WHERE channel_id = $1 AND user_id = $2', [
    channelId,
    userId,
  ]);
}

export async function deleteChannel(id: number, userId: number): Promise<void> {
  const channel = await queryOne<ChannelRow>('SELECT * FROM channels WHERE id = $1', [id]);
  if (!channel) throw createError('Channel not found', 404);
  if (channel.created_by !== userId) throw createError('Forbidden', 403);

  await execute('DELETE FROM channels WHERE id = $1', [id]);
}

export async function updateChannelTopic(
  channelId: number,
  requesterId: number,
  topic: string | null | undefined,
  description: string | null | undefined,
  isAdmin: boolean,
): Promise<Channel> {
  const channel = await queryOne<ChannelRow>('SELECT * FROM channels WHERE id = $1', [channelId]);
  if (!channel) throw createError('Channel not found', 404);
  if (!isAdmin && channel.created_by !== requesterId) throw createError('Forbidden', 403);

  const newTopic = topic !== undefined ? topic : channel.topic;
  const newDescription = description !== undefined ? description : channel.description;

  const updated = await queryOne<ChannelRow>(
    `UPDATE channels SET topic = $1, description = $2 WHERE id = $3 RETURNING *`,
    [newTopic, newDescription, channelId],
  );

  // システムメッセージを投稿
  const topicText = newTopic ?? '（未設定）';
  await execute('INSERT INTO messages (channel_id, user_id, content) VALUES ($1, NULL, $2)', [
    channelId,
    `チャンネルトピックが「${topicText}」に設定されました`,
  ]);

  return toChannel(updated!);
}

export async function joinChannel(channelId: number, userId: number): Promise<void> {
  await execute(
    'INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [channelId, userId],
  );
}

export async function archiveChannel(
  channelId: number,
  requesterId: number,
  isAdmin: boolean,
): Promise<Channel> {
  const channel = await queryOne<ChannelRow>('SELECT * FROM channels WHERE id = $1', [channelId]);
  if (!channel) throw createError('Channel not found', 404);
  if (!isAdmin && channel.created_by !== requesterId) throw createError('Forbidden', 403);
  if (channel.is_archived) throw createError('Channel is already archived', 409);

  const updated = await queryOne<ChannelRow>(
    'UPDATE channels SET is_archived = true WHERE id = $1 RETURNING *',
    [channelId],
  );
  return toChannel(updated!);
}

export async function unarchiveChannel(
  channelId: number,
  requesterId: number,
  isAdmin: boolean,
): Promise<Channel> {
  const channel = await queryOne<ChannelRow>('SELECT * FROM channels WHERE id = $1', [channelId]);
  if (!channel) throw createError('Channel not found', 404);
  if (!isAdmin && channel.created_by !== requesterId) throw createError('Forbidden', 403);
  if (!channel.is_archived) throw createError('Channel is not archived', 409);

  const updated = await queryOne<ChannelRow>(
    'UPDATE channels SET is_archived = false WHERE id = $1 RETURNING *',
    [channelId],
  );
  return toChannel(updated!);
}

export async function getArchivedChannels(userId: number): Promise<Channel[]> {
  const rows = await query<ChannelRow>(
    `SELECT c.id, c.name, c.description, c.created_by, c.is_private, c.is_archived, c.is_recommended,
            c.posting_permission, c.created_at, c.topic
     FROM channels c
     WHERE c.is_archived = true
       AND (c.is_private = false
        OR c.id IN (
          SELECT cm.channel_id FROM channel_members cm WHERE cm.user_id = $1
        ))
     ORDER BY c.name`,
    [userId],
  );
  return rows.map((row) => toChannel({ ...row, unread_count: 0, mention_count: 0 }));
}

export async function setChannelRecommended(
  channelId: number,
  isRecommended: boolean,
): Promise<Channel> {
  const channel = await queryOne<ChannelRow>('SELECT * FROM channels WHERE id = $1', [channelId]);
  if (!channel) throw createError('Channel not found', 404);

  const updated = await queryOne<ChannelRow>(
    'UPDATE channels SET is_recommended = $1 WHERE id = $2 RETURNING *',
    [isRecommended, channelId],
  );
  return toChannel(updated!);
}

// #113 投稿権限制御チャンネル
export async function canPost(userId: number, channelId: number): Promise<boolean> {
  const channel = await queryOne<{
    id: number;
    is_private: boolean;
    posting_permission: ChannelPostingPermission;
  }>('SELECT id, is_private, posting_permission FROM channels WHERE id = $1', [channelId]);
  if (!channel) return false;

  const permission = channel.posting_permission ?? 'everyone';

  if (permission === 'readonly') return false;

  const userRow = await queryOne<{ role: string }>('SELECT role FROM users WHERE id = $1', [
    userId,
  ]);
  const isAdmin = userRow?.role === 'admin';

  if (permission === 'admins') {
    return isAdmin;
  }

  // permission === 'everyone'
  // プライベートチャンネルはメンバーシップが必要、パブリックは誰でも投稿可
  if (channel.is_private) {
    const member = await queryOne<{ user_id: number }>(
      'SELECT user_id FROM channel_members WHERE channel_id = $1 AND user_id = $2',
      [channelId, userId],
    );
    return member !== null;
  }
  return true;
}

export async function updateChannelPostingPermission(
  channelId: number,
  requesterId: number,
  permission: ChannelPostingPermission,
  isAdmin: boolean,
): Promise<Channel> {
  if (!isValidPostingPermission(permission)) {
    throw createError('Invalid postingPermission', 400);
  }

  const channel = await queryOne<ChannelRow>('SELECT * FROM channels WHERE id = $1', [channelId]);
  if (!channel) throw createError('Channel not found', 404);

  if (!isAdmin && channel.created_by !== requesterId) {
    throw createError('Forbidden', 403);
  }

  const updated = await queryOne<ChannelRow>(
    'UPDATE channels SET posting_permission = $1 WHERE id = $2 RETURNING *',
    [permission, channelId],
  );
  return toChannel(updated!);
}
