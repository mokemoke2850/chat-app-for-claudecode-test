import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import * as adminService from '../services/adminService';
import { createError } from '../middleware/errorHandler';

export function getUsers(req: AuthenticatedRequest, res: Response): void {
  const users = adminService.getAdminUsers();
  res.json({ users });
}

export function updateUserRole(req: AuthenticatedRequest, res: Response): void {
  const targetId = Number(req.params.id);
  const { role } = req.body as { role?: unknown };
  if (role !== 'user' && role !== 'admin') {
    throw createError('Invalid role', 400);
  }
  adminService.updateUserRole(targetId, role, req.userId);
  res.json({ success: true });
}

export function updateUserStatus(req: AuthenticatedRequest, res: Response): void {
  const targetId = Number(req.params.id);
  const { isActive } = req.body as { isActive?: unknown };
  if (typeof isActive !== 'boolean') {
    throw createError('isActive must be a boolean', 400);
  }
  adminService.updateUserStatus(targetId, isActive);
  res.json({ success: true });
}

export function deleteUser(req: AuthenticatedRequest, res: Response): void {
  const targetId = Number(req.params.id);
  adminService.deleteUser(targetId, req.userId);
  res.status(204).end();
}

export function getChannels(req: AuthenticatedRequest, res: Response): void {
  const channels = adminService.getAdminChannels();
  res.json({ channels });
}

export function deleteChannel(req: AuthenticatedRequest, res: Response): void {
  const channelId = Number(req.params.id);
  adminService.deleteChannel(channelId);
  res.status(204).end();
}

export function getStats(req: AuthenticatedRequest, res: Response): void {
  const stats = adminService.getStats();
  res.json(stats);
}
