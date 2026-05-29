/**
 * テスト対象: 全ルート共通のエラーレスポンス形式（#372 APIレスポンス形式の統一）
 * 戦略: supertest で実エンドポイントを叩き、各種エラーが統一形式
 *       { error: { code, message, details? } } で返ることを横断的に検証する統合テスト。
 *       代表ルートとして saved-views（zod バリデーション・id 検証・404）と admin（403）を使う。
 */

import { createTestDatabase } from '../__fixtures__/pgTestHelper';

const testDb = createTestDatabase();

jest.mock('../../db/database', () => testDb);

import request from 'supertest';
import { createApp } from '../../app';
import { registerUser } from '../__fixtures__/testHelpers';

const app = createApp();

describe('エラーレスポンス形式の統一（#372）', () => {
  describe('認証エラー', () => {
    it('認証なしリクエストは { error: { code, message } } 形式の 401 を返す', async () => {
      const res = await request(app).get('/api/saved-views');
      expect(res.status).toBe(401);
      expect(res.body.error).toMatchObject({ code: 'UNAUTHORIZED', message: expect.any(String) });
    });

    it('error は文字列ではなくオブジェクトである（旧 { error: string } を返さない）', async () => {
      const res = await request(app).get('/api/saved-views');
      expect(typeof res.body.error).toBe('object');
    });
  });

  describe('バリデーションエラー（zod）', () => {
    it('zod バリデーション失敗時は code "VALIDATION_ERROR" の 400 を返す', async () => {
      const { token } = await registerUser(app, 'err_fmt_zod', 'err_fmt_zod@test.com');
      const res = await request(app)
        .post('/api/saved-views')
        .set('Cookie', `token=${token}`)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('error.details に zod の issues 配列を含む', async () => {
      const { token } = await registerUser(app, 'err_fmt_zod2', 'err_fmt_zod2@test.com');
      const res = await request(app)
        .post('/api/saved-views')
        .set('Cookie', `token=${token}`)
        .send({});
      expect(Array.isArray(res.body.error.details)).toBe(true);
      expect(res.body.error.details.length).toBeGreaterThan(0);
    });
  });

  describe('不正なパスパラメータ', () => {
    it('id が数値でないときは 400 を返し error.code を持つ', async () => {
      const { token } = await registerUser(app, 'err_fmt_nan', 'err_fmt_nan@test.com');
      const res = await request(app).delete('/api/saved-views/abc').set('Cookie', `token=${token}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });
  });

  describe('リソース未検出', () => {
    it('存在しないリソースへの操作は code "NOT_FOUND" の 404 を返す', async () => {
      const { token } = await registerUser(app, 'err_fmt_404', 'err_fmt_404@test.com');
      const res = await request(app)
        .put('/api/saved-views/999999')
        .set('Cookie', `token=${token}`)
        .send({ name: 'x', query: {} });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('権限エラー', () => {
    it('管理者以外が管理 API を叩くと 403 を返し error はオブジェクト形式である', async () => {
      const { token } = await registerUser(app, 'err_fmt_403', 'err_fmt_403@test.com');
      const res = await request(app).get('/api/admin/users').set('Cookie', `token=${token}`);
      expect(res.status).toBe(403);
      expect(res.body.error).toMatchObject({ code: 'FORBIDDEN', message: expect.any(String) });
    });
  });
});
