// Issue #302 — イベントの繰り返し設定（バックエンド）
// 実装方針: マスター + 子レコード方式（calendar_events 内に recurrence_master_id で自己参照）
// テスト対象: services/calendarService.ts の create/update/delete スコープ別ロジック + expandRecurrence

import { createTestDatabase, resetTestData } from './__fixtures__/pgTestHelper';

const testDb = createTestDatabase();

jest.mock('../db/database', () => testDb);

 
import * as calendarService from '../services/calendarService';

let userId1: number;
let userId2: number;
let channelId: number;

const FUTURE_START = '2030-01-06T09:00:00.000Z'; // 日曜
const FUTURE_END = '2030-01-06T10:00:00.000Z';

async function setupFixtures(): Promise<void> {
  const u1 = await testDb.execute(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
    ['alice', 'a@t.com', 'h'],
  );
  userId1 = u1.rows[0].id as number;
  const u2 = await testDb.execute(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
    ['bob', 'b@t.com', 'h'],
  );
  userId2 = u2.rows[0].id as number;
  const c1 = await testDb.execute(
    'INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id',
    ['general', userId1],
  );
  channelId = c1.rows[0].id as number;
}

beforeEach(async () => {
  await resetTestData(testDb);
  await setupFixtures();
});

describe('イベントの繰り返し設定（サーバー）', () => {
  describe('expandRecurrence: 繰り返し展開ロジック', () => {
    it('DAILY count=3 で 3 件のインスタンスを返す（マスター含む）', () => {
      const result = calendarService.expandRecurrence('DAILY', FUTURE_START, FUTURE_END, {
        interval: 1,
        count: 3,
      });
      expect(result).toHaveLength(3);
      expect(result[0].startsAt).toBe(FUTURE_START);
    });

    it('DAILY interval=2 で 1日おきになる', () => {
      const result = calendarService.expandRecurrence('DAILY', FUTURE_START, FUTURE_END, {
        interval: 2,
        count: 3,
      });
      expect(result).toHaveLength(3);
      const d0 = new Date(result[0].startsAt);
      const d1 = new Date(result[1].startsAt);
      expect((d1.getTime() - d0.getTime()) / (1000 * 60 * 60 * 24)).toBe(2);
    });

    it('WEEKLY daysOfWeek=[1,3,5] で月水金の日付のみ返す', () => {
      // 開始: 2030-01-06 (日)
      const result = calendarService.expandRecurrence('WEEKLY', FUTURE_START, FUTURE_END, {
        interval: 1,
        daysOfWeek: [1, 3, 5],
        count: 6,
      });
      expect(result).toHaveLength(6);
      const days = result.map((r) => new Date(r.startsAt).getDay());
      // 月水金以外が含まれていないこと
      for (const d of days) expect([1, 3, 5]).toContain(d);
    });

    it('endDate を超えると展開を打ち切る', () => {
      const result = calendarService.expandRecurrence('DAILY', FUTURE_START, FUTURE_END, {
        interval: 1,
        endDate: '2030-01-08T23:59:59.000Z',
      });
      // 1/6, 1/7, 1/8 の 3 件
      expect(result.length).toBe(3);
    });

    it('MONTHLY で各月の同日インスタンスを返す（31日が無い月はスキップ）', () => {
      // 1/31 開始の MONTHLY: 2/31 は無いのでスキップ → 3/31 へ
      const result = calendarService.expandRecurrence(
        'MONTHLY',
        '2030-01-31T09:00:00.000Z',
        '2030-01-31T10:00:00.000Z',
        { interval: 1, count: 3 },
      );
      const months = result.map((r) => new Date(r.startsAt).getUTCMonth());
      // 1月(0), 3月(2), 5月(4) などの「31日がある月」のみ
      expect(months).not.toContain(1); // 2月は含まれない
    });

    it('YEARLY で 1 年ごとのインスタンスを返す', () => {
      const result = calendarService.expandRecurrence('YEARLY', FUTURE_START, FUTURE_END, {
        interval: 1,
        count: 3,
      });
      expect(result).toHaveLength(3);
      expect(new Date(result[0].startsAt).getUTCFullYear()).toBe(2030);
      expect(new Date(result[1].startsAt).getUTCFullYear()).toBe(2031);
    });
  });

  describe('createEvent: 繰り返しイベントの作成', () => {
    it('recurrence なしで作成すると単発イベントになり子レコードが生成されない', async () => {
      const event = await calendarService.createEvent(userId1, {
        channelId,
        title: 'Single',
        startsAt: FUTURE_START,
        endsAt: FUTURE_END,
      });
      expect(event.recurrenceRule).toBeNull();
      const all = await testDb.query<{ id: number }>('SELECT id FROM calendar_events');
      expect(all.length).toBe(1);
    });

    it('recurrence: { rule: "DAILY", count: 5 } で作成するとマスター + 子4件 = 5件 INSERT される', async () => {
      const event = await calendarService.createEvent(userId1, {
        channelId,
        title: 'Daily Standup',
        startsAt: FUTURE_START,
        endsAt: FUTURE_END,
        recurrence: { rule: 'DAILY', count: 5 },
      });
      expect(event.recurrenceRule).toBe('DAILY');
      expect(event.recurrenceCount).toBe(5);
      const all = await testDb.query<{ id: number; recurrence_master_id: number | null }>(
        'SELECT id, recurrence_master_id FROM calendar_events ORDER BY starts_at ASC',
      );
      expect(all.length).toBe(5);
      // 1件目はマスター
      expect(all[0].id).toBe(event.id);
      expect(all[0].recurrence_master_id).toBeNull();
      // 2件目以降は子（recurrence_master_id = master.id）
      for (let i = 1; i < 5; i++) {
        expect(all[i].recurrence_master_id).toBe(event.id);
      }
    });

    it('WEEKLY daysOfWeek=[1,3,5] count=6 で月水金の 6 件が生成される', async () => {
      const event = await calendarService.createEvent(userId1, {
        channelId,
        title: 'MWF',
        startsAt: FUTURE_START,
        endsAt: FUTURE_END,
        recurrence: { rule: 'WEEKLY', daysOfWeek: [1, 3, 5], count: 6 },
      });
      expect(event.recurrenceDaysOfWeek).toEqual([1, 3, 5]);
      const rows = await testDb.query<{ starts_at: string }>(
        'SELECT starts_at FROM calendar_events WHERE id = $1 OR recurrence_master_id = $1 ORDER BY starts_at ASC',
        [event.id],
      );
      // 全件月水金のみ
      for (const r of rows) {
        const day = new Date(r.starts_at).getUTCDay();
        expect([1, 3, 5]).toContain(day);
      }
    });

    it('count に 0 以下を指定した場合は 400 を返す', async () => {
      await expect(
        calendarService.createEvent(userId1, {
          channelId,
          title: 'X',
          startsAt: FUTURE_START,
          endsAt: FUTURE_END,
          recurrence: { rule: 'DAILY', count: 0 },
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('rule に不正な値を指定した場合は 400 を返す', async () => {
      await expect(
        calendarService.createEvent(userId1, {
          channelId,
          title: 'X',
          startsAt: FUTURE_START,
          endsAt: FUTURE_END,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          recurrence: { rule: 'INVALID' as any },
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('endDate と count を同時指定すると 400', async () => {
      await expect(
        calendarService.createEvent(userId1, {
          channelId,
          title: 'X',
          startsAt: FUTURE_START,
          endsAt: FUTURE_END,
          recurrence: { rule: 'DAILY', endDate: '2030-02-01T00:00:00Z', count: 5 },
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('展開上限は 365 件で打ち切られる', async () => {
      const event = await calendarService.createEvent(userId1, {
        channelId,
        title: 'Heavy',
        startsAt: FUTURE_START,
        endsAt: FUTURE_END,
        recurrence: { rule: 'DAILY' }, // count なし → 365 件で打ち切り
      });
      const all = await testDb.query<{ id: number }>(
        'SELECT id FROM calendar_events WHERE id = $1 OR recurrence_master_id = $1',
        [event.id],
      );
      expect(all.length).toBe(calendarService.RECURRENCE_MAX_INSTANCES);
    });
  });

  describe('updateEvent: 編集スコープ', () => {
    async function createWeekly(): Promise<{ masterId: number; childIds: number[] }> {
      const master = await calendarService.createEvent(userId1, {
        channelId,
        title: 'Weekly',
        startsAt: FUTURE_START,
        endsAt: FUTURE_END,
        recurrence: { rule: 'DAILY', count: 5 },
      });
      const all = await testDb.query<{ id: number }>(
        'SELECT id FROM calendar_events WHERE id = $1 OR recurrence_master_id = $1 ORDER BY starts_at ASC',
        [master.id],
      );
      return {
        masterId: master.id,
        childIds: all.slice(1).map((r) => r.id),
      };
    }

    it('scope="one" で対象レコードだけタイトルが更新される', async () => {
      const { masterId, childIds } = await createWeekly();
      await calendarService.updateEvent(userId1, childIds[0], {
        title: 'Override only',
        scope: 'one',
      });
      const target = await testDb.query<{ title: string }>(
        'SELECT title FROM calendar_events WHERE id = $1',
        [childIds[0]],
      );
      const master = await testDb.query<{ title: string }>(
        'SELECT title FROM calendar_events WHERE id = $1',
        [masterId],
      );
      expect(target[0].title).toBe('Override only');
      expect(master[0].title).toBe('Weekly');
    });

    it('scope="all" でマスターと全子イベントのタイトルが一括更新される', async () => {
      const { masterId } = await createWeekly();
      await calendarService.updateEvent(userId1, masterId, {
        title: 'New Title',
        scope: 'all',
      });
      const all = await testDb.query<{ title: string }>(
        'SELECT title FROM calendar_events WHERE id = $1 OR recurrence_master_id = $1',
        [masterId],
      );
      for (const r of all) expect(r.title).toBe('New Title');
    });

    it('scope="following" で当該以降のレコードのみ更新され、それより前のレコードは元のまま', async () => {
      const { masterId, childIds } = await createWeekly();
      // 3件目以降を更新
      const targetId = childIds[1]; // 3 番目 (0=master, 1=child0, 2=child1)
      await calendarService.updateEvent(userId1, targetId, {
        title: 'After',
        scope: 'following',
      });
      const all = await testDb.query<{ id: number; title: string; starts_at: string }>(
        'SELECT id, title, starts_at FROM calendar_events WHERE id = $1 OR recurrence_master_id = $1 ORDER BY starts_at ASC',
        [masterId],
      );
      // ターゲットの開始時刻
      const targetRow = all.find((r) => r.id === targetId);
      const targetTs = new Date(targetRow!.starts_at).getTime();
      for (const r of all) {
        const ts = new Date(r.starts_at).getTime();
        if (ts >= targetTs) expect(r.title).toBe('After');
        else expect(r.title).toBe('Weekly');
      }
    });

    it('組織者でないユーザーが編集すると 403 を返す', async () => {
      const { masterId } = await createWeekly();
      await expect(
        calendarService.updateEvent(userId2, masterId, { title: 'X', scope: 'all' }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('scope が不正な値の場合は 400', async () => {
      const { masterId } = await createWeekly();
      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        calendarService.updateEvent(userId1, masterId, { title: 'X', scope: 'bogus' as any }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe('deleteEvent: 削除スコープ', () => {
    async function createDaily(): Promise<{ masterId: number; childIds: number[] }> {
      const master = await calendarService.createEvent(userId1, {
        channelId,
        title: 'Daily',
        startsAt: FUTURE_START,
        endsAt: FUTURE_END,
        recurrence: { rule: 'DAILY', count: 5 },
      });
      const all = await testDb.query<{ id: number }>(
        'SELECT id FROM calendar_events WHERE id = $1 OR recurrence_master_id = $1 ORDER BY starts_at ASC',
        [master.id],
      );
      return { masterId: master.id, childIds: all.slice(1).map((r) => r.id) };
    }

    it('scope="one" でその回のレコードだけ削除される', async () => {
      const { masterId, childIds } = await createDaily();
      await calendarService.deleteEvent(userId1, childIds[0], { scope: 'one' });
      const all = await testDb.query<{ id: number }>(
        'SELECT id FROM calendar_events WHERE id = $1 OR recurrence_master_id = $1',
        [masterId],
      );
      expect(all.length).toBe(4);
    });

    it('scope="all" で繰り返しイベント全体が削除される', async () => {
      const { masterId } = await createDaily();
      await calendarService.deleteEvent(userId1, masterId, { scope: 'all' });
      const all = await testDb.query<{ id: number }>(
        'SELECT id FROM calendar_events WHERE id = $1 OR recurrence_master_id = $1',
        [masterId],
      );
      expect(all.length).toBe(0);
    });

    it('scope="following" で対象以降が削除される', async () => {
      const { masterId, childIds } = await createDaily();
      await calendarService.deleteEvent(userId1, childIds[1], { scope: 'following' });
      const all = await testDb.query<{ id: number }>(
        'SELECT id FROM calendar_events WHERE id = $1 OR recurrence_master_id = $1 ORDER BY starts_at ASC',
        [masterId],
      );
      // master + childIds[0] の 2 件のみ残る
      expect(all.length).toBe(2);
    });

    it('組織者でないユーザーが削除すると 403 を返す', async () => {
      const { masterId } = await createDaily();
      await expect(
        calendarService.deleteEvent(userId2, masterId, { scope: 'all' }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });
});
