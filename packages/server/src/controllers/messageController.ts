import { Request, Response, NextFunction } from 'express';
import * as messageService from '../services/messageService';
import { AuthenticatedRequest } from '../middleware/auth';

export function getMessages(req: Request, res: Response, next: NextFunction): void {
  try {
    const channelId = Number(req.params.channelId);
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const before = req.query.before ? Number(req.query.before) : undefined;
    res.json({ messages: messageService.getChannelMessages(channelId, limit, before) });
  } catch (err) { next(err); }
}

export function editMessage(req: Request, res: Response, next: NextFunction): void {
  try {
    const { content, mentionedUserIds } = req.body as { content?: string; mentionedUserIds?: number[] };
    if (!content) { res.status(400).json({ error: 'content is required' }); return; }
    const message = messageService.editMessage(
      Number(req.params.id),
      (req as AuthenticatedRequest).userId,
      content,
      mentionedUserIds,
    );
    res.json({ message });
  } catch (err) { next(err); }
}

export function deleteMessage(req: Request, res: Response, next: NextFunction): void {
  try {
    messageService.deleteMessage(Number(req.params.id), (req as AuthenticatedRequest).userId);
    res.status(204).send();
  } catch (err) { next(err); }
}
