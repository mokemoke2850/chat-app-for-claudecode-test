/**
 * テスト対象: adminService.getStats / adminController.getStats の期間フィルタ（Issue #272）
 * 戦略: pg-mem のインメモリ PostgreSQL 互換 DB を使用し、
 *   - from / to クエリパラメータを受け取ったときに集計範囲が正しく絞り込まれること
 *   - バリデーション（不正な日付・from > to 等）が適切にエラーを返すこと
 * を検証する。
 */

import { createTestDatabase, resetTestData } from '../__fixtures__/pgTestHelper';

const testDb = createTestDatabase();

jest.mock('../../db/database', () => testDb);

import { getStats } from '../../services/adminService';
import { createApp } from '../../app';
import request from 'supertest';
import { registerUser } from '../__fixtures__/testHelpers';

const app = createApp();

async function makeAdmin(userId: number): Promise<void> {
  await testDb.execute("UPDATE users SET role = 'admin' WHERE id = $1", [userId]);
}

async function insertUserWithLastLogin(
  username: string,
  lastLoginAt: Date | null,
): Promise<number> {
  const res = await testDb.execute(
    "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, 'hash') RETURNING id",
    [username, `${username}@example.com`],
  );
  const id = res.rows[0].id as number;
  if (lastLoginAt !== null) {
    await testDb.execute('UPDATE users SET last_login_at = $1 WHERE id = $2', [
      lastLoginAt.toISOString(),
      id,
    ]);
  }
  return id;
}

async function insertChannel(name: string, createdBy: number): Promise<number> {
  const res = await testDb.execute(
    'INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id',
    [name, createdBy],
  );
  return res.rows[0].id as number;
}

async function insertMessage(channelId: number, userId: number, createdAt?: Date): Promise<number> {
  let res;
  if (createdAt) {
    res = await testDb.execute(
      'INSERT INTO messages (channel_id, user_id, content, created_at) VALUES ($1, $2, $3, $4) RETURNING id',
      [channelId, userId, 'test', createdAt.toISOString()],
    );
  } else {
    res = await testDb.execute(
      'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
      [channelId, userId, 'test'],
    );
  }
  return res.rows[0].id as number;
}

beforeEach(async () => {
  await resetTestData(testDb);
});

describe('adminService.getStats: 期間フィルタ（from / to）', () => {
  describe('メッセージ数の集計範囲', () => {
    it('from / to を指定しない場合は全期間の totalMessages を返す', async () => {
      const userId = await insertUserWithLastLogin('pf_u1', null);
      const chId = await insertChannel('pf-ch1', userId);
      await insertMessage(chId, userId);
      await insertMessage(chId, userId);

      const stats = await getStats();
      expect(stats.totalMessages).toBeGreaterThanOrEqual(2);
    });

    it('from を指定すると from 以降のメッセージのみが totalMessages に含まれる', async () => {
      const userId = await insertUserWithLastLogin('pf_u2', null);
      const chId = await insertChannel('pf-ch2', userId);

      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

      // from より前のメッセージ
      await insertMessage(chId, userId, twoDaysAgo);
      // from 以降のメッセージ
      await insertMessage(chId, userId, oneDayAgo);
      await insertMessage(chId, userId, now);

      const from = new Date(now.getTime() - 36 * 60 * 60 * 1000); // 1.5日前
      const stats = await getStats({ from });
      expect(stats.totalMessages).toBe(2);
    });

    it('to を指定すると to 以前のメッセージのみが totalMessages に含まれる', async () => {
      const userId = await insertUserWithLastLogin('pf_u3', null);
      const chId = await insertChannel('pf-ch3', userId);

      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

      // to 以前のメッセージ
      await insertMessage(chId, userId, twoDaysAgo);
      await insertMessage(chId, userId, oneDayAgo);
      // to より後のメッセージ（現在時刻）
      await insertMessage(chId, userId, now);

      const to = new Date(now.getTime() - 12 * 60 * 60 * 1000); // 12時間前
      const stats = await getStats({ to });
      expect(stats.totalMessages).toBe(2);
    });

    it('from と to の両方を指定すると範囲内のメッセージのみが totalMessages に含まれる', async () => {
      const userId = await insertUserWithLastLogin('pf_u4', null);
      const chId = await insertChannel('pf-ch4', userId);

      const now = new Date();
      const t1 = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000); // 4日前
      const t2 = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000); // 3日前
      const t3 = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2日前
      const t4 = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000); // 1日前

      await insertMessage(chId, userId, t1); // 範囲外（前）
      await insertMessage(chId, userId, t2); // 範囲内
      await insertMessage(chId, userId, t3); // 範囲内
      await insertMessage(chId, userId, t4); // 範囲外（後）

      const from = new Date(now.getTime() - 3.5 * 24 * 60 * 60 * 1000);
      const to = new Date(now.getTime() - 1.5 * 24 * 60 * 60 * 1000);
      const stats = await getStats({ from, to });
      expect(stats.totalMessages).toBe(2);
    });

    it('from と to が同じ日時の場合でもその時点のメッセージが含まれる', async () => {
      const userId = await insertUserWithLastLogin('pf_u5', null);
      const chId = await insertChannel('pf-ch5', userId);

      const exactTime = new Date('2024-06-15T12:00:00.000Z');
      await insertMessage(chId, userId, exactTime);

      const stats = await getStats({ from: exactTime, to: exactTime });
      expect(stats.totalMessages).toBe(1);
    });
  });

  describe('アクティブユーザー数の集計範囲', () => {
    it('from / to を指定した場合、範囲内に last_login_at があるユーザーだけが activeUsers に含まれる', async () => {
      const now = new Date();
      const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
      const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000);

      await insertUserWithLastLogin('pf_active1', threeHoursAgo);
      await insertUserWithLastLogin('pf_active2', fiveHoursAgo);

      const from = new Date(now.getTime() - 4 * 60 * 60 * 1000); // 4時間前
      const to = now;
      const stats = await getStats({ from, to });

      expect(stats.activeUsers).toBe(1);
    });

    it('from / to の範囲外に last_login_at があるユーザーは activeUsers に含まれない', async () => {
      const now = new Date();
      const tenHoursAgo = new Date(now.getTime() - 10 * 60 * 60 * 1000);

      await insertUserWithLastLogin('pf_outside1', tenHoursAgo);

      const from = new Date(now.getTime() - 4 * 60 * 60 * 1000);
      const to = now;
      const stats = await getStats({ from, to });

      expect(stats.activeUsers).toBe(0);
    });
  });

  describe('バリデーション', () => {
    it('from に不正な日付文字列を渡すと例外を投げる（またはエラーを返す）', async () => {
      await expect(getStats({ from: 'not-a-date' as unknown as Date })).rejects.toThrow();
    });

    it('to に不正な日付文字列を渡すと例外を投げる（またはエラーを返す）', async () => {
      await expect(getStats({ to: 'invalid' as unknown as Date })).rejects.toThrow();
    });

    it('from が to より後の日時の場合は例外を投げる（またはエラーを返す）', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      await expect(getStats({ from: now, to: yesterday })).rejects.toThrow();
    });
  });
});

describe('GET /api/admin/stats: 期間フィルタ（from / to クエリパラメータ）', () => {
  describe('正常系', () => {
    it('?from=2024-01-01&to=2024-12-31 を指定すると 200 で集計結果が返る', async () => {
      const { token, userId } = await registerUser(app, 'pf_api1', 'pf_api1@example.com');
      await makeAdmin(userId);

      const res = await request(app)
        .get('/api/admin/stats?from=2024-01-01&to=2024-12-31')
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalMessages');
    });

    it('from のみ指定した場合でも 200 で集計結果が返る', async () => {
      const { token, userId } = await registerUser(app, 'pf_api2', 'pf_api2@example.com');
      await makeAdmin(userId);

      const res = await request(app)
        .get('/api/admin/stats?from=2024-01-01')
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalMessages');
    });

    it('to のみ指定した場合でも 200 で集計結果が返る', async () => {
      const { token, userId } = await registerUser(app, 'pf_api3', 'pf_api3@example.com');
      await makeAdmin(userId);

      const res = await request(app)
        .get('/api/admin/stats?to=2025-12-31')
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalMessages');
    });

    it('?period=24h を指定すると現在時刻から 24 時間前までの集計が返る', async () => {
      const { token, userId } = await registerUser(app, 'pf_api4', 'pf_api4@example.com');
      await makeAdmin(userId);

      const res = await request(app)
        .get('/api/admin/stats?period=24h')
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalMessages');
    });

    it('?period=7d を指定すると現在時刻から 7 日前までの集計が返る', async () => {
      const { token, userId } = await registerUser(app, 'pf_api5', 'pf_api5@example.com');
      await makeAdmin(userId);

      const res = await request(app)
        .get('/api/admin/stats?period=7d')
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalMessages');
    });

    it('?period=30d を指定すると現在時刻から 30 日前までの集計が返る', async () => {
      const { token, userId } = await registerUser(app, 'pf_api6', 'pf_api6@example.com');
      await makeAdmin(userId);

      const res = await request(app)
        .get('/api/admin/stats?period=30d')
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalMessages');
    });
  });

  describe('異常系', () => {
    it('from に不正な日付文字列を渡すと 400 が返る', async () => {
      const { token, userId } = await registerUser(app, 'pf_err1', 'pf_err1@example.com');
      await makeAdmin(userId);

      const res = await request(app)
        .get('/api/admin/stats?from=not-a-date')
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(400);
    });

    it('to に不正な日付文字列を渡すと 400 が返る', async () => {
      const { token, userId } = await registerUser(app, 'pf_err2', 'pf_err2@example.com');
      await makeAdmin(userId);

      const res = await request(app)
        .get('/api/admin/stats?to=invalid')
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(400);
    });

    it('from が to より後の日時の場合は 400 が返る', async () => {
      const { token, userId } = await registerUser(app, 'pf_err3', 'pf_err3@example.com');
      await makeAdmin(userId);

      const res = await request(app)
        .get('/api/admin/stats?from=2025-12-31&to=2024-01-01')
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(400);
    });

    it('未知の period 値（例: ?period=1y）を指定すると 400 が返る', async () => {
      const { token, userId } = await registerUser(app, 'pf_err4', 'pf_err4@example.com');
      await makeAdmin(userId);

      const res = await request(app)
        .get('/api/admin/stats?period=1y')
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(400);
    });

    it('非ログインは 401 が返る', async () => {
      const res = await request(app).get('/api/admin/stats');
      expect(res.status).toBe(401);
    });

    it('一般ユーザーは 403 が返る', async () => {
      // 最初のユーザーは自動的に admin になるので、先に admin を登録してから一般ユーザーを登録する
      await registerUser(app, 'pf_first_admin', 'pf_first_admin@example.com');
      const { token } = await registerUser(app, 'pf_nonadmin', 'pf_nonadmin@example.com');
      const res = await request(app).get('/api/admin/stats').set('Cookie', `token=${token}`);
      expect(res.status).toBe(403);
    });
  });
});
