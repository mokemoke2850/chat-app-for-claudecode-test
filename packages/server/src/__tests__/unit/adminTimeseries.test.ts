/**
 * テスト対象: adminService の時系列集計関数（Issue #271）
 * 戦略: pg-mem のインメモリ PostgreSQL 互換 DB を使用し、
 *   - 期間（from/to）と粒度（hour/day）に応じた時系列データの集計
 *   - 投稿数・アクティブユーザー数のバケット集計
 *   - 集計粒度の自動決定（≤24h → hour、それ以外 → day）
 * を検証する。
 *
 * 備考: 本フェーズは最小スコープ実装。チャンネル別 Top N 等は次フェーズで対応する（it.todo 残し）。
 */

import { createTestDatabase, resetTestData } from '../__fixtures__/pgTestHelper';

const testDb = createTestDatabase();

jest.mock('../../db/database', () => testDb);

import { getMessageTimeseries, getActiveUsersTimeseries } from '../../services/adminService';

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
      it.todo('period=24h を指定した場合は1時間単位（hour）でバケット化される（次フェーズ）');
      it.todo('period=7d を指定した場合は1日単位（day）でバケット化される（次フェーズ）');
      it.todo('period=30d を指定した場合は1日単位（day）でバケット化される（次フェーズ）');
      it.todo('granularity を明示指定した場合は自動判定より優先される（次フェーズ）');
    });

    describe('バリデーション（次フェーズ）', () => {
      it.todo('不正な period 値（例: "1h"）を指定するとエラーになる（次フェーズ）');
      it.todo('from が不正な日付文字列だとエラーになる（次フェーズ）');
      it.todo('from > to を指定するとエラーになる（次フェーズ）');
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

    it.todo('不正な period 値を指定するとエラーになる（次フェーズ）');
  });

  describe('getMessagesByChannelTimeseries: チャンネル別投稿ボリュームの時系列集計（次フェーズ）', () => {
    it.todo('チャンネル別に時系列バケットへ集計される（次フェーズ）');
    it.todo(
      '返り値は { channelId, channelName, points: [{ timestamp, count }] } 形式である（次フェーズ）',
    );
    it.todo('論理削除済みメッセージは集計から除外される（次フェーズ）');
    it.todo('期間内に投稿が無いチャンネルは結果に含まれない（次フェーズ）');
  });

  describe('getTopChannelsByMessageCount: チャンネル別 Top N 投稿数（次フェーズ）', () => {
    it.todo('指定期間内のメッセージ数降順で上位 N 件を返す（次フェーズ）');
    it.todo('limit パラメータで返り値の件数を制限できる（デフォルトは 10）（次フェーズ）');
    it.todo('limit が指定されない場合はデフォルト値で動作する（次フェーズ）');
    it.todo('limit が 100 を超える場合はエラー、または 100 に丸める（次フェーズ）');
    it.todo('期間外のメッセージは集計に含まれない（次フェーズ）');
    it.todo('論理削除済みメッセージは集計から除外される（次フェーズ）');
    it.todo('返り値は { channelId, channelName, count } 形式である（次フェーズ）');
    it.todo('集計対象が無い場合は空配列を返す（次フェーズ）');
  });

  describe('getTopUsersByMessageCount: ユーザー別 Top N 投稿数（次フェーズ）', () => {
    it.todo('指定期間内のメッセージ数降順で上位 N 件を返す（次フェーズ）');
    it.todo('limit パラメータで返り値の件数を制限できる（次フェーズ）');
    it.todo('論理削除済みメッセージは集計から除外される（次フェーズ）');
    it.todo('返り値は { userId, username, count } 形式である（次フェーズ）');
  });
});

describe('adminController 時系列エンドポイント（Issue #271）', () => {
  describe('GET /admin/stats/timeseries（次フェーズ・別パスで実装済み）', () => {
    // 本フェーズでは GET /admin/timeseries を実装する。
    it.todo(
      'admin 権限ユーザーが period=7d を指定するとメッセージ・アクティブユーザーの時系列を取得できる（次フェーズ）',
    );
    it.todo('一般ユーザーがアクセスすると 403 を返す（次フェーズ）');
    it.todo('未認証アクセスは 401 を返す（次フェーズ）');
    it.todo('不正な period パラメータは 400 を返す（次フェーズ）');
    it.todo('from/to の併用が許可される（または明確に拒否される）（次フェーズ）');
  });

  describe('GET /admin/stats/top-channels（次フェーズ）', () => {
    it.todo(
      'admin 権限ユーザーが期間とリミットを指定すると Top N チャンネルが取得できる（次フェーズ）',
    );
    it.todo('limit のデフォルト値で動作する（次フェーズ）');
    it.todo('一般ユーザーがアクセスすると 403 を返す（次フェーズ）');
    it.todo('limit が範囲外の場合は 400 を返す（次フェーズ）');
  });
});
