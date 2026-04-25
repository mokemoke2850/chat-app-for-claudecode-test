import { Response, NextFunction } from 'express';
import * as moderationService from '../services/moderationService';
import * as auditLogService from '../services/auditLogService';
import { AuthenticatedRequest } from '../middleware/auth';
import type {
  CreateNgWordInput,
  UpdateNgWordInput,
  CreateBlockedExtensionInput,
} from '@chat-app/shared';

// ─── NG ワード ─────────────────────────────────────────────────

export async function listNgWords(
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    res.json({ ngWords: await moderationService.listNgWords() });
  } catch (err) {
    next(err);
  }
}

export async function createNgWord(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = req.body as CreateNgWordInput;
    const created = await moderationService.createNgWord(input, req.userId);
    await auditLogService.record({
      actorUserId: req.userId,
      actionType: 'moderation.ngword.create',
      targetType: null,
      targetId: created.id,
      metadata: { pattern: created.pattern, action: created.action },
    });
    res.status(201).json({ ngWord: created });
  } catch (err) {
    next(err);
  }
}

export async function updateNgWord(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = Number(req.params.id);
    const input = req.body as UpdateNgWordInput;
    const updated = await moderationService.updateNgWord(id, input);
    await auditLogService.record({
      actorUserId: req.userId,
      actionType: 'moderation.ngword.update',
      targetType: null,
      targetId: updated.id,
      metadata: { pattern: updated.pattern, action: updated.action, isActive: updated.isActive },
    });
    res.json({ ngWord: updated });
  } catch (err) {
    next(err);
  }
}

export async function deleteNgWord(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = Number(req.params.id);
    await moderationService.deleteNgWord(id);
    await auditLogService.record({
      actorUserId: req.userId,
      actionType: 'moderation.ngword.delete',
      targetType: null,
      targetId: id,
      metadata: null,
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// ─── 拡張子ブロックリスト ─────────────────────────────────────

export async function listBlockedExtensions(
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    res.json({ blockedExtensions: await moderationService.listBlockedExtensions() });
  } catch (err) {
    next(err);
  }
}

export async function createBlockedExtension(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = req.body as CreateBlockedExtensionInput;
    const created = await moderationService.createBlockedExtension(input, req.userId);
    await auditLogService.record({
      actorUserId: req.userId,
      actionType: 'moderation.blocklist.add',
      targetType: null,
      targetId: created.id,
      metadata: { extension: created.extension, reason: created.reason },
    });
    res.status(201).json({ blockedExtension: created });
  } catch (err) {
    next(err);
  }
}

export async function deleteBlockedExtension(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = Number(req.params.id);
    await moderationService.deleteBlockedExtension(id);
    await auditLogService.record({
      actorUserId: req.userId,
      actionType: 'moderation.blocklist.remove',
      targetType: null,
      targetId: id,
      metadata: null,
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
