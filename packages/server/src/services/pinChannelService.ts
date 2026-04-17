import { query, queryOne, execute } from '../db/database';

export interface PinnedChannel {
  id: number;
  userId: number;
  channelId: number;
  createdAt: string;
}

interface PinnedChannelRow {
  id: number;
  user_id: number;
  channel_id: number;
  created_at: string;
}

function toIsoString(val: unknown): string {
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

function rowToPinnedChannel(row: PinnedChannelRow): PinnedChannel {
  return {
    id: row.id,
    userId: row.user_id,
    channelId: row.channel_id,
    createdAt: toIsoString(row.created_at),
  };
}

export async function pinChannel(userId: number, channelId: number): Promise<PinnedChannel> {
  const channel = await queryOne<{ id: number }>(
    'SELECT id FROM channels WHERE id = $1',
    [channelId],
  );
  if (!channel) {
    throw new Error('Channel not found');
  }

  try {
    const result = await queryOne<PinnedChannelRow>(
      'INSERT INTO pinned_channels (user_id, channel_id) VALUES ($1, $2) RETURNING id, user_id, channel_id, created_at',
      [userId, channelId],
    );
    return rowToPinnedChannel(result!);
  } catch (err: unknown) {
    const error = err as { code?: string };
    if (error.code === '23505') {
      throw new Error('Channel is already pinned');
    }
    throw err;
  }
}

export async function unpinChannel(userId: number, channelId: number): Promise<void> {
  const result = await execute(
    'DELETE FROM pinned_channels WHERE user_id = $1 AND channel_id = $2',
    [userId, channelId],
  );
  if (result.rowCount === 0) {
    throw new Error('Pin not found');
  }
}

export async function getPinnedChannels(userId: number): Promise<PinnedChannel[]> {
  const rows = await query<PinnedChannelRow>(
    `SELECT pc.id, pc.user_id, pc.channel_id, pc.created_at
     FROM pinned_channels pc
     WHERE pc.user_id = $1
     ORDER BY pc.created_at ASC`,
    [userId],
  );
  return rows.map(rowToPinnedChannel);
}
