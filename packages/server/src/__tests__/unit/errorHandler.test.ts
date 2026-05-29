/**
 * テスト対象: middleware/errorHandler.ts（#372 APIレスポンス形式の統一）
 * 戦略: errorHandler / createError / バリデーションエラーヘルパーを直接呼び出し、
 *       統一エラー形式 { error: { code, message, details? } } を検証するユニットテスト。
 *       Express の res は最小限のモックで代替する。
 */

import { describe, it, expect, jest } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import {
  errorHandler,
  createError,
  createValidationError,
  AppError,
} from '../../middleware/errorHandler';

// status().json() をチェーンできる最小限の Response モックを作る
function mockRes() {
  const status = jest.fn();
  const json = jest.fn();
  const res = { status, json } as Record<string, jest.Mock>;
  status.mockReturnValue(res);
  json.mockReturnValue(res);
  return { res: res as unknown as Response, status, json };
}

const req = {} as Request;
const next = (() => {}) as NextFunction;

function run(err: AppError) {
  const { res, status, json } = mockRes();
  errorHandler(err, req, res, next);
  return {
    status: status.mock.calls[0]?.[0] as number,
    body: json.mock.calls[0]?.[0] as {
      error: { code: string; message: string; details?: unknown };
    },
  };
}

describe('errorHandler（統一エラー形式）', () => {
  describe('レスポンス形式', () => {
    it('AppError を { error: { code, message } } 形式の JSON で返す', () => {
      const { body } = run(createError('見つかりません', 404));
      expect(body).toEqual({ error: { code: 'NOT_FOUND', message: '見つかりません' } });
    });

    it('err.statusCode をそのまま HTTP ステータスコードに使う', () => {
      const { status } = run(createError('権限がありません', 403));
      expect(status).toBe(403);
    });

    it('statusCode 未指定のときは 500 を返す', () => {
      const { status, body } = run(new Error('想定外') as AppError);
      expect(status).toBe(500);
      expect(body.error.code).toBe('INTERNAL');
    });

    it('message が空のときは既定メッセージ "Internal server error" を使う', () => {
      const err = new Error('') as AppError;
      const { body } = run(err);
      expect(body.error.message).toBe('Internal server error');
    });

    it('err.details があるときは error.details に含める', () => {
      const { body } = run(createError('無効', 400, { details: [{ path: ['name'] }] }));
      expect(body.error.details).toEqual([{ path: ['name'] }]);
    });

    it('err.details がないときは error に details キーを含めない', () => {
      const { body } = run(createError('無効', 400));
      expect('details' in body.error).toBe(false);
    });
  });

  describe('code の導出', () => {
    it('err.code が指定されていればそれを使う', () => {
      const { body } = run(createError('レート制限', 429, { code: 'RATE_LIMITED' }));
      expect(body.error.code).toBe('RATE_LIMITED');
    });

    it('code 未指定時は statusCode からデフォルト code を導出する（400→BAD_REQUEST 等）', () => {
      expect(run(createError('x', 400)).body.error.code).toBe('BAD_REQUEST');
      expect(run(createError('x', 401)).body.error.code).toBe('UNAUTHORIZED');
      expect(run(createError('x', 403)).body.error.code).toBe('FORBIDDEN');
      expect(run(createError('x', 404)).body.error.code).toBe('NOT_FOUND');
      expect(run(createError('x', 409)).body.error.code).toBe('CONFLICT');
      expect(run(createError('x', 500)).body.error.code).toBe('INTERNAL');
    });

    it('未知の statusCode のときは code に "ERROR" を使う', () => {
      const { body } = run(createError('x', 418));
      expect(body.error.code).toBe('ERROR');
    });
  });
});

describe('createError', () => {
  it('message と statusCode を受け取り statusCode を持つ AppError を生成する（既存シグネチャ後方互換）', () => {
    const err = createError('boom', 404);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('boom');
    expect(err.statusCode).toBe(404);
  });

  it('options.code を指定すると AppError.code に設定される', () => {
    const err = createError('boom', 400, { code: 'CUSTOM' });
    expect(err.code).toBe('CUSTOM');
  });

  it('options.details を指定すると AppError.details に設定される', () => {
    const err = createError('boom', 400, { details: { foo: 'bar' } });
    expect(err.details).toEqual({ foo: 'bar' });
  });
});

describe('createValidationError（zod バリデーション失敗ヘルパー）', () => {
  it('statusCode 400・code "VALIDATION_ERROR" の AppError を生成する', () => {
    const err = createValidationError([]);
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
  });

  it('zod の issues を details に保持する', () => {
    const issues = [{ path: ['name'], message: 'Required' }];
    const err = createValidationError(issues);
    expect(err.details).toEqual(issues);
  });

  it('errorHandler を通すと details に issues を含む 400 レスポンスになる', () => {
    const issues = [{ path: ['name'], message: 'Required' }];
    const { status, body } = run(createValidationError(issues));
    expect(status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details).toEqual(issues);
  });
});
