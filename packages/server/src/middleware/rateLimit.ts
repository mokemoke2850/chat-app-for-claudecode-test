/**
 * レート制限ミドルウェア (#153)
 *
 * Express ルートの POST に適用し、送信レート超過時に 429 を返す。
 * レート判定は rateLimitService に委譲する。
 */

import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth';
import { rateLimitService } from '../services/rateLimitService';
import type { RateLimitErrorBody } from '@chat-app/shared';

/**
 * レート制限チェックを行う Express ミドルウェアを生成する。
 *
 * @param action - カウンタキーに含めるアクション種別（例: 'message', 'dm', 'scheduled'）
 */
export function createRateLimitMiddleware(action: string) {
  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) {
      next();
      return;
    }

    const result = rateLimitService.check(userId, action);
    if (!result.allowed) {
      const body: RateLimitErrorBody = {
        error: '短時間に多くの送信を検出しました。少し時間をおいてください。',
        retryAfterSec: result.retryAfterSec,
        limit: result.limit,
        windowSec: result.windowSec,
      };
      res.status(429).json(body);
      return;
    }

    next();
  };
}
