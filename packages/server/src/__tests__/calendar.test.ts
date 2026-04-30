/**
 * カレンダー機能のサービス層テスト（中間粒度）
 *
 * テスト対象:
 *  - services/calendarService.ts のイベント CRUD / RSVP / 日程調整 (Poll) / リマインダー登録ロジック
 *
 * 戦略:
 *  - pg-mem のインメモリ PostgreSQL を使った中間粒度テスト（既存 event.test.ts の流儀踏襲）
 *  - HTTP 層の検証は calendar-route.test.ts に分離
 *  - リマインダー送信ジョブの動作検証は unit/calendarReminderWorker.test.ts に分離
 *
 * 関連 Issue: #152
 */

import { getSharedTestDatabase, resetTestData } from './__fixtures__/pgTestHelper';

const testDb = getSharedTestDatabase();

jest.mock('../db/database', () => testDb);

import * as calendarService from '../services/calendarService';

let userId1: number;
let userId2: number;
let userId3: number;
let channelId: number;
let channelId2: number;

const FUTURE_START = '2030-01-01T10:00:00Z';
const FUTURE_END = '2030-01-01T11:00:00Z';
const FUTURE_START_2 = '2030-01-02T15:00:00Z';
const FUTURE_END_2 = '2030-01-02T16:00:00Z';
const FUTURE_START_3 = '2030-01-03T09:00:00Z';
const FUTURE_END_3 = '2030-01-03T10:00:00Z';

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
  const u3 = await testDb.execute(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
    ['carol', 'c@t.com', 'h'],
  );
  userId3 = u3.rows[0].id as number;

  const c1 = await testDb.execute(
    'INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id',
    ['general', userId1],
  );
  channelId = c1.rows[0].id as number;
  const c2 = await testDb.execute(
    'INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id',
    ['design', userId1],
  );
  channelId2 = c2.rows[0].id as number;
}

beforeEach(async () => {
  await resetTestData(testDb);
  await setupFixtures();
});

describe('calendarService', () => {
  describe('createEvent', () => {
    it('title/channelId/startsAt/endsAt/organizerId を渡すとイベントが作成され、id と空の attendees が返る', async () => {
      const event = await calendarService.createEvent(userId1, {
        channelId,
        title: 'Sprint Planning',
        startsAt: FUTURE_START,
        endsAt: FUTURE_END,
      });
      expect(event.id).toBeDefined();
      expect(event.title).toBe('Sprint Planning');
      expect(event.channelId).toBe(channelId);
      expect(event.organizerId).toBe(userId1);
      expect(event.attendees).toEqual([]);
      expect(event.reminderOffsetMinutes).toBeNull();
      expect(event.description).toBeNull();
      expect(event.location).toBeNull();
    });

    it('channelId を null で渡すとワークスペース全体イベントとして作成できる', async () => {
      const event = await calendarService.createEvent(userId1, {
        channelId: null,
        title: 'All Hands',
        startsAt: FUTURE_START,
        endsAt: FUTURE_END,
      });
      expect(event.channelId).toBeNull();
    });

    it('attendees 配列を渡すと calendar_event_attendees に status=pending で INSERT される', async () => {
      const event = await calendarService.createEvent(userId1, {
        channelId,
        title: 'Design Review',
        startsAt: FUTURE_START,
        endsAt: FUTURE_END,
        attendeeUserIds: [userId2, userId3],
      });
      expect(event.attendees).toHaveLength(2);
      const userIds = event.attendees.map((a) => a.userId).sort();
      expect(userIds).toEqual([userId2, userId3].sort());
      expect(event.attendees.every((a) => a.status === 'pending')).toBe(true);
    });

    it('reminderOffsetMinutes を渡すと calendar_event_reminders に行が作成される', async () => {
      const event = await calendarService.createEvent(userId1, {
        channelId,
        title: 'Standup',
        startsAt: FUTURE_START,
        endsAt: FUTURE_END,
        reminderOffsetMinutes: 15,
      });
      expect(event.reminderOffsetMinutes).toBe(15);

      const rows = await testDb.execute(
        'SELECT * FROM calendar_event_reminders WHERE event_id = $1',
        [event.id],
      );
      expect(rows.rows.length).toBe(1);
      expect(rows.rows[0].remind_offset_minutes).toBe(15);
      expect(rows.rows[0].sent_at).toBeNull();
    });

    it('starts_at が ends_at 以降の場合はバリデーションエラー', async () => {
      await expect(
        calendarService.createEvent(userId1, {
          channelId,
          title: 'Bad Event',
          startsAt: FUTURE_END,
          endsAt: FUTURE_START,
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('存在しない channelId を渡すと FK エラーで作成失敗', async () => {
      await expect(
        calendarService.createEvent(userId1, {
          channelId: 99999,
          title: 'Phantom',
          startsAt: FUTURE_START,
          endsAt: FUTURE_END,
        }),
      ).rejects.toThrow();
    });

    it('存在しない organizerId を渡すと FK エラーで作成失敗', async () => {
      await expect(
        calendarService.createEvent(99999, {
          channelId,
          title: 'Phantom',
          startsAt: FUTURE_START,
          endsAt: FUTURE_END,
        }),
      ).rejects.toThrow();
    });
  });

  describe('updateEvent', () => {
    it('organizer 自身は title/description/startsAt/endsAt/location を更新できる', async () => {
      const created = await calendarService.createEvent(userId1, {
        channelId,
        title: 'Old Title',
        startsAt: FUTURE_START,
        endsAt: FUTURE_END,
      });
      const updated = await calendarService.updateEvent(userId1, created.id, {
        title: 'New Title',
        description: 'updated desc',
        location: 'Room A',
        startsAt: FUTURE_START_2,
        endsAt: FUTURE_END_2,
      });
      expect(updated.title).toBe('New Title');
      expect(updated.description).toBe('updated desc');
      expect(updated.location).toBe('Room A');
      expect(updated.startsAt).toBe(new Date(FUTURE_START_2).toISOString());
      expect(updated.endsAt).toBe(new Date(FUTURE_END_2).toISOString());
    });

    it('updated_at が現在時刻に更新される', async () => {
      const created = await calendarService.createEvent(userId1, {
        channelId,
        title: 'Old',
        startsAt: FUTURE_START,
        endsAt: FUTURE_END,
      });
      const before = new Date(created.updatedAt).getTime();
      await new Promise((r) => setTimeout(r, 5));
      const updated = await calendarService.updateEvent(userId1, created.id, {
        title: 'Renamed',
      });
      const after = new Date(updated.updatedAt).getTime();
      expect(after).toBeGreaterThanOrEqual(before);
    });

    it('organizer 以外のユーザーが更新を試みると権限エラー', async () => {
      const created = await calendarService.createEvent(userId1, {
        channelId,
        title: 'Mine',
        startsAt: FUTURE_START,
        endsAt: FUTURE_END,
      });
      await expect(
        calendarService.updateEvent(userId2, created.id, { title: 'Hacked' }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('存在しない eventId で更新を試みると NotFound エラー', async () => {
      await expect(
        calendarService.updateEvent(userId1, 99999, { title: 'X' }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('starts_at >= ends_at になる更新はバリデーションエラー', async () => {
      const created = await calendarService.createEvent(userId1, {
        channelId,
        title: 'Ev',
        startsAt: FUTURE_START,
        endsAt: FUTURE_END,
      });
      await expect(
        calendarService.updateEvent(userId1, created.id, {
          startsAt: FUTURE_END_2,
          endsAt: FUTURE_START_2,
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe('deleteEvent', () => {
    it('organizer 自身は削除でき、calendar_event_attendees も CASCADE で消える', async () => {
      const created = await calendarService.createEvent(userId1, {
        channelId,
        title: 'Ev',
        startsAt: FUTURE_START,
        endsAt: FUTURE_END,
        attendeeUserIds: [userId2],
      });
      await calendarService.deleteEvent(userId1, created.id);
      const ev = await testDb.execute('SELECT * FROM calendar_events WHERE id = $1', [created.id]);
      expect(ev.rows.length).toBe(0);
      const att = await testDb.execute(
        'SELECT * FROM calendar_event_attendees WHERE event_id = $1',
        [created.id],
      );
      expect(att.rows.length).toBe(0);
    });

    it('削除に伴い calendar_event_reminders も CASCADE で消える', async () => {
      const created = await calendarService.createEvent(userId1, {
        channelId,
        title: 'Ev',
        startsAt: FUTURE_START,
        endsAt: FUTURE_END,
        reminderOffsetMinutes: 30,
      });
      await calendarService.deleteEvent(userId1, created.id);
      const r = await testDb.execute('SELECT * FROM calendar_event_reminders WHERE event_id = $1', [
        created.id,
      ]);
      expect(r.rows.length).toBe(0);
    });

    it('関連する calendar_polls.confirmed_event_id は SET NULL される', async () => {
      const ev = await calendarService.createEvent(userId1, {
        channelId,
        title: 'Confirmed',
        startsAt: FUTURE_START,
        endsAt: FUTURE_END,
      });
      // poll を直接 INSERT して confirmed_event_id にイベント id を貼る
      const pollRes = await testDb.execute(
        `INSERT INTO calendar_polls (channel_id, title, organizer_id, confirmed_event_id)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [channelId, 'Existing Poll', userId1, ev.id],
      );
      const pollId = pollRes.rows[0].id as number;

      await calendarService.deleteEvent(userId1, ev.id);

      const after = await testDb.execute(
        'SELECT confirmed_event_id FROM calendar_polls WHERE id = $1',
        [pollId],
      );
      expect(after.rows[0].confirmed_event_id).toBeNull();
    });

    it('organizer 以外のユーザーが削除を試みると権限エラー', async () => {
      const created = await calendarService.createEvent(userId1, {
        channelId,
        title: 'Ev',
        startsAt: FUTURE_START,
        endsAt: FUTURE_END,
      });
      await expect(calendarService.deleteEvent(userId2, created.id)).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it('存在しない eventId で削除を試みると NotFound エラー', async () => {
      await expect(calendarService.deleteEvent(userId1, 99999)).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  describe('getEventById', () => {
    it('attendees の配列と reminder の offset リストを同梱して返す', async () => {
      const created = await calendarService.createEvent(userId1, {
        channelId,
        title: 'Ev',
        startsAt: FUTURE_START,
        endsAt: FUTURE_END,
        attendeeUserIds: [userId2, userId3],
        reminderOffsetMinutes: 60,
      });
      const got = await calendarService.getEventById(created.id);
      expect(got).not.toBeNull();
      expect(got!.attendees.map((a) => a.userId).sort()).toEqual([userId2, userId3].sort());
      expect(got!.reminderOffsetMinutes).toBe(60);
    });

    it('存在しない id で null を返す', async () => {
      const got = await calendarService.getEventById(99999);
      expect(got).toBeNull();
    });
  });

  describe('listEventsInRange', () => {
    it('期間 [from, to] に starts_at が含まれるイベントを starts_at 昇順で返す', async () => {
      // 2030-01-02, 2030-01-01, 2030-01-03 の順で作成 → 1/1, 1/2, 1/3 順で返るか
      await calendarService.createEvent(userId1, {
        channelId,
        title: 'B',
        startsAt: FUTURE_START_2,
        endsAt: FUTURE_END_2,
      });
      await calendarService.createEvent(userId1, {
        channelId,
        title: 'A',
        startsAt: FUTURE_START,
        endsAt: FUTURE_END,
      });
      await calendarService.createEvent(userId1, {
        channelId,
        title: 'C',
        startsAt: FUTURE_START_3,
        endsAt: FUTURE_END_3,
      });
      const list = await calendarService.listEventsInRange({
        from: '2030-01-01T00:00:00Z',
        to: '2030-01-04T00:00:00Z',
      });
      expect(list.map((e) => e.title)).toEqual(['A', 'B', 'C']);
    });

    it('channelIds を指定するとそのチャンネルに属するイベントのみ返す', async () => {
      await calendarService.createEvent(userId1, {
        channelId,
        title: 'In ch1',
        startsAt: FUTURE_START,
        endsAt: FUTURE_END,
      });
      await calendarService.createEvent(userId1, {
        channelId: channelId2,
        title: 'In ch2',
        startsAt: FUTURE_START_2,
        endsAt: FUTURE_END_2,
      });
      const list = await calendarService.listEventsInRange({
        from: '2030-01-01T00:00:00Z',
        to: '2030-01-04T00:00:00Z',
        channelIds: [channelId],
      });
      expect(list.map((e) => e.title)).toEqual(['In ch1']);
    });

    it('channelIds 未指定なら全チャンネルのイベントを返す', async () => {
      await calendarService.createEvent(userId1, {
        channelId,
        title: 'In ch1',
        startsAt: FUTURE_START,
        endsAt: FUTURE_END,
      });
      await calendarService.createEvent(userId1, {
        channelId: channelId2,
        title: 'In ch2',
        startsAt: FUTURE_START_2,
        endsAt: FUTURE_END_2,
      });
      const list = await calendarService.listEventsInRange({
        from: '2030-01-01T00:00:00Z',
        to: '2030-01-04T00:00:00Z',
      });
      expect(list).toHaveLength(2);
    });

    it('期間外のイベントは含まれない', async () => {
      await calendarService.createEvent(userId1, {
        channelId,
        title: 'Inside',
        startsAt: FUTURE_START,
        endsAt: FUTURE_END,
      });
      await calendarService.createEvent(userId1, {
        channelId,
        title: 'Outside',
        startsAt: '2031-01-01T10:00:00Z',
        endsAt: '2031-01-01T11:00:00Z',
      });
      const list = await calendarService.listEventsInRange({
        from: '2030-01-01T00:00:00Z',
        to: '2030-12-31T23:59:59Z',
      });
      expect(list.map((e) => e.title)).toEqual(['Inside']);
    });

    it('channelIds が空配列ならイベントは 0 件', async () => {
      await calendarService.createEvent(userId1, {
        channelId,
        title: 'Ev',
        startsAt: FUTURE_START,
        endsAt: FUTURE_END,
      });
      const list = await calendarService.listEventsInRange({
        from: '2030-01-01T00:00:00Z',
        to: '2030-12-31T23:59:59Z',
        channelIds: [],
      });
      expect(list).toEqual([]);
    });

    it('channel_id が NULL のイベント（ワークスペース全体）は channelIds 指定時には含まれない', async () => {
      await calendarService.createEvent(userId1, {
        channelId: null,
        title: 'All Hands',
        startsAt: FUTURE_START,
        endsAt: FUTURE_END,
      });
      await calendarService.createEvent(userId1, {
        channelId,
        title: 'Channeled',
        startsAt: FUTURE_START_2,
        endsAt: FUTURE_END_2,
      });
      const list = await calendarService.listEventsInRange({
        from: '2030-01-01T00:00:00Z',
        to: '2030-12-31T23:59:59Z',
        channelIds: [channelId],
      });
      expect(list.map((e) => e.title)).toEqual(['Channeled']);
    });
  });

  describe('setRsvp', () => {
    it('初回呼び出しで accepted/maybe/declined/pending のいずれかで attendee 行が作成される', async () => {
      const ev = await calendarService.createEvent(userId1, {
        channelId,
        title: 'Ev',
        startsAt: FUTURE_START,
        endsAt: FUTURE_END,
      });
      const a = await calendarService.setRsvp(userId2, ev.id, 'accepted');
      expect(a.userId).toBe(userId2);
      expect(a.status).toBe('accepted');

      const rows = await testDb.execute(
        'SELECT * FROM calendar_event_attendees WHERE event_id = $1 AND user_id = $2',
        [ev.id, userId2],
      );
      expect(rows.rows[0].status).toBe('accepted');
    });

    it('既存の RSVP がある場合は status を更新する', async () => {
      const ev = await calendarService.createEvent(userId1, {
        channelId,
        title: 'Ev',
        startsAt: FUTURE_START,
        endsAt: FUTURE_END,
        attendeeUserIds: [userId2],
      });
      // 初期 pending
      const a1 = await calendarService.setRsvp(userId2, ev.id, 'maybe');
      expect(a1.status).toBe('maybe');
      const a2 = await calendarService.setRsvp(userId2, ev.id, 'declined');
      expect(a2.status).toBe('declined');
      // 行が増えていない（UPSERT の挙動）
      const rows = await testDb.execute(
        'SELECT * FROM calendar_event_attendees WHERE event_id = $1 AND user_id = $2',
        [ev.id, userId2],
      );
      expect(rows.rows.length).toBe(1);
      expect(rows.rows[0].status).toBe('declined');
    });

    it('responded_at が更新される', async () => {
      const ev = await calendarService.createEvent(userId1, {
        channelId,
        title: 'Ev',
        startsAt: FUTURE_START,
        endsAt: FUTURE_END,
      });
      const a1 = await calendarService.setRsvp(userId2, ev.id, 'maybe');
      const t1 = new Date(a1.respondedAt).getTime();
      await new Promise((r) => setTimeout(r, 5));
      const a2 = await calendarService.setRsvp(userId2, ev.id, 'accepted');
      const t2 = new Date(a2.respondedAt).getTime();
      expect(t2).toBeGreaterThanOrEqual(t1);
    });

    it('無効な status 値は受け付けない', async () => {
      const ev = await calendarService.createEvent(userId1, {
        channelId,
        title: 'Ev',
        startsAt: FUTURE_START,
        endsAt: FUTURE_END,
      });
      await expect(
        // 型をすり抜けて無効値を渡す
        calendarService.setRsvp(userId2, ev.id, 'going' as never),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('存在しないイベントでは NotFound エラー', async () => {
      await expect(calendarService.setRsvp(userId2, 99999, 'accepted')).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  describe('createPoll', () => {
    it('title/channelId/organizerId/deadline/candidates[] を渡すと poll とその candidates が作成される', async () => {
      const poll = await calendarService.createPoll(userId1, {
        channelId,
        title: 'Next Review',
        deadline: '2030-01-05T00:00:00Z',
        candidates: [
          { startsAt: FUTURE_START, endsAt: FUTURE_END },
          { startsAt: FUTURE_START_2, endsAt: FUTURE_END_2 },
        ],
      });
      expect(poll.id).toBeDefined();
      expect(poll.organizerId).toBe(userId1);
      expect(poll.candidates).toHaveLength(2);
      expect(poll.candidates[0].startsAt).toBe(new Date(FUTURE_START).toISOString());
      expect(poll.confirmedEventId).toBeNull();
      expect(poll.votes).toEqual([]);
    });

    it('deadline は省略可能で NULL で保存できる', async () => {
      const poll = await calendarService.createPoll(userId1, {
        channelId,
        title: 'No Deadline',
        candidates: [{ startsAt: FUTURE_START, endsAt: FUTURE_END }],
      });
      expect(poll.deadline).toBeNull();
    });

    it('candidates が 0 件ならバリデーションエラー', async () => {
      await expect(
        calendarService.createPoll(userId1, {
          channelId,
          title: 'Empty',
          candidates: [],
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('candidate の starts_at >= ends_at はバリデーションエラー', async () => {
      await expect(
        calendarService.createPoll(userId1, {
          channelId,
          title: 'Bad',
          candidates: [{ startsAt: FUTURE_END, endsAt: FUTURE_START }],
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('存在しない channelId を渡すと FK エラー', async () => {
      await expect(
        calendarService.createPoll(userId1, {
          channelId: 99999,
          title: 'Phantom',
          candidates: [{ startsAt: FUTURE_START, endsAt: FUTURE_END }],
        }),
      ).rejects.toThrow();
    });
  });

  describe('getPollWithVotes', () => {
    it('poll の candidates と各候補への votes 一覧を同梱して返す', async () => {
      const poll = await calendarService.createPoll(userId1, {
        channelId,
        title: 'Vote Test',
        candidates: [
          { startsAt: FUTURE_START, endsAt: FUTURE_END },
          { startsAt: FUTURE_START_2, endsAt: FUTURE_END_2 },
        ],
      });
      await calendarService.castVote(userId2, poll.id, [
        { candidateId: poll.candidates[0].id, vote: 'yes' },
        { candidateId: poll.candidates[1].id, vote: 'no' },
      ]);
      const got = await calendarService.getPollWithVotes(poll.id);
      expect(got).not.toBeNull();
      expect(got!.candidates).toHaveLength(2);
      expect(got!.votes).toHaveLength(2);
      const myVotes = got!.votes.filter((v) => v.userId === userId2);
      expect(myVotes.length).toBe(2);
    });

    it('confirmed_event_id が設定されていればそれも含めて返す', async () => {
      const poll = await calendarService.createPoll(userId1, {
        channelId,
        title: 'Confirm Test',
        candidates: [{ startsAt: FUTURE_START, endsAt: FUTURE_END }],
      });
      await calendarService.confirmPoll(userId1, poll.id, poll.candidates[0].id);
      const got = await calendarService.getPollWithVotes(poll.id);
      expect(got!.confirmedEventId).not.toBeNull();
    });

    it('存在しない id で null を返す', async () => {
      const got = await calendarService.getPollWithVotes(99999);
      expect(got).toBeNull();
    });
  });

  describe('listPollsByChannel', () => {
    it('指定チャンネルの poll を candidates / votes 同梱で返す', async () => {
      await calendarService.createPoll(userId1, {
        channelId,
        title: 'P1',
        candidates: [{ startsAt: FUTURE_START, endsAt: FUTURE_END }],
      });
      await calendarService.createPoll(userId1, {
        channelId,
        title: 'P2',
        candidates: [{ startsAt: FUTURE_START_2, endsAt: FUTURE_END_2 }],
      });
      const list = await calendarService.listPollsByChannel(channelId);
      expect(list).toHaveLength(2);
      expect(list[0].candidates.length).toBeGreaterThan(0);
    });

    it('confirmed 済みの poll も含めて返す', async () => {
      const p = await calendarService.createPoll(userId1, {
        channelId,
        title: 'Confirmed',
        candidates: [{ startsAt: FUTURE_START, endsAt: FUTURE_END }],
      });
      await calendarService.confirmPoll(userId1, p.id, p.candidates[0].id);
      const list = await calendarService.listPollsByChannel(channelId);
      expect(list.some((x) => x.confirmedEventId !== null)).toBe(true);
    });

    it('別チャンネルの poll は含めない', async () => {
      await calendarService.createPoll(userId1, {
        channelId,
        title: 'In ch1',
        candidates: [{ startsAt: FUTURE_START, endsAt: FUTURE_END }],
      });
      await calendarService.createPoll(userId1, {
        channelId: channelId2,
        title: 'In ch2',
        candidates: [{ startsAt: FUTURE_START_2, endsAt: FUTURE_END_2 }],
      });
      const list = await calendarService.listPollsByChannel(channelId);
      expect(list.map((p) => p.title)).toEqual(['In ch1']);
    });
  });

  describe('castVote', () => {
    async function makePoll(numCands = 2) {
      const cands = Array.from({ length: numCands }, (_, i) => ({
        startsAt: `2030-01-0${i + 1}T10:00:00Z`,
        endsAt: `2030-01-0${i + 1}T11:00:00Z`,
      }));
      return calendarService.createPoll(userId1, {
        channelId,
        title: `P-${numCands}`,
        candidates: cands,
      });
    }

    it('未投票の候補に yes / maybe / no を新規投票できる', async () => {
      const p = await makePoll();
      const result = await calendarService.castVote(userId2, p.id, [
        { candidateId: p.candidates[0].id, vote: 'yes' },
        { candidateId: p.candidates[1].id, vote: 'maybe' },
      ]);
      expect(result.votes).toHaveLength(2);
      const my = result.votes.filter((v) => v.userId === userId2);
      const yes = my.find((v) => v.candidateId === p.candidates[0].id);
      const maybe = my.find((v) => v.candidateId === p.candidates[1].id);
      expect(yes!.vote).toBe('yes');
      expect(maybe!.vote).toBe('maybe');
    });

    it('既存投票を上書き更新できる', async () => {
      const p = await makePoll();
      await calendarService.castVote(userId2, p.id, [
        { candidateId: p.candidates[0].id, vote: 'yes' },
      ]);
      const r = await calendarService.castVote(userId2, p.id, [
        { candidateId: p.candidates[0].id, vote: 'no' },
      ]);
      const my = r.votes.find((v) => v.userId === userId2 && v.candidateId === p.candidates[0].id);
      expect(my!.vote).toBe('no');
    });

    it('vote=null を渡すと既存投票を削除する', async () => {
      const p = await makePoll();
      await calendarService.castVote(userId2, p.id, [
        { candidateId: p.candidates[0].id, vote: 'yes' },
      ]);
      const r = await calendarService.castVote(userId2, p.id, [
        { candidateId: p.candidates[0].id, vote: null },
      ]);
      const my = r.votes.find((v) => v.userId === userId2 && v.candidateId === p.candidates[0].id);
      expect(my).toBeUndefined();
    });

    it('複数候補への一括投票が atomic に処理される（途中失敗時は全体ロールバック）', async () => {
      const p = await makePoll();
      // 不正な candidateId を含む → トランザクションでロールバック → 既存投票も無いまま
      await expect(
        calendarService.castVote(userId2, p.id, [
          { candidateId: p.candidates[0].id, vote: 'yes' },
          { candidateId: 99999, vote: 'no' },
        ]),
      ).rejects.toMatchObject({ statusCode: 400 });
      const got = await calendarService.getPollWithVotes(p.id);
      expect(got!.votes.filter((v) => v.userId === userId2)).toEqual([]);
    });

    it('無効な vote 値はバリデーションエラー', async () => {
      const p = await makePoll();
      await expect(
        calendarService.castVote(userId2, p.id, [
          { candidateId: p.candidates[0].id, vote: 'bad' as never },
        ]),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('confirmed 済み poll への投票は拒否される', async () => {
      const p = await makePoll();
      await calendarService.confirmPoll(userId1, p.id, p.candidates[0].id);
      await expect(
        calendarService.castVote(userId2, p.id, [{ candidateId: p.candidates[1].id, vote: 'yes' }]),
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('poll に属さない candidateId への投票は拒否される', async () => {
      const p1 = await makePoll();
      const p2 = await makePoll();
      // p1 への投票で p2 の candidate を指定
      await expect(
        calendarService.castVote(userId2, p1.id, [
          { candidateId: p2.candidates[0].id, vote: 'yes' },
        ]),
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe('confirmPoll', () => {
    async function makePoll() {
      return calendarService.createPoll(userId1, {
        channelId,
        title: 'Confirm Target',
        candidates: [
          { startsAt: FUTURE_START, endsAt: FUTURE_END },
          { startsAt: FUTURE_START_2, endsAt: FUTURE_END_2 },
        ],
      });
    }

    it('organizer が候補を選ぶと calendar_events が作成され confirmed_event_id が更新される', async () => {
      const p = await makePoll();
      const ev = await calendarService.confirmPoll(userId1, p.id, p.candidates[0].id);
      expect(ev.id).toBeDefined();
      const after = await calendarService.getPollWithVotes(p.id);
      expect(after!.confirmedEventId).toBe(ev.id);
    });

    it('作成されるイベントの organizer_id は poll.organizer_id と一致する', async () => {
      const p = await makePoll();
      const ev = await calendarService.confirmPoll(userId1, p.id, p.candidates[0].id);
      expect(ev.organizerId).toBe(userId1);
    });

    it('作成されるイベントの channel_id は poll.channel_id と一致する', async () => {
      const p = await makePoll();
      const ev = await calendarService.confirmPoll(userId1, p.id, p.candidates[0].id);
      expect(ev.channelId).toBe(channelId);
    });

    it('candidate の starts_at と ends_at がイベントの時刻として転写される', async () => {
      const p = await makePoll();
      const ev = await calendarService.confirmPoll(userId1, p.id, p.candidates[1].id);
      expect(ev.startsAt).toBe(new Date(FUTURE_START_2).toISOString());
      expect(ev.endsAt).toBe(new Date(FUTURE_END_2).toISOString());
    });

    // NOTE: confirm のトランザクション原子性は pg-mem 環境でロールバック動作を再現できないため、
    // ここでは正常系の他テストでの「event と confirmed_event_id が揃って永続化される」観察で代替する。
    // 真のロールバック検証は本物の PostgreSQL での結合テストで担保する。

    it('既に confirmed_event_id が設定されている poll への二重 confirm は拒否される', async () => {
      const p = await makePoll();
      await calendarService.confirmPoll(userId1, p.id, p.candidates[0].id);
      await expect(
        calendarService.confirmPoll(userId1, p.id, p.candidates[1].id),
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('organizer 以外のユーザーが confirm を試みると権限エラー', async () => {
      const p = await makePoll();
      await expect(
        calendarService.confirmPoll(userId2, p.id, p.candidates[0].id),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('poll に属さない candidateId を渡すとバリデーションエラー', async () => {
      const p = await makePoll();
      await expect(calendarService.confirmPoll(userId1, p.id, 99999)).rejects.toMatchObject({
        statusCode: 400,
      });
    });
  });
});
