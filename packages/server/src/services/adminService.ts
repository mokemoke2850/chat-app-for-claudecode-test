import { getDatabase } from '../db/database';
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
  is_active: number;
  last_login_at: string | null;
  created_at: string;
}

interface AdminChannelRow {
  id: number;
  name: string;
  description: string | null;
  is_private: number;
  member_count: number;
  created_at: string;
}

export function getAdminUsers(): AdminUser[] {
  const rows = getDatabase()
    .prepare(
      `SELECT id, username, email, role, is_active, last_login_at, created_at
       FROM users ORDER BY created_at ASC`,
    )
    .all() as AdminUserRow[];
  return rows.map((r) => ({
    id: r.id,
    username: r.username,
    email: r.email,
    role: r.role,
    isActive: r.is_active === 1,
    lastLoginAt: r.last_login_at,
    createdAt: r.created_at,
  }));
}

export function updateUserRole(
  targetId: number,
  role: 'user' | 'admin',
  requesterId: number,
): void {
  if (targetId === requesterId) throw createError('Cannot change your own role', 400);
  const db = getDatabase();
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(targetId);
  if (!user) throw createError('User not found', 404);
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, targetId);
}

export function updateUserStatus(targetId: number, isActive: boolean): void {
  const db = getDatabase();
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(targetId);
  if (!user) throw createError('User not found', 404);
  db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(isActive ? 1 : 0, targetId);
}

export function deleteUser(targetId: number, requesterId: number): void {
  if (targetId === requesterId) throw createError('Cannot delete yourself', 400);
  const db = getDatabase();
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(targetId);
  if (!user) throw createError('User not found', 404);
  db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
}

export function getAdminChannels(): AdminChannel[] {
  const rows = getDatabase()
    .prepare(
      `SELECT c.id, c.name, c.description, c.is_private, c.created_at,
              COUNT(cm.user_id) AS member_count
       FROM channels c
       LEFT JOIN channel_members cm ON cm.channel_id = c.id
       GROUP BY c.id
       ORDER BY c.created_at ASC`,
    )
    .all() as AdminChannelRow[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    isPrivate: r.is_private === 1,
    memberCount: r.member_count,
    createdAt: r.created_at,
  }));
}

export function deleteChannel(channelId: number): void {
  const db = getDatabase();
  const channel = db.prepare('SELECT id FROM channels WHERE id = ?').get(channelId);
  if (!channel) throw createError('Channel not found', 404);
  db.prepare('DELETE FROM channels WHERE id = ?').run(channelId);
}

export function getStats(): AdminStats {
  const db = getDatabase();
  const totalUsers = (db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number }).cnt;
  const totalChannels = (
    db.prepare('SELECT COUNT(*) as cnt FROM channels').get() as { cnt: number }
  ).cnt;
  const totalMessages = (
    db.prepare('SELECT COUNT(*) as cnt FROM messages WHERE is_deleted = 0').get() as { cnt: number }
  ).cnt;
  const activeUsersLast24h = (
    db
      .prepare(
        `SELECT COUNT(*) as cnt FROM users
         WHERE last_login_at >= datetime('now', '-24 hours')`,
      )
      .get() as { cnt: number }
  ).cnt;
  const activeUsersLast7d = (
    db
      .prepare(
        `SELECT COUNT(*) as cnt FROM users
         WHERE last_login_at >= datetime('now', '-7 days')`,
      )
      .get() as { cnt: number }
  ).cnt;
  return { totalUsers, totalChannels, totalMessages, activeUsersLast24h, activeUsersLast7d };
}
