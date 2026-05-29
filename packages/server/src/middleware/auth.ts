import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { queryOne } from '../db/database';
import { createError } from './errorHandler';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-please-change-in-production';

export interface AuthenticatedRequest extends Request {
  userId: number;
  username: string;
}

export function authenticateToken(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies?.token as string | undefined;

  if (!token) {
    next(createError('Unauthorized', 401));
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: number; username: string };
    (req as AuthenticatedRequest).userId = payload.userId;
    (req as AuthenticatedRequest).username = payload.username;
    next();
  } catch {
    next(createError('Invalid token', 401));
  }
}

export function generateToken(userId: number, username: string): string {
  return jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: '7d' });
}

/** authenticateToken の後に使う管理者専用ミドルウェア */
export async function requireAdmin(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = (req as AuthenticatedRequest).userId;
  const row = await queryOne<{ role: string }>('SELECT role FROM users WHERE id = $1', [userId]);
  if (row?.role !== 'admin') {
    next(createError('Forbidden', 403));
    return;
  }
  next();
}
