/**
 * カレンダーリマインダーワーカーのユニットテスト
 *
 * テスト対象:
 *  - jobs/calendarReminderWorker.ts の pickDueReminders / runOnce / ライフサイクル
 *
 * 戦略:
 *  - pg-mem インメモリ DB を共有（getSharedTestDatabase）
 *  - 時刻は runOnce(now) / pickDueReminders(now) に Date を渡して制御
 *  - messageService.createMessage は jest.mock してメッセージ投稿の引数と回数を検証
 *  - 既存 unit/scheduledMessageWorker.test.ts のパターンを踏襲
 *
 * 関連 Issue: #152
 */

import { getSharedTestDatabase, resetTestData } from '../__fixtures__/pgTestHelper';

const testDb = getSharedTestDatabase();
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
  afterEach(() => stopCalendarReminderWorker());

  it('startCalendarReminderWorker は setInterval ハンドルを返す', () => {
    const h = startCalendarReminderWorker();
    expect(h).toBeDefined();
  });

  it('startCalendarReminderWorker の interval は 30 秒', () => {
    expect(INTERVAL_MS).toBe(30_000);
  });

  it('NODE_ENV=test では startCalendarReminderWorker を呼ばないガードが index.ts 側に存在する', () => {
    // index.ts の文字列を読んでガードの存在を検証する（実 require/exec は副作用が大きいため）
    const src = fs.readFileSync(path.join(__dirname, '../../index.ts'), 'utf-8');
    expect(src).toMatch(/process\.env\.NODE_ENV\s*!==\s*['"]test['"]/);
    expect(src).toMatch(/startCalendarReminderWorker\(\)/);
  });

  it('stopCalendarReminderWorker で interval が停止する', () => {
    startCalendarReminderWorker();
    expect(() => stopCalendarReminderWorker()).not.toThrow();
  });
});
