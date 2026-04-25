import { Request, Response, NextFunction } from 'express';
import * as messageService from '../services/messageService';
import * as channelService from '../services/channelService';
import * as auditLogService from '../services/auditLogService';
import { AuthenticatedRequest } from '../middleware/auth';
import { queryOne } from '../db/database';

export async function searchMessages(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const qRaw = req.query.q;
    const q = typeof qRaw === 'string' ? qRaw.trim() : '';

    const { dateFrom, dateTo, userId, hasAttachment, tagIds } = req.query;

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
    };

    const hasAnyFilter =
      filters.dateFrom !== undefined ||
      filters.dateTo !== undefined ||
      filters.userId !== undefined ||
      filters.hasAttachment !== undefined ||
      (filters.tagIds !== undefined && filters.tagIds.length > 0);

    // q が空でフィルターも未指定なら 400
    if (q === '' && !hasAnyFilter) {
      res.status(400).json({ error: 'q or at least one filter is required' });
      return;
    }

    res.json({ messages: await messageService.searchMessages(q, filters) });
  } catch (err) {
    next(err);
  }
}

export async function getMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const channelId = Number(req.params.channelId);
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const before = req.query.before ? Number(req.query.before) : undefined;
    res.json({ messages: await messageService.getChannelMessages(channelId, limit, before) });
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
      res.status(400).json({ error: 'content is required' });
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
    const replies = await messageService.getThreadReplies(Number(req.params.id));
    res.json({ replies });
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
      res.status(400).json({ error: 'content is required' });
      return;
    }

    const channel = await channelService.getChannelById(channelId);
    if (!channel) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }

    if (channel.isArchived) {
      res.status(403).json({ error: 'Cannot send messages to an archived channel' });
      return;
    }

    const userId = (req as AuthenticatedRequest).userId;
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
