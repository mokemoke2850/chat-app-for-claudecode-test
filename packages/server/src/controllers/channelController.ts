import { Request, Response, NextFunction } from 'express';
import * as channelService from '../services/channelService';
import { AuthenticatedRequest } from '../middleware/auth';
import { queryOne } from '../db/database';

export async function getChannels(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    res.json({ channels: await channelService.getChannelsForUser(userId) });
  } catch (err) {
    next(err);
  }
}

export async function getChannel(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const channel = await channelService.getChannelById(Number(req.params.id));
    if (!channel) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }
    res.json({ channel });
  } catch (err) {
    next(err);
  }
}

export async function createChannel(req: Request, res: Response, next: NextFunction): Promise<void> {
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
      ? await channelService.createPrivateChannel(name, description, userId, memberIds ?? [])
      : await channelService.createChannel(name, description, userId);
    res.status(201).json({ channel });
  } catch (err) {
    next(err);
  }
}

export async function deleteChannel(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await channelService.deleteChannel(Number(req.params.id), (req as AuthenticatedRequest).userId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function joinChannel(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await channelService.joinChannel(Number(req.params.id), (req as AuthenticatedRequest).userId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function addMember(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId: targetUserId } = req.body as { userId?: number };
    if (!targetUserId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }
    await channelService.addChannelMember(
      Number(req.params.id),
      (req as AuthenticatedRequest).userId,
      targetUserId,
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function getMembers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const members = await channelService.getChannelMembers(Number(req.params.id));
    res.json({ members });
  } catch (err) {
    next(err);
  }
}

export async function removeMember(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await channelService.removeChannelMember(
      Number(req.params.id),
      (req as AuthenticatedRequest).userId,
      Number(req.params.userId),
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function updateTopic(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const channelId = Number(req.params.id);
    const { topic, description } = req.body as { topic?: string | null; description?: string | null };
    const userId = (req as AuthenticatedRequest).userId;

    const userRow = await queryOne<{ role: string }>('SELECT role FROM users WHERE id = $1', [userId]);
    const isAdmin = userRow?.role === 'admin';

    const channel = await channelService.updateChannelTopic(
      channelId,
      userId,
      topic,
      description,
      isAdmin,
    );
    res.json({ channel });
  } catch (err) {
    next(err);
  }
}

export async function markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const channelId = Number(req.params.id);
    const channel = await channelService.getChannelById(channelId);
    if (!channel) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }
    await channelService.markChannelAsRead(channelId, (req as AuthenticatedRequest).userId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
