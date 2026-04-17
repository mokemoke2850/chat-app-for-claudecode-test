import { query, queryOne, execute } from '../db/database';
import { createError } from '../middleware/errorHandler';

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  role: 'user' | 'admin';
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AdminChannel {
  id: number;
  name: string;
  description: string | null;
  isPrivate: boolean;
  memberCount: number;
  createdAt: string;
}

export interface AdminStats {
  totalUsers: number;
  totalChannels: number;
  totalMessages: number;
  activeUsersLast24h: number;
  activeUsersLast7d: number;
}

interface AdminUserRow {
  id: number;
  username: string;
  email: string;
  role: 'user' | 'admin';
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

interface AdminChannelRow {
  id: number;
  name: string;
  description: string | null;
  is_private: boolean;
  member_count: string;
  created_at: string;
}

export async function getAdminUsers(): Promise<AdminUser[]> {
  const rows = await query<AdminUserRow>(
    `SELECT id, username, email, role, is_active, last_login_at, created_at
     FROM users ORDER BY created_at ASC`,
  );
  return rows.map((r) => ({
    id: r.id,
    username: r.username,
    email: r.email,
    role: r.role,
    isActive: r.is_active,
    lastLoginAt: r.last_login_at,
    createdAt: r.created_at,
  }));
}

export async function updateUserRole(
  targetId: number,
  role: 'user' | 'admin',
  requesterId: number,
): Promise<void> {
  if (targetId === requesterId) throw createError('Cannot change your own role', 400);
  const user = await queryOne('SELECT id FROM users WHERE id = $1', [targetId]);
  if (!user) throw createError('User not found', 404);
  await execute('UPDATE users SET role = $1 WHERE id = $2', [role, targetId]);
}

export async function updateUserStatus(targetId: number, isActive: boolean): Promise<void> {
  const user = await queryOne('SELECT id FROM users WHERE id = $1', [targetId]);
  if (!user) throw createError('User not found', 404);
  await execute('UPDATE users SET is_active = $1 WHERE id = $2', [isActive, targetId]);
}

export async function deleteUser(targetId: number, requesterId: number): Promise<void> {
  if (targetId === requesterId) throw createError('Cannot delete yourself', 400);
  const user = await queryOne('SELECT id FROM users WHERE id = $1', [targetId]);
  if (!user) throw createError('User not found', 404);
  await execute('DELETE FROM users WHERE id = $1', [targetId]);
}

export async function getAdminChannels(): Promise<AdminChannel[]> {
  const rows = await query<AdminChannelRow>(
    `SELECT c.id, c.name, c.description, c.is_private, c.created_at,
            COUNT(cm.user_id) AS member_count
     FROM channels c
     LEFT JOIN channel_members cm ON cm.channel_id = c.id
     GROUP BY c.id, c.name, c.description, c.is_private, c.created_at
     ORDER BY c.created_at ASC`,
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    isPrivate: r.is_private,
    memberCount: Number(r.member_count),
    createdAt: r.created_at,
  }));
}

export async function deleteChannel(channelId: number): Promise<void> {
  const channel = await queryOne('SELECT id FROM channels WHERE id = $1', [channelId]);
  if (!channel) throw createError('Channel not found', 404);
  await execute('DELETE FROM channels WHERE id = $1', [channelId]);
}

export async function getStats(): Promise<AdminStats> {
  const totalUsers = Number((await queryOne<{ cnt: string }>('SELECT COUNT(*) as cnt FROM users'))?.cnt ?? 0);
  const totalChannels = Number((await queryOne<{ cnt: string }>('SELECT COUNT(*) as cnt FROM channels'))?.cnt ?? 0);
  const totalMessages = Number(
    (await queryOne<{ cnt: string }>('SELECT COUNT(*) as cnt FROM messages WHERE is_deleted = false'))?.cnt ?? 0,
  );
  const activeUsersLast24h = Number(
    (
      await queryOne<{ cnt: string }>(
        `SELECT COUNT(*) as cnt FROM users WHERE last_login_at >= NOW() - INTERVAL '24 hours'`,
      )
    )?.cnt ?? 0,
  );
  const activeUsersLast7d = Number(
    (
      await queryOne<{ cnt: string }>(
        `SELECT COUNT(*) as cnt FROM users WHERE last_login_at >= NOW() - INTERVAL '7 days'`,
      )
    )?.cnt ?? 0,
  );
  return { totalUsers, totalChannels, totalMessages, activeUsersLast24h, activeUsersLast7d };
}
