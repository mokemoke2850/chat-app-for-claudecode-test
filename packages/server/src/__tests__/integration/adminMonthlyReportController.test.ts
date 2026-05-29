/**
 * 月次レポート CSV エクスポートの HTTP レベルテスト（Issue #273）
 *
 * テスト対象: packages/server/src/controllers/adminController.ts に追加する
 *           exportMonthlyReport ハンドラと
 *           GET /api/admin/reports/monthly?month=YYYY-MM ルート
 * 戦略:
 *   - supertest で HTTP リクエストを発行し、認可・バリデーション・レスポンスヘッダー・
 *     レスポンスボディ（CSV テキスト・BOM）を検証する
 *   - DB は pg-mem を使用
 */

import { createTestDatabase, resetTestData } from '../__fixtures__/pgTestHelper';

const testDb = createTestDatabase();

jest.mock('../../db/database', () => testDb);

import request from 'supertest';
import { createApp } from '../../app';
import { makeAdmin, registerUser } from '../__fixtures__/testHelpers';

const app = createApp();

async function clearAll(): Promise<void> {
  await resetTestData(testDb);
}

function pickPastMonth(): string {
  // 現在月より過去の月を必ず返す（前月）
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function pickFutureMonth(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

describe('GET /api/admin/reports/monthly', () => {
  beforeEach(async () => {
    await clearAll();
  });

  describe('認可', () => {
    it('非ログインは 401 を返す', async () => {
      const res = await request(app).get('/api/admin/reports/monthly?month=2026-04');
      expect(res.status).toBe(401);
    });

    it('一般ユーザー（role=user）は 403 を返す', async () => {
      // 先に1人 dummy を作って 2人目を user として作る（authService は最初のユーザーを admin に昇格）
      await registerUser(app, `mr_dummy_${Date.now()}`, `mr_dummy_${Date.now()}@e.com`);
      const { token, userId } = await registerUser(
        app,
        `mr_user_${Date.now()}_2`,
        `mr_user_${Date.now()}_2@e.com`,
      );
      // 念のため role='user' に強制
      await testDb.execute("UPDATE users SET role = 'user' WHERE id = $1", [userId]);
      const res = await request(app)
        .get('/api/admin/reports/monthly?month=2026-04')
        .set('Cookie', `token=${token}`);
      expect(res.status).toBe(403);
    });

    it('admin ユーザーは 200 を返す', async () => {
      const { token, userId } = await registerUser(
        app,
        `mr_adm_${Date.now()}`,
        `mr_adm_${Date.now()}@e.com`,
      );
      await makeAdmin(userId);
      const res = await request(app)
        .get(`/api/admin/reports/monthly?month=${pickPastMonth()}`)
        .set('Cookie', `token=${token}`);
      expect(res.status).toBe(200);
    });
  });

  describe('month パラメータのバリデーション', () => {
    async function adminToken(): Promise<string> {
      const { token, userId } = await registerUser(
        app,
        `mr_v_${Date.now()}_${Math.random()}`,
        `mr_v_${Date.now()}_${Math.random()}@e.com`,
      );
      await makeAdmin(userId);
      return token;
    }

    it('month パラメータが未指定の場合は 400 を返す', async () => {
      const token = await adminToken();
      const res = await request(app)
        .get('/api/admin/reports/monthly')
        .set('Cookie', `token=${token}`);
      expect(res.status).toBe(400);
    });

    it('month パラメータが YYYY-MM 形式でない場合（例: "2026/01"）は 400 を返す', async () => {
      const token = await adminToken();
      const res = await request(app)
        .get('/api/admin/reports/monthly?month=2026/01')
        .set('Cookie', `token=${token}`);
      expect(res.status).toBe(400);
    });

    it('month の月部分が範囲外（例: "2026-13"）の場合は 400 を返す', async () => {
      const token = await adminToken();
      const res = await request(app)
        .get('/api/admin/reports/monthly?month=2026-13')
        .set('Cookie', `token=${token}`);
      expect(res.status).toBe(400);
    });

    it('未来月（現在月より後）を指定した場合は 400 を返す', async () => {
      const token = await adminToken();
      const res = await request(app)
        .get(`/api/admin/reports/monthly?month=${pickFutureMonth()}`)
        .set('Cookie', `token=${token}`);
      expect(res.status).toBe(400);
    });
  });

  describe('レスポンスヘッダー・ボディ', () => {
    it('Content-Type が text/csv; charset=utf-8、Content-Disposition が attachment で対象月を含む', async () => {
      const { token, userId } = await registerUser(
        app,
        `mr_h_${Date.now()}`,
        `mr_h_${Date.now()}@e.com`,
      );
      await makeAdmin(userId);
      const month = pickPastMonth();
      const res = await request(app)
        .get(`/api/admin/reports/monthly?month=${month}`)
        .set('Cookie', `token=${token}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.headers['content-type']).toMatch(/charset=utf-8/);
      expect(res.headers['content-disposition']).toMatch(/attachment/);
      expect(res.headers['content-disposition']).toContain(month);
    });

    it('レスポンスの先頭に UTF-8 BOM が付与され、各セクションが含まれる', async () => {
      const { token, userId } = await registerUser(
        app,
        `mr_b_${Date.now()}`,
        `mr_b_${Date.now()}@e.com`,
      );
      await makeAdmin(userId);
      const res = await request(app)
        .get(`/api/admin/reports/monthly?month=${pickPastMonth()}`)
        .set('Cookie', `token=${token}`)
        .buffer(true)
        .parse((response, callback) => {
          const chunks: Buffer[] = [];
          response.on('data', (c: Buffer) => chunks.push(c));
          response.on('end', () => callback(null, Buffer.concat(chunks)));
        });
      const buf = res.body as Buffer;
      expect(buf[0]).toBe(0xef);
      expect(buf[1]).toBe(0xbb);
      expect(buf[2]).toBe(0xbf);
      const text = buf.subarray(3).toString('utf8');
      expect(text).toContain('# Users');
      expect(text).toContain('# Channels');
      expect(text).toContain('# Files');
    });
  });
});
