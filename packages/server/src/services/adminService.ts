import { query, queryOne, execute } from '../db/database';
import { createError } from '../middleware/errorHandler';
import type {
  MaintenanceModeSettings,
  MaintenanceRestriction,
  SettingsExportData,
  SettingsExportChannel,
  SettingsExportNotification,
  SettingsExportNgWord,
  SettingsExportPermission,
  SettingsImportDiff,
  SettingsImportPreview,
} from '@chat-app/shared';

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

export type TimeseriesGranularity = 'hour' | 'day';

export interface TimeseriesPoint {
  timestamp: string; // ISO8601
  count: number;
}

export interface GetTimeseriesOptions {
  from?: Date | string;
  to?: Date | string;
  period?: PeriodKey;
  granularity?: TimeseriesGranularity;
}

export type PeriodKey = '24h' | '7d' | '30d';

export interface ChannelTimeseries {
  channelId: number;
  channelName: string;
  points: TimeseriesPoint[];
}

export interface TopChannelByMessageCount {
  channelId: number;
  channelName: string;
  count: number;
}

export interface TopUserByMessageCount {
  userId: number | null;
  username: string | null;
  count: number;
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

const MAINTENANCE_SETTING_KEY = 'maintenance_mode';
const VALID_MAINTENANCE_RESTRICTIONS: MaintenanceRestriction[] = ['posting', 'upload', 'login'];

const DEFAULT_MAINTENANCE_SETTINGS: MaintenanceModeSettings = {
  enabled: false,
  message: '',
  restrictedOperations: [],
  updatedAt: null,
};

function normalizeMaintenanceSettings(
  value: unknown,
  updatedAt: string | null,
): MaintenanceModeSettings {
  if (!value || typeof value !== 'object') return { ...DEFAULT_MAINTENANCE_SETTINGS };
  const raw = value as Partial<MaintenanceModeSettings>;
  const restrictedOperations = Array.isArray(raw.restrictedOperations)
    ? raw.restrictedOperations.filter((op): op is MaintenanceRestriction =>
        VALID_MAINTENANCE_RESTRICTIONS.includes(op as MaintenanceRestriction),
      )
    : [];
  return {
    enabled: raw.enabled === true,
    message: typeof raw.message === 'string' ? raw.message : '',
    restrictedOperations,
    updatedAt,
  };
}

function validateMaintenanceRestrictions(operations: unknown): MaintenanceRestriction[] {
  if (!Array.isArray(operations)) {
    throw createError('restrictedOperations must be an array', 400);
  }
  for (const op of operations) {
    if (!VALID_MAINTENANCE_RESTRICTIONS.includes(op as MaintenanceRestriction)) {
      throw createError('Invalid maintenance restriction', 400);
    }
  }
  return Array.from(new Set(operations as MaintenanceRestriction[]));
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

export async function getMaintenanceModeSettings(): Promise<MaintenanceModeSettings> {
  const row = await queryOne<{ value: unknown; updated_at: string }>(
    'SELECT value, updated_at FROM app_settings WHERE key = $1',
    [MAINTENANCE_SETTING_KEY],
  );
  return normalizeMaintenanceSettings(row?.value, row?.updated_at ?? null);
}

export async function updateMaintenanceModeSettings(input: {
  enabled: boolean;
  message?: string;
  restrictedOperations: unknown;
}): Promise<MaintenanceModeSettings> {
  const restrictedOperations = validateMaintenanceRestrictions(input.restrictedOperations);
  const settings: Omit<MaintenanceModeSettings, 'updatedAt'> = {
    enabled: input.enabled,
    message: input.message?.trim() ?? '',
    restrictedOperations,
  };
  const row = await queryOne<{ value: unknown; updated_at: string }>(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
     RETURNING value, updated_at`,
    [MAINTENANCE_SETTING_KEY, JSON.stringify(settings)],
  );
  return normalizeMaintenanceSettings(row?.value, row?.updated_at ?? null);
}

export async function isMaintenanceRestricted(
  operation: MaintenanceRestriction,
  userRole: 'user' | 'admin' = 'user',
): Promise<boolean> {
  if (userRole === 'admin') return false;
  const settings = await getMaintenanceModeSettings();
  return settings.enabled && settings.restrictedOperations.includes(operation);
}

function assertPlainObject(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw createError('Invalid settings JSON', 400);
  }
}

function validateSettingsExportData(value: unknown): SettingsExportData {
  assertPlainObject(value);
  if (value.schemaVersion !== 1) {
    throw createError('Unsupported settings schema version', 400);
  }
  for (const key of ['channels', 'notifications', 'ngWords', 'permissions']) {
    if (!Array.isArray(value[key])) {
      throw createError('Settings JSON schema mismatch', 400);
    }
  }
  return value as unknown as SettingsExportData;
}

export async function exportSettings(): Promise<SettingsExportData> {
  const channels = await query<{
    name: string;
    description: string | null;
    is_private: boolean;
    is_archived: boolean;
    is_recommended: boolean;
    posting_permission: string;
  }>(
    `SELECT name, description, is_private, is_archived, is_recommended, posting_permission
     FROM channels
     ORDER BY name ASC`,
  );

  const notifications = await query<{
    username: string;
    channel_name: string;
    level: string;
  }>(
    `SELECT u.username, c.name AS channel_name, s.level
     FROM channel_notification_settings s
     JOIN users u ON u.id = s.user_id
     JOIN channels c ON c.id = s.channel_id
     ORDER BY u.username ASC, c.name ASC`,
  );

  const ngWords = await query<{
    pattern: string;
    is_regex: boolean;
    action: string;
    is_active: boolean;
  }>(
    `SELECT pattern, is_regex, action, is_active
     FROM ng_words
     ORDER BY pattern ASC`,
  );

  const permissions = await query<{ username: string; role: 'user' | 'admin' }>(
    `SELECT username, role
     FROM users
     ORDER BY username ASC`,
  );

  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    channels: channels.map(
      (r): SettingsExportChannel => ({
        name: r.name,
        description: r.description,
        isPrivate: r.is_private,
        isArchived: r.is_archived,
        isRecommended: r.is_recommended,
        postingPermission: r.posting_permission,
      }),
    ),
    notifications: notifications.map(
      (r): SettingsExportNotification => ({
        username: r.username,
        channelName: r.channel_name,
        level: r.level,
      }),
    ),
    ngWords: ngWords.map(
      (r): SettingsExportNgWord => ({
        pattern: r.pattern,
        isRegex: r.is_regex,
        action: r.action,
        isActive: r.is_active,
      }),
    ),
    permissions: permissions.map(
      (r): SettingsExportPermission => ({
        username: r.username,
        role: r.role,
      }),
    ),
  };
}

function countChanges<T>(
  current: T[],
  incoming: T[],
  getKey: (item: T) => string,
  normalize: (item: T) => string,
): { added: number; updated: number; removed: number } {
  const currentMap = new Map(current.map((item) => [getKey(item), normalize(item)]));
  const incomingMap = new Map(incoming.map((item) => [getKey(item), normalize(item)]));
  let added = 0;
  let updated = 0;
  let removed = 0;
  for (const [key, value] of incomingMap) {
    if (!currentMap.has(key)) {
      added += 1;
    } else if (currentMap.get(key) !== value) {
      updated += 1;
    }
  }
  for (const key of currentMap.keys()) {
    if (!incomingMap.has(key)) removed += 1;
  }
  return { added, updated, removed };
}

export async function previewSettingsImport(input: unknown): Promise<SettingsImportPreview> {
  const data = validateSettingsExportData(input);
  const current = await exportSettings();
  const diff: SettingsImportDiff = {
    channels: countChanges(
      current.channels,
      data.channels,
      (item) => item.name,
      (item) => JSON.stringify(item),
    ),
    notifications: countChanges(
      current.notifications,
      data.notifications,
      (item) => `${item.username}:${item.channelName}`,
      (item) => JSON.stringify(item),
    ),
    ngWords: countChanges(
      current.ngWords,
      data.ngWords,
      (item) => item.pattern,
      (item) => JSON.stringify(item),
    ),
    permissions: {
      updated: data.permissions.filter((incoming) => {
        const currentPermission = current.permissions.find((p) => p.username === incoming.username);
        return currentPermission && currentPermission.role !== incoming.role;
      }).length,
    },
  };
  return { valid: true, diff };
}

export async function importSettings(input: unknown): Promise<SettingsImportPreview> {
  const data = validateSettingsExportData(input);
  const preview = await previewSettingsImport(data);

  for (const channel of data.channels) {
    await execute(
      `INSERT INTO channels (name, description, is_private, is_archived, is_recommended, posting_permission)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (name) DO UPDATE SET
         description = EXCLUDED.description,
         is_private = EXCLUDED.is_private,
         is_archived = EXCLUDED.is_archived,
         is_recommended = EXCLUDED.is_recommended,
         posting_permission = EXCLUDED.posting_permission`,
      [
        channel.name,
        channel.description,
        channel.isPrivate,
        channel.isArchived,
        channel.isRecommended,
        channel.postingPermission,
      ],
    );
  }

  await execute('DELETE FROM channel_notification_settings', []);
  for (const setting of data.notifications) {
    const user = await queryOne<{ id: number }>('SELECT id FROM users WHERE username = $1', [
      setting.username,
    ]);
    const channel = await queryOne<{ id: number }>('SELECT id FROM channels WHERE name = $1', [
      setting.channelName,
    ]);
    if (!user || !channel) continue;
    await execute(
      `INSERT INTO channel_notification_settings (user_id, channel_id, level)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, channel_id) DO UPDATE SET level = EXCLUDED.level, updated_at = NOW()`,
      [user.id, channel.id, setting.level],
    );
  }

  await execute('DELETE FROM ng_words', []);
  for (const word of data.ngWords) {
    await execute(
      `INSERT INTO ng_words (pattern, is_regex, action, is_active)
       VALUES ($1, $2, $3, $4)`,
      [word.pattern, word.isRegex, word.action, word.isActive],
    );
  }

  for (const permission of data.permissions) {
    if (permission.role !== 'user' && permission.role !== 'admin') {
      throw createError('Invalid role in settings JSON', 400);
    }
    await execute('UPDATE users SET role = $1 WHERE username = $2', [
      permission.role,
      permission.username,
    ]);
  }

  return preview;
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

// ─── 時系列集計（Issue #271） ─────────────────────────────────────
const PERIOD_HOURS: Record<PeriodKey, number> = {
  '24h': 24,
  '7d': 7 * 24,
  '30d': 30 * 24,
};

function determineGranularity(from: Date, to: Date): TimeseriesGranularity {
  const diffHours = (to.getTime() - from.getTime()) / (60 * 60 * 1000);
  return diffHours <= 24 ? 'hour' : 'day';
}

function truncateToBucket(d: Date, granularity: TimeseriesGranularity): Date {
  const r = new Date(d.getTime());
  if (granularity === 'hour') {
    r.setUTCMinutes(0, 0, 0);
  } else {
    r.setUTCHours(0, 0, 0, 0);
  }
  return r;
}

function generateBuckets(from: Date, to: Date, granularity: TimeseriesGranularity): Date[] {
  const start = truncateToBucket(from, granularity);
  const end = truncateToBucket(to, granularity);
  const buckets: Date[] = [];
  const stepMs = granularity === 'hour' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  for (let t = start.getTime(); t <= end.getTime(); t += stepMs) {
    buckets.push(new Date(t));
  }
  return buckets;
}

function coerceDate(value: Date | string | undefined, name: 'from' | 'to'): Date | undefined {
  if (value === undefined) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) {
    throw createError(`Invalid ${name} date`, 400);
  }
  return date;
}

function resolveTimeseriesRange(options: GetTimeseriesOptions): {
  from: Date;
  to: Date;
  granularity: TimeseriesGranularity;
} {
  const { period } = options;
  if (period !== undefined && !Object.prototype.hasOwnProperty.call(PERIOD_HOURS, period)) {
    throw createError('Invalid period', 400);
  }

  let from = coerceDate(options.from, 'from');
  let to = coerceDate(options.to, 'to');

  if (period) {
    to = to ?? new Date();
    from = from ?? new Date(to.getTime() - PERIOD_HOURS[period] * 60 * 60 * 1000);
  }

  if (!from || !to) {
    to = to ?? new Date();
    from = from ?? new Date(to.getTime() - PERIOD_HOURS['7d'] * 60 * 60 * 1000);
  }

  validateRange(from, to);
  return { from, to, granularity: options.granularity ?? determineGranularity(from, to) };
}

function validateRange(from: Date, to: Date): void {
  if (isNaN(from.getTime())) {
    throw createError('Invalid from date', 400);
  }
  if (isNaN(to.getTime())) {
    throw createError('Invalid to date', 400);
  }
  if (from > to) {
    throw createError('from must be before to', 400);
  }
}

function validateLimit(limit = 10): number {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw createError('limit must be between 1 and 100', 400);
  }
  return limit;
}

/**
 * 投稿数の時系列集計
 * - granularity 未指定時は from/to の差から自動判定（≤24h → hour、それ以外 → day）
 * - 期間内のバケットが空でも 0 件として埋める
 *
 * 注: pg-mem では date_trunc が未実装のため JavaScript 側でバケット計算する。
 *     データ量が大きくなる場合は本番 PostgreSQL 用に date_trunc 版を別途用意する想定。
 */
export async function getMessageTimeseries(
  options: GetTimeseriesOptions,
): Promise<TimeseriesPoint[]> {
  const { from, to, granularity } = resolveTimeseriesRange(options);

  const rows = await query<{ created_at: string }>(
    `SELECT created_at
     FROM messages
     WHERE is_deleted = false
       AND created_at >= $1
       AND created_at <= $2`,
    [from.toISOString(), to.toISOString()],
  );

  const map = new Map<string, number>();
  for (const r of rows) {
    const key = truncateToBucket(new Date(r.created_at), granularity).toISOString();
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  const buckets = generateBuckets(from, to, granularity);
  return buckets.map((b) => {
    const key = b.toISOString();
    return { timestamp: key, count: map.get(key) ?? 0 };
  });
}

// ─── 月次レポート CSV エクスポート（Issue #273） ─────────────────

/** RFC 4180 準拠の CSV フィールドエスケープ */
function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('\n') || value.includes('\r') || value.includes('"')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

export interface BuildMonthlyReportInput {
  year: number;
  month: number; // 1-12
}

/**
 * ワークスペース利用状況の月次レポートを CSV 形式の Buffer で返す。
 * 集計内容: ユーザー別投稿数 / チャンネル別投稿数 / ファイル容量合計
 *
 * 期間は対象月の UTC 1日 00:00:00 〜 翌月 1日 00:00:00（排他）。
 * UTF-8 BOM 先頭付与・CRLF 改行・RFC 4180 エスケープに従う。
 */
export async function buildMonthlyReportCsv(input: BuildMonthlyReportInput): Promise<Buffer> {
  const { year, month } = input;
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw createError('Invalid year/month', 400);
  }

  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const monthLabel = `${year}-${String(month).padStart(2, '0')}`;

  // ユーザー別投稿数
  const userRows = await query<{ user_id: number; username: string; cnt: string }>(
    `SELECT m.user_id AS user_id, u.username AS username, COUNT(*) AS cnt
     FROM messages m
     JOIN users u ON u.id = m.user_id
     WHERE m.is_deleted = false
       AND m.created_at >= $1 AND m.created_at < $2
     GROUP BY m.user_id, u.username
     ORDER BY COUNT(*) DESC, u.username ASC`,
    [startIso, endIso],
  );

  // チャンネル別投稿数
  const channelRows = await query<{ channel_id: number; channel_name: string; cnt: string }>(
    `SELECT m.channel_id AS channel_id, c.name AS channel_name, COUNT(*) AS cnt
     FROM messages m
     JOIN channels c ON c.id = m.channel_id
     WHERE m.is_deleted = false
       AND m.created_at >= $1 AND m.created_at < $2
     GROUP BY m.channel_id, c.name
     ORDER BY COUNT(*) DESC, c.name ASC`,
    [startIso, endIso],
  );

  // ファイル容量
  const fileRow = await queryOne<{ total: string | null; cnt: string }>(
    `SELECT COALESCE(SUM(size), 0) AS total, COUNT(*) AS cnt
     FROM message_attachments
     WHERE created_at >= $1 AND created_at < $2`,
    [startIso, endIso],
  );

  const lines: string[] = [];
  lines.push(`# Monthly Report ${monthLabel}`);
  lines.push(`# Range: ${startIso} - ${endIso}`);
  lines.push('');
  lines.push('# Users');
  lines.push('user_id,username,message_count');
  for (const r of userRows) {
    lines.push(
      [String(r.user_id), escapeCsvField(String(r.username ?? '')), String(Number(r.cnt))].join(
        ',',
      ),
    );
  }
  lines.push('');
  lines.push('# Channels');
  lines.push('channel_id,channel_name,message_count');
  for (const r of channelRows) {
    lines.push(
      [
        String(r.channel_id),
        escapeCsvField(String(r.channel_name ?? '')),
        String(Number(r.cnt)),
      ].join(','),
    );
  }
  lines.push('');
  lines.push('# Files');
  lines.push('total_bytes,file_count');
  lines.push(`${Number(fileRow?.total ?? 0)},${Number(fileRow?.cnt ?? 0)}`);

  const csvText = lines.join('\r\n') + '\r\n';
  const bom = Buffer.from([0xef, 0xbb, 0xbf]);
  return Buffer.concat([bom, Buffer.from(csvText, 'utf8')]);
}

/**
 * アクティブユーザー数の時系列集計
 * - 各バケット内に last_login_at を持つユーザー数（重複なし）を返す
 */
export async function getActiveUsersTimeseries(
  options: GetTimeseriesOptions,
): Promise<TimeseriesPoint[]> {
  const { from, to, granularity } = resolveTimeseriesRange(options);

  const rows = await query<{ id: number; last_login_at: string }>(
    `SELECT id, last_login_at
     FROM users
     WHERE last_login_at IS NOT NULL
       AND last_login_at >= $1
       AND last_login_at <= $2`,
    [from.toISOString(), to.toISOString()],
  );

  // バケット → ユニークユーザー集合
  const bucketUsers = new Map<string, Set<number>>();
  for (const r of rows) {
    const key = truncateToBucket(new Date(r.last_login_at), granularity).toISOString();
    if (!bucketUsers.has(key)) bucketUsers.set(key, new Set());
    bucketUsers.get(key)!.add(r.id);
  }

  const buckets = generateBuckets(from, to, granularity);
  return buckets.map((b) => {
    const key = b.toISOString();
    return { timestamp: key, count: bucketUsers.get(key)?.size ?? 0 };
  });
}

export async function getMessagesByChannelTimeseries(
  options: GetTimeseriesOptions,
): Promise<ChannelTimeseries[]> {
  const { from, to, granularity } = resolveTimeseriesRange(options);
  const rows = await query<{ channel_id: number; channel_name: string; created_at: string }>(
    `SELECT m.channel_id, c.name AS channel_name, m.created_at
     FROM messages m
     JOIN channels c ON c.id = m.channel_id
     WHERE m.is_deleted = false
       AND m.created_at >= $1
       AND m.created_at <= $2
     ORDER BY c.name ASC, m.created_at ASC`,
    [from.toISOString(), to.toISOString()],
  );

  const buckets = generateBuckets(from, to, granularity);
  const byChannel = new Map<number, { channelName: string; counts: Map<string, number> }>();
  for (const row of rows) {
    const bucket = truncateToBucket(new Date(row.created_at), granularity).toISOString();
    const entry = byChannel.get(row.channel_id) ?? {
      channelName: row.channel_name,
      counts: new Map<string, number>(),
    };
    entry.counts.set(bucket, (entry.counts.get(bucket) ?? 0) + 1);
    byChannel.set(row.channel_id, entry);
  }

  return Array.from(byChannel.entries()).map(([channelId, entry]) => ({
    channelId,
    channelName: entry.channelName,
    points: buckets.map((bucket) => {
      const key = bucket.toISOString();
      return { timestamp: key, count: entry.counts.get(key) ?? 0 };
    }),
  }));
}

export async function getTopChannelsByMessageCount(
  options: GetTimeseriesOptions & { limit?: number },
): Promise<TopChannelByMessageCount[]> {
  const { from, to } = resolveTimeseriesRange(options);
  const limit = validateLimit(options.limit);
  const rows = await query<{ channel_id: number; channel_name: string; cnt: string }>(
    `SELECT m.channel_id, c.name AS channel_name, COUNT(*) AS cnt
     FROM messages m
     JOIN channels c ON c.id = m.channel_id
     WHERE m.is_deleted = false
       AND m.created_at >= $1
       AND m.created_at <= $2
     GROUP BY m.channel_id, c.name
     ORDER BY COUNT(*) DESC, c.name ASC
     LIMIT $3`,
    [from.toISOString(), to.toISOString(), limit],
  );
  return rows.map((row) => ({
    channelId: row.channel_id,
    channelName: row.channel_name,
    count: Number(row.cnt),
  }));
}

export async function getTopUsersByMessageCount(
  options: GetTimeseriesOptions & { limit?: number },
): Promise<TopUserByMessageCount[]> {
  const { from, to } = resolveTimeseriesRange(options);
  const limit = validateLimit(options.limit);
  const rows = await query<{ user_id: number | null; username: string | null; cnt: string }>(
    `SELECT m.user_id, u.username, COUNT(*) AS cnt
     FROM messages m
     LEFT JOIN users u ON u.id = m.user_id
     WHERE m.is_deleted = false
       AND m.created_at >= $1
       AND m.created_at <= $2
     GROUP BY m.user_id, u.username
     ORDER BY COUNT(*) DESC, u.username ASC
     LIMIT $3`,
    [from.toISOString(), to.toISOString(), limit],
  );
  return rows.map((row) => ({
    userId: row.user_id,
    username: row.username,
    count: Number(row.cnt),
  }));
}
