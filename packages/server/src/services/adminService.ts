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
  isArchived: boolean;
  isRecommended: boolean;
  createdAt: string;
}

export interface AdminStats {
  totalUsers: number;
  totalChannels: number;
  totalMessages: number;
  activeUsersLast24h: number;
  activeUsersLast7d: number;
  activeUsers?: number;
}

export interface GetStatsOptions {
  from?: Date;
  to?: Date;
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
  is_archived: boolean;
  is_recommended: boolean;
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
    `SELECT c.id, c.name, c.description, c.is_private, c.is_archived, c.is_recommended, c.created_at,
            COUNT(cm.user_id) AS member_count
     FROM channels c
     LEFT JOIN channel_members cm ON cm.channel_id = c.id
     GROUP BY c.id, c.name, c.description, c.is_private, c.is_archived, c.is_recommended, c.created_at
     ORDER BY c.created_at ASC`,
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    isPrivate: r.is_private,
    isArchived: r.is_archived,
    isRecommended: r.is_recommended,
    memberCount: Number(r.member_count),
    createdAt: r.created_at,
  }));
}

export async function setChannelRecommended(
  channelId: number,
  isRecommended: boolean,
): Promise<AdminChannel> {
  const channel = await queryOne<AdminChannelRow>(
    `SELECT c.id, c.name, c.description, c.is_private, c.is_archived, c.is_recommended, c.created_at,
            COUNT(cm.user_id) AS member_count
     FROM channels c
     LEFT JOIN channel_members cm ON cm.channel_id = c.id
     WHERE c.id = $1
     GROUP BY c.id, c.name, c.description, c.is_private, c.is_archived, c.is_recommended, c.created_at`,
    [channelId],
  );
  if (!channel) throw createError('Channel not found', 404);

  await execute('UPDATE channels SET is_recommended = $1 WHERE id = $2', [
    isRecommended,
    channelId,
  ]);

  return {
    id: channel.id,
    name: channel.name,
    description: channel.description,
    isPrivate: channel.is_private,
    isArchived: channel.is_archived,
    isRecommended,
    memberCount: Number(channel.member_count),
    createdAt: channel.created_at,
  };
}

export async function deleteChannel(channelId: number): Promise<void> {
  const channel = await queryOne('SELECT id FROM channels WHERE id = $1', [channelId]);
  if (!channel) throw createError('Channel not found', 404);
  await execute('DELETE FROM channels WHERE id = $1', [channelId]);
}

export async function getStats(options: GetStatsOptions = {}): Promise<AdminStats> {
  const { from, to } = options;

  // バリデーション
  if (from !== undefined && !(from instanceof Date) && isNaN(Date.parse(String(from)))) {
    throw createError('Invalid from date', 400);
  }
  if (to !== undefined && !(to instanceof Date) && isNaN(Date.parse(String(to)))) {
    throw createError('Invalid to date', 400);
  }
  const fromDate = from instanceof Date ? from : from ? new Date(from) : undefined;
  const toDate = to instanceof Date ? to : to ? new Date(to) : undefined;
  if (fromDate && isNaN(fromDate.getTime())) {
    throw createError('Invalid from date', 400);
  }
  if (toDate && isNaN(toDate.getTime())) {
    throw createError('Invalid to date', 400);
  }
  if (fromDate && toDate && fromDate > toDate) {
    throw createError('from must be before to', 400);
  }

  const totalUsers = Number(
    (await queryOne<{ cnt: string }>('SELECT COUNT(*) as cnt FROM users'))?.cnt ?? 0,
  );
  const totalChannels = Number(
    (await queryOne<{ cnt: string }>('SELECT COUNT(*) as cnt FROM channels'))?.cnt ?? 0,
  );

  // メッセージ数: from/to 期間フィルタを適用
  let msgQuery = 'SELECT COUNT(*) as cnt FROM messages WHERE is_deleted = false';
  const msgParams: unknown[] = [];
  if (fromDate) {
    msgParams.push(fromDate.toISOString());
    msgQuery += ` AND created_at >= $${msgParams.length}`;
  }
  if (toDate) {
    msgParams.push(toDate.toISOString());
    msgQuery += ` AND created_at <= $${msgParams.length}`;
  }
  const totalMessages = Number((await queryOne<{ cnt: string }>(msgQuery, msgParams))?.cnt ?? 0);

  // アクティブユーザー: from/to 期間フィルタを適用
  let activeUsersLast24h: number;
  let activeUsersLast7d: number;
  let activeUsers: number | undefined;

  if (fromDate || toDate) {
    // 期間フィルタ指定時: last_login_at が範囲内のユーザー数を activeUsers として返す
    let userQuery = 'SELECT COUNT(*) as cnt FROM users WHERE last_login_at IS NOT NULL';
    const userParams: unknown[] = [];
    if (fromDate) {
      userParams.push(fromDate.toISOString());
      userQuery += ` AND last_login_at >= $${userParams.length}`;
    }
    if (toDate) {
      userParams.push(toDate.toISOString());
      userQuery += ` AND last_login_at <= $${userParams.length}`;
    }
    activeUsers = Number((await queryOne<{ cnt: string }>(userQuery, userParams))?.cnt ?? 0);
    // 後方互換のため Last24h/7d も返す（全期間の値）
    activeUsersLast24h = Number(
      (
        await queryOne<{ cnt: string }>(
          `SELECT COUNT(*) as cnt FROM users WHERE last_login_at >= NOW() - INTERVAL '24 hours'`,
        )
      )?.cnt ?? 0,
    );
    activeUsersLast7d = Number(
      (
        await queryOne<{ cnt: string }>(
          `SELECT COUNT(*) as cnt FROM users WHERE last_login_at >= NOW() - INTERVAL '7 days'`,
        )
      )?.cnt ?? 0,
    );
  } else {
    activeUsersLast24h = Number(
      (
        await queryOne<{ cnt: string }>(
          `SELECT COUNT(*) as cnt FROM users WHERE last_login_at >= NOW() - INTERVAL '24 hours'`,
        )
      )?.cnt ?? 0,
    );
    activeUsersLast7d = Number(
      (
        await queryOne<{ cnt: string }>(
          `SELECT COUNT(*) as cnt FROM users WHERE last_login_at >= NOW() - INTERVAL '7 days'`,
        )
      )?.cnt ?? 0,
    );
  }

  return {
    totalUsers,
    totalChannels,
    totalMessages,
    activeUsersLast24h,
    activeUsersLast7d,
    ...(activeUsers !== undefined ? { activeUsers } : {}),
  };
}
