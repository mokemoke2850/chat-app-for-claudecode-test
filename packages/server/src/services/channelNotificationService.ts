import type { ChannelNotificationLevel, ChannelNotificationSetting } from '@chat-app/shared';
import { query, execute } from '../db/database';

interface ChannelNotificationSettingRow {
  channel_id: number;
  level: string;
  updated_at: unknown;
}

function toIsoString(val: unknown): string {
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

/**
 * ユーザーのチャンネル通知レベルを取得する。
 * レコードが存在しない場合は 'all' を返す（デフォルト）。
 */
export async function getLevel(
  userId: number,
  channelId: number,
): Promise<ChannelNotificationLevel> {
  const rows = await query<ChannelNotificationSettingRow>(
    'SELECT level FROM channel_notification_settings WHERE user_id = $1 AND channel_id = $2',
    [userId, channelId],
  );
  if (rows.length === 0) return 'all';
  const level = rows[0].level as ChannelNotificationLevel;
  return level;
}

/**
 * ユーザーの全チャンネル通知設定を Map<channelId, ChannelNotificationSetting> で返す。
 */
export async function getForUser(userId: number): Promise<Map<number, ChannelNotificationSetting>> {
  const rows = await query<ChannelNotificationSettingRow>(
    'SELECT channel_id, level, updated_at FROM channel_notification_settings WHERE user_id = $1',
    [userId],
  );
  const map = new Map<number, ChannelNotificationSetting>();
  for (const row of rows) {
    map.set(row.channel_id, {
      channelId: row.channel_id,
      level: row.level as ChannelNotificationLevel,
      updatedAt: toIsoString(row.updated_at),
    });
  }
  return map;
}

/**
 * チャンネル通知レベルを設定（UPSERT）する。
 */
export async function set(
  userId: number,
  channelId: number,
  level: ChannelNotificationLevel,
): Promise<ChannelNotificationSetting> {
  const rows = await query<ChannelNotificationSettingRow>(
    `INSERT INTO channel_notification_settings (user_id, channel_id, level, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id, channel_id)
     DO UPDATE SET level = EXCLUDED.level, updated_at = NOW()
     RETURNING channel_id, level, updated_at`,
    [userId, channelId, level],
  );
  const row = rows[0];
  return {
    channelId: row.channel_id,
    level: row.level as ChannelNotificationLevel,
    updatedAt: toIsoString(row.updated_at),
  };
}
