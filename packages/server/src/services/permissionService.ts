/**
 * 権限判定の共通モジュール（#373 権限判定ロジックの集約）
 *
 * サービス・コントローラ・ルートに散在していた権限判定を一元化する。
 * - 本アプリのロールは users.role = 'user' | 'admin' の2種
 * - 権限軸: 管理者(admin) / チャンネルメンバー / リソース所有者(created_by)
 * - チャンネル投稿権限(canPost)もここに集約する（旧 channelService から移動）
 */
import { queryOne } from '../db/database';
import { createError } from '../middleware/errorHandler';
import type { ChannelPostingPermission } from '@chat-app/shared';

/** 管理者ロールの識別子 */
export const ROLE_ADMIN = 'admin';

/** ユーザーが管理者かどうかを判定する */
export async function isAdmin(userId: number): Promise<boolean> {
  const row = await queryOne<{ role: string }>('SELECT role FROM users WHERE id = $1', [userId]);
  return row?.role === ROLE_ADMIN;
}

/** ユーザーが指定チャンネルのメンバーかどうかを判定する */
export async function isChannelMember(userId: number, channelId: number): Promise<boolean> {
  const row = await queryOne<{ user_id: number }>(
    'SELECT user_id FROM channel_members WHERE channel_id = $1 AND user_id = $2',
    [channelId, userId],
  );
  return row !== null;
}

/**
 * リソースの所有者本人、または管理者でなければ 403 を投げる。
 * 「自分のリソースは編集可、ただし管理者は他人のものも可」という頻出パターンを集約する。
 */
export function assertOwnerOrAdmin(
  ownerId: number | null,
  userId: number,
  admin: boolean,
  message = 'Forbidden',
): void {
  if (!admin && ownerId !== userId) {
    throw createError(message, 403);
  }
}

/**
 * チャンネルへの投稿可否を判定する（旧 channelService.canPost を移動）。
 * - readonly: 常に false
 * - admins:   管理者のみ true
 * - everyone: プライベートはメンバーのみ true、パブリックは誰でも true
 */
export async function canPost(userId: number, channelId: number): Promise<boolean> {
  const channel = await queryOne<{
    id: number;
    is_private: boolean;
    posting_permission: ChannelPostingPermission;
  }>('SELECT id, is_private, posting_permission FROM channels WHERE id = $1', [channelId]);
  if (!channel) return false;

  const permission = channel.posting_permission ?? 'everyone';

  if (permission === 'readonly') return false;

  if (permission === 'admins') {
    return isAdmin(userId);
  }

  // permission === 'everyone'
  // プライベートチャンネルはメンバーシップが必要、パブリックは誰でも投稿可
  if (channel.is_private) {
    return isChannelMember(userId, channelId);
  }
  return true;
}
