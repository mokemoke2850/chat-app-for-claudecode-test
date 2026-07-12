import { Request, Response, NextFunction } from 'express';
import { createError } from '../middleware/errorHandler';
import * as messageService from '../services/messageService';
import * as channelService from '../services/channelService';
import * as adminService from '../services/adminService';
import * as auditLogService from '../services/auditLogService';
import { AuthenticatedRequest } from '../middleware/auth';
import { queryOne } from '../db/database';
import { parseCursorParams, buildCursorPage } from '../utils/pagination';

export async function searchMessages(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const qRaw = req.query.q;
    const q = typeof qRaw === 'string' ? qRaw.trim() : '';

    const {
      dateFrom,
      dateTo,
      userId,
      hasAttachment,
      tagIds,
      mentionedToMe,
      unreadOnly,
      channelId,
      limit: limitRaw,
      offset: offsetRaw,
    } = req.query;

    // #375 オフセットページング: limit / offset を検証（数値以外・負数は 400）
    let limit: number | undefined;
    if (typeof limitRaw === 'string' && limitRaw !== '') {
      limit = Number(limitRaw);
      if (!Number.isInteger(limit) || limit < 1) {
        next(createError('limit must be a positive integer', 400));
        return;
      }
    }
    let offset: number | undefined;
    if (typeof offsetRaw === 'string' && offsetRaw !== '') {
      offset = Number(offsetRaw);
      if (!Number.isInteger(offset) || offset < 0) {
        next(createError('offset must be a non-negative integer', 400));
        return;
      }
    }

    const filters = {
      dateFrom: typeof dateFrom === 'string' && dateFrom ? dateFrom : undefined,
      dateTo: typeof dateTo === 'string' && dateTo ? dateTo : undefined,
      userId:
        typeof userId === 'string' && userId !== '' && !isNaN(Number(userId))
          ? Number(userId)
          : undefined,
      hasAttachment:
        hasAttachment === 'true' ? true : hasAttachment === 'false' ? false : undefined,
      tagIds:
        typeof tagIds === 'string' && tagIds !== ''
          ? tagIds
              .split(',')
              .map(Number)
              .filter((n) => !isNaN(n))
          : Array.isArray(tagIds)
            ? (tagIds as string[]).map(Number).filter((n) => !isNaN(n))
            : undefined,
      mentionedToMe: mentionedToMe === 'true' ? true : undefined,
      unreadOnly: unreadOnly === 'true' ? true : undefined,
      channelId:
        typeof channelId === 'string' && channelId !== '' && !isNaN(Number(channelId))
          ? Number(channelId)
          : undefined,
      limit,
      offset,
    };

    const hasAnyFilter =
      filters.dateFrom !== undefined ||
      filters.dateTo !== undefined ||
      filters.userId !== undefined ||
      filters.hasAttachment !== undefined ||
      (filters.tagIds !== undefined && filters.tagIds.length > 0) ||
      filters.mentionedToMe === true ||
      filters.channelId !== undefined;

    // q が空でフィルターも未指定なら 400
    if (q === '' && !hasAnyFilter) {
      next(createError('q or at least one filter is required', 400));
      return;
    }

    const currentUserId = (req as AuthenticatedRequest).userId;
    // #375 ページング標準仕様（オフセット系）: { items, total, limit, offset }
    res.json(await messageService.searchMessages(q, filters, currentUserId));
  } catch (err) {
    next(err);
  }
}

export async function getMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const channelId = Number(req.params.channelId);
    const { limit, before } = parseCursorParams(req);
    const viewerUserId = (req as { userId?: number }).userId;

    // #375 ページング標準仕様（カーソル系）: { items, nextCursor, hasMore }
    // hasMore 判定のため limit+1 件取得し、共通ヘルパーで封筒化する。
    const fetched = await messageService.getChannelMessages(
      channelId,
      limit + 1,
      before,
      viewerUserId,
    );
    res.json(buildCursorPage(fetched, limit));
  } catch (err) {
    next(err);
  }
}

export async function getMessageContext(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const messageId = Number(req.params.id);
    if (!Number.isInteger(messageId) || messageId <= 0) {
      next(createError('Invalid message id', 400));
      return;
    }
    const items = await messageService.getMessageContext(
      messageId,
      (req as AuthenticatedRequest).userId,
    );
    if (!items) {
      next(createError('Message not found or unavailable', 404));
      return;
    }
    res.json({ items, targetMessageId: messageId });
  } catch (err) {
    next(err);
  }
}

export async function editMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { content, mentionedUserIds } = req.body as {
      content?: string;
      mentionedUserIds?: number[];
    };
    if (!content) {
      next(createError('content is required', 400));
      return;
    }
    const message = await messageService.editMessage(
      Number(req.params.id),
      (req as AuthenticatedRequest).userId,
      content,
      mentionedUserIds,
    );
    res.json({ message });
  } catch (err) {
    next(err);
  }
}

export async function deleteMessage(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const messageId = Number(req.params.id);
    const userId = (req as AuthenticatedRequest).userId;
    // 論理削除前に channel_id を取得（削除後も取得可能だが明示的に事前取得）
    const target = await queryOne<{ channel_id: number }>(
      'SELECT channel_id FROM messages WHERE id = $1',
      [messageId],
    );
    await messageService.deleteMessage(messageId, userId);
    await auditLogService.record({
      actorUserId: userId,
      actionType: 'message.delete',
      targetType: 'message',
      targetId: messageId,
      metadata: target ? { channelId: target.channel_id } : null,
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function getReplies(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // #386 ページング標準仕様（カーソル系）: { items, nextCursor, hasMore }
    const { limit, before } = parseCursorParams(req);
    const fetched = await messageService.getThreadReplies(Number(req.params.id), limit + 1, before);
    res.json(buildCursorPage(fetched, limit));
  } catch (err) {
    next(err);
  }
}

export async function forwardMessage(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const sourceMessageId = Number(req.params.id);
    const { targetChannelId, comment } = req.body as {
      targetChannelId?: number;
      comment?: string;
    };

    if (!targetChannelId || isNaN(targetChannelId)) {
      next(createError('targetChannelId is required', 400));
      return;
    }

    const userId = (req as AuthenticatedRequest).userId;
    const message = await messageService.forwardMessage(
      userId,
      sourceMessageId,
      targetChannelId,
      comment,
    );
    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
}

export async function createMessage(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const channelId = Number(req.params.channelId);
    const { content, mentionedUserIds } = req.body as {
      content?: string;
      mentionedUserIds?: number[];
    };

    if (!content) {
      next(createError('content is required', 400));
      return;
    }

    const userId = (req as AuthenticatedRequest).userId;
    if (await adminService.isMaintenanceRestricted('posting')) {
      next(createError('メンテナンス中のため投稿できません', 503, { code: 'MAINTENANCE_MODE' }));
      return;
    }

    const channel = await channelService.getChannelById(channelId);
    if (!channel) {
      next(createError('Channel not found', 404));
      return;
    }

    if (channel.isArchived) {
      next(createError('Cannot send messages to an archived channel', 403));
      return;
    }

    const message = await messageService.createMessage(
      channelId,
      userId,
      content,
      mentionedUserIds,
    );
    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
}
