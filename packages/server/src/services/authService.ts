import bcrypt from 'bcrypt';

import { getDatabase } from '../db/database';
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
  };
}

export async function register(username: string, email: string, password: string): Promise<User> {
  const db = getDatabase();

  const existing = db
    .prepare('SELECT id FROM users WHERE email = ? OR username = ?')
    .get(email, username);
  if (existing) throw createError('Username or email already taken', 409);

  const passwordHash = await bcrypt.hash(password, 12);
  const result = db
    .prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)')
    .run(username, email, passwordHash);

  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid) as UserRow;
  return toUser(row);
}

export async function login(email: string, password: string): Promise<User> {
  const db = getDatabase();

  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined;
  if (!row) throw createError('Invalid credentials', 401);

  const valid = await bcrypt.compare(password, row.password_hash);
  if (!valid) throw createError('Invalid credentials', 401);

  return toUser(row);
}

export function getUserById(id: number): User | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
  return row ? toUser(row) : null;
}

export function updateProfile(
  userId: number,
  data: { displayName?: string | null; location?: string | null; avatarUrl?: string | null },
): User {
  const db = getDatabase();
  const existing = getUserById(userId);
  if (!existing) throw createError('User not found', 404);

  const sets: string[] = [];
  const values: unknown[] = [];

  if ('displayName' in data) {
    sets.push('display_name = ?');
    values.push(data.displayName || null);
  }
  if ('location' in data) {
    sets.push('location = ?');
    values.push(data.location || null);
  }
  if ('avatarUrl' in data) {
    sets.push('avatar_url = ?');
    values.push(data.avatarUrl || null);
  }

  if (sets.length > 0) {
    sets.push("updated_at = datetime('now')");
    values.push(userId);
    db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  }

  return getUserById(userId)!;
}

export function getAllUsers(): User[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM users ORDER BY username').all() as UserRow[];
  return rows.map(toUser);
}
