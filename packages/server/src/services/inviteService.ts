import crypto from 'crypto';
import { query, queryOne, execute } from '../db/database';
import type { InviteLink, CreateInviteLinkInput, InviteLinkLookupResult } from '@chat-app/shared';
import { createError } from '../middleware/errorHandler';

interface InviteLinkRow {
  id: number;
  token: string;
  channel_id: number | null;
  created_by: number | null;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  is_revoked: boolean;
  created_at: string;
}

function toInviteLink(row: InviteLinkRow): InviteLink {
  return {
    id: row.id,
    token: row.token,
    channelId: row.channel_id,
    createdBy: row.created_by,
    maxUses: row.max_uses,
    usedCount: Number(row.used_count),
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    isRevoked: row.is_revoked,
    createdAt: String(row.created_at),
  };
}

/** URL セーフな 32 文字以上の token を生成する */
export function generateToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

/** 招待リンクを作成する */
export async function create(userId: number, input: CreateInviteLinkInput): Promise<InviteLink> {
  const token = generateToken();
  const expiresAt =
    input.expiresInHours != null
      ? new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000).toISOString()
      : null;

  const row = await queryOne<InviteLinkRow>(
    `INSERT INTO invite_links (token, channel_id, created_by, max_uses, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [token, input.channelId ?? null, userId, input.maxUses ?? null, expiresAt],
  );
  return toInviteLink(row!);
}

/** 特定チャンネルの招待リンク一覧を取得する */
export async function listByChannel(channelId: number): Promise<InviteLink[]> {
  const rows = await query<InviteLinkRow>(
    'SELECT * FROM invite_links WHERE channel_id = $1 ORDER BY created_at DESC',
    [channelId],
  );
  return rows.map(toInviteLink);
}

/** 全招待リンクを取得する（管理者用） */
export async function listAll(): Promise<InviteLink[]> {
  const rows = await query<InviteLinkRow>('SELECT * FROM invite_links ORDER BY created_at DESC');
  return rows.map(toInviteLink);
}

/** 招待リンクを無効化する */
export async function revoke(
  userId: number,
  inviteId: number,
  isAdmin: boolean,
): Promise<InviteLink> {
  const existing = await queryOne<InviteLinkRow>('SELECT * FROM invite_links WHERE id = $1', [
    inviteId,
  ]);
  if (!existing) throw createError('招待リンクが見つかりません', 404);
  if (!isAdmin && existing.created_by !== userId) {
    throw createError('この招待リンクを無効化する権限がありません', 403);
  }

  const row = await queryOne<InviteLinkRow>(
    'UPDATE invite_links SET is_revoked = true WHERE id = $1 RETURNING *',
    [inviteId],
  );
  return toInviteLink(row!);
}

/**
 * 招待リンクを使用してチャンネルに参加する。
 * トランザクション + 条件付き UPDATE でレースコンディションに対応する。
 */
export async function redeem(token: string, userId: number): Promise<{ channelId: number | null }> {
  // まずトークンを取得して有効性チェック
  const invite = await queryOne<InviteLinkRow>('SELECT * FROM invite_links WHERE token = $1', [
    token,
  ]);
  if (!invite) throw createError('招待リンクが無効または存在しません', 410);
  if (invite.is_revoked) throw createError('この招待リンクは無効化されています', 410);
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    throw createError('招待リンクの有効期限が切れています', 410);
  }
  if (invite.max_uses !== null && invite.used_count >= invite.max_uses) {
    throw createError('招待リンクの使用上限に達しています', 410);
  }

  const channelId = invite.channel_id;

  if (channelId !== null) {
    // チャンネル招待: 既存メンバーかチェック
    const alreadyMember = await queryOne(
      'SELECT 1 FROM channel_members WHERE channel_id = $1 AND user_id = $2',
      [channelId, userId],
    );
    if (alreadyMember) {
      // 既にメンバー: 成功扱いだが used_count は増やさない
      return { channelId };
    }

    // 条件付き UPDATE でレースコンディション対策
    const updated = await execute(
      `UPDATE invite_links
       SET used_count = used_count + 1
       WHERE id = $1
         AND is_revoked = false
         AND (expires_at IS NULL OR expires_at > NOW())
         AND (max_uses IS NULL OR used_count < max_uses)`,
      [invite.id],
    );
    if (updated.rowCount === 0) {
      throw createError('招待リンクが無効または使用上限に達しています', 410);
    }

    // チャンネルメンバーとして追加
    await execute(
      `INSERT INTO channel_members (channel_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [channelId, userId],
    );
  } else {
    // ワークスペース招待: 公開チャンネル全て
    // 条件付き UPDATE でレースコンディション対策
    const updated = await execute(
      `UPDATE invite_links
       SET used_count = used_count + 1
       WHERE id = $1
         AND is_revoked = false
         AND (expires_at IS NULL OR expires_at > NOW())
         AND (max_uses IS NULL OR used_count < max_uses)`,
      [invite.id],
    );
    if (updated.rowCount === 0) {
      throw createError('招待リンクが無効または使用上限に達しています', 410);
    }

    // 全公開チャンネルを取得してメンバー追加
    const publicChannels = await query<{ id: number }>(
      'SELECT id FROM channels WHERE is_private = false AND is_archived = false',
    );
    for (const ch of publicChannels) {
      await execute(
        `INSERT INTO channel_members (channel_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [ch.id, userId],
      );
    }
  }

  // 使用履歴を記録
  await execute('INSERT INTO invite_link_uses (invite_id, user_id) VALUES ($1, $2)', [
    invite.id,
    userId,
  ]);

  return { channelId };
}

/** トークンの情報を取得する（認証不要・プレビュー用） */
export async function lookup(token: string): Promise<InviteLinkLookupResult | null> {
  const row = await queryOne<InviteLinkRow & { channel_name: string | null }>(
    `SELECT il.*, c.name AS channel_name
     FROM invite_links il
     LEFT JOIN channels c ON c.id = il.channel_id
     WHERE il.token = $1`,
    [token],
  );
  if (!row) return null;

  const isExpired = row.expires_at !== null && new Date(row.expires_at) < new Date();
  const isExhausted = row.max_uses !== null && Number(row.used_count) >= row.max_uses;

  return {
    token: row.token,
    channelId: row.channel_id,
    channelName: row.channel_name,
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    isExpired,
    isRevoked: row.is_revoked,
    isExhausted,
  };
}
