import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/authService';
import { generateToken, AuthenticatedRequest } from '../middleware/auth';
import { saveAvatar } from '../services/avatarStorageService';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { username, email, password } = req.body as {
      username?: string;
      email?: string;
      password?: string;
    };
    if (!username || !email || !password) {
      res.status(400).json({ error: 'username, email and password are required' });
      return;
    }
    const user = await authService.register(username, email, password);
    const token = generateToken(user.id, user.username);
    res.cookie('token', token, COOKIE_OPTIONS);
    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: 'email and password are required' });
      return;
    }
    const user = await authService.login(email, password);
    const token = generateToken(user.id, user.username);
    res.cookie('token', token, COOKIE_OPTIONS);
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

export function logout(_req: Request, res: Response): void {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
}

export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await authService.getUserById((req as AuthenticatedRequest).userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const { displayName, location, avatarUrl } = req.body as {
      displayName?: string;
      location?: string;
      avatarUrl?: string;
    };
    const resolvedAvatarUrl = avatarUrl ? saveAvatar(userId, avatarUrl) : avatarUrl;
    const user = await authService.updateProfile(userId, {
      displayName,
      location,
      avatarUrl: resolvedAvatarUrl,
    });
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const { currentPassword, newPassword, confirmPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
      confirmPassword?: string;
    };

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'currentPassword and newPassword are required' });
      return;
    }
    if (newPassword.length < 8) {
      res.status(400).json({ error: 'newPassword must be at least 8 characters' });
      return;
    }
    if (newPassword !== confirmPassword) {
      res.status(400).json({ error: 'newPassword and confirmPassword do not match' });
      return;
    }

    await authService.changePassword(userId, currentPassword, newPassword);
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
}

export async function getUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { channelId } = req.query as { channelId?: string };
    if (channelId !== undefined) {
      const users = await authService.getUsersForChannel(Number(channelId));
      if (users === null) {
        res.status(404).json({ error: 'Channel not found' });
        return;
      }
      res.json({ users });
      return;
    }
    res.json({ users: await authService.getAllUsers() });
  } catch (err) {
    next(err);
  }
}
