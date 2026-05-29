import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { queryOne } from '../db/database';
import { createError } from '../middleware/errorHandler';
import * as wikiPageService from '../services/wikiPageService';
import * as permissionService from '../services/permissionService';

const router = Router();

// #373 admin 判定は permissionService に集約。canEdit/canDelete が要求する userRole 形は維持する。
async function loadAuthCtx(userId: number): Promise<{ userId: number; userRole: string }> {
  const admin = await permissionService.isAdmin(userId);
  return { userId, userRole: admin ? 'admin' : 'user' };
}

async function assertChannelAccess(channelId: number, userId: number): Promise<void> {
  const channel = await queryOne<{ id: number }>('SELECT id FROM channels WHERE id = $1', [
    channelId,
  ]);
  if (!channel) {
    throw createError('チャンネルが見つかりません', 404);
  }
  if (await permissionService.isAdmin(userId)) return;
  if (!(await permissionService.isChannelMember(userId, channelId))) {
    throw createError('チャンネルメンバーではありません', 403);
  }
}

// チャンネル所属 Wiki 一覧 / 作成
export const channelWikiRouter = Router({ mergeParams: true });

channelWikiRouter.get(
  '/',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthenticatedRequest).userId;
      const channelId = parseInt(String(req.params.channelId), 10);
      if (isNaN(channelId)) {
        throw createError('Invalid channel ID', 400);
      }
      await assertChannelAccess(channelId, userId);
      const q = typeof req.query.q === 'string' ? req.query.q : undefined;
      const pages = await wikiPageService.listWikiPages(channelId, q);
      res.json({ pages });
    } catch (err) {
      next(err);
    }
  },
);

channelWikiRouter.post(
  '/',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthenticatedRequest).userId;
      const channelId = parseInt(String(req.params.channelId), 10);
      if (isNaN(channelId)) {
        throw createError('Invalid channel ID', 400);
      }
      await assertChannelAccess(channelId, userId);
      const { title, content, tagIds } = req.body as {
        title?: string;
        content?: string;
        tagIds?: number[];
      };
      const page = await wikiPageService.createWikiPage(channelId, userId, {
        title: title ?? '',
        content,
        tagIds,
      });
      res.status(201).json({ page });
    } catch (err) {
      next(err);
    }
  },
);

// 単一 Wiki ページ操作（GET / PATCH / DELETE）
router.get('/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw createError('Invalid wiki page ID', 400);

    const info = await wikiPageService.loadPageAuthInfo(id);
    if (!info) throw createError('Wikiページが見つかりません', 404);

    await assertChannelAccess(info.channelId, userId);

    const page = await wikiPageService.getWikiPage(id);
    if (!page) throw createError('Wikiページが見つかりません', 404);
    res.json({ page });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw createError('Invalid wiki page ID', 400);

    const info = await wikiPageService.loadPageAuthInfo(id);
    if (!info) throw createError('Wikiページが見つかりません', 404);

    const auth = await loadAuthCtx(userId);
    if (!wikiPageService.canEdit(info, auth)) {
      throw createError('編集権限がありません', 403);
    }

    const { title, content, tagIds, expectedUpdatedAt } = req.body as {
      title?: string;
      content?: string;
      tagIds?: number[];
      expectedUpdatedAt?: string;
    };
    if (!expectedUpdatedAt) {
      throw createError('expectedUpdatedAt が必要です', 400);
    }
    const page = await wikiPageService.updateWikiPage(id, userId, {
      title,
      content,
      tagIds,
      expectedUpdatedAt,
    });
    res.json({ page });
  } catch (err) {
    next(err);
  }
});

router.delete(
  '/:id',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthenticatedRequest).userId;
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) throw createError('Invalid wiki page ID', 400);

      const info = await wikiPageService.loadPageAuthInfo(id);
      if (!info) throw createError('Wikiページが見つかりません', 404);

      const auth = await loadAuthCtx(userId);
      if (!wikiPageService.canDelete(info, auth)) {
        throw createError('削除権限がありません', 403);
      }

      await wikiPageService.deleteWikiPage(id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

export default router;
