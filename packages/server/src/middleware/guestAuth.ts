/**
 * ゲストトークン認証ミドルウェア（#149）
 * - middleware/auth.ts には依存しない（authenticateToken と独立）
 * - Authorization: Bearer <jwt> でゲスト JWT を受け取り、
 *   payload の token / channelId と DB の guest_links を突き合わせて認可する
 * - 既存ユーザーの cookie token は無視する（ゲストフロー固定）
 */

import { Request, Response, NextFunction } from 'express';
import { createError } from './errorHandler';
import jwt from 'jsonwebtoken';
import { queryOne } from '../db/database';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-please-change-in-production';

export interface GuestRequest extends Request {
  guest: {
    token: string;
    channelId: number;
    linkId: number;
  };
}

interface GuestPayload {
  type?: string;
  token?: string;
  channelId?: number;
  linkId?: number;
}

interface GuestLinkRow {
  id: number;
  channel_id: number;
  expires_at: string | null;
  is_revoked: boolean;
}

export async function guestAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    next(createError('ゲストトークンが必要です', 401));
    return;
  }

  const token = auth.substring('Bearer '.length).trim();
  if (!token) {
    next(createError('ゲストトークンが必要です', 401));
    return;
  }

  let payload: GuestPayload;
  try {
    payload = jwt.verify(token, JWT_SECRET) as GuestPayload;
  } catch {
    next(createError('ゲストトークンが無効です', 401));
    return;
  }

  if (payload.type !== 'guest' || !payload.token || !payload.channelId) {
    next(createError('ゲストトークンが無効です', 401));
    return;
  }

  // DB と突き合わせ
  const row = await queryOne<GuestLinkRow>(
    'SELECT id, channel_id, expires_at, is_revoked FROM guest_links WHERE token = $1',
    [payload.token],
  );
  if (!row) {
    next(createError('ゲストリンクが見つかりません', 401));
    return;
  }
  if (row.is_revoked) {
    next(createError('ゲストリンクは無効化されています', 410));
    return;
  }
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    next(createError('ゲストリンクの有効期限が切れています', 410));
    return;
  }
  if (row.channel_id !== payload.channelId) {
    next(createError('チャンネル ID が一致しません', 403));
    return;
  }

  (req as GuestRequest).guest = {
    token: payload.token,
    channelId: payload.channelId,
    linkId: row.id,
  };
  next();
}
