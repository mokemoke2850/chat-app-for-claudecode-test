/**
 * PATCH /api/auth/password エンドポイントの統合テスト
 *
 * テスト対象: パスワード変更機能
 * 戦略: supertest で HTTP リクエストを発行し、レスポンスのステータスコードと
 * レスポンスボディを検証する。DB は pg-mem のインメモリ PostgreSQL 互換 DB を使用。
 */

import { createTestDatabase } from '../__fixtures__/pgTestHelper';

const testDb = createTestDatabase();

jest.mock('../../db/database', () => testDb);

import request from 'supertest';
import { createApp } from '../../app';
import { registerAndGetCookie } from '../__fixtures__/testHelpers';
import { generateToken } from '../../middleware/auth';

const app = createApp();

describe('PATCH /api/auth/password（パスワード変更）', () => {
  let token: string;
  let userId: number;
  const currentPassword = 'current-password123';

  beforeAll(async () => {
    const result = await registerAndGetCookie(app, 'pw_change_user', 'pw_change@example.com', currentPassword);
    userId = result.userId;
    token = generateToken(userId, 'pw_change_user');
  });

  describe('認証チェック', () => {
    it('未認証（トークンなし）の場合は 401 が返る', async () => {
      const res = await request(app)
        .patch('/api/auth/password')
        .send({ currentPassword, newPassword: 'newPassword123', confirmPassword: 'newPassword123' });

      expect(res.status).toBe(401);
    });
  });

  describe('バリデーション', () => {
    it('currentPassword が欠けている場合は 400 が返る', async () => {
      const res = await request(app)
        .patch('/api/auth/password')
        .set('Cookie', `token=${token}`)
        .send({ newPassword: 'newPassword123', confirmPassword: 'newPassword123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('newPassword が欠けている場合は 400 が返る', async () => {
      const res = await request(app)
        .patch('/api/auth/password')
        .set('Cookie', `token=${token}`)
        .send({ currentPassword, confirmPassword: 'newPassword123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('newPassword が最小文字数（8文字）未満の場合は 400 が返る', async () => {
      const res = await request(app)
        .patch('/api/auth/password')
        .set('Cookie', `token=${token}`)
        .send({ currentPassword, newPassword: 'short', confirmPassword: 'short' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('newPassword と confirmPassword が一致しない場合は 400 が返る', async () => {
      const res = await request(app)
        .patch('/api/auth/password')
        .set('Cookie', `token=${token}`)
        .send({ currentPassword, newPassword: 'newPassword123', confirmPassword: 'differentPassword123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('パスワード検証', () => {
    it('currentPassword が現在のパスワードと一致しない場合は 401 が返る', async () => {
      const res = await request(app)
        .patch('/api/auth/password')
        .set('Cookie', `token=${token}`)
        .send({ currentPassword: 'wrong-password', newPassword: 'newPassword123', confirmPassword: 'newPassword123' });

      expect(res.status).toBe(401);
    });
  });

  describe('正常系', () => {
    // 正常系テストは順序依存のため、変数で新パスワードを管理する
    const newPassword = 'newPassword456';

    it('正しい currentPassword と有効な newPassword を渡すと 200 が返る', async () => {
      const res = await request(app)
        .patch('/api/auth/password')
        .set('Cookie', `token=${token}`)
        .send({ currentPassword, newPassword, confirmPassword: newPassword });

      expect(res.status).toBe(200);
      expect(res.body.message).toBeDefined();
    });

    it('パスワード変更後、新しいパスワードでログインできる', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'pw_change@example.com', password: newPassword });

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
    });

    it('パスワード変更後、古いパスワードではログインできない', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'pw_change@example.com', password: currentPassword });

      expect(res.status).toBe(401);
    });
  });
});
