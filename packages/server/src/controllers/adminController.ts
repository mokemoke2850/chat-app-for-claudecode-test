import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import * as adminService from '../services/adminService';
import * as auditLogService from '../services/auditLogService';
import { queryOne } from '../db/database';
import { createError } from '../middleware/errorHandler';

export async function getUsers(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const users = await adminService.getAdminUsers();
    res.json({ users });
  } catch (err) {
    next(err);
  }
}

export async function updateUserRole(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const targetId = Number(req.params.id);
    const { role } = req.body as { role?: unknown };
    if (role !== 'user' && role !== 'admin') {
      throw createError('Invalid role', 400);
    }
    // 変更前のロールを取得（記録用）
    const prev = await queryOne<{ role: 'user' | 'admin' }>(
      'SELECT role FROM users WHERE id = $1',
      [targetId],
    );
    await adminService.updateUserRole(targetId, role, req.userId);
    await auditLogService.record({
      actorUserId: req.userId,
      actionType: 'user.role_change',
      targetType: 'user',
      targetId,
      metadata: { from: prev?.role ?? null, to: role },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function updateUserStatus(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const targetId = Number(req.params.id);
    const { isActive } = req.body as { isActive?: unknown };
    if (typeof isActive !== 'boolean') {
      throw createError('isActive must be a boolean', 400);
    }
    await adminService.updateUserStatus(targetId, isActive);
    await auditLogService.record({
      actorUserId: req.userId,
      actionType: 'user.status_change',
      targetType: 'user',
      targetId,
      metadata: { isActive },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function deleteUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const targetId = Number(req.params.id);
    const target = await queryOne<{ username: string }>(
      'SELECT username FROM users WHERE id = $1',
      [targetId],
    );
    await adminService.deleteUser(targetId, req.userId);
    await auditLogService.record({
      actorUserId: req.userId,
      actionType: 'user.delete',
      targetType: 'user',
      targetId,
      metadata: target ? { username: target.username } : null,
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function getChannels(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const channels = await adminService.getAdminChannels();
    res.json({ channels });
  } catch (err) {
    next(err);
  }
}

export async function deleteChannel(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const channelId = Number(req.params.id);
    const target = await queryOne<{ name: string }>('SELECT name FROM channels WHERE id = $1', [
      channelId,
    ]);
    await adminService.deleteChannel(channelId);
    await auditLogService.record({
      actorUserId: req.userId,
      actionType: 'channel.delete',
      targetType: 'channel',
      targetId: channelId,
      metadata: target ? { name: target.name } : null,
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

const VALID_PERIODS = ['24h', '7d', '30d'] as const;
type PeriodKey = (typeof VALID_PERIODS)[number];

const PERIOD_HOURS: Record<PeriodKey, number> = {
  '24h': 24,
  '7d': 7 * 24,
  '30d': 30 * 24,
};

export async function getStats(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const q = req.query as Record<string, string | undefined>;
    const periodParam = q.period;
    const fromParam = q.from;
    const toParam = q.to;

    // period パラメータのバリデーション
    if (periodParam !== undefined && !VALID_PERIODS.includes(periodParam as PeriodKey)) {
      throw createError(`Invalid period. Must be one of: ${VALID_PERIODS.join(', ')}`, 400);
    }

    // from/to パラメータのバリデーション
    if (fromParam !== undefined && isNaN(Date.parse(fromParam))) {
      throw createError('Invalid from date', 400);
    }
    if (toParam !== undefined && isNaN(Date.parse(toParam))) {
      throw createError('Invalid to date', 400);
    }

    let from: Date | undefined;
    let to: Date | undefined;

    if (periodParam) {
      const hours = PERIOD_HOURS[periodParam as PeriodKey];
      to = new Date();
      from = new Date(to.getTime() - hours * 60 * 60 * 1000);
    } else {
      if (fromParam) from = new Date(fromParam);
      if (toParam) to = new Date(toParam);
    }

    if (from && to && from > to) {
      throw createError('from must be before to', 400);
    }

    const stats = await adminService.getStats({ from, to });
    res.json(stats);
  } catch (err) {
    next(err);
  }
}

export async function getAuditLogs(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const q = req.query as Record<string, string | undefined>;
    const rawLimit = q.limit !== undefined ? Number(q.limit) : 50;
    const rawOffset = q.offset !== undefined ? Number(q.offset) : 0;

    if (Number.isNaN(rawLimit) || Number.isNaN(rawOffset)) {
      throw createError('limit and offset must be numbers', 400);
    }
    if (rawLimit > 200) {
      throw createError('limit must be 200 or less', 400);
    }
    if (rawLimit < 1 || rawOffset < 0) {
      throw createError('limit must be >= 1 and offset must be >= 0', 400);
    }

    const actorUserId = q.actor_user_id !== undefined ? Number(q.actor_user_id) : undefined;
    if (actorUserId !== undefined && Number.isNaN(actorUserId)) {
      throw createError('actor_user_id must be a number', 400);
    }

    const result = await auditLogService.listAuditLogs({
      actionType: q.action_type,
      actorUserId,
      from: q.from,
      to: q.to,
      limit: rawLimit,
      offset: rawOffset,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function setChannelRecommended(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const channelId = Number(req.params.id);
    const { isRecommended } = req.body as { isRecommended?: unknown };
    if (typeof isRecommended !== 'boolean') {
      throw createError('isRecommended must be a boolean', 400);
    }
    const channel = await adminService.setChannelRecommended(channelId, isRecommended);
    await auditLogService.record({
      actorUserId: req.userId,
      actionType: isRecommended ? 'admin.channel.recommend' : 'admin.channel.unrecommend',
      targetType: 'channel',
      targetId: channelId,
    });
    res.json({ channel });
  } catch (err) {
    next(err);
  }
}

export async function exportAuditLogs(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const q = req.query as Record<string, string | undefined>;

    const actorUserId = q.actor_user_id !== undefined ? Number(q.actor_user_id) : undefined;
    if (actorUserId !== undefined && Number.isNaN(actorUserId)) {
      throw createError('actor_user_id must be a number', 400);
    }

    const filter = {
      actionType: q.action_type,
      actorUserId,
      from: q.from,
      to: q.to,
    };

    const csvBuffer = await auditLogService.buildAuditLogsCsv(filter);

    // ファイル名: audit-logs-YYYYMMDD-HHMMSS.csv
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const datePart = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}`;
    const timePart = `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
    const filename = `audit-logs-${datePart}-${timePart}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(csvBuffer);

    // エクスポート自体を監査ログに記録（レスポンス送信後に非同期で実行）
    void auditLogService.record({
      actorUserId: req.userId,
      actionType: 'audit.export',
      metadata: { filter },
    });
  } catch (err) {
    next(err);
  }
}
