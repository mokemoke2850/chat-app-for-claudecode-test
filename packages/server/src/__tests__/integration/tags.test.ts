/**
 * タグ関連 HTTP ルーティングのテスト
 *
 * テスト対象: GET /api/tags/suggestions
 * 戦略:
 *   - DB は pg-mem のインメモリ PostgreSQL 互換 DB を使用
 *   - supertest で HTTP リクエストを発行し、ステータスコードを検証する
 *   - ルートが `/api` ベースに統合されているため、`/api/tags/suggestions` で
 *     ルーティングされていることを担保する（パス間違いの再発防止）
 */

import { createTestDatabase } from '../__fixtures__/pgTestHelper';

const testDb = createTestDatabase();

jest.mock('../../db/database', () => testDb);

import request from 'supertest';
import { createApp } from '../../app';
import { registerUser } from '../__fixtures__/testHelpers';

const app = createApp();

describe('GET /api/tags/suggestions', () => {
  describe('正常系', () => {
    it('prefix を指定すると 200 を返す', async () => {
      const { token } = await registerUser(app, 'tagsugg1', 'tagsugg1@example.com');

      const res = await request(app)
        .get('/api/tags/suggestions?prefix=xxx&limit=10')
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.suggestions)).toBe(true);
    });

    it('prefix が空でも 200 を返す', async () => {
      const { token } = await registerUser(app, 'tagsugg2', 'tagsugg2@example.com');

      const res = await request(app).get('/api/tags/suggestions').set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.suggestions)).toBe(true);
    });
  });

  describe('エラー系', () => {
    it('認証 Cookie がない場合 401 を返す', async () => {
      const res = await request(app).get('/api/tags/suggestions?prefix=xxx');

      expect(res.status).toBe(401);
    });
  });
});
