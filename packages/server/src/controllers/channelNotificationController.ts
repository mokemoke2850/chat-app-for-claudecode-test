import { Request, Response, NextFunction } from 'express';
import type { ChannelNotificationLevel } from '@chat-app/shared';
import { AuthenticatedRequest } from '../middleware/auth';
import * as channelNotificationService from '../services/channelNotificationService';

const VALID_LEVELS: ChannelNotificationLevel[] = ['all', 'mentions', 'muted'];

export async function getNotifications(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const map = await channelNotificationService.getForUser(userId);
    const settings = Array.from(map.values());
    res.json({ settings });
  } catch (err) {
    next(err);
  }
}

export async function setNotificationLevel(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const channelId = Number(req.params.id);
    const { level } = req.body as { level: unknown };

    if (!VALID_LEVELS.includes(level as ChannelNotificationLevel)) {
      res
        .status(400)
        .json({ error: 'level は all / mentions / muted のいずれかである必要があります' });
      return;
    }

    const setting = await channelNotificationService.set(
      userId,
      channelId,
      level as ChannelNotificationLevel,
    );
    res.json({ setting });
  } catch (err) {
    next(err);
  }
}
