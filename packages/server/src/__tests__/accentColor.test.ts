/**
 * テスト対象: アクセントカラー機能（サーバサイド / #274）
 *
 * 戦略:
 *   - pg-mem のインメモリ PostgreSQL 互換 DB を使い HTTP エンドポイントを検証する
 *   - GET /api/auth/me で users.accent_color が camelCase（accentColor）で返ることを確認する
 *   - PATCH /api/auth/profile で accentColor を更新できることを確認する
 *   - プリセット外の値（任意 hex / 不正文字列）は 400 を返すバリデーションを確認する
 *   - 認証なしのアクセスは 401 を返すことを確認する
 *
 *   プリセット値は 'blue' / 'purple' / 'green' / 'orange' / 'red' の 5 種類を想定する。
 */

import { createTestDatabase, resetTestData } from './__fixtures__/pgTestHelper';

const testDb = createTestDatabase();

jest.mock('../db/database', () => testDb);

import request from 'supertest';
import { createApp } from '../app';
import { registerUser } from './__fixtures__/testHelpers';

const app = createApp();

describe('アクセントカラー機能', () => {
  let userId: number;
  let authToken: string;

  beforeEach(async () => {
    await resetTestData(testDb);
    const result = await registerUser(app, 'colorsuser', 'colors@example.com');
    userId = result.userId;
    authToken = result.token;
  });

  describe('GET /api/auth/me で accent_color が返る', () => {
    it('未設定ユーザーの GET /api/auth/me レスポンスに accentColor: null が含まれる', async () => {
      const res = await request(app).get('/api/auth/me').set('Cookie', `token=${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user).toHaveProperty('accentColor');
      expect(res.body.user.accentColor).toBeNull();
    });

    it('accent_color を設定済みのユーザーの GET /api/auth/me レスポンスに保存値（例: "purple"）が含まれる', async () => {
      // DB に直接 accent_color を書き込む
      await testDb.execute('UPDATE users SET accent_color = $1 WHERE id = $2', ['purple', userId]);

      const res = await request(app).get('/api/auth/me').set('Cookie', `token=${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user.accentColor).toBe('purple');
    });
  });

  describe('accentColor の更新', () => {
    it('プリセット値（例: "purple"）で更新リクエストを送ると 200 が返り DB に保存される', async () => {
      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Cookie', `token=${authToken}`)
        .send({ accentColor: 'purple' });

      expect(res.status).toBe(200);
      expect(res.body.user.accentColor).toBe('purple');

      // DB にも保存されていることを確認
      const row = await testDb.queryOne<{ accent_color: string | null }>(
        'SELECT accent_color FROM users WHERE id = $1',
        [userId],
      );
      expect(row?.accent_color).toBe('purple');
    });

    it('更新後の GET /api/auth/me で新しい accentColor が返る', async () => {
      await request(app)
        .patch('/api/auth/profile')
        .set('Cookie', `token=${authToken}`)
        .send({ accentColor: 'green' });

      const meRes = await request(app).get('/api/auth/me').set('Cookie', `token=${authToken}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.user.accentColor).toBe('green');
    });

    it('null を送ると accentColor をクリアできる（DB 値が NULL になる）', async () => {
      // 一度設定
      await request(app)
        .patch('/api/auth/profile')
        .set('Cookie', `token=${authToken}`)
        .send({ accentColor: 'red' });

      // null でクリア
      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Cookie', `token=${authToken}`)
        .send({ accentColor: null });

      expect(res.status).toBe(200);
      expect(res.body.user.accentColor).toBeNull();

      const row = await testDb.queryOne<{ accent_color: string | null }>(
        'SELECT accent_color FROM users WHERE id = $1',
        [userId],
      );
      expect(row?.accent_color).toBeNull();
    });

    it('5 つのプリセット（blue / purple / green / orange / red）すべてが受け付けられる', async () => {
      for (const color of ['blue', 'purple', 'green', 'orange', 'red']) {
        const res = await request(app)
          .patch('/api/auth/profile')
          .set('Cookie', `token=${authToken}`)
          .send({ accentColor: color });
        expect(res.status).toBe(200);
        expect(res.body.user.accentColor).toBe(color);
      }
    });
  });

  describe('プリセット外の値の拒否', () => {
    it('任意の hex 値（例: "#FF00AA"）を送ると 400 が返る', async () => {
      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Cookie', `token=${authToken}`)
        .send({ accentColor: '#FF00AA' });

      expect(res.status).toBe(400);
    });

    it('プリセット外の文字列（例: "rainbow"）を送ると 400 が返る', async () => {
      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Cookie', `token=${authToken}`)
        .send({ accentColor: 'rainbow' });

      expect(res.status).toBe(400);
    });
  });

  describe('認証チェック', () => {
    it('認証 Cookie なしで accentColor 更新エンドポイントを叩くと 401 が返る', async () => {
      const res = await request(app).patch('/api/auth/profile').send({ accentColor: 'blue' });

      expect(res.status).toBe(401);
    });
  });
});
