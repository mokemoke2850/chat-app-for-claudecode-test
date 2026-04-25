import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { queryOne } from '../db/database';
import * as inviteService from '../services/inviteService';
import * as auditLogService from '../services/auditLogService';

const router = Router();

/**
 * POST /api/invites
 * 招待リンクを作成する（チャンネル管理者または admin のみ）
 */
router.post('/', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const { channelId, maxUses, expiresInHours } = req.body as {
      channelId?: number | null;
      maxUses?: number | null;
      expiresInHours?: number | null;
    };

    // 権限チェック: channel_id が指定された場合はメンバーであることを確認
    // admin は常に許可
    const userRow = await queryOne<{ role: string }>('SELECT role FROM users WHERE id = $1', [
      userId,
    ]);
    const isAdmin = userRow?.role === 'admin';

    if (!isAdmin && channelId != null) {
      const member = await queryOne(
        'SELECT 1 FROM channel_members WHERE channel_id = $1 AND user_id = $2',
        [channelId, userId],
      );
      // チャンネル作成者かどうかも確認
      const creator = await queryOne('SELECT 1 FROM channels WHERE id = $1 AND created_by = $2', [
        channelId,
        userId,
      ]);
      if (!member && !creator) {
        res.status(403).json({ error: '招待リンクを作成する権限がありません' });
        return;
      }
    }

    const invite = await inviteService.create(userId, { channelId, maxUses, expiresInHours });

    await auditLogService.record({
      actorUserId: userId,
      actionType: 'invite.create',
      targetType: channelId != null ? 'channel' : null,
      targetId: channelId ?? null,
      metadata: { inviteId: invite.id, token: invite.token },
    });

    res.status(201).json({ invite });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/invites?channelId=...
 * 招待リンク一覧を取得する
 */
router.get('/', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const channelId = req.query.channelId ? Number(req.query.channelId) : undefined;

    const userRow = await queryOne<{ role: string }>('SELECT role FROM users WHERE id = $1', [
      userId,
    ]);
    const isAdmin = userRow?.role === 'admin';

    let invites;
    if (channelId !== undefined) {
      invites = await inviteService.listByChannel(channelId);
    } else {
      if (!isAdmin) {
        res.status(403).json({ error: '管理者のみ全招待リンクを取得できます' });
        return;
      }
      invites = await inviteService.listAll();
    }

    res.json({ invites });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/invites/:token
 * トークン情報を取得する（認証不要）
 */
router.get('/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;
    const result = await inviteService.lookup(token);
    if (!result) {
      res.status(404).json({ error: '招待リンクが見つかりません' });
      return;
    }
    res.json({ invite: result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/invites/:token/redeem
 * 招待リンクを使用してチャンネルに参加する（認証必須）
 */
router.post(
  '/:token/redeem',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthenticatedRequest).userId;
      const { token } = req.params;

      const result = await inviteService.redeem(token, userId);

      await auditLogService.record({
        actorUserId: userId,
        actionType: 'invite.redeem',
        targetType: result.channelId != null ? 'channel' : null,
        targetId: result.channelId ?? null,
        metadata: { token },
      });

      res.json({ success: true, channelId: result.channelId });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * DELETE /api/invites/:id
 * 招待リンクを無効化する
 */
router.delete(
  '/:id',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthenticatedRequest).userId;
      const inviteId = Number(req.params.id);

      const userRow = await queryOne<{ role: string }>('SELECT role FROM users WHERE id = $1', [
        userId,
      ]);
      const isAdmin = userRow?.role === 'admin';

      const invite = await inviteService.revoke(userId, inviteId, isAdmin);

      await auditLogService.record({
        actorUserId: userId,
        actionType: 'invite.revoke',
        targetType: invite.channelId != null ? 'channel' : null,
        targetId: invite.channelId ?? null,
        metadata: { inviteId: invite.id },
      });

      res.json({ invite });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
