import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/authService';
import { generateToken, AuthenticatedRequest } from '../middleware/auth';

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

export function getMe(req: Request, res: Response, next: NextFunction): void {
  try {
    const user = authService.getUserById((req as AuthenticatedRequest).userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

export function updateProfile(req: Request, res: Response, next: NextFunction): void {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const { displayName, location, avatarUrl } = req.body as {
      displayName?: string;
      location?: string;
      avatarUrl?: string;
    };
    const user = authService.updateProfile(userId, { displayName, location, avatarUrl });
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

export function getUsers(_req: Request, res: Response, next: NextFunction): void {
  try {
    res.json({ users: authService.getAllUsers() });
  } catch (err) {
    next(err);
  }
}
