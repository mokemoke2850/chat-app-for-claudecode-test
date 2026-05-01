/**
 * テスト対象: middleware/guestAuth.ts — ゲストトークン認証ミドルウェア（#149）
 * 戦略:
 *   - Express の Request/Response/Next をモックしてミドルウェアの分岐を直接検証する
 *   - JWT の secret / payload / 有効期限・revoke / channelId 一致を中心に検証する
 *   - middleware/auth.ts には触らない方針（#153 とのコンフリクト回避）。本ミドルウェアは独立して動作することを境界として確認する
 */

import { createTestDatabase, resetTestData } from '../__fixtures__/pgTestHelper';

const testDb = createTestDatabase();

jest.mock('../../db/database', () => testDb);

import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { guestAuth, GuestRequest } from '../../middleware/guestAuth';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-please-change-in-production';

let userId: number;
let channelId: number;
let validToken: string;
let validJwt: string;

async function setupFixtures() {
  const r1 = await testDb.execute(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
    ['gowner', 'g@t.com', 'h'],
  );
  userId = r1.rows[0].id as number;

  const rc = await testDb.execute(
    'INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id',
    ['guest-auth-ch', userId],
  );
  channelId = rc.rows[0].id as number;

  validToken = 'guest-token-abc';
  await testDb.execute(
    `INSERT INTO guest_links (token, channel_id, created_by) VALUES ($1, $2, $3)`,
    [validToken, channelId, userId],
  );

  validJwt = jwt.sign({ type: 'guest', token: validToken, channelId, linkId: 1 }, JWT_SECRET, {
    expiresIn: '1h',
  });
}

function makeRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

function makeReq(headers: Record<string, string> = {}, cookies: Record<string, string> = {}) {
  return { headers, cookies } as unknown as Request;
}

beforeEach(async () => {
  await resetTestData(testDb);
  await setupFixtures();
});

describe('guestAuth ミドルウェア', () => {
  describe('Authorization ヘッダ解析', () => {
    it('Authorization ヘッダがない場合は 401 を返す', async () => {
      const req = makeReq({});
      const res = makeRes();
      const next = jest.fn() as unknown as NextFunction;
      await guestAuth(req, res, next);
      expect((res as unknown as { statusCode: number }).statusCode).toBe(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('Authorization ヘッダが Bearer 形式でない場合は 401 を返す', async () => {
      const req = makeReq({ authorization: 'Basic xxx' });
      const res = makeRes();
      const next = jest.fn() as unknown as NextFunction;
      await guestAuth(req, res, next);
      expect((res as unknown as { statusCode: number }).statusCode).toBe(401);
    });

    it('有効な Bearer ゲストトークンは next() を呼ぶ', async () => {
      const req = makeReq({ authorization: `Bearer ${validJwt}` });
      const res = makeRes();
      const next = jest.fn() as unknown as NextFunction;
      await guestAuth(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('JWT 検証', () => {
    it('別 secret で署名された JWT は 401 になる', async () => {
      const bad = jwt.sign({ type: 'guest', token: validToken, channelId }, 'other-secret');
      const req = makeReq({ authorization: `Bearer ${bad}` });
      const res = makeRes();
      const next = jest.fn() as unknown as NextFunction;
      await guestAuth(req, res, next);
      expect((res as unknown as { statusCode: number }).statusCode).toBe(401);
    });

    it('既に有効期限切れの JWT は 401 になる', async () => {
      const expired = jwt.sign({ type: 'guest', token: validToken, channelId }, JWT_SECRET, {
        expiresIn: -10,
      });
      const req = makeReq({ authorization: `Bearer ${expired}` });
      const res = makeRes();
      const next = jest.fn() as unknown as NextFunction;
      await guestAuth(req, res, next);
      expect((res as unknown as { statusCode: number }).statusCode).toBe(401);
    });

    it('payload に token が含まれない JWT は 401 になる', async () => {
      const bad = jwt.sign({ type: 'guest', channelId }, JWT_SECRET);
      const req = makeReq({ authorization: `Bearer ${bad}` });
      const res = makeRes();
      const next = jest.fn() as unknown as NextFunction;
      await guestAuth(req, res, next);
      expect((res as unknown as { statusCode: number }).statusCode).toBe(401);
    });

    it('payload に channelId が含まれない JWT は 401 になる', async () => {
      const bad = jwt.sign({ type: 'guest', token: validToken }, JWT_SECRET);
      const req = makeReq({ authorization: `Bearer ${bad}` });
      const res = makeRes();
      const next = jest.fn() as unknown as NextFunction;
      await guestAuth(req, res, next);
      expect((res as unknown as { statusCode: number }).statusCode).toBe(401);
    });
  });

  describe('リンク状態の検証', () => {
    it('payload の token が DB に存在しない場合は 401 になる', async () => {
      const bad = jwt.sign({ type: 'guest', token: 'no-such-token', channelId }, JWT_SECRET);
      const req = makeReq({ authorization: `Bearer ${bad}` });
      const res = makeRes();
      const next = jest.fn() as unknown as NextFunction;
      await guestAuth(req, res, next);
      expect((res as unknown as { statusCode: number }).statusCode).toBe(401);
    });

    it('payload の token が is_revoked = true の場合は 410 になる', async () => {
      await testDb.execute('UPDATE guest_links SET is_revoked = true WHERE token = $1', [
        validToken,
      ]);
      const req = makeReq({ authorization: `Bearer ${validJwt}` });
      const res = makeRes();
      const next = jest.fn() as unknown as NextFunction;
      await guestAuth(req, res, next);
      expect((res as unknown as { statusCode: number }).statusCode).toBe(410);
    });

    it('payload の token が expires_at < now の場合は 410 になる', async () => {
      const past = new Date(Date.now() - 60_000).toISOString();
      await testDb.execute('UPDATE guest_links SET expires_at = $1 WHERE token = $2', [
        past,
        validToken,
      ]);
      const req = makeReq({ authorization: `Bearer ${validJwt}` });
      const res = makeRes();
      const next = jest.fn() as unknown as NextFunction;
      await guestAuth(req, res, next);
      expect((res as unknown as { statusCode: number }).statusCode).toBe(410);
    });

    it('payload の channelId が DB の channel_id と一致しない場合は 403 になる', async () => {
      const bad = jwt.sign({ type: 'guest', token: validToken, channelId: 999999 }, JWT_SECRET);
      const req = makeReq({ authorization: `Bearer ${bad}` });
      const res = makeRes();
      const next = jest.fn() as unknown as NextFunction;
      await guestAuth(req, res, next);
      expect((res as unknown as { statusCode: number }).statusCode).toBe(403);
    });
  });

  describe('req に注入する情報', () => {
    it('検証成功時に req.guest = { token, channelId, linkId } を設定する', async () => {
      const req = makeReq({ authorization: `Bearer ${validJwt}` });
      const res = makeRes();
      const next = jest.fn() as unknown as NextFunction;
      await guestAuth(req, res, next);
      const guest = (req as unknown as GuestRequest).guest;
      expect(guest.token).toBe(validToken);
      expect(guest.channelId).toBe(channelId);
      expect(typeof guest.linkId).toBe('number');
    });
  });

  describe('既存 authenticateToken との独立性', () => {
    it('通常ユーザーの cookie token を guestAuth に渡しても 401 になる（payload 形が違う）', async () => {
      const userJwt = jwt.sign({ userId: 1, username: 'u' }, JWT_SECRET);
      const req = makeReq({ authorization: `Bearer ${userJwt}` });
      const res = makeRes();
      const next = jest.fn() as unknown as NextFunction;
      await guestAuth(req, res, next);
      expect((res as unknown as { statusCode: number }).statusCode).toBe(401);
    });
  });
});
