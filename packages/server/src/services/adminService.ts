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

export type TimeseriesGranularity = 'hour' | 'day';

export interface TimeseriesPoint {
  timestamp: string; // ISO8601
  count: number;
}

export interface GetTimeseriesOptions {
  from: Date;
  to: Date;
  granularity?: TimeseriesGranularity;
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

// ─── 時系列集計（Issue #271） ─────────────────────────────────────
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

function validateRange(from: Date, to: Date): void {
  if (!(from instanceof Date) || isNaN(from.getTime())) {
    throw createError('Invalid from date', 400);
  }
  if (!(to instanceof Date) || isNaN(to.getTime())) {
    throw createError('Invalid to date', 400);
  }
  if (from > to) {
    throw createError('from must be before to', 400);
  }
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
  const { from, to } = options;
  validateRange(from, to);
  const granularity = options.granularity ?? determineGranularity(from, to);

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
  const { from, to } = options;
  validateRange(from, to);
  const granularity = options.granularity ?? determineGranularity(from, to);

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
