import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import * as pinChannelService from '../services/pinChannelService';

export async function getPinnedChannels(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const pinnedChannels = await pinChannelService.getPinnedChannels(userId);
    res.json({ pinnedChannels });
  } catch (err) {
    next(err);
  }
}

export async function pinChannel(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const channelId = Number(req.params.id);
    const pinnedChannel = await pinChannelService.pinChannel(userId, channelId);
    res.status(201).json({ pinnedChannel });
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === 'Channel not found') {
      res.status(404).json({ error: error.message });
      return;
    }
    if (error.message === 'Channel is already pinned') {
      res.status(409).json({ error: error.message });
      return;
    }
    next(err);
  }
}

export async function unpinChannel(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const channelId = Number(req.params.id);
    await pinChannelService.unpinChannel(userId, channelId);
    res.status(204).send();
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === 'Pin not found') {
      res.status(404).json({ error: error.message });
      return;
    }
    next(err);
  }
}
