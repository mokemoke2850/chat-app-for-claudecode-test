/**
 * ゲスト閲覧リンクサービス（#149）
 * - 未登録ユーザー向け読み取り専用公開URLの発行・失効・検証を担当する
 * - パスワードは bcrypt でハッシュ化して保存し、平文では返さない
 * - 検証失敗の総当たり対策として、トークン単位の短期ブロックをメモリ Map で実装する
 * - パスワード検証に成功すると短期 JWT（ゲストセッション）を発行する
 */

import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query, queryOne } from '../db/database';
import type {
  GuestLink,
  CreateGuestLinkInput,
  GuestLinkLookupResult,
  GuestLinkVerifyResult,
} from '@chat-app/shared';
import { createError } from '../middleware/errorHandler';
import { assertOwnerOrAdmin } from './permissionService';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-please-change-in-production';
const GUEST_JWT_EXPIRES_IN = '2h'; // ゲストセッションは短期
const BCRYPT_ROUNDS = 10;

// 総当たり対策: トークンごとの失敗カウント
const FAIL_THRESHOLD = 5;
const BLOCK_DURATION_MS = 60 * 1000; // 1 分間ブロック
interface FailRecord {
  count: number;
  blockedUntil: number;
}
const failureMap = new Map<string, FailRecord>();

interface GuestLinkRow {
  id: number;
  token: string;
  channel_id: number;
  created_by: number | null;
  password_hash: string | null;
  expires_at: string | null;
  is_revoked: boolean;
  created_at: string;
}

function toGuestLink(row: GuestLinkRow): GuestLink {
  return {
    id: row.id,
    token: row.token,
    channelId: row.channel_id,
    createdBy: row.created_by,
    hasPassword: row.password_hash !== null && row.password_hash !== '',
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    isRevoked: row.is_revoked,
    createdAt: String(row.created_at),
  };
}

/** URL セーフな base64url トークン（24 byte → 32 文字以上）を生成 */
export function generateGuestToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

/** ゲストリンクを作成する */
export async function create(userId: number, input: CreateGuestLinkInput): Promise<GuestLink> {
  // 対象チャンネル存在確認
  const channel = await queryOne('SELECT id FROM channels WHERE id = $1', [input.channelId]);
  if (!channel) {
    throw createError('チャンネルが見つかりません', 404);
  }

  const token = generateGuestToken();
  const expiresAt =
    input.expiresInHours != null
      ? new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000).toISOString()
      : null;
  const passwordHash =
    input.password != null && input.password !== ''
      ? await bcrypt.hash(input.password, BCRYPT_ROUNDS)
      : null;

  const row = await queryOne<GuestLinkRow>(
    `INSERT INTO guest_links (token, channel_id, created_by, password_hash, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [token, input.channelId, userId, passwordHash, expiresAt],
  );
  return toGuestLink(row!);
}

/** チャンネル ID 指定の一覧取得 */
export async function listByChannel(channelId: number): Promise<GuestLink[]> {
  const rows = await query<GuestLinkRow>(
    'SELECT * FROM guest_links WHERE channel_id = $1 ORDER BY created_at DESC',
    [channelId],
  );
  return rows.map(toGuestLink);
}

/** ID で取得 */
export async function findById(id: number): Promise<GuestLink | null> {
  const row = await queryOne<GuestLinkRow>('SELECT * FROM guest_links WHERE id = $1', [id]);
  return row ? toGuestLink(row) : null;
}

/** ゲストリンクを失効する */
export async function revoke(userId: number, linkId: number, isAdmin: boolean): Promise<GuestLink> {
  const existing = await queryOne<GuestLinkRow>('SELECT * FROM guest_links WHERE id = $1', [
    linkId,
  ]);
  if (!existing) throw createError('ゲストリンクが見つかりません', 404);
  assertOwnerOrAdmin(
    existing.created_by,
    userId,
    isAdmin,
    'このゲストリンクを失効する権限がありません',
  );

  const row = await queryOne<GuestLinkRow>(
    'UPDATE guest_links SET is_revoked = true WHERE id = $1 RETURNING *',
    [linkId],
  );
  return toGuestLink(row!);
}

/** トークン情報を取得（公開・パスワードハッシュは含まない） */
export async function lookup(token: string): Promise<GuestLinkLookupResult | null> {
  const row = await queryOne<GuestLinkRow & { channel_name: string | null }>(
    `SELECT gl.*, c.name AS channel_name
     FROM guest_links gl
     LEFT JOIN channels c ON c.id = gl.channel_id
     WHERE gl.token = $1`,
    [token],
  );
  if (!row) return null;

  const isExpired = row.expires_at !== null && new Date(row.expires_at) < new Date();

  return {
    token: row.token,
    channelId: row.channel_id,
    channelName: row.channel_name,
    hasPassword: row.password_hash !== null && row.password_hash !== '',
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    isExpired,
    isRevoked: row.is_revoked,
  };
}

/** トークン単位の総当たりブロック判定 */
function isBlocked(token: string): boolean {
  const rec = failureMap.get(token);
  if (!rec) return false;
  if (rec.blockedUntil > Date.now()) return true;
  // ブロック期間が過ぎたらリセット
  if (rec.blockedUntil > 0 && rec.blockedUntil <= Date.now()) {
    failureMap.delete(token);
  }
  return false;
}

function recordFailure(token: string): void {
  const rec = failureMap.get(token) ?? { count: 0, blockedUntil: 0 };
  rec.count += 1;
  if (rec.count >= FAIL_THRESHOLD) {
    rec.blockedUntil = Date.now() + BLOCK_DURATION_MS;
  }
  failureMap.set(token, rec);
}

function clearFailures(token: string): void {
  failureMap.delete(token);
}

/** テスト用: 失敗カウンタをリセット */
export function _resetFailureMap(): void {
  failureMap.clear();
}

/**
 * パスワード検証 + ゲストセッション JWT 発行。
 * - 失効・期限切れは 410（createError 経由）
 * - パスワード不一致は 401
 * - ブロック中は 429
 */
export async function verifyAndIssueSession(
  token: string,
  password: string | null | undefined,
): Promise<GuestLinkVerifyResult> {
  if (isBlocked(token)) {
    throw createError('検証失敗が連続したためブロックされています。しばらくお待ちください', 429);
  }

  const row = await queryOne<GuestLinkRow & { channel_name: string | null }>(
    `SELECT gl.*, c.name AS channel_name
     FROM guest_links gl
     LEFT JOIN channels c ON c.id = gl.channel_id
     WHERE gl.token = $1`,
    [token],
  );
  if (!row) throw createError('ゲストリンクが見つかりません', 404);
  if (row.is_revoked) throw createError('このリンクは無効化されています', 410);
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    throw createError('このリンクは有効期限が切れています', 410);
  }

  // パスワード検証
  if (row.password_hash) {
    if (password == null || password === '') {
      recordFailure(token);
      throw createError('パスワードが必要です', 401);
    }
    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) {
      recordFailure(token);
      throw createError('パスワードが正しくありません', 401);
    }
  }

  clearFailures(token);

  const guestToken = jwt.sign(
    { type: 'guest', token: row.token, channelId: row.channel_id, linkId: row.id },
    JWT_SECRET,
    { expiresIn: GUEST_JWT_EXPIRES_IN },
  );

  return {
    guestToken,
    channelId: row.channel_id,
    channelName: row.channel_name,
  };
}

/**
 * ゲストトークン経由でチャンネル本体メッセージを取得する（読み取り専用）。
 * - is_deleted = false のメッセージのみ
 * - parent_message_id IS NULL（トップレベルのみ。スレッド返信は除外）
 * - 添付メタデータは含む（リアクションは含まない）
 */
export async function listGuestMessages(channelId: number): Promise<
  Array<{
    id: number;
    channelId: number;
    userId: number | null;
    username: string | null;
    avatarUrl: string | null;
    content: string;
    createdAt: string;
    updatedAt: string;
    isEdited: boolean;
    attachments: Array<{
      id: number;
      url: string;
      originalName: string;
      size: number;
      mimeType: string;
    }>;
  }>
> {
  const rows = await query<{
    id: number;
    channel_id: number;
    user_id: number | null;
    username: string | null;
    avatar_url: string | null;
    content: string;
    created_at: string;
    updated_at: string;
    is_edited: boolean;
  }>(
    `SELECT m.id, m.channel_id, m.user_id, u.username, u.avatar_url, m.content,
            m.created_at, m.updated_at, m.is_edited
     FROM messages m
     LEFT JOIN users u ON u.id = m.user_id
     WHERE m.channel_id = $1
       AND m.is_deleted = false
       AND m.parent_message_id IS NULL
     ORDER BY m.created_at ASC, m.id ASC`,
    [channelId],
  );

  // 添付をまとめて取得
  const ids = rows.map((r) => r.id);
  const attachmentMap = new Map<
    number,
    Array<{ id: number; url: string; originalName: string; size: number; mimeType: string }>
  >();
  if (ids.length > 0) {
    const attRows = await query<{
      id: number;
      message_id: number;
      url: string;
      original_name: string;
      size: number;
      mime_type: string;
    }>(
      `SELECT id, message_id, url, original_name, size, mime_type
       FROM message_attachments
       WHERE message_id = ANY($1::int[])`,
      [ids],
    );
    for (const att of attRows) {
      const list = attachmentMap.get(att.message_id) ?? [];
      list.push({
        id: att.id,
        url: att.url,
        originalName: att.original_name,
        size: Number(att.size),
        mimeType: att.mime_type,
      });
      attachmentMap.set(att.message_id, list);
    }
  }

  return rows.map((r) => ({
    id: r.id,
    channelId: r.channel_id,
    userId: r.user_id,
    username: r.username,
    avatarUrl: r.avatar_url ?? null,
    content: r.content,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
    isEdited: r.is_edited,
    attachments: attachmentMap.get(r.id) ?? [],
  }));
}
