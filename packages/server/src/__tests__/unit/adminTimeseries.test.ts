/**
 * テスト対象: adminService の時系列集計関数（Issue #271）
 * 戦略: pg-mem のインメモリ PostgreSQL 互換 DB を使用し、
 *   - 期間（from/to）と粒度（hour/day）に応じた時系列データの集計
 *   - 投稿数・アクティブユーザー数のバケット集計
 *   - 集計粒度の自動決定（≤24h → hour、それ以外 → day）
 * を検証する。
 *
 * 備考: Issue #341 ではチャンネル別時系列・Top N 集計・管理 API も検証する。
 */

import { createTestDatabase, resetTestData } from '../__fixtures__/pgTestHelper';

const testDb = createTestDatabase();

jest.mock('../../db/database', () => testDb);

import request from 'supertest';
import { createApp } from '../../app';
import { registerUser } from '../__fixtures__/testHelpers';
import {
  getMessageTimeseries,
  getActiveUsersTimeseries,
  getMessagesByChannelTimeseries,
  getTopChannelsByMessageCount,
  getTopUsersByMessageCount,
} from '../../services/adminService';

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

describe('adminService 時系列集計（Issue #271）', () => {
  describe('getMessageTimeseries: 投稿数の時系列集計', () => {
    describe('集計粒度の決定', () => {
      it('from/to の差が24時間以内の場合は hour 粒度で返す', async () => {
        const userId = await insertUserWithLastLogin('ts_u_h1', null);
        const chId = await insertChannel('ts-ch-h1', userId);

        const to = new Date('2024-06-15T12:00:00.000Z');
        const from = new Date('2024-06-15T00:00:00.000Z'); // 12 時間幅

        await insertMessage(chId, userId, new Date('2024-06-15T01:30:00.000Z'));
        await insertMessage(chId, userId, new Date('2024-06-15T01:45:00.000Z'));
        await insertMessage(chId, userId, new Date('2024-06-15T03:10:00.000Z'));

        const points = await getMessageTimeseries({ from, to });
        expect(points.length).toBe(13); // 0〜12 時の13バケット
        // 1時台に2件、3時台に1件
        const bucket1 = points.find((p) => p.timestamp.startsWith('2024-06-15T01'));
        const bucket3 = points.find((p) => p.timestamp.startsWith('2024-06-15T03'));
        expect(bucket1?.count).toBe(2);
        expect(bucket3?.count).toBe(1);
      });

      it('from/to の差が24時間を超える場合は day 粒度で返す', async () => {
        const userId = await insertUserWithLastLogin('ts_u_d1', null);
        const chId = await insertChannel('ts-ch-d1', userId);

        const to = new Date('2024-06-10T00:00:00.000Z');
        const from = new Date('2024-06-07T00:00:00.000Z'); // 3 日幅

        await insertMessage(chId, userId, new Date('2024-06-08T03:00:00.000Z'));
        await insertMessage(chId, userId, new Date('2024-06-08T13:00:00.000Z'));
        await insertMessage(chId, userId, new Date('2024-06-09T05:00:00.000Z'));

        const points = await getMessageTimeseries({ from, to });
        expect(points.length).toBe(4); // 6/7, 6/8, 6/9, 6/10
        const day8 = points.find((p) => p.timestamp.startsWith('2024-06-08'));
        const day9 = points.find((p) => p.timestamp.startsWith('2024-06-09'));
        expect(day8?.count).toBe(2);
        expect(day9?.count).toBe(1);
      });
    });

    describe('バケット集計の正確性', () => {
      it('指定期間内に存在しないバケットも 0 件として返す（連続した時系列を保証）', async () => {
        const userId = await insertUserWithLastLogin('ts_u_z1', null);
        const chId = await insertChannel('ts-ch-z1', userId);

        const to = new Date('2024-06-10T00:00:00.000Z');
        const from = new Date('2024-06-07T00:00:00.000Z');

        // 6/8 にだけメッセージを投入
        await insertMessage(chId, userId, new Date('2024-06-08T05:00:00.000Z'));

        const points = await getMessageTimeseries({ from, to });
        expect(points.length).toBe(4);
        const counts = points.map((p) => p.count);
        // どこかが 1、それ以外は 0
        expect(counts.filter((c) => c === 0).length).toBeGreaterThanOrEqual(3);
        expect(counts.filter((c) => c === 1).length).toBe(1);
      });

      it('論理削除済み（is_deleted=true）のメッセージは集計から除外される', async () => {
        const userId = await insertUserWithLastLogin('ts_u_del', null);
        const chId = await insertChannel('ts-ch-del', userId);

        const to = new Date('2024-06-10T00:00:00.000Z');
        const from = new Date('2024-06-09T00:00:00.000Z');

        await insertMessage(chId, userId, new Date('2024-06-09T10:00:00.000Z'));
        const delMsg = await insertMessage(chId, userId, new Date('2024-06-09T12:00:00.000Z'));
        await testDb.execute('UPDATE messages SET is_deleted = true WHERE id = $1', [delMsg]);

        const points = await getMessageTimeseries({ from, to });
        const total = points.reduce((sum, p) => sum + p.count, 0);
        expect(total).toBe(1);
      });

      it('返り値は時刻昇順でソートされ、各バケットの timestamp は ISO8601 文字列で返される', async () => {
        const userId = await insertUserWithLastLogin('ts_u_sort', null);
        const chId = await insertChannel('ts-ch-sort', userId);

        const to = new Date('2024-06-10T00:00:00.000Z');
        const from = new Date('2024-06-07T00:00:00.000Z');
        await insertMessage(chId, userId, new Date('2024-06-08T05:00:00.000Z'));

        const points = await getMessageTimeseries({ from, to });
        for (let i = 1; i < points.length; i++) {
          expect(points[i].timestamp >= points[i - 1].timestamp).toBe(true);
        }
        expect(typeof points[0].timestamp).toBe('string');
        // ISO8601 形式チェック (YYYY-MM-DDTHH:...)
        expect(points[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}/);
      });
    });

    describe('集計粒度の決定（追加）', () => {
      it('period=24h を指定した場合は1時間単位（hour）でバケット化される（次フェーズ）', async () => {
        const userId = await insertUserWithLastLogin('ts_period_24h', null);
        const chId = await insertChannel('ts-period-24h', userId);
        const to = new Date('2024-06-15T12:00:00.000Z');
        await insertMessage(chId, userId, new Date('2024-06-15T11:30:00.000Z'));

        const points = await getMessageTimeseries({ period: '24h', to });

        expect(points).toHaveLength(25);
        expect(points[0].timestamp).toBe('2024-06-14T12:00:00.000Z');
        expect(points[points.length - 1].timestamp).toBe('2024-06-15T12:00:00.000Z');
        expect(points.find((p) => p.timestamp === '2024-06-15T11:00:00.000Z')?.count).toBe(1);
      });
      it('period=7d を指定した場合は1日単位（day）でバケット化される（次フェーズ）', async () => {
        const userId = await insertUserWithLastLogin('ts_period_7d', null);
        const chId = await insertChannel('ts-period-7d', userId);
        const to = new Date('2024-06-15T12:00:00.000Z');
        await insertMessage(chId, userId, new Date('2024-06-10T03:00:00.000Z'));

        const points = await getMessageTimeseries({ period: '7d', to });

        expect(points[0].timestamp).toBe('2024-06-08T00:00:00.000Z');
        expect(points[points.length - 1].timestamp).toBe('2024-06-15T00:00:00.000Z');
        expect(points.find((p) => p.timestamp === '2024-06-10T00:00:00.000Z')?.count).toBe(1);
      });
      it('period=30d を指定した場合は1日単位（day）でバケット化される（次フェーズ）', async () => {
        const points = await getMessageTimeseries({
          period: '30d',
          to: new Date('2024-06-30T12:00:00.000Z'),
        });

        expect(points).toHaveLength(31);
        expect(points[0].timestamp).toBe('2024-05-31T00:00:00.000Z');
      });
      it('granularity を明示指定した場合は自動判定より優先される（次フェーズ）', async () => {
        const points = await getMessageTimeseries({
          from: new Date('2024-06-01T00:00:00.000Z'),
          to: new Date('2024-06-01T03:00:00.000Z'),
          granularity: 'day',
        });

        expect(points).toHaveLength(1);
        expect(points[0].timestamp).toBe('2024-06-01T00:00:00.000Z');
      });
    });

    describe('バリデーション（次フェーズ）', () => {
      it('不正な period 値（例: "1h"）を指定するとエラーになる（次フェーズ）', async () => {
        await expect(getMessageTimeseries({ period: '1h' as never })).rejects.toThrow();
      });
      it('from が不正な日付文字列だとエラーになる（次フェーズ）', async () => {
        await expect(
          getMessageTimeseries({ from: 'not-a-date', to: new Date('2024-06-01T00:00:00.000Z') }),
        ).rejects.toThrow();
      });
      it('from > to を指定するとエラーになる（次フェーズ）', async () => {
        await expect(
          getMessageTimeseries({
            from: new Date('2024-06-02T00:00:00.000Z'),
            to: new Date('2024-06-01T00:00:00.000Z'),
          }),
        ).rejects.toThrow();
      });
    });
  });

  describe('getActiveUsersTimeseries: アクティブユーザー数の時系列集計', () => {
    it('各バケット期間内に last_login_at を持つユニークユーザー数が返される', async () => {
      const to = new Date('2024-06-10T00:00:00.000Z');
      const from = new Date('2024-06-07T00:00:00.000Z');

      await insertUserWithLastLogin('au_u1', new Date('2024-06-08T05:00:00.000Z'));
      await insertUserWithLastLogin('au_u2', new Date('2024-06-08T10:00:00.000Z'));
      await insertUserWithLastLogin('au_u3', new Date('2024-06-09T05:00:00.000Z'));

      const points = await getActiveUsersTimeseries({ from, to });
      const day8 = points.find((p) => p.timestamp.startsWith('2024-06-08'));
      const day9 = points.find((p) => p.timestamp.startsWith('2024-06-09'));
      expect(day8?.count).toBe(2);
      expect(day9?.count).toBe(1);
    });

    it('期間外のログインは集計に含まれない', async () => {
      const to = new Date('2024-06-10T00:00:00.000Z');
      const from = new Date('2024-06-08T00:00:00.000Z');

      // 期間内
      await insertUserWithLastLogin('au_in', new Date('2024-06-09T05:00:00.000Z'));
      // 期間外
      await insertUserWithLastLogin('au_out', new Date('2024-06-05T05:00:00.000Z'));

      const points = await getActiveUsersTimeseries({ from, to });
      const total = points.reduce((sum, p) => sum + p.count, 0);
      expect(total).toBe(1);
    });

    it('バケットに該当ユーザーがいない場合は 0 として返す', async () => {
      const to = new Date('2024-06-10T00:00:00.000Z');
      const from = new Date('2024-06-07T00:00:00.000Z');

      // 全期間外にログインしているユーザーのみ
      await insertUserWithLastLogin('au_none', new Date('2024-06-01T05:00:00.000Z'));

      const points = await getActiveUsersTimeseries({ from, to });
      // 全バケットが 0 であること
      for (const p of points) {
        expect(p.count).toBe(0);
      }
    });

    it('不正な period 値を指定するとエラーになる（次フェーズ）', async () => {
      await expect(getActiveUsersTimeseries({ period: '1h' as never })).rejects.toThrow();
    });
  });

  describe('getMessagesByChannelTimeseries: チャンネル別投稿ボリュームの時系列集計（次フェーズ）', () => {
    it('チャンネル別に時系列バケットへ集計される（次フェーズ）', async () => {
      const userId = await insertUserWithLastLogin('ch_ts_user1', null);
      const ch1 = await insertChannel('general', userId);
      const ch2 = await insertChannel('random', userId);
      await insertMessage(ch1, userId, new Date('2024-06-10T01:00:00.000Z'));
      await insertMessage(ch1, userId, new Date('2024-06-10T02:00:00.000Z'));
      await insertMessage(ch2, userId, new Date('2024-06-11T01:00:00.000Z'));

      const result = await getMessagesByChannelTimeseries({
        from: new Date('2024-06-10T00:00:00.000Z'),
        to: new Date('2024-06-11T23:00:00.000Z'),
        granularity: 'day',
      });

      expect(result).toHaveLength(2);
      expect(result.find((c) => c.channelId === ch1)?.points[0].count).toBe(2);
      expect(result.find((c) => c.channelId === ch2)?.points[1].count).toBe(1);
    });
    it('返り値は { channelId, channelName, points: [{ timestamp, count }] } 形式である（次フェーズ）', async () => {
      const userId = await insertUserWithLastLogin('ch_ts_user2', null);
      const chId = await insertChannel('shape', userId);
      await insertMessage(chId, userId, new Date('2024-06-10T01:00:00.000Z'));

      const [channel] = await getMessagesByChannelTimeseries({
        from: new Date('2024-06-10T00:00:00.000Z'),
        to: new Date('2024-06-10T23:00:00.000Z'),
      });

      expect(channel).toMatchObject({ channelId: chId, channelName: 'shape' });
      expect(channel.points[0]).toEqual(
        expect.objectContaining({ timestamp: expect.any(String), count: expect.any(Number) }),
      );
    });
    it('論理削除済みメッセージは集計から除外される（次フェーズ）', async () => {
      const userId = await insertUserWithLastLogin('ch_ts_user3', null);
      const chId = await insertChannel('deleted', userId);
      await insertMessage(chId, userId, new Date('2024-06-10T01:00:00.000Z'));
      const deletedId = await insertMessage(chId, userId, new Date('2024-06-10T02:00:00.000Z'));
      await testDb.execute('UPDATE messages SET is_deleted = true WHERE id = $1', [deletedId]);

      const [channel] = await getMessagesByChannelTimeseries({
        from: new Date('2024-06-10T00:00:00.000Z'),
        to: new Date('2024-06-10T23:00:00.000Z'),
      });

      expect(channel.points.reduce((sum, p) => sum + p.count, 0)).toBe(1);
    });
    it('期間内に投稿が無いチャンネルは結果に含まれない（次フェーズ）', async () => {
      const userId = await insertUserWithLastLogin('ch_ts_user4', null);
      await insertChannel('empty', userId);

      const result = await getMessagesByChannelTimeseries({
        from: new Date('2024-06-10T00:00:00.000Z'),
        to: new Date('2024-06-10T23:00:00.000Z'),
      });

      expect(result).toEqual([]);
    });
  });

  describe('getTopChannelsByMessageCount: チャンネル別 Top N 投稿数（次フェーズ）', () => {
    async function seedTopChannels() {
      const userId = await insertUserWithLastLogin('top_ch_user', null);
      const chA = await insertChannel('alpha', userId);
      const chB = await insertChannel('beta', userId);
      const chC = await insertChannel('gamma', userId);
      const inRange = new Date('2024-06-10T01:00:00.000Z');
      await insertMessage(chA, userId, inRange);
      await insertMessage(chA, userId, inRange);
      await insertMessage(chB, userId, inRange);
      await insertMessage(chB, userId, inRange);
      await insertMessage(chB, userId, inRange);
      await insertMessage(chC, userId, inRange);
      return { userId, chA, chB, chC };
    }

    it('指定期間内のメッセージ数降順で上位 N 件を返す（次フェーズ）', async () => {
      await seedTopChannels();
      const result = await getTopChannelsByMessageCount({
        from: new Date('2024-06-10T00:00:00.000Z'),
        to: new Date('2024-06-10T23:00:00.000Z'),
        limit: 3,
      });

      expect(result.map((c) => c.count)).toEqual([3, 2, 1]);
      expect(result.map((c) => c.channelName)).toEqual(['beta', 'alpha', 'gamma']);
    });
    it('limit パラメータで返り値の件数を制限できる（デフォルトは 10）（次フェーズ）', async () => {
      await seedTopChannels();
      const result = await getTopChannelsByMessageCount({
        from: new Date('2024-06-10T00:00:00.000Z'),
        to: new Date('2024-06-10T23:00:00.000Z'),
        limit: 2,
      });

      expect(result).toHaveLength(2);
    });
    it('limit が指定されない場合はデフォルト値で動作する（次フェーズ）', async () => {
      await seedTopChannels();
      const result = await getTopChannelsByMessageCount({
        from: new Date('2024-06-10T00:00:00.000Z'),
        to: new Date('2024-06-10T23:00:00.000Z'),
      });

      expect(result.length).toBeLessThanOrEqual(10);
      expect(result[0].channelName).toBe('beta');
    });
    it('limit が 100 を超える場合はエラー、または 100 に丸める（次フェーズ）', async () => {
      await expect(
        getTopChannelsByMessageCount({
          from: new Date('2024-06-10T00:00:00.000Z'),
          to: new Date('2024-06-10T23:00:00.000Z'),
          limit: 101,
        }),
      ).rejects.toThrow();
    });
    it('期間外のメッセージは集計に含まれない（次フェーズ）', async () => {
      const userId = await insertUserWithLastLogin('top_ch_range', null);
      const chId = await insertChannel('range', userId);
      await insertMessage(chId, userId, new Date('2024-06-09T23:00:00.000Z'));
      await insertMessage(chId, userId, new Date('2024-06-10T01:00:00.000Z'));

      const result = await getTopChannelsByMessageCount({
        from: new Date('2024-06-10T00:00:00.000Z'),
        to: new Date('2024-06-10T23:00:00.000Z'),
      });

      expect(result[0].count).toBe(1);
    });
    it('論理削除済みメッセージは集計から除外される（次フェーズ）', async () => {
      const userId = await insertUserWithLastLogin('top_ch_deleted', null);
      const chId = await insertChannel('deleted-top', userId);
      await insertMessage(chId, userId, new Date('2024-06-10T01:00:00.000Z'));
      const deletedId = await insertMessage(chId, userId, new Date('2024-06-10T02:00:00.000Z'));
      await testDb.execute('UPDATE messages SET is_deleted = true WHERE id = $1', [deletedId]);

      const result = await getTopChannelsByMessageCount({
        from: new Date('2024-06-10T00:00:00.000Z'),
        to: new Date('2024-06-10T23:00:00.000Z'),
      });

      expect(result[0].count).toBe(1);
    });
    it('返り値は { channelId, channelName, count } 形式である（次フェーズ）', async () => {
      const { chA } = await seedTopChannels();
      const result = await getTopChannelsByMessageCount({
        from: new Date('2024-06-10T00:00:00.000Z'),
        to: new Date('2024-06-10T23:00:00.000Z'),
      });

      expect(result.find((c) => c.channelId === chA)).toEqual({
        channelId: chA,
        channelName: 'alpha',
        count: 2,
      });
    });
    it('集計対象が無い場合は空配列を返す（次フェーズ）', async () => {
      const result = await getTopChannelsByMessageCount({
        from: new Date('2024-06-10T00:00:00.000Z'),
        to: new Date('2024-06-10T23:00:00.000Z'),
      });

      expect(result).toEqual([]);
    });
  });

  describe('getTopUsersByMessageCount: ユーザー別 Top N 投稿数（次フェーズ）', () => {
    it('指定期間内のメッセージ数降順で上位 N 件を返す（次フェーズ）', async () => {
      const userA = await insertUserWithLastLogin('top_user_a', null);
      const userB = await insertUserWithLastLogin('top_user_b', null);
      const chId = await insertChannel('top-users', userA);
      await insertMessage(chId, userA, new Date('2024-06-10T01:00:00.000Z'));
      await insertMessage(chId, userB, new Date('2024-06-10T01:00:00.000Z'));
      await insertMessage(chId, userB, new Date('2024-06-10T02:00:00.000Z'));

      const result = await getTopUsersByMessageCount({
        from: new Date('2024-06-10T00:00:00.000Z'),
        to: new Date('2024-06-10T23:00:00.000Z'),
      });

      expect(result.map((u) => u.count)).toEqual([2, 1]);
      expect(result[0].username).toBe('top_user_b');
    });
    it('limit パラメータで返り値の件数を制限できる（次フェーズ）', async () => {
      const userA = await insertUserWithLastLogin('top_user_limit_a', null);
      const userB = await insertUserWithLastLogin('top_user_limit_b', null);
      const chId = await insertChannel('top-users-limit', userA);
      await insertMessage(chId, userA, new Date('2024-06-10T01:00:00.000Z'));
      await insertMessage(chId, userB, new Date('2024-06-10T02:00:00.000Z'));

      const result = await getTopUsersByMessageCount({
        from: new Date('2024-06-10T00:00:00.000Z'),
        to: new Date('2024-06-10T23:00:00.000Z'),
        limit: 1,
      });

      expect(result).toHaveLength(1);
    });
    it('論理削除済みメッセージは集計から除外される（次フェーズ）', async () => {
      const userId = await insertUserWithLastLogin('top_user_deleted', null);
      const chId = await insertChannel('top-users-deleted', userId);
      await insertMessage(chId, userId, new Date('2024-06-10T01:00:00.000Z'));
      const deletedId = await insertMessage(chId, userId, new Date('2024-06-10T02:00:00.000Z'));
      await testDb.execute('UPDATE messages SET is_deleted = true WHERE id = $1', [deletedId]);

      const result = await getTopUsersByMessageCount({
        from: new Date('2024-06-10T00:00:00.000Z'),
        to: new Date('2024-06-10T23:00:00.000Z'),
      });

      expect(result[0].count).toBe(1);
    });
    it('返り値は { userId, username, count } 形式である（次フェーズ）', async () => {
      const userId = await insertUserWithLastLogin('top_user_shape', null);
      const chId = await insertChannel('top-users-shape', userId);
      await insertMessage(chId, userId, new Date('2024-06-10T01:00:00.000Z'));

      const result = await getTopUsersByMessageCount({
        from: new Date('2024-06-10T00:00:00.000Z'),
        to: new Date('2024-06-10T23:00:00.000Z'),
      });

      expect(result[0]).toEqual({ userId, username: 'top_user_shape', count: 1 });
    });
  });
});

describe('adminController 時系列エンドポイント（Issue #271）', () => {
  describe('GET /admin/stats/timeseries（次フェーズ・別パスで実装済み）', () => {
    // 本フェーズでは GET /admin/timeseries を実装する。
    it('admin 権限ユーザーが period=7d を指定するとメッセージ・アクティブユーザーの時系列を取得できる（次フェーズ）', async () => {
      const { token, userId } = await registerUser(app, 'ts_api_admin', 'ts_api_admin@example.com');
      await makeAdmin(userId);

      const res = await request(app)
        .get('/api/admin/stats/timeseries?period=7d')
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.messages)).toBe(true);
      expect(Array.isArray(res.body.activeUsers)).toBe(true);
      expect(Array.isArray(res.body.messagesByChannel)).toBe(true);
    });
    it('一般ユーザーがアクセスすると 403 を返す（次フェーズ）', async () => {
      await registerUser(app, 'ts_api_owner', 'ts_api_owner@example.com');
      const { token } = await registerUser(app, 'ts_api_user', 'ts_api_user@example.com');

      const res = await request(app)
        .get('/api/admin/stats/timeseries?period=7d')
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(403);
    });
    it('未認証アクセスは 401 を返す（次フェーズ）', async () => {
      const res = await request(app).get('/api/admin/stats/timeseries?period=7d');
      expect(res.status).toBe(401);
    });
    it('不正な period パラメータは 400 を返す（次フェーズ）', async () => {
      const { token, userId } = await registerUser(app, 'ts_api_bad', 'ts_api_bad@example.com');
      await makeAdmin(userId);

      const res = await request(app)
        .get('/api/admin/stats/timeseries?period=1h')
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(400);
    });
    it('from/to の併用が許可される（または明確に拒否される）（次フェーズ）', async () => {
      const { token, userId } = await registerUser(app, 'ts_api_range', 'ts_api_range@example.com');
      await makeAdmin(userId);

      const res = await request(app)
        .get('/api/admin/stats/timeseries?from=2024-06-01T00:00:00.000Z&to=2024-06-02T00:00:00.000Z')
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      expect(res.body.messages[0]).toHaveProperty('timestamp');
    });
  });

  describe('GET /admin/stats/top-channels（次フェーズ）', () => {
    it('admin 権限ユーザーが期間とリミットを指定すると Top N チャンネルが取得できる（次フェーズ）', async () => {
      const { token, userId } = await registerUser(
        app,
        'top_api_admin',
        'top_api_admin@example.com',
      );
      await makeAdmin(userId);
      const chId = await insertChannel('top-api', userId);
      await insertMessage(chId, userId, new Date('2024-06-10T01:00:00.000Z'));

      const res = await request(app)
        .get('/api/admin/stats/top-channels?from=2024-06-10T00:00:00.000Z&to=2024-06-10T23:00:00.000Z&limit=1')
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      expect(res.body.channels).toEqual([{ channelId: chId, channelName: 'top-api', count: 1 }]);
    });
    it('limit のデフォルト値で動作する（次フェーズ）', async () => {
      const { token, userId } = await registerUser(
        app,
        'top_api_default',
        'top_api_default@example.com',
      );
      await makeAdmin(userId);

      const res = await request(app)
        .get('/api/admin/stats/top-channels?period=7d')
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.channels)).toBe(true);
    });
    it('一般ユーザーがアクセスすると 403 を返す（次フェーズ）', async () => {
      await registerUser(app, 'top_api_owner', 'top_api_owner@example.com');
      const { token } = await registerUser(app, 'top_api_user', 'top_api_user@example.com');

      const res = await request(app)
        .get('/api/admin/stats/top-channels?period=7d')
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(403);
    });
    it('limit が範囲外の場合は 400 を返す（次フェーズ）', async () => {
      const { token, userId } = await registerUser(
        app,
        'top_api_limit',
        'top_api_limit@example.com',
      );
      await makeAdmin(userId);

      const res = await request(app)
        .get('/api/admin/stats/top-channels?period=7d&limit=101')
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(400);
    });
  });
});
