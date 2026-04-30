/**
 * ゲストトークン認証ミドルウェア（#149）
 * - middleware/auth.ts には依存しない（authenticateToken と独立）
 * - Authorization: Bearer <jwt> でゲスト JWT を受け取り、
 *   payload の token / channelId と DB の guest_links を突き合わせて認可する
 * - 既存ユーザーの cookie token は無視する（ゲストフロー固定）
 */

import { Request, Response, NextFunction } from 'express';
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
    res.status(401).json({ error: 'ゲストトークンが必要です' });
    return;
  }

  const token = auth.substring('Bearer '.length).trim();
  if (!token) {
    res.status(401).json({ error: 'ゲストトークンが必要です' });
    return;
  }

  let payload: GuestPayload;
  try {
    payload = jwt.verify(token, JWT_SECRET) as GuestPayload;
  } catch {
    res.status(401).json({ error: 'ゲストトークンが無効です' });
    return;
  }

  if (payload.type !== 'guest' || !payload.token || !payload.channelId) {
    res.status(401).json({ error: 'ゲストトークンが無効です' });
    return;
  }

  // DB と突き合わせ
  const row = await queryOne<GuestLinkRow>(
    'SELECT id, channel_id, expires_at, is_revoked FROM guest_links WHERE token = $1',
    [payload.token],
  );
  if (!row) {
    res.status(401).json({ error: 'ゲストリンクが見つかりません' });
    return;
  }
  if (row.is_revoked) {
    res.status(410).json({ error: 'ゲストリンクは無効化されています' });
    return;
  }
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    res.status(410).json({ error: 'ゲストリンクの有効期限が切れています' });
    return;
  }
  if (row.channel_id !== payload.channelId) {
    res.status(403).json({ error: 'チャンネル ID が一致しません' });
    return;
  }

  (req as GuestRequest).guest = {
    token: payload.token,
    channelId: payload.channelId,
    linkId: row.id,
  };
  next();
}
