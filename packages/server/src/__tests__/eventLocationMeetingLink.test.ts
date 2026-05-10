/**
 * テスト対象: イベント詳細のロケーション／会議リンク機能 (#303)
 *
 * 対象:
 *   - routes/calendar.ts — POST /api/calendar/events, PATCH /api/calendar/events/:id
 *   - services/calendarService.ts — createEvent, updateEvent
 *   - DB: calendar_events テーブルの location カラム（既存）と meeting_url カラム（新規追加）
 *
 * 戦略:
 *   - supertest + createApp() で実エンドポイントを叩く
 *   - DB は pg-mem を共有（createTestDatabase）
 */

import { createTestDatabase, resetTestData } from './__fixtures__/pgTestHelper';

const testDb = createTestDatabase();

jest.mock('../db/database', () => testDb);

import request from 'supertest';
import { createApp } from '../app';
import { registerUser } from './__fixtures__/testHelpers';

const app = createApp();

let userId: number;
let authToken: string;
let channelId: number;

beforeEach(async () => {
  await resetTestData(testDb);
  const result = await registerUser(app, 'alice', 'alice@t.com');
  userId = result.userId;
  authToken = result.token;

  const c = await testDb.execute(
    'INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id',
    ['general', userId],
  );
  channelId = c.rows[0].id as number;
});

const FUTURE_START = '2030-01-01T10:00:00Z';
const FUTURE_END = '2030-01-01T11:00:00Z';

describe('POST /api/calendar/events — location と meeting_url', () => {
  describe('location フィールド（既存カラム）', () => {
    it('location を指定してイベントを作成すると DB に保存される', async () => {
      const res = await request(app)
        .post('/api/calendar/events')
        .set('Cookie', `token=${authToken}`)
        .send({
          channelId,
          title: 'Test',
          startsAt: FUTURE_START,
          endsAt: FUTURE_END,
          location: '会議室A',
        });
      expect(res.status).toBe(201);
      expect(res.body.event.location).toBe('会議室A');
    });

    it('location を省略してイベントを作成すると null で保存される', async () => {
      const res = await request(app)
        .post('/api/calendar/events')
        .set('Cookie', `token=${authToken}`)
        .send({ channelId, title: 'Test', startsAt: FUTURE_START, endsAt: FUTURE_END });
      expect(res.status).toBe(201);
      expect(res.body.event.location).toBeNull();
    });

    it('location が null のイベント作成リクエストが 201 を返す', async () => {
      const res = await request(app)
        .post('/api/calendar/events')
        .set('Cookie', `token=${authToken}`)
        .send({
          channelId,
          title: 'Test',
          startsAt: FUTURE_START,
          endsAt: FUTURE_END,
          location: null,
        });
      expect(res.status).toBe(201);
    });

    it('作成したイベントのレスポンスに location が含まれる', async () => {
      const res = await request(app)
        .post('/api/calendar/events')
        .set('Cookie', `token=${authToken}`)
        .send({
          channelId,
          title: 'Test',
          startsAt: FUTURE_START,
          endsAt: FUTURE_END,
          location: '渋谷オフィス',
        });
      expect(res.status).toBe(201);
      expect(res.body.event).toHaveProperty('location', '渋谷オフィス');
    });
  });

  describe('meeting_url フィールド（新規カラム）', () => {
    it('meeting_url を指定してイベントを作成すると DB に保存される', async () => {
      const res = await request(app)
        .post('/api/calendar/events')
        .set('Cookie', `token=${authToken}`)
        .send({
          channelId,
          title: 'Test',
          startsAt: FUTURE_START,
          endsAt: FUTURE_END,
          meetingUrl: 'https://zoom.us/j/123',
        });
      expect(res.status).toBe(201);
      expect(res.body.event.meetingUrl).toBe('https://zoom.us/j/123');
    });

    it('meeting_url を省略してイベントを作成すると null で保存される', async () => {
      const res = await request(app)
        .post('/api/calendar/events')
        .set('Cookie', `token=${authToken}`)
        .send({ channelId, title: 'Test', startsAt: FUTURE_START, endsAt: FUTURE_END });
      expect(res.status).toBe(201);
      expect(res.body.event.meetingUrl).toBeNull();
    });

    it('meeting_url が null のイベント作成リクエストが 201 を返す', async () => {
      const res = await request(app)
        .post('/api/calendar/events')
        .set('Cookie', `token=${authToken}`)
        .send({
          channelId,
          title: 'Test',
          startsAt: FUTURE_START,
          endsAt: FUTURE_END,
          meetingUrl: null,
        });
      expect(res.status).toBe(201);
    });

    it('作成したイベントのレスポンスに meetingUrl が含まれる', async () => {
      const res = await request(app)
        .post('/api/calendar/events')
        .set('Cookie', `token=${authToken}`)
        .send({
          channelId,
          title: 'Test',
          startsAt: FUTURE_START,
          endsAt: FUTURE_END,
          meetingUrl: 'https://meet.google.com/abc',
        });
      expect(res.status).toBe(201);
      expect(res.body.event).toHaveProperty('meetingUrl', 'https://meet.google.com/abc');
    });
  });

  describe('location と meeting_url の組み合わせ', () => {
    it('location と meeting_url の両方を指定してイベントを作成できる', async () => {
      const res = await request(app)
        .post('/api/calendar/events')
        .set('Cookie', `token=${authToken}`)
        .send({
          channelId,
          title: 'Test',
          startsAt: FUTURE_START,
          endsAt: FUTURE_END,
          location: '会議室B',
          meetingUrl: 'https://zoom.us/j/456',
        });
      expect(res.status).toBe(201);
      expect(res.body.event.location).toBe('会議室B');
      expect(res.body.event.meetingUrl).toBe('https://zoom.us/j/456');
    });

    it('両方省略してもイベントが正常に作成される', async () => {
      const res = await request(app)
        .post('/api/calendar/events')
        .set('Cookie', `token=${authToken}`)
        .send({ channelId, title: 'Test', startsAt: FUTURE_START, endsAt: FUTURE_END });
      expect(res.status).toBe(201);
      expect(res.body.event.location).toBeNull();
      expect(res.body.event.meetingUrl).toBeNull();
    });
  });
});

describe('PATCH /api/calendar/events/:id — location と meeting_url の更新', () => {
  async function createEvent(opts: { location?: string | null; meetingUrl?: string | null } = {}) {
    const res = await request(app)
      .post('/api/calendar/events')
      .set('Cookie', `token=${authToken}`)
      .send({ channelId, title: 'Original', startsAt: FUTURE_START, endsAt: FUTURE_END, ...opts });
    return res.body.event as { id: number };
  }

  describe('location フィールドの更新', () => {
    it('location を新しい値に更新できる', async () => {
      const ev = await createEvent({ location: '旧会議室' });
      const res = await request(app)
        .patch(`/api/calendar/events/${ev.id}`)
        .set('Cookie', `token=${authToken}`)
        .send({ location: '新会議室' });
      expect(res.status).toBe(200);
      expect(res.body.event.location).toBe('新会議室');
    });

    it('location を null に更新（削除）できる', async () => {
      const ev = await createEvent({ location: '会議室A' });
      const res = await request(app)
        .patch(`/api/calendar/events/${ev.id}`)
        .set('Cookie', `token=${authToken}`)
        .send({ location: null });
      expect(res.status).toBe(200);
      expect(res.body.event.location).toBeNull();
    });

    it('location を更新したレスポンスに新しい location が含まれる', async () => {
      const ev = await createEvent();
      const res = await request(app)
        .patch(`/api/calendar/events/${ev.id}`)
        .set('Cookie', `token=${authToken}`)
        .send({ location: '新しい場所' });
      expect(res.body.event).toHaveProperty('location', '新しい場所');
    });
  });

  describe('meeting_url フィールドの更新', () => {
    it('meeting_url を新しい値に更新できる', async () => {
      const ev = await createEvent({ meetingUrl: 'https://zoom.us/j/old' });
      const res = await request(app)
        .patch(`/api/calendar/events/${ev.id}`)
        .set('Cookie', `token=${authToken}`)
        .send({ meetingUrl: 'https://zoom.us/j/new' });
      expect(res.status).toBe(200);
      expect(res.body.event.meetingUrl).toBe('https://zoom.us/j/new');
    });

    it('meeting_url を null に更新（削除）できる', async () => {
      const ev = await createEvent({ meetingUrl: 'https://zoom.us/j/123' });
      const res = await request(app)
        .patch(`/api/calendar/events/${ev.id}`)
        .set('Cookie', `token=${authToken}`)
        .send({ meetingUrl: null });
      expect(res.status).toBe(200);
      expect(res.body.event.meetingUrl).toBeNull();
    });

    it('meeting_url を更新したレスポンスに新しい meetingUrl が含まれる', async () => {
      const ev = await createEvent();
      const res = await request(app)
        .patch(`/api/calendar/events/${ev.id}`)
        .set('Cookie', `token=${authToken}`)
        .send({ meetingUrl: 'https://meet.google.com/xyz' });
      expect(res.body.event).toHaveProperty('meetingUrl', 'https://meet.google.com/xyz');
    });
  });

  describe('権限チェック', () => {
    it('主催者以外のユーザーが meeting_url を更新しようとすると 403 を返す', async () => {
      const ev = await createEvent();
      // 別ユーザーを作成してそのトークンを使う
      const otherUser = await registerUser(app, 'bob', 'bob@t.com');

      const res = await request(app)
        .patch(`/api/calendar/events/${ev.id}`)
        .set('Cookie', `token=${otherUser.token}`)
        .send({ meetingUrl: 'https://zoom.us/j/hacked' });
      expect(res.status).toBe(403);
    });
  });
});

describe('GET /api/calendar/events/:id — location と meeting_url の取得', () => {
  it('location が設定されたイベントを取得するとレスポンスに location が含まれる', async () => {
    const created = await request(app)
      .post('/api/calendar/events')
      .set('Cookie', `token=${authToken}`)
      .send({
        channelId,
        title: 'Test',
        startsAt: FUTURE_START,
        endsAt: FUTURE_END,
        location: '会議室C',
      });
    const id = created.body.event.id as number;

    const res = await request(app)
      .get(`/api/calendar/events/${id}`)
      .set('Cookie', `token=${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.event.location).toBe('会議室C');
  });

  it('meeting_url が設定されたイベントを取得するとレスポンスに meetingUrl が含まれる', async () => {
    const created = await request(app)
      .post('/api/calendar/events')
      .set('Cookie', `token=${authToken}`)
      .send({
        channelId,
        title: 'Test',
        startsAt: FUTURE_START,
        endsAt: FUTURE_END,
        meetingUrl: 'https://zoom.us/j/789',
      });
    const id = created.body.event.id as number;

    const res = await request(app)
      .get(`/api/calendar/events/${id}`)
      .set('Cookie', `token=${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.event.meetingUrl).toBe('https://zoom.us/j/789');
  });

  it('location と meeting_url が両方 null のイベントを正常に取得できる', async () => {
    const created = await request(app)
      .post('/api/calendar/events')
      .set('Cookie', `token=${authToken}`)
      .send({ channelId, title: 'Test', startsAt: FUTURE_START, endsAt: FUTURE_END });
    const id = created.body.event.id as number;

    const res = await request(app)
      .get(`/api/calendar/events/${id}`)
      .set('Cookie', `token=${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.event.location).toBeNull();
    expect(res.body.event.meetingUrl).toBeNull();
  });
});

describe('GET /api/calendar/events — イベント一覧と location・meeting_url', () => {
  it('一覧取得レスポンスの各イベントに location が含まれる', async () => {
    await request(app).post('/api/calendar/events').set('Cookie', `token=${authToken}`).send({
      channelId,
      title: 'Test',
      startsAt: FUTURE_START,
      endsAt: FUTURE_END,
      location: '会議室D',
    });

    const res = await request(app)
      .get('/api/calendar/events')
      .set('Cookie', `token=${authToken}`)
      .query({ from: '2030-01-01T00:00:00Z', to: '2030-12-31T23:59:59Z' });
    expect(res.status).toBe(200);
    expect(res.body.events.length).toBeGreaterThan(0);
    expect(res.body.events[0]).toHaveProperty('location');
  });

  it('一覧取得レスポンスの各イベントに meetingUrl が含まれる', async () => {
    await request(app).post('/api/calendar/events').set('Cookie', `token=${authToken}`).send({
      channelId,
      title: 'Test',
      startsAt: FUTURE_START,
      endsAt: FUTURE_END,
      meetingUrl: 'https://zoom.us/j/list',
    });

    const res = await request(app)
      .get('/api/calendar/events')
      .set('Cookie', `token=${authToken}`)
      .query({ from: '2030-01-01T00:00:00Z', to: '2030-12-31T23:59:59Z' });
    expect(res.status).toBe(200);
    expect(res.body.events.length).toBeGreaterThan(0);
    expect(res.body.events[0]).toHaveProperty('meetingUrl');
  });
});
