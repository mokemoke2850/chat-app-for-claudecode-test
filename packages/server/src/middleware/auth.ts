import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getDatabase } from '../db/database';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-please-change-in-production';

export interface AuthenticatedRequest extends Request {
  userId: number;
  username: string;
}

export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.token as string | undefined;

  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: number; username: string };
    (req as AuthenticatedRequest).userId = payload.userId;
    (req as AuthenticatedRequest).username = payload.username;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function generateToken(userId: number, username: string): string {
  return jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: '7d' });
}

/** authenticateToken の後に使う管理者専用ミドルウェア */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const userId = (req as AuthenticatedRequest).userId;
  const row = getDatabase().prepare('SELECT role FROM users WHERE id = ?').get(userId) as
    | { role: string }
    | undefined;
  if (row?.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  next();
}
