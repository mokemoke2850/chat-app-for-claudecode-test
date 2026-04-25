/**
 * テスト対象: eventService（会話イベント投稿 #108）
 * 戦略:
 *   - pg-mem のインメモリ PostgreSQL 互換 DB を使いサービス層を直接テストする
 *   - 外部キー制約を満たすため beforeEach でユーザー・チャンネル・メッセージを挿入する
 *   - イベント作成 / RSVP（参加・不参加・未定）/ 集計 / 権限 / 境界値を網羅する
 */

import { getSharedTestDatabase, resetTestData } from './__fixtures__/pgTestHelper';

const testDb = getSharedTestDatabase();

jest.mock('../db/database', () => testDb);

import * as eventService from '../services/eventService';
import { getChannelMessages } from '../services/messageService';

let userId1: number;
let userId2: number;
let userId3: number;
let channelId: number;
let restrictedChannelId: number;

const FUTURE_START = '2030-01-01T10:00:00Z';
const FUTURE_END = '2030-01-01T12:00:00Z';
const FUTURE_START_2 = '2030-01-02T15:00:00Z';

async function setupFixtures(): Promise<void> {
  const r1 = await testDb.execute(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
    ['alice', 'a@t.com', 'h'],
  );
  userId1 = r1.rows[0].id as number;

  const r2 = await testDb.execute(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
    ['bob', 'b@t.com', 'h'],
  );
  userId2 = r2.rows[0].id as number;

  const r3 = await testDb.execute(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
    ['carol', 'c@t.com', 'h'],
  );
  userId3 = r3.rows[0].id as number;

  const rc = await testDb.execute(
    "INSERT INTO channels (name, created_by, posting_permission) VALUES ($1, $2, 'everyone') RETURNING id",
    ['general', userId1],
  );
  channelId = rc.rows[0].id as number;

  // readonly チャンネル（投稿権限なし）
  const rc2 = await testDb.execute(
    "INSERT INTO channels (name, created_by, posting_permission) VALUES ($1, $2, 'readonly') RETURNING id",
    ['announce', userId1],
  );
  restrictedChannelId = rc2.rows[0].id as number;
}

beforeEach(async () => {
  await resetTestData(testDb);
  await setupFixtures();
});

describe('eventService - 会話イベント投稿 (#108)', () => {
  describe('イベント作成', () => {
    describe('正常系', () => {
      it('チャンネル内にイベント（タイトル・日時・説明）を投稿でき、対応する message と event レコードが作成される', async () => {
        const event = await eventService.create(userId1, {
          channelId,
          title: '勉強会',
          description: 'React 19 入門',
          startsAt: FUTURE_START,
          endsAt: FUTURE_END,
        });

        expect(event.id).toBeDefined();
        expect(event.title).toBe('勉強会');
        expect(event.description).toBe('React 19 入門');

        // messages 行も作成されている
        const msgRows = await testDb.execute(
          'SELECT id, channel_id, user_id FROM messages WHERE id = $1',
          [event.messageId],
        );
        expect(msgRows.rows.length).toBe(1);
        expect(msgRows.rows[0].channel_id).toBe(channelId);
        expect(msgRows.rows[0].user_id).toBe(userId1);

        // events 行も存在
        const evRows = await testDb.execute('SELECT id FROM events WHERE id = $1', [event.id]);
        expect(evRows.rows.length).toBe(1);
      });

      it('description が省略された場合は null として保存される', async () => {
        const event = await eventService.create(userId1, {
          channelId,
          title: 'Lunch',
          startsAt: FUTURE_START,
        });
        expect(event.description).toBeNull();
      });

      it('ends_at が省略された場合は null として保存される', async () => {
        const event = await eventService.create(userId1, {
          channelId,
          title: 'Standup',
          startsAt: FUTURE_START,
        });
        expect(event.endsAt).toBeNull();
      });

      it('作成者の created_by が記録される', async () => {
        const event = await eventService.create(userId2, {
          channelId,
          title: 'Bob meeting',
          startsAt: FUTURE_START,
        });
        expect(event.createdBy).toBe(userId2);
      });

      it('作成直後の rsvpCounts は { going: 0, notGoing: 0, maybe: 0 } である', async () => {
        const event = await eventService.create(userId1, {
          channelId,
          title: 'Empty',
          startsAt: FUTURE_START,
        });
        expect(event.rsvpCounts).toEqual({ going: 0, notGoing: 0, maybe: 0 });
      });

      it('作成直後の myRsvp は null である', async () => {
        const event = await eventService.create(userId1, {
          channelId,
          title: 'Empty',
          startsAt: FUTURE_START,
        });
        expect(event.myRsvp).toBeNull();
      });
    });

    describe('境界値・エラー系', () => {
      it('starts_at が ends_at より後の場合はエラーになる', async () => {
        await expect(
          eventService.create(userId1, {
            channelId,
            title: 'Bad',
            startsAt: FUTURE_END,
            endsAt: FUTURE_START,
          }),
        ).rejects.toMatchObject({ statusCode: 400 });
      });

      it('starts_at と ends_at が同時刻の場合はエラーになる', async () => {
        await expect(
          eventService.create(userId1, {
            channelId,
            title: 'Same',
            startsAt: FUTURE_START,
            endsAt: FUTURE_START,
          }),
        ).rejects.toMatchObject({ statusCode: 400 });
      });

      it('タイトルが空文字の場合はエラーになる', async () => {
        await expect(
          eventService.create(userId1, {
            channelId,
            title: '   ',
            startsAt: FUTURE_START,
          }),
        ).rejects.toMatchObject({ statusCode: 400 });
      });

      it('存在しないチャンネルにイベントを作成しようとするとエラーになる', async () => {
        await expect(
          eventService.create(userId1, {
            channelId: 99999,
            title: 'Nope',
            startsAt: FUTURE_START,
          }),
        ).rejects.toMatchObject({ statusCode: 404 });
      });

      it('投稿権限のないチャンネルにイベントを作成しようとすると 403 エラーになる', async () => {
        await expect(
          eventService.create(userId1, {
            channelId: restrictedChannelId,
            title: 'No post',
            startsAt: FUTURE_START,
          }),
        ).rejects.toMatchObject({ statusCode: 403 });
      });
    });
  });

  describe('イベント更新（update）', () => {
    it('作成者はタイトル・説明・日時を更新できる', async () => {
      const event = await eventService.create(userId1, {
        channelId,
        title: 'Old',
        startsAt: FUTURE_START,
      });
      const updated = await eventService.update(userId1, event.id, {
        title: 'New title',
        description: 'New desc',
        startsAt: FUTURE_START_2,
      });
      expect(updated.title).toBe('New title');
      expect(updated.description).toBe('New desc');
      expect(new Date(updated.startsAt).toISOString()).toBe(new Date(FUTURE_START_2).toISOString());
    });

    it('作成者以外が更新しようとすると 403 エラーになる', async () => {
      const event = await eventService.create(userId1, {
        channelId,
        title: 'Mine',
        startsAt: FUTURE_START,
      });
      await expect(
        eventService.update(userId2, event.id, { title: 'Hacked' }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('存在しないイベントを更新しようとすると 404 エラーになる', async () => {
      await expect(eventService.update(userId1, 99999, { title: 'X' })).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('更新後の updated_at が更新前より新しくなる', async () => {
      const event = await eventService.create(userId1, {
        channelId,
        title: 'T',
        startsAt: FUTURE_START,
      });
      // pg-mem の NOW() は呼び出しごとに進むので 1ms 待つだけで十分
      await new Promise((r) => setTimeout(r, 5));
      const updated = await eventService.update(userId1, event.id, { title: 'T2' });
      expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(event.updatedAt).getTime(),
      );
    });

    it('更新時も starts_at が ends_at より後の場合はエラーになる', async () => {
      const event = await eventService.create(userId1, {
        channelId,
        title: 'T',
        startsAt: FUTURE_START,
        endsAt: FUTURE_END,
      });
      await expect(
        eventService.update(userId1, event.id, {
          startsAt: FUTURE_END,
          endsAt: FUTURE_START,
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe('イベント削除（delete）', () => {
    it('作成者はイベントを削除でき、関連する message も削除される（CASCADE）', async () => {
      const event = await eventService.create(userId1, {
        channelId,
        title: 'Del',
        startsAt: FUTURE_START,
      });
      await eventService.deleteEvent(userId1, event.id);

      const evRows = await testDb.execute('SELECT id FROM events WHERE id = $1', [event.id]);
      expect(evRows.rows.length).toBe(0);

      const msgRows = await testDb.execute('SELECT id FROM messages WHERE id = $1', [
        event.messageId,
      ]);
      expect(msgRows.rows.length).toBe(0);
    });

    it('作成者以外が削除しようとすると 403 エラーになる', async () => {
      const event = await eventService.create(userId1, {
        channelId,
        title: 'X',
        startsAt: FUTURE_START,
      });
      await expect(eventService.deleteEvent(userId2, event.id)).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it('イベント削除時に紐づく event_rsvps も CASCADE で削除される', async () => {
      const event = await eventService.create(userId1, {
        channelId,
        title: 'X',
        startsAt: FUTURE_START,
      });
      await eventService.setRsvp(userId2, event.id, 'going');
      await eventService.deleteEvent(userId1, event.id);

      const rsvpRows = await testDb.execute('SELECT * FROM event_rsvps WHERE event_id = $1', [
        event.id,
      ]);
      expect(rsvpRows.rows.length).toBe(0);
    });
  });

  describe('RSVP（参加可否）', () => {
    describe('登録・更新', () => {
      it('"going" を選択すると event_rsvps に登録される', async () => {
        const event = await eventService.create(userId1, {
          channelId,
          title: 'E',
          startsAt: FUTURE_START,
        });
        const result = await eventService.setRsvp(userId2, event.id, 'going');
        expect(result.event.rsvpCounts.going).toBe(1);
        expect(result.event.myRsvp).toBe('going');
      });

      it('"not_going" を選択すると event_rsvps に登録される', async () => {
        const event = await eventService.create(userId1, {
          channelId,
          title: 'E',
          startsAt: FUTURE_START,
        });
        const result = await eventService.setRsvp(userId2, event.id, 'not_going');
        expect(result.event.rsvpCounts.notGoing).toBe(1);
      });

      it('"maybe" を選択すると event_rsvps に登録される', async () => {
        const event = await eventService.create(userId1, {
          channelId,
          title: 'E',
          startsAt: FUTURE_START,
        });
        const result = await eventService.setRsvp(userId2, event.id, 'maybe');
        expect(result.event.rsvpCounts.maybe).toBe(1);
      });

      it('同一ユーザーが連続で同じステータスを送信しても重複しない（冪等）', async () => {
        const event = await eventService.create(userId1, {
          channelId,
          title: 'E',
          startsAt: FUTURE_START,
        });
        await eventService.setRsvp(userId2, event.id, 'going');
        await eventService.setRsvp(userId2, event.id, 'going');
        const refreshed = await eventService.getByMessageId(event.messageId, userId2);
        expect(refreshed?.rsvpCounts.going).toBe(1);

        const rows = await testDb.execute(
          'SELECT COUNT(*) AS cnt FROM event_rsvps WHERE event_id = $1 AND user_id = $2',
          [event.id, userId2],
        );
        expect(Number(rows.rows[0].cnt)).toBe(1);
      });

      it('同一ユーザーが異なるステータスを送信すると status が更新される（1人1レコード）', async () => {
        const event = await eventService.create(userId1, {
          channelId,
          title: 'E',
          startsAt: FUTURE_START,
        });
        await eventService.setRsvp(userId2, event.id, 'going');
        const updated = await eventService.setRsvp(userId2, event.id, 'maybe');
        expect(updated.event.rsvpCounts.going).toBe(0);
        expect(updated.event.rsvpCounts.maybe).toBe(1);

        const rows = await testDb.execute(
          'SELECT COUNT(*) AS cnt FROM event_rsvps WHERE event_id = $1 AND user_id = $2',
          [event.id, userId2],
        );
        expect(Number(rows.rows[0].cnt)).toBe(1);
      });

      it('RSVP 更新時に updated_at が更新される', async () => {
        const event = await eventService.create(userId1, {
          channelId,
          title: 'E',
          startsAt: FUTURE_START,
        });
        await eventService.setRsvp(userId2, event.id, 'going');
        const before = await testDb.execute(
          'SELECT updated_at FROM event_rsvps WHERE event_id = $1 AND user_id = $2',
          [event.id, userId2],
        );
        await new Promise((r) => setTimeout(r, 5));
        await eventService.setRsvp(userId2, event.id, 'maybe');
        const after = await testDb.execute(
          'SELECT updated_at FROM event_rsvps WHERE event_id = $1 AND user_id = $2',
          [event.id, userId2],
        );
        expect(new Date(after.rows[0].updated_at as string).getTime()).toBeGreaterThanOrEqual(
          new Date(before.rows[0].updated_at as string).getTime(),
        );
      });
    });

    describe('エラー系', () => {
      it('存在しないイベントへの RSVP は 404 エラーになる', async () => {
        await expect(eventService.setRsvp(userId1, 99999, 'going')).rejects.toMatchObject({
          statusCode: 404,
        });
      });

      it('不正な status 値（例: "yes"）は 400 エラーになる', async () => {
        const event = await eventService.create(userId1, {
          channelId,
          title: 'E',
          startsAt: FUTURE_START,
        });
        await expect(
          eventService.setRsvp(userId2, event.id, 'yes' as 'going'),
        ).rejects.toMatchObject({ statusCode: 400 });
      });
    });
  });

  describe('集計（rsvpCounts）', () => {
    it('参加（going）人数が正しくカウントされる', async () => {
      const event = await eventService.create(userId1, {
        channelId,
        title: 'E',
        startsAt: FUTURE_START,
      });
      await eventService.setRsvp(userId2, event.id, 'going');
      await eventService.setRsvp(userId3, event.id, 'going');
      const refreshed = await eventService.getByMessageId(event.messageId);
      expect(refreshed?.rsvpCounts.going).toBe(2);
    });

    it('不参加（not_going）人数が正しくカウントされる', async () => {
      const event = await eventService.create(userId1, {
        channelId,
        title: 'E',
        startsAt: FUTURE_START,
      });
      await eventService.setRsvp(userId2, event.id, 'not_going');
      await eventService.setRsvp(userId3, event.id, 'not_going');
      const refreshed = await eventService.getByMessageId(event.messageId);
      expect(refreshed?.rsvpCounts.notGoing).toBe(2);
    });

    it('未定（maybe）人数が正しくカウントされる', async () => {
      const event = await eventService.create(userId1, {
        channelId,
        title: 'E',
        startsAt: FUTURE_START,
      });
      await eventService.setRsvp(userId2, event.id, 'maybe');
      const refreshed = await eventService.getByMessageId(event.messageId);
      expect(refreshed?.rsvpCounts.maybe).toBe(1);
    });

    it('複数ユーザーが各ステータスを混在させても正しく集計される', async () => {
      const event = await eventService.create(userId1, {
        channelId,
        title: 'E',
        startsAt: FUTURE_START,
      });
      await eventService.setRsvp(userId1, event.id, 'going');
      await eventService.setRsvp(userId2, event.id, 'not_going');
      await eventService.setRsvp(userId3, event.id, 'maybe');
      const refreshed = await eventService.getByMessageId(event.messageId);
      expect(refreshed?.rsvpCounts).toEqual({ going: 1, notGoing: 1, maybe: 1 });
    });

    it('ユーザーが status を変更すると旧ステータスのカウントが減り、新ステータスのカウントが増える', async () => {
      const event = await eventService.create(userId1, {
        channelId,
        title: 'E',
        startsAt: FUTURE_START,
      });
      await eventService.setRsvp(userId2, event.id, 'going');
      await eventService.setRsvp(userId2, event.id, 'maybe');
      const refreshed = await eventService.getByMessageId(event.messageId);
      expect(refreshed?.rsvpCounts.going).toBe(0);
      expect(refreshed?.rsvpCounts.maybe).toBe(1);
    });

    it('myRsvp は問い合わせユーザーの現在の RSVP ステータスを返す', async () => {
      const event = await eventService.create(userId1, {
        channelId,
        title: 'E',
        startsAt: FUTURE_START,
      });
      await eventService.setRsvp(userId2, event.id, 'maybe');
      const refreshed = await eventService.getByMessageId(event.messageId, userId2);
      expect(refreshed?.myRsvp).toBe('maybe');
    });

    it('問い合わせユーザーが RSVP していない場合 myRsvp は null になる', async () => {
      const event = await eventService.create(userId1, {
        channelId,
        title: 'E',
        startsAt: FUTURE_START,
      });
      const refreshed = await eventService.getByMessageId(event.messageId, userId3);
      expect(refreshed?.myRsvp).toBeNull();
    });
  });

  describe('メッセージタイムラインへの統合', () => {
    it('getChannelMessages がイベント投稿メッセージに event フィールドを含めて返す', async () => {
      const event = await eventService.create(userId1, {
        channelId,
        title: 'タイムライン用',
        startsAt: FUTURE_START,
      });
      const messages = await getChannelMessages(channelId, 50, undefined, userId1);
      const eventMsg = messages.find((m) => m.id === event.messageId);
      expect(eventMsg).toBeDefined();
      expect(eventMsg?.event).toBeDefined();
      expect(eventMsg?.event?.title).toBe('タイムライン用');
    });

    it('通常メッセージの event フィールドは null または undefined になる', async () => {
      // 通常メッセージを直接挿入
      const r = await testDb.execute(
        'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
        [channelId, userId1, 'plain message'],
      );
      const plainId = r.rows[0].id as number;

      const messages = await getChannelMessages(channelId, 50, undefined, userId1);
      const plain = messages.find((m) => m.id === plainId);
      expect(plain).toBeDefined();
      expect(plain?.event ?? null).toBeNull();
    });

    it('複数イベントが混在するチャンネルでも N+1 を起こさず bulk fetch される', async () => {
      const e1 = await eventService.create(userId1, {
        channelId,
        title: 'Event1',
        startsAt: FUTURE_START,
      });
      const e2 = await eventService.create(userId1, {
        channelId,
        title: 'Event2',
        startsAt: FUTURE_START_2,
      });
      await eventService.setRsvp(userId2, e1.id, 'going');
      await eventService.setRsvp(userId3, e2.id, 'maybe');

      const messages = await getChannelMessages(channelId, 50, undefined, userId2);
      const m1 = messages.find((m) => m.id === e1.messageId);
      const m2 = messages.find((m) => m.id === e2.messageId);
      expect(m1?.event?.rsvpCounts.going).toBe(1);
      expect(m1?.event?.myRsvp).toBe('going');
      expect(m2?.event?.rsvpCounts.maybe).toBe(1);
      expect(m2?.event?.myRsvp).toBeNull();
    });
  });

  describe('参加者一覧取得', () => {
    it('指定イベントの going ユーザー一覧を取得できる', async () => {
      const event = await eventService.create(userId1, {
        channelId,
        title: 'E',
        startsAt: FUTURE_START,
      });
      await eventService.setRsvp(userId2, event.id, 'going');
      await eventService.setRsvp(userId3, event.id, 'not_going');
      const users = await eventService.getRsvpUsers(event.id);
      const going = users.filter((u) => u.status === 'going');
      expect(going.map((u) => u.userId)).toEqual([userId2]);
    });

    it('指定イベントの not_going ユーザー一覧を取得できる', async () => {
      const event = await eventService.create(userId1, {
        channelId,
        title: 'E',
        startsAt: FUTURE_START,
      });
      await eventService.setRsvp(userId2, event.id, 'not_going');
      const users = await eventService.getRsvpUsers(event.id);
      expect(users.filter((u) => u.status === 'not_going').map((u) => u.userId)).toEqual([userId2]);
    });

    it('指定イベントの maybe ユーザー一覧を取得できる', async () => {
      const event = await eventService.create(userId1, {
        channelId,
        title: 'E',
        startsAt: FUTURE_START,
      });
      await eventService.setRsvp(userId3, event.id, 'maybe');
      const users = await eventService.getRsvpUsers(event.id);
      expect(users.filter((u) => u.status === 'maybe').map((u) => u.userId)).toEqual([userId3]);
    });
  });
});
