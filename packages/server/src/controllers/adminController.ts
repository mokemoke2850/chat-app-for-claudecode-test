import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import * as adminService from '../services/adminService';
import { createError } from '../middleware/errorHandler';

export async function getUsers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const users = await adminService.getAdminUsers();
    res.json({ users });
  } catch (err) { next(err); }
}

export async function updateUserRole(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const targetId = Number(req.params.id);
    const { role } = req.body as { role?: unknown };
    if (role !== 'user' && role !== 'admin') {
      throw createError('Invalid role', 400);
    }
    await adminService.updateUserRole(targetId, role, req.userId);
    res.json({ success: true });
  } catch (err) { next(err); }
}

export async function updateUserStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const targetId = Number(req.params.id);
    const { isActive } = req.body as { isActive?: unknown };
    if (typeof isActive !== 'boolean') {
      throw createError('isActive must be a boolean', 400);
    }
    await adminService.updateUserStatus(targetId, isActive);
    res.json({ success: true });
  } catch (err) { next(err); }
}

export async function deleteUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const targetId = Number(req.params.id);
    await adminService.deleteUser(targetId, req.userId);
    res.status(204).end();
  } catch (err) { next(err); }
}

export async function getChannels(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const channels = await adminService.getAdminChannels();
    res.json({ channels });
  } catch (err) { next(err); }
}

export async function deleteChannel(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const channelId = Number(req.params.id);
    await adminService.deleteChannel(channelId);
    res.status(204).end();
  } catch (err) { next(err); }
}

export async function getStats(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const stats = await adminService.getStats();
    res.json(stats);
  } catch (err) { next(err); }
}
