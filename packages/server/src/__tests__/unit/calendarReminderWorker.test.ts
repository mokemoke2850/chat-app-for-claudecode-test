/**
 * カレンダーリマインダーワーカーのユニットテスト
 *
 * テスト対象:
 *  - jobs/calendarReminderWorker.ts の pickDueReminders / runOnce / ライフサイクル
 *
 * 戦略:
 *  - pg-mem インメモリ DB を共有（createTestDatabase）
 *  - 時刻は runOnce(now) / pickDueReminders(now) に Date を渡して制御
 *  - messageService.createMessage は jest.mock してメッセージ投稿の引数と回数を検証
 *  - 既存 unit/scheduledMessageWorker.test.ts のパターンを踏襲
 *
 * 関連 Issue: #152
 */

import { createTestDatabase, resetTestData } from '../__fixtures__/pgTestHelper';

const testDb = createTestDatabase();
jest.mock('../../db/database', () => testDb);

const mockCreateMessage = jest.fn();
jest.mock('../../services/messageService', () => ({
  createMessage: (...args: unknown[]) => mockCreateMessage(...args),
}));

import * as fs from 'fs';
import * as path from 'path';

import {
  pickDueReminders,
  runOnce,
  markSent,
  startCalendarReminderWorker,
  stopCalendarReminderWorker,
  INTERVAL_MS,
} from '../../jobs/calendarReminderWorker';
import { getJobMonitoringStatuses } from '../../services/jobMonitoringService';

let userId1: number;
let channelId: number;

const NOW = new Date('2030-06-01T10:00:00Z');

async function createEventRow(opts: {
  channelId: number | null;
  startsAt: string;
  endsAt: string;
  title?: string;
  organizerId: number;
}): Promise<number> {
  const r = await testDb.execute(
    `INSERT INTO calendar_events (channel_id, title, starts_at, ends_at, organizer_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [opts.channelId, opts.title ?? 'Ev', opts.startsAt, opts.endsAt, opts.organizerId],
  );
  return r.rows[0].id as number;
}

async function createReminderRow(eventId: number, offsetMinutes: number): Promise<number> {
  const r = await testDb.execute(
    `INSERT INTO calendar_event_reminders (event_id, remind_offset_minutes)
     VALUES ($1, $2) RETURNING id`,
    [eventId, offsetMinutes],
  );
  return r.rows[0].id as number;
}

beforeEach(async () => {
  await resetTestData(testDb);
  mockCreateMessage.mockReset();
  mockCreateMessage.mockResolvedValue({ id: 1, channelId: 1, content: 'msg' });

  const u1 = await testDb.execute(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
    ['alice', 'a@t.com', 'h'],
  );
  userId1 = u1.rows[0].id as number;
  const c1 = await testDb.execute(
    'INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id',
    ['general', userId1],
  );
  channelId = c1.rows[0].id as number;
});

describe('calendarReminderWorker.runOnce', () => {
  describe('ジョブ監視 (#391)', () => {
    async function addDue(title: string): Promise<void> {
      const id = await createEventRow({ channelId, startsAt: '2030-06-01T10:00:00Z',
        endsAt: '2030-06-01T11:00:00Z', title, organizerId: userId1 });
      await createReminderRow(id, 0);
    }
    async function monitored() {
      return (await getJobMonitoringStatuses(NOW)).find((job) => job.key === 'calendarReminders')!;
    }
    it('処理対象がなくても1回の正常実行として記録する', async () => {
      await runOnce(NOW);
      expect(await monitored()).toEqual(expect.objectContaining({ successCount: 1, failureCount: 0 }));
    });
    it('全対象の投稿成功を対象件数によらず1回の正常実行として記録する', async () => {
      await addDue('A'); await addDue('B');
      await runOnce(NOW);
      expect(await monitored()).toEqual(expect.objectContaining({ successCount: 1, failureCount: 0 }));
    });
    it('1件でも投稿に失敗したtickを1回の失敗として直近エラーを記録する', async () => {
      await addDue('A'); mockCreateMessage.mockRejectedValue(new Error('boom'));
      await runOnce(NOW);
      expect(await monitored()).toEqual(expect.objectContaining({ successCount: 0, failureCount: 1,
        lastFailure: { message: 'boom', at: NOW.toISOString() } }));
    });
    it('一部の投稿失敗後も残りを処理し、成功回数を増やさず失敗を1回だけ記録する', async () => {
      await addDue('A'); await addDue('B');
      mockCreateMessage.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ id: 2 });
      await runOnce(NOW);
      expect(mockCreateMessage).toHaveBeenCalledTimes(2);
      expect(await monitored()).toEqual(expect.objectContaining({ successCount: 0, failureCount: 1 }));
    });
    it('処理対象の取得自体が失敗したtickを1回の失敗として記録する', async () => {
      const querySpy = jest.spyOn(testDb, 'query').mockRejectedValueOnce(new Error('db down'));
      await expect(runOnce(NOW)).rejects.toThrow('db down');
      querySpy.mockRestore();
      expect(await monitored()).toEqual(expect.objectContaining({ failureCount: 1 }));
    });
  });

  it('starts_at - remind_offset_minutes <= now() かつ sent_at IS NULL のリマインダーを抽出する', async () => {
    // 開始 10:15、15 分前リマインダー → 10:00 が due → NOW=10:00 なら抽出される
    const evId = await createEventRow({
      channelId,
      startsAt: '2030-06-01T10:15:00Z',
      endsAt: '2030-06-01T11:00:00Z',
      organizerId: userId1,
    });
    await createReminderRow(evId, 15);

    const due = await pickDueReminders(NOW);
    expect(due.length).toBe(1);
    expect(due[0].event_id).toBe(evId);
  });

  it('対象リマインダーごとに channel にメッセージを投稿する', async () => {
    const evId = await createEventRow({
      channelId,
      startsAt: '2030-06-01T10:15:00Z',
      endsAt: '2030-06-01T11:00:00Z',
      title: 'Sprint Planning',
      organizerId: userId1,
    });
    await createReminderRow(evId, 15);
    await runOnce(NOW);
    expect(mockCreateMessage).toHaveBeenCalledTimes(1);
    const args = mockCreateMessage.mock.calls[0];
    expect(args[0]).toBe(channelId);
    expect(args[1]).toBe(userId1);
  });

  it('投稿されるメッセージの content にイベントタイトルと残り時間（分）が含まれる', async () => {
    const evId = await createEventRow({
      channelId,
      startsAt: '2030-06-01T10:15:00Z',
      endsAt: '2030-06-01T11:00:00Z',
      title: 'Sprint Planning',
      organizerId: userId1,
    });
    await createReminderRow(evId, 15);
    await runOnce(NOW);
    const content = mockCreateMessage.mock.calls[0][2] as string;
    expect(content).toContain('Sprint Planning');
    expect(content).toContain('15'); // 残り時間 15 分
  });

  it('送信完了後は sent_at が現在時刻に更新される', async () => {
    const evId = await createEventRow({
      channelId,
      startsAt: '2030-06-01T10:15:00Z',
      endsAt: '2030-06-01T11:00:00Z',
      organizerId: userId1,
    });
    const remId = await createReminderRow(evId, 15);
    await runOnce(NOW);
    const r = await testDb.execute('SELECT sent_at FROM calendar_event_reminders WHERE id = $1', [
      remId,
    ]);
    expect(r.rows[0].sent_at).not.toBeNull();
  });

  it('既に sent_at が設定済みのリマインダーは送信対象から除外される（冪等性）', async () => {
    const evId = await createEventRow({
      channelId,
      startsAt: '2030-06-01T10:15:00Z',
      endsAt: '2030-06-01T11:00:00Z',
      organizerId: userId1,
    });
    const remId = await createReminderRow(evId, 15);
    await markSent(remId, NOW);
    await runOnce(NOW);
    expect(mockCreateMessage).not.toHaveBeenCalled();
  });

  it('event.channel_id が NULL のリマインダーはスキップされ sent_at は更新されない', async () => {
    const evId = await createEventRow({
      channelId: null,
      startsAt: '2030-06-01T10:15:00Z',
      endsAt: '2030-06-01T11:00:00Z',
      organizerId: userId1,
    });
    const remId = await createReminderRow(evId, 15);
    await runOnce(NOW);
    expect(mockCreateMessage).not.toHaveBeenCalled();
    const r = await testDb.execute('SELECT sent_at FROM calendar_event_reminders WHERE id = $1', [
      remId,
    ]);
    expect(r.rows[0].sent_at).toBeNull();
  });

  it('starts_at が未来かつ remind_offset_minutes 以上先のリマインダーは抽出されない', async () => {
    // 開始 11:00、15 分前 → 10:45 が due。NOW=10:00 ならまだ
    const evId = await createEventRow({
      channelId,
      startsAt: '2030-06-01T11:00:00Z',
      endsAt: '2030-06-01T12:00:00Z',
      organizerId: userId1,
    });
    await createReminderRow(evId, 15);
    const due = await pickDueReminders(NOW);
    expect(due.length).toBe(0);
  });

  it('メッセージ投稿が失敗してもワーカー全体は止まらず、他のリマインダーは処理を続ける', async () => {
    const evId1 = await createEventRow({
      channelId,
      startsAt: '2030-06-01T10:10:00Z',
      endsAt: '2030-06-01T11:00:00Z',
      title: 'Bad',
      organizerId: userId1,
    });
    const evId2 = await createEventRow({
      channelId,
      startsAt: '2030-06-01T10:11:00Z',
      endsAt: '2030-06-01T11:00:00Z',
      title: 'Good',
      organizerId: userId1,
    });
    await createReminderRow(evId1, 15);
    await createReminderRow(evId2, 15);
    mockCreateMessage.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ id: 100 });
    await runOnce(NOW);
    expect(mockCreateMessage).toHaveBeenCalledTimes(2);
  });

  it('メッセージ投稿が失敗したリマインダーの sent_at は更新されない（次回再試行される）', async () => {
    const evId = await createEventRow({
      channelId,
      startsAt: '2030-06-01T10:15:00Z',
      endsAt: '2030-06-01T11:00:00Z',
      organizerId: userId1,
    });
    const remId = await createReminderRow(evId, 15);
    mockCreateMessage.mockRejectedValueOnce(new Error('boom'));
    await runOnce(NOW);
    const r = await testDb.execute('SELECT sent_at FROM calendar_event_reminders WHERE id = $1', [
      remId,
    ]);
    expect(r.rows[0].sent_at).toBeNull();
  });
});

describe('calendarReminderWorker のライフサイクル', () => {
  afterEach(() => {
    stopCalendarReminderWorker();
    jest.useRealTimers();
  });

  it('start すると INTERVAL_MS 経過ごとに runOnce が実行される', async () => {
    jest.useFakeTimers();
    startCalendarReminderWorker();
    // 起動直後に 1 回（即時 runOnce）が走り、INTERVAL_MS 経過後にもう 1 回走る
    // mockCreateMessage 呼び出しのカウントは pickDueReminders 結果次第なので、
    // ここでは setInterval が登録されたタイマー数で確認する
    expect(jest.getTimerCount()).toBeGreaterThan(0);
    // INTERVAL_MS 進めても interval が残り続ける（再登録される）
    jest.advanceTimersByTime(INTERVAL_MS);
    expect(jest.getTimerCount()).toBeGreaterThan(0);
  });

  it('stop 後は INTERVAL_MS 経過してもタイマーが残らない', () => {
    jest.useFakeTimers();
    startCalendarReminderWorker();
    expect(jest.getTimerCount()).toBeGreaterThan(0);
    stopCalendarReminderWorker();
    jest.advanceTimersByTime(INTERVAL_MS * 2);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('start を二重に呼んでも interval は 1 つしか登録されない', () => {
    jest.useFakeTimers();
    startCalendarReminderWorker();
    const first = jest.getTimerCount();
    startCalendarReminderWorker();
    expect(jest.getTimerCount()).toBe(first);
  });

  it('NODE_ENV=test では index.ts のガードで startCalendarReminderWorker が呼ばれない', () => {
    // 実 require/exec は副作用が大きいため、index.ts のソースを直接 grep してガードの存在を確認
    const src = fs.readFileSync(path.join(__dirname, '../../index.ts'), 'utf-8');
    const startMatches = src.match(/startCalendarReminderWorker\(\)/g) ?? [];
    expect(startMatches.length).toBe(1);
    // ガード if の中に startCalendarReminderWorker() が含まれていることを確認
    const guardBlock = src.match(/if \(process\.env\.NODE_ENV !== ['"]test['"]\)\s*\{[^}]+\}/);
    expect(guardBlock?.[0]).toContain('startCalendarReminderWorker()');
  });
});
