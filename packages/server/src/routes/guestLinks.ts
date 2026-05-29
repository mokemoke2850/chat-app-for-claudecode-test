/**
 * ゲスト閲覧リンク API ルート（#149）
 *
 * - 管理ルート（authenticateToken 必須）:
 *   POST   /api/channels/:id/guest-links  発行
 *   GET    /api/channels/:id/guest-links  一覧
 *   DELETE /api/guest-links/:id           失効
 * - 公開ルート（認証不要）:
 *   GET  /api/guest-links/:token         トークン情報
 *   POST /api/guest-links/:token/verify  パスワード検証 + ゲストセッション発行
 * - ゲストセッション必須:
 *   GET  /api/guest-links/:token/messages  メッセージ取得（guestAuth ミドルウェア）
 */

import { Router, Request, Response, NextFunction } from 'express';
import { createError } from '../middleware/errorHandler';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { guestAuth, GuestRequest } from '../middleware/guestAuth';
import { queryOne } from '../db/database';
import * as guestLinkService from '../services/guestLinkService';
import * as permissionService from '../services/permissionService';
import * as auditLogService from '../services/auditLogService';

// 管理者・チャンネル別の発行/一覧用ルーター（/api/channels/:id/guest-links 配下）
export const channelGuestLinksRouter = Router({ mergeParams: true });

channelGuestLinksRouter.post(
  '/',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthenticatedRequest).userId;
      const channelId = Number(
        (req.params as { id?: string; channelId?: string }).id ??
          (req.params as { channelId?: string }).channelId,
      );
      if (!channelId || Number.isNaN(channelId)) {
        next(createError('チャンネル ID が不正です', 400));
        return;
      }

      const isAdmin = await permissionService.isAdmin(userId);

      const channel = await queryOne<{ id: number }>('SELECT id FROM channels WHERE id = $1', [
        channelId,
      ]);
      if (!channel) {
        next(createError('チャンネルが見つかりません', 404));
        return;
      }

      if (!isAdmin) {
        const member = await queryOne(
          'SELECT 1 FROM channel_members WHERE channel_id = $1 AND user_id = $2',
          [channelId, userId],
        );
        if (!member) {
          next(createError('ゲストリンクを発行する権限がありません', 403));
          return;
        }
      }

      const { password, expiresInHours } = req.body as {
        password?: string | null;
        expiresInHours?: number | null;
      };
      const guestLink = await guestLinkService.create(userId, {
        channelId,
        password: password ?? null,
        expiresInHours: expiresInHours ?? null,
      });

      await auditLogService.record({
        actorUserId: userId,
        actionType: 'guest_link.create',
        targetType: 'channel',
        targetId: channelId,
        metadata: { guestLinkId: guestLink.id, token: guestLink.token },
      });

      res.status(201).json({ guestLink });
    } catch (err) {
      next(err);
    }
  },
);

channelGuestLinksRouter.get(
  '/',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthenticatedRequest).userId;
      const channelId = Number(
        (req.params as { id?: string; channelId?: string }).id ??
          (req.params as { channelId?: string }).channelId,
      );
      if (!channelId || Number.isNaN(channelId)) {
        next(createError('チャンネル ID が不正です', 400));
        return;
      }

      const isAdmin = await permissionService.isAdmin(userId);

      if (!isAdmin) {
        const member = await queryOne(
          'SELECT 1 FROM channel_members WHERE channel_id = $1 AND user_id = $2',
          [channelId, userId],
        );
        if (!member) {
          next(createError('ゲストリンク一覧を取得する権限がありません', 403));
          return;
        }
      }

      const guestLinks = await guestLinkService.listByChannel(channelId);
      res.json({ guestLinks });
    } catch (err) {
      next(err);
    }
  },
);

// 公開・トップレベル用ルーター（/api/guest-links 配下）
const router = Router();

/** DELETE /api/guest-links/:id — 失効（認証必須） */
router.delete(
  '/:id',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthenticatedRequest).userId;
      const linkId = Number(req.params.id);
      if (!linkId || Number.isNaN(linkId)) {
        next(createError('ID が不正です', 400));
        return;
      }

      const isAdmin = await permissionService.isAdmin(userId);

      const guestLink = await guestLinkService.revoke(userId, linkId, isAdmin);

      await auditLogService.record({
        actorUserId: userId,
        actionType: 'guest_link.revoke',
        targetType: 'channel',
        targetId: guestLink.channelId,
        metadata: { guestLinkId: guestLink.id },
      });

      res.json({ guestLink });
    } catch (err) {
      next(err);
    }
  },
);

/** GET /api/guest-links/:token — トークン情報（公開） */
router.get('/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;
    const result = await guestLinkService.lookup(token);
    if (!result) {
      next(createError('ゲストリンクが見つかりません', 404));
      return;
    }
    res.json({ guestLink: result });
  } catch (err) {
    next(err);
  }
});

/** POST /api/guest-links/:token/verify — パスワード検証 + ゲストセッション発行 */
router.post('/:token/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;
    const { password } = req.body as { password?: string | null };
    const result = await guestLinkService.verifyAndIssueSession(token, password);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** GET /api/guest-links/:token/messages — 公開メッセージ取得（ゲストセッション必須） */
router.get(
  '/:token/messages',
  guestAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guest = (req as GuestRequest).guest;
      const tokenParam = req.params.token;
      // パス上のトークンと JWT 内のトークンが一致することを再確認
      if (tokenParam !== guest.token) {
        next(createError('トークンが一致しません', 403));
        return;
      }
      const messages = await guestLinkService.listGuestMessages(guest.channelId);
      res.json({ messages });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
