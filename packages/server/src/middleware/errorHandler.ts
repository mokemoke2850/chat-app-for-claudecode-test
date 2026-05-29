import { Request, Response, NextFunction } from 'express';
import type { ApiErrorResponse } from '@chat-app/shared';

export interface AppError extends Error {
  statusCode?: number;
  /** フロントが機械的に分岐するためのエラーコード（未指定時は statusCode から導出） */
  code?: string;
  /** zod issues などの補足情報（任意） */
  details?: unknown;
}

/** HTTP ステータスコード → 既定エラーコードの対応表 */
const STATUS_CODE_MAP: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMITED',
  500: 'INTERNAL',
};

/** statusCode から既定の code を導出する */
export function codeFromStatus(statusCode: number): string {
  return STATUS_CODE_MAP[statusCode] ?? 'ERROR';
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error(err.stack);
  const statusCode = err.statusCode ?? 500;
  const code = err.code ?? codeFromStatus(statusCode);
  const message = err.message || 'Internal server error';

  const body: ApiErrorResponse = { error: { code, message } };
  if (err.details !== undefined) {
    body.error.details = err.details;
  }

  res.status(statusCode).json(body);
}

/**
 * AppError を生成する。
 * 既存シグネチャ createError(message, statusCode) は後方互換のため維持し、
 * code / details は任意の第3引数で指定する。
 */
export function createError(
  message: string,
  statusCode: number,
  options?: { code?: string; details?: unknown },
): AppError {
  const err = new Error(message) as AppError;
  err.statusCode = statusCode;
  if (options?.code !== undefined) err.code = options.code;
  if (options?.details !== undefined) err.details = options.details;
  return err;
}

/**
 * zod バリデーション失敗用の AppError を生成する。
 * statusCode 400 / code 'VALIDATION_ERROR' で、details に issues を保持する。
 */
export function createValidationError(
  details: unknown,
  message = '無効なリクエストです',
): AppError {
  return createError(message, 400, { code: 'VALIDATION_ERROR', details });
}
