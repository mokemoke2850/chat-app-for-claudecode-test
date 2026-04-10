import { getDatabase } from '../db/database';
import { Channel } from '@chat-app/shared';
import { createError } from '../middleware/errorHandler';

interface ChannelRow {
  id: number;
  name: string;
  description: string | null;
  created_by: number;
  created_at: string;
}

function toChannel(row: ChannelRow): Channel {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export function getAllChannels(): Channel[] {
  const db = getDatabase();
  return (db.prepare('SELECT * FROM channels ORDER BY name').all() as ChannelRow[]).map(toChannel);
}

export function getChannelById(id: number): Channel | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM channels WHERE id = ?').get(id) as ChannelRow | undefined;
  return row ? toChannel(row) : null;
}

export function createChannel(name: string, description: string | undefined, createdBy: number): Channel {
  const db = getDatabase();

  const existing = db.prepare('SELECT id FROM channels WHERE name = ?').get(name);
  if (existing) throw createError('Channel name already taken', 409);

  const result = db
    .prepare('INSERT INTO channels (name, description, created_by) VALUES (?, ?, ?)')
    .run(name, description ?? null, createdBy);

  const channelId = result.lastInsertRowid;
  db.prepare('INSERT OR IGNORE INTO channel_members (channel_id, user_id) VALUES (?, ?)').run(channelId, createdBy);

  const row = db.prepare('SELECT * FROM channels WHERE id = ?').get(channelId) as ChannelRow;
  return toChannel(row);
}

export function deleteChannel(id: number, userId: number): void {
  const db = getDatabase();
  const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(id) as ChannelRow | undefined;

  if (!channel) throw createError('Channel not found', 404);
  if (channel.created_by !== userId) throw createError('Forbidden', 403);

  db.prepare('DELETE FROM channels WHERE id = ?').run(id);
}

export function joinChannel(channelId: number, userId: number): void {
  const db = getDatabase();
  db.prepare('INSERT OR IGNORE INTO channel_members (channel_id, user_id) VALUES (?, ?)').run(channelId, userId);
}
