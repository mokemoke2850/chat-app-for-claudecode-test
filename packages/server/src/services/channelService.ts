import { getDatabase } from '../db/database';
import { Channel, User } from '@chat-app/shared';
import { createError } from '../middleware/errorHandler';

interface ChannelRow {
  id: number;
  name: string;
  description: string | null;
  created_by: number;
  is_private: number;
  created_at: string;
}

function toChannel(row: ChannelRow & { unread_count?: number }): Channel {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdBy: row.created_by,
    isPrivate: row.is_private === 1,
    createdAt: row.created_at,
    unreadCount: row.unread_count ?? 0,
  };
}

export function getAllChannels(): Channel[] {
  const db = getDatabase();
  return (db.prepare('SELECT * FROM channels ORDER BY name').all() as ChannelRow[]).map(toChannel);
}

export function getChannelsForUser(userId: number): Channel[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT c.*,
        CASE
          WHEN crs.last_read_message_id IS NULL THEN (
            SELECT COUNT(*) FROM messages m WHERE m.channel_id = c.id AND m.is_deleted = 0
          )
          ELSE (
            SELECT COUNT(*) FROM messages m
            WHERE m.channel_id = c.id AND m.id > crs.last_read_message_id AND m.is_deleted = 0
          )
        END AS unread_count
       FROM channels c
       LEFT JOIN channel_read_status crs ON crs.channel_id = c.id AND crs.user_id = ?
       WHERE c.is_private = 0
          OR EXISTS (
            SELECT 1 FROM channel_members cm
            WHERE cm.channel_id = c.id AND cm.user_id = ?
          )
       ORDER BY c.name`,
    )
    .all(userId, userId) as (ChannelRow & { unread_count: number })[];
  return rows.map(toChannel);
}

export function markChannelAsRead(channelId: number, userId: number): void {
  const db = getDatabase();
  const lastMsg = db
    .prepare(
      'SELECT id FROM messages WHERE channel_id = ? AND is_deleted = 0 ORDER BY id DESC LIMIT 1',
    )
    .get(channelId) as { id: number } | undefined;

  db.prepare(
    `INSERT INTO channel_read_status (user_id, channel_id, last_read_message_id, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(user_id, channel_id) DO UPDATE SET
       last_read_message_id = excluded.last_read_message_id,
       updated_at = excluded.updated_at`,
  ).run(userId, channelId, lastMsg?.id ?? null);
}

export function getChannelById(id: number): Channel | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM channels WHERE id = ?').get(id) as ChannelRow | undefined;
  return row ? toChannel(row) : null;
}

export function createChannel(
  name: string,
  description: string | undefined,
  createdBy: number,
): Channel {
  const db = getDatabase();

  const existing = db.prepare('SELECT id FROM channels WHERE name = ?').get(name);
  if (existing) throw createError('Channel name already taken', 409);

  const result = db
    .prepare('INSERT INTO channels (name, description, created_by) VALUES (?, ?, ?)')
    .run(name, description ?? null, createdBy);

  const channelId = result.lastInsertRowid;
  db.prepare('INSERT OR IGNORE INTO channel_members (channel_id, user_id) VALUES (?, ?)').run(
    channelId,
    createdBy,
  );

  const row = db.prepare('SELECT * FROM channels WHERE id = ?').get(channelId) as ChannelRow;
  return toChannel(row);
}

export function createPrivateChannel(
  name: string,
  description: string | undefined,
  createdBy: number,
  memberIds: number[],
): Channel {
  const db = getDatabase();

  const existing = db.prepare('SELECT id FROM channels WHERE name = ?').get(name);
  if (existing) throw createError('Channel name already taken', 409);

  const result = db
    .prepare('INSERT INTO channels (name, description, created_by, is_private) VALUES (?, ?, ?, 1)')
    .run(name, description ?? null, createdBy);

  const channelId = result.lastInsertRowid;

  // 作成者を初期メンバーに追加
  db.prepare('INSERT OR IGNORE INTO channel_members (channel_id, user_id) VALUES (?, ?)').run(
    channelId,
    createdBy,
  );

  // 指定メンバーを追加
  for (const uid of memberIds) {
    db.prepare('INSERT OR IGNORE INTO channel_members (channel_id, user_id) VALUES (?, ?)').run(
      channelId,
      uid,
    );
  }

  const row = db.prepare('SELECT * FROM channels WHERE id = ?').get(channelId) as ChannelRow;
  return toChannel(row);
}

export function addChannelMember(channelId: number, requesterId: number, userId: number): void {
  const db = getDatabase();
  const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(channelId) as
    | ChannelRow
    | undefined;

  if (!channel) throw createError('Channel not found', 404);
  if (channel.created_by !== requesterId) throw createError('Forbidden', 403);

  db.prepare('INSERT OR IGNORE INTO channel_members (channel_id, user_id) VALUES (?, ?)').run(
    channelId,
    userId,
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
  is_active: number;
  created_at: string;
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
    isActive: row.is_active === 1,
  };
}

export function getChannelMembers(channelId: number): User[] {
  const db = getDatabase();
  return (
    db
      .prepare(
        `SELECT u.* FROM users u
         INNER JOIN channel_members cm ON cm.user_id = u.id
         WHERE cm.channel_id = ?
         ORDER BY u.username`,
      )
      .all(channelId) as UserRow[]
  ).map(toUser);
}

export function removeChannelMember(channelId: number, requesterId: number, userId: number): void {
  const db = getDatabase();
  const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(channelId) as
    | ChannelRow
    | undefined;

  if (!channel) throw createError('Channel not found', 404);
  if (channel.created_by !== requesterId) throw createError('Forbidden', 403);

  db.prepare('DELETE FROM channel_members WHERE channel_id = ? AND user_id = ?').run(
    channelId,
    userId,
  );
}

export function deleteChannel(id: number, userId: number): void {
  const db = getDatabase();
  const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(id) as
    | ChannelRow
    | undefined;

  if (!channel) throw createError('Channel not found', 404);
  if (channel.created_by !== userId) throw createError('Forbidden', 403);

  db.prepare('DELETE FROM channels WHERE id = ?').run(id);
}

export function joinChannel(channelId: number, userId: number): void {
  const db = getDatabase();
  db.prepare('INSERT OR IGNORE INTO channel_members (channel_id, user_id) VALUES (?, ?)').run(
    channelId,
    userId,
  );
}
