import bcrypt from 'bcrypt';

import { query, queryOne, execute } from '../db/database';
import { User } from '@chat-app/shared';
import { createError } from '../middleware/errorHandler';

// production 既定は 12 ラウンド。テスト環境では BCRYPT_ROUNDS=4 などに下げて高速化する
const BCRYPT_ROUNDS = process.env.BCRYPT_ROUNDS ? parseInt(process.env.BCRYPT_ROUNDS, 10) : 12;

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
  onboarding_completed_at: string | null;
  status_emoji: string | null;
  status_text: string | null;
  status_expires_at: string | null;
}

/**
 * DB row からユーザーオブジェクトへ変換する。
 * status_expires_at が現在時刻より過去の場合は status を null として返す（#147）。
 */
function toUser(row: UserRow): User {
  let status: User['status'] = null;
  // 絵文字またはテキストが設定されていて、かつ期限切れでない場合のみステータスを返す
  const hasStatus = row.status_emoji != null || row.status_text != null;
  const isExpired = row.status_expires_at != null && new Date(row.status_expires_at) < new Date();

  if (hasStatus && !isExpired) {
    status = {
      emoji: row.status_emoji,
      text: row.status_text,
      expiresAt: row.status_expires_at,
    };
  }

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
    status,
  };
}

export async function register(username: string, email: string, password: string): Promise<User> {
  const existing = await queryOne('SELECT id FROM users WHERE email = $1 OR username = $2', [
    email,
    username,
  ]);
  if (existing) throw createError('Username or email already taken', 409);

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

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

  await execute('UPDATE users SET last_login_at = NOW() WHERE id = $1', [row.id]);

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

export async function changePassword(
  userId: number,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const row = await queryOne<UserRow>('SELECT * FROM users WHERE id = $1', [userId]);
  if (!row) throw createError('User not found', 404);

  const valid = await bcrypt.compare(currentPassword, row.password_hash);
  if (!valid) throw createError('現在のパスワードが正しくありません', 401);

  const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await execute('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
    newHash,
    userId,
  ]);
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

export async function completeOnboarding(userId: number): Promise<User> {
  await execute(
    'UPDATE users SET onboarding_completed_at = NOW(), updated_at = NOW() WHERE id = $1',
    [userId],
  );
  const user = await getUserById(userId);
  if (!user) throw createError('User not found', 404);
  return user;
}

/**
 * カスタムステータスを更新する（#147）。
 * emoji と text が両方 null の場合はステータスをクリアする。
 * expiresAt に過去日時を指定した場合はエラー。
 */
export async function updateStatus(
  userId: number,
  data: {
    emoji: string | null;
    text: string | null;
    expiresAt: string | null;
  },
): Promise<User> {
  const existing = await getUserById(userId);
  if (!existing) throw createError('User not found', 404);

  // 過去日時のバリデーション
  if (data.expiresAt != null && new Date(data.expiresAt) < new Date()) {
    throw createError('expires_at には未来の日時を指定してください', 400);
  }

  await execute(
    'UPDATE users SET status_emoji = $1, status_text = $2, status_expires_at = $3, updated_at = NOW() WHERE id = $4',
    [data.emoji, data.text, data.expiresAt, userId],
  );

  return (await getUserById(userId))!;
}
