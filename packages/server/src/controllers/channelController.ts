import { Request, Response, NextFunction } from 'express';
import * as channelService from '../services/channelService';
import { AuthenticatedRequest } from '../middleware/auth';

export function getChannels(req: Request, res: Response, next: NextFunction): void {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    res.json({ channels: channelService.getChannelsForUser(userId) });
  } catch (err) {
    next(err);
  }
}

export function getChannel(req: Request, res: Response, next: NextFunction): void {
  try {
    const channel = channelService.getChannelById(Number(req.params.id));
    if (!channel) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }
    res.json({ channel });
  } catch (err) {
    next(err);
  }
}

export function createChannel(req: Request, res: Response, next: NextFunction): void {
  try {
    const { name, description, is_private, memberIds } = req.body as {
      name?: string;
      description?: string;
      is_private?: boolean;
      memberIds?: number[];
    };
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    const userId = (req as AuthenticatedRequest).userId;
    const channel = is_private
      ? channelService.createPrivateChannel(name, description, userId, memberIds ?? [])
      : channelService.createChannel(name, description, userId);
    res.status(201).json({ channel });
  } catch (err) {
    next(err);
  }
}

export function deleteChannel(req: Request, res: Response, next: NextFunction): void {
  try {
    channelService.deleteChannel(Number(req.params.id), (req as AuthenticatedRequest).userId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export function joinChannel(req: Request, res: Response, next: NextFunction): void {
  try {
    channelService.joinChannel(Number(req.params.id), (req as AuthenticatedRequest).userId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export function addMember(req: Request, res: Response, next: NextFunction): void {
  try {
    const { userId: targetUserId } = req.body as { userId?: number };
    if (!targetUserId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }
    channelService.addChannelMember(
      Number(req.params.id),
      (req as AuthenticatedRequest).userId,
      targetUserId,
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export function getMembers(req: Request, res: Response, next: NextFunction): void {
  try {
    const members = channelService.getChannelMembers(Number(req.params.id));
    res.json({ members });
  } catch (err) {
    next(err);
  }
}
