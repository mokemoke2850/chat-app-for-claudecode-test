import { Request, Response, NextFunction } from 'express';
import { createError } from '../middleware/errorHandler';
import jwt from 'jsonwebtoken';
import * as authService from '../services/authService';
import * as auditLogService from '../services/auditLogService';
import * as adminService from '../services/adminService';
import * as presenceService from '../services/presenceService';
import { generateToken, AuthenticatedRequest } from '../middleware/auth';
import { saveAvatar } from '../services/avatarStorageService';
import type { User, AccentColor } from '@chat-app/shared';
import { isAccentColor, EXTENDED_PROFILE_LIMITS } from '@chat-app/shared';

/**
 * #305 拡張プロフィール用のバリデーションヘルパ
 */
function isValidHttpUrl(value: string): boolean {
  // URL コンストラクタが受理し、かつ http/https スキームのみ許容する
  try {
    const u = new URL(value);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    // スペース等の不正文字（URL 構築は通っても href に空白が入るケースを弾く）
    if (/\s/.test(value)) return false;
    return true;
  } catch {
    return false;
  }
}

function isValidIanaTimezone(value: string): boolean {
  // IANA 形式は最低限 "Area/City" 構造（または "UTC"）。略称（"JST" 等）は除外。
  // Intl.supportedValuesOf が使える環境では正規リストで検証、未対応環境では DateTimeFormat で間接検証する。
  if (value === 'UTC') return true;
  if (!/^[A-Za-z_]+\/[A-Za-z_+\-/0-9]+$/.test(value)) return false;
  try {
    const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] })
      .supportedValuesOf;
    if (typeof supported === 'function') {
      return supported('timeZone').includes(value);
    }
    // フォールバック: DateTimeFormat に渡してエラーにならなければ有効
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-please-change-in-production';

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
      next(createError('username, email and password are required', 400));
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
      next(createError('email and password are required', 400));
      return;
    }
    const user = await authService.login(email, password);
    if (await adminService.isMaintenanceRestricted('login', user.role)) {
      next(
        createError('メンテナンス中のためログインできません', 503, { code: 'MAINTENANCE_MODE' }),
      );
      return;
    }
    const token = generateToken(user.id, user.username);
    res.cookie('token', token, COOKIE_OPTIONS);
    await auditLogService.record({
      actorUserId: user.id,
      actionType: 'auth.login',
      targetType: 'user',
      targetId: user.id,
    });
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  // logout はミドルウェアで認証を必須としていないため、cookie から直接 actor を復元する
  let actorUserId: number | null = null;
  const token = (req.cookies as { token?: string } | undefined)?.token;
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { userId?: number };
      if (typeof payload.userId === 'number') {
        actorUserId = payload.userId;
      }
    } catch {
      // 無効なトークンは単に無視（ログアウト自体は成功させる）
    }
  }
  if (actorUserId !== null) {
    await auditLogService.record({
      actorUserId,
      actionType: 'auth.logout',
      targetType: 'user',
      targetId: actorUserId,
    });
  }
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
}

export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await authService.getUserById((req as AuthenticatedRequest).userId);
    if (!user) {
      next(createError('User not found', 404));
      return;
    }
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const body = req.body as {
      displayName?: string;
      location?: string;
      avatarUrl?: string;
      accentColor?: string | null;
      // #305 拡張プロフィール項目
      bio?: string | null;
      jobTitle?: string | null;
      department?: string | null;
      timezone?: string | null;
      githubUrl?: string | null;
      snsUrl?: string | null;
    };
    const { displayName, location, avatarUrl } = body;
    const resolvedAvatarUrl = avatarUrl ? saveAvatar(userId, avatarUrl) : avatarUrl;

    // accentColor が body に含まれている場合のみ更新対象とする（プリセット外は 400）
    const updateData: Parameters<typeof authService.updateProfile>[1] = {
      displayName,
      location,
      avatarUrl: resolvedAvatarUrl,
    };
    if ('accentColor' in body) {
      const ac = body.accentColor;
      if (ac === null) {
        updateData.accentColor = null;
      } else if (isAccentColor(ac)) {
        updateData.accentColor = ac as AccentColor;
      } else {
        next(createError('accentColor はプリセット値である必要があります', 400));
        return;
      }
    }

    // #305 拡張プロフィール項目のバリデーション
    if ('bio' in body) {
      const v = body.bio;
      if (v != null && typeof v === 'string' && v.length > EXTENDED_PROFILE_LIMITS.bio) {
        res
          .status(400)
          .json({ error: `bio は ${EXTENDED_PROFILE_LIMITS.bio} 文字以内で入力してください` });
        return;
      }
      updateData.bio = v ?? null;
    }
    if ('jobTitle' in body) {
      const v = body.jobTitle;
      if (v != null && typeof v === 'string' && v.length > EXTENDED_PROFILE_LIMITS.jobTitle) {
        res.status(400).json({
          error: `jobTitle は ${EXTENDED_PROFILE_LIMITS.jobTitle} 文字以内で入力してください`,
        });
        return;
      }
      updateData.jobTitle = v ?? null;
    }
    if ('department' in body) {
      const v = body.department;
      if (v != null && typeof v === 'string' && v.length > EXTENDED_PROFILE_LIMITS.department) {
        res.status(400).json({
          error: `department は ${EXTENDED_PROFILE_LIMITS.department} 文字以内で入力してください`,
        });
        return;
      }
      updateData.department = v ?? null;
    }
    if ('timezone' in body) {
      const v = body.timezone;
      if (v != null && v !== '' && !isValidIanaTimezone(v)) {
        next(createError('timezone は IANA 形式で指定してください', 400));
        return;
      }
      updateData.timezone = v == null || v === '' ? null : v;
    }
    if ('githubUrl' in body) {
      const v = body.githubUrl;
      if (v != null && v !== '' && !isValidHttpUrl(v)) {
        next(createError('githubUrl は http(s) の URL を指定してください', 400));
        return;
      }
      updateData.githubUrl = v == null || v === '' ? null : v;
    }
    if ('snsUrl' in body) {
      const v = body.snsUrl;
      if (v != null && v !== '' && !isValidHttpUrl(v)) {
        next(createError('snsUrl は http(s) の URL を指定してください', 400));
        return;
      }
      updateData.snsUrl = v == null || v === '' ? null : v;
    }

    const user = await authService.updateProfile(userId, updateData);
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

export async function changePassword(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const { currentPassword, newPassword, confirmPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
      confirmPassword?: string;
    };

    if (!currentPassword || !newPassword) {
      next(createError('currentPassword and newPassword are required', 400));
      return;
    }
    if (newPassword.length < 8) {
      next(createError('newPassword must be at least 8 characters', 400));
      return;
    }
    if (newPassword !== confirmPassword) {
      next(createError('newPassword and confirmPassword do not match', 400));
      return;
    }

    await authService.changePassword(userId, currentPassword, newPassword);
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
}

function attachPresenceState(users: User[]): User[] {
  return users.map((u) => ({ ...u, presenceState: presenceService.getState(u.id) }));
}

export async function getUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { channelId } = req.query as { channelId?: string };
    if (channelId !== undefined) {
      const users = await authService.getUsersForChannel(Number(channelId));
      if (users === null) {
        next(createError('Channel not found', 404));
        return;
      }
      res.json({ users: attachPresenceState(users) });
      return;
    }
    res.json({ users: attachPresenceState(await authService.getAllUsers()) });
  } catch (err) {
    next(err);
  }
}

export async function completeOnboarding(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const user = await authService.completeOnboarding(userId);
    await auditLogService.record({
      actorUserId: userId,
      actionType: 'auth.onboarding.complete',
      targetType: 'user',
      targetId: userId,
    });
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

/** #147 カスタムステータス更新 */
export async function updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const { emoji, text, expiresAt } = req.body as {
      emoji?: string | null;
      text?: string | null;
      expiresAt?: string | null;
    };

    const user = await authService.updateStatus(userId, {
      emoji: emoji ?? null,
      text: text ?? null,
      expiresAt: expiresAt ?? null,
    });
    res.json({ user });
  } catch (err) {
    next(err);
  }
}
