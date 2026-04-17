import bcrypt from 'bcrypt';

import { query, queryOne, execute } from '../db/database';
import { User } from '@chat-app/shared';
import { createError } from '../middleware/errorHandler';

interface UserRow {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  avatar_url: string | null;
  display_name: string | null;
  location: string | null;
  role: 'user' | 'admin';
  is_active: boolean;
  last_login_at: string | null;
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
    isActive: row.is_active,
  };
}

export async function register(username: string, email: string, password: string): Promise<User> {
  const existing = await queryOne(
    'SELECT id FROM users WHERE email = $1 OR username = $2',
    [email, username],
  );
  if (existing) throw createError('Username or email already taken', 409);

  const passwordHash = await bcrypt.hash(password, 12);

  const countRow = await queryOne<{ cnt: string }>('SELECT COUNT(*) as cnt FROM users');
  const role = Number(countRow?.cnt) === 0 ? 'admin' : 'user';

  const row = await queryOne<UserRow>(
    'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING *',
    [username, email, passwordHash, role],
  );
  return toUser(row!);
}

export async function login(email: string, password: string): Promise<User> {
  const row = await queryOne<UserRow>('SELECT * FROM users WHERE email = $1', [email]);
  if (!row) throw createError('Invalid credentials', 401);

  const valid = await bcrypt.compare(password, row.password_hash);
  if (!valid) throw createError('Invalid credentials', 401);

  if (!row.is_active) throw createError('Account is suspended', 403);

  await execute("UPDATE users SET last_login_at = NOW() WHERE id = $1", [row.id]);

  return toUser({ ...row, last_login_at: new Date().toISOString() });
}

export async function getUserById(id: number): Promise<User | null> {
  const row = await queryOne<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
  return row ? toUser(row) : null;
}

export async function updateProfile(
  userId: number,
  data: { displayName?: string | null; location?: string | null; avatarUrl?: string | null },
): Promise<User> {
  const existing = await getUserById(userId);
  if (!existing) throw createError('User not found', 404);

  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if ('displayName' in data) {
    sets.push(`display_name = $${idx++}`);
    values.push(data.displayName || null);
  }
  if ('location' in data) {
    sets.push(`location = $${idx++}`);
    values.push(data.location || null);
  }
  if ('avatarUrl' in data) {
    sets.push(`avatar_url = $${idx++}`);
    values.push(data.avatarUrl || null);
  }

  if (sets.length > 0) {
    sets.push(`updated_at = NOW()`);
    values.push(userId);
    await execute(`UPDATE users SET ${sets.join(', ')} WHERE id = $${idx}`, values);
  }

  return (await getUserById(userId))!;
}

export async function getAllUsers(): Promise<User[]> {
  const rows = await query<UserRow>('SELECT * FROM users ORDER BY username');
  return rows.map(toUser);
}

export async function getUsersForChannel(channelId: number): Promise<User[] | null> {
  const channel = await queryOne<{ id: number; is_private: boolean }>(
    'SELECT id, is_private FROM channels WHERE id = $1',
    [channelId],
  );

  if (!channel) return null;

  if (!channel.is_private) return getAllUsers();

  const rows = await query<UserRow>(
    `SELECT u.* FROM users u
     INNER JOIN channel_members cm ON cm.user_id = u.id
     WHERE cm.channel_id = $1
     ORDER BY u.username`,
    [channelId],
  );
  return rows.map(toUser);
}
