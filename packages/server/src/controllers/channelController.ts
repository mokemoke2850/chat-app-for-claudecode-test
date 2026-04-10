import { Request, Response, NextFunction } from 'express';
import * as channelService from '../services/channelService';
import { AuthenticatedRequest } from '../middleware/auth';

export function getChannels(_req: Request, res: Response, next: NextFunction): void {
  try {
    res.json({ channels: channelService.getAllChannels() });
  } catch (err) { next(err); }
}

export function getChannel(req: Request, res: Response, next: NextFunction): void {
  try {
    const channel = channelService.getChannelById(Number(req.params.id));
    if (!channel) { res.status(404).json({ error: 'Channel not found' }); return; }
    res.json({ channel });
  } catch (err) { next(err); }
}

export function createChannel(req: Request, res: Response, next: NextFunction): void {
  try {
    const { name, description } = req.body as { name?: string; description?: string };
    if (!name) { res.status(400).json({ error: 'name is required' }); return; }
    const channel = channelService.createChannel(name, description, (req as AuthenticatedRequest).userId);
    res.status(201).json({ channel });
  } catch (err) { next(err); }
}

export function deleteChannel(req: Request, res: Response, next: NextFunction): void {
  try {
    channelService.deleteChannel(Number(req.params.id), (req as AuthenticatedRequest).userId);
    res.status(204).send();
  } catch (err) { next(err); }
}

export function joinChannel(req: Request, res: Response, next: NextFunction): void {
  try {
    channelService.joinChannel(Number(req.params.id), (req as AuthenticatedRequest).userId);
    res.status(204).send();
  } catch (err) { next(err); }
}
