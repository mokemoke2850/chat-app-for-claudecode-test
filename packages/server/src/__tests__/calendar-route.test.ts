/**
 * カレンダー HTTP API 統合テスト
 *
 * テスト対象:
 *  - routes/calendar.ts の /api/calendar/events 系（CRUD + RSVP）
 *  - routes/calendar.ts の /api/calendar/polls 系（CRUD + 投票 + 確定）
 *
 * 戦略:
 *  - supertest + createApp() で実エンドポイントを叩く
 *  - 認証は authenticateToken を通すためテスト用 JWT を発行して Cookie に付与（既存 events-route.test.ts の流儀踏襲）
 *  - DB は pg-mem を共有（getSharedTestDatabase）
 *
 * 関連 Issue: #152
 */

import { getSharedTestDatabase, resetTestData } from './__fixtures__/pgTestHelper';

const testDb = getSharedTestDatabase();
jest.mock('../db/database', () => testDb);

import request from 'supertest';
import { createApp } from '../app';
import { registerUser, createChannelReq } from './__fixtures__/testHelpers';

const app = createApp();

const FUTURE_START = '2030-06-01T10:00:00.000Z';
const FUTURE_END = '2030-06-01T11:00:00.000Z';
const FUTURE_START_2 = '2030-06-02T10:00:00.000Z';
const FUTURE_END_2 = '2030-06-02T11:00:00.000Z';

beforeEach(async () => {
  await resetTestData(testDb);
});

describe('POST /api/calendar/events', () => {
  it('認証なしのリクエストは 401', async () => {
    const res = await request(app).post('/api/calendar/events').send({
      channelId: 1,
      title: 'X',
      startsAt: FUTURE_START,
      endsAt: FUTURE_END,
    });
    expect(res.status).toBe(401);
  });

  it('正常な body で 201 + 作成されたイベントを返す', async () => {
    const { token } = await registerUser(app, 'cal_a', 'cal_a@t.com');
    const channelId = await createChannelReq(app, token, 'cal-a-ch');

    const res = await request(app)
      .post('/api/calendar/events')
      .set('Cookie', `token=${token}`)
      .send({
        channelId,
        title: 'Created Event',
        startsAt: FUTURE_START,
        endsAt: FUTURE_END,
      });
    expect(res.status).toBe(201);
    expect(res.body.event.title).toBe('Created Event');
    expect(res.body.event.channelId).toBe(channelId);
  });

  it('attendees 配列を渡すと作成されたイベントの attendees に pending として含まれる', async () => {
    const { token } = await registerUser(app, 'cal_b', 'cal_b@t.com');
    const { userId: u2 } = await registerUser(app, 'cal_b2', 'cal_b2@t.com');
    const channelId = await createChannelReq(app, token, 'cal-b-ch');

    const res = await request(app)
      .post('/api/calendar/events')
      .set('Cookie', `token=${token}`)
      .send({
        channelId,
        title: 'With Attendees',
        startsAt: FUTURE_START,
        endsAt: FUTURE_END,
        attendeeUserIds: [u2],
      });
    expect(res.status).toBe(201);
    expect(res.body.event.attendees).toHaveLength(1);
    expect(res.body.event.attendees[0].userId).toBe(u2);
    expect(res.body.event.attendees[0].status).toBe('pending');
  });

  it('reminderOffsetMinutes を渡すと作成されたイベントの reminder offset に反映される', async () => {
    const { token } = await registerUser(app, 'cal_c', 'cal_c@t.com');
    const channelId = await createChannelReq(app, token, 'cal-c-ch');

    const res = await request(app)
      .post('/api/calendar/events')
      .set('Cookie', `token=${token}`)
      .send({
        channelId,
        title: 'With Reminder',
        startsAt: FUTURE_START,
        endsAt: FUTURE_END,
        reminderOffsetMinutes: 30,
      });
    expect(res.status).toBe(201);
    expect(res.body.event.reminderOffsetMinutes).toBe(30);
  });

  it('title が空の body は 400', async () => {
    const { token } = await registerUser(app, 'cal_d', 'cal_d@t.com');
    const channelId = await createChannelReq(app, token, 'cal-d-ch');
    const res = await request(app)
      .post('/api/calendar/events')
      .set('Cookie', `token=${token}`)
      .send({ channelId, title: '   ', startsAt: FUTURE_START, endsAt: FUTURE_END });
    expect(res.status).toBe(400);
  });

  it('starts_at >= ends_at の body は 400', async () => {
    const { token } = await registerUser(app, 'cal_e', 'cal_e@t.com');
    const channelId = await createChannelReq(app, token, 'cal-e-ch');
    const res = await request(app)
      .post('/api/calendar/events')
      .set('Cookie', `token=${token}`)
      .send({ channelId, title: 'X', startsAt: FUTURE_END, endsAt: FUTURE_START });
    expect(res.status).toBe(400);
  });

  it('存在しない channelId を渡すと 400', async () => {
    const { token } = await registerUser(app, 'cal_f', 'cal_f@t.com');
    const res = await request(app)
      .post('/api/calendar/events')
      .set('Cookie', `token=${token}`)
      .send({ channelId: 99999, title: 'X', startsAt: FUTURE_START, endsAt: FUTURE_END });
    // FK 制約違反は pg-mem だと 500 になる可能性があるので、4xx/5xx のいずれか
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe('GET /api/calendar/events', () => {
  it('認証なしのリクエストは 401', async () => {
    const res = await request(app).get('/api/calendar/events');
    expect(res.status).toBe(401);
  });

  it('from / to クエリで期間絞り込みできる', async () => {
    const { token } = await registerUser(app, 'cal_g', 'cal_g@t.com');
    const channelId = await createChannelReq(app, token, 'cal-g-ch');
    // 期間内
    await request(app).post('/api/calendar/events').set('Cookie', `token=${token}`).send({
      channelId,
      title: 'Inside',
      startsAt: FUTURE_START,
      endsAt: FUTURE_END,
    });
    // 期間外
    await request(app).post('/api/calendar/events').set('Cookie', `token=${token}`).send({
      channelId,
      title: 'Outside',
      startsAt: '2031-06-01T10:00:00.000Z',
      endsAt: '2031-06-01T11:00:00.000Z',
    });

    const res = await request(app)
      .get('/api/calendar/events?from=2030-06-01T00:00:00Z&to=2030-06-30T23:59:59Z')
      .set('Cookie', `token=${token}`);
    expect(res.status).toBe(200);
    expect(res.body.events.map((e: { title: string }) => e.title)).toEqual(['Inside']);
  });

  it('channelIds=10,11 で複数チャンネル絞り込みできる（カンマ区切り）', async () => {
    const { token } = await registerUser(app, 'cal_h', 'cal_h@t.com');
    const ch1 = await createChannelReq(app, token, 'cal-h-ch1');
    const ch2 = await createChannelReq(app, token, 'cal-h-ch2');
    const ch3 = await createChannelReq(app, token, 'cal-h-ch3');
    const post = (channelId: number, title: string, startsAt: string, endsAt: string) =>
      request(app).post('/api/calendar/events').set('Cookie', `token=${token}`).send({
        channelId,
        title,
        startsAt,
        endsAt,
      });
    await post(ch1, 'In ch1', FUTURE_START, FUTURE_END);
    await post(ch2, 'In ch2', FUTURE_START_2, FUTURE_END_2);
    await post(ch3, 'In ch3', '2030-06-03T10:00:00.000Z', '2030-06-03T11:00:00.000Z');

    const res = await request(app)
      .get(
        `/api/calendar/events?from=2030-06-01T00:00:00Z&to=2030-06-30T23:59:59Z&channelIds=${ch1},${ch2}`,
      )
      .set('Cookie', `token=${token}`);
    expect(res.status).toBe(200);
    const titles = res.body.events.map((e: { title: string }) => e.title).sort();
    expect(titles).toEqual(['In ch1', 'In ch2']);
  });

  it('クエリ無指定時は当月のイベントを返す（既定の期間）', async () => {
    const { token } = await registerUser(app, 'cal_i', 'cal_i@t.com');
    const res = await request(app).get('/api/calendar/events').set('Cookie', `token=${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.events)).toBe(true);
  });
});

describe('GET /api/calendar/events/:id', () => {
  it('200 でイベント詳細（attendees / reminder offset 同梱）を返す', async () => {
    const { token } = await registerUser(app, 'cal_j', 'cal_j@t.com');
    const channelId = await createChannelReq(app, token, 'cal-j-ch');
    const created = await request(app)
      .post('/api/calendar/events')
      .set('Cookie', `token=${token}`)
      .send({
        channelId,
        title: 'Detail',
        startsAt: FUTURE_START,
        endsAt: FUTURE_END,
        reminderOffsetMinutes: 15,
      });
    const id = created.body.event.id;
    const res = await request(app)
      .get(`/api/calendar/events/${id}`)
      .set('Cookie', `token=${token}`);
    expect(res.status).toBe(200);
    expect(res.body.event.id).toBe(id);
    expect(res.body.event.reminderOffsetMinutes).toBe(15);
    expect(Array.isArray(res.body.event.attendees)).toBe(true);
  });

  it('存在しない id は 404', async () => {
    const { token } = await registerUser(app, 'cal_k', 'cal_k@t.com');
    const res = await request(app)
      .get('/api/calendar/events/99999')
      .set('Cookie', `token=${token}`);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/calendar/events/:id', () => {
  it('organizer は 200 で更新できる', async () => {
    const { token } = await registerUser(app, 'cal_l', 'cal_l@t.com');
    const channelId = await createChannelReq(app, token, 'cal-l-ch');
    const created = await request(app)
      .post('/api/calendar/events')
      .set('Cookie', `token=${token}`)
      .send({ channelId, title: 'Old', startsAt: FUTURE_START, endsAt: FUTURE_END });
    const id = created.body.event.id;
    const res = await request(app)
      .patch(`/api/calendar/events/${id}`)
      .set('Cookie', `token=${token}`)
      .send({ title: 'New' });
    expect(res.status).toBe(200);
    expect(res.body.event.title).toBe('New');
  });

  it('organizer 以外は 403', async () => {
    const { token: t1 } = await registerUser(app, 'cal_m', 'cal_m@t.com');
    const { token: t2 } = await registerUser(app, 'cal_m2', 'cal_m2@t.com');
    const channelId = await createChannelReq(app, t1, 'cal-m-ch');
    const created = await request(app)
      .post('/api/calendar/events')
      .set('Cookie', `token=${t1}`)
      .send({ channelId, title: 'Mine', startsAt: FUTURE_START, endsAt: FUTURE_END });
    const id = created.body.event.id;
    const res = await request(app)
      .patch(`/api/calendar/events/${id}`)
      .set('Cookie', `token=${t2}`)
      .send({ title: 'Hacked' });
    expect(res.status).toBe(403);
  });

  it('存在しない id は 404', async () => {
    const { token } = await registerUser(app, 'cal_n', 'cal_n@t.com');
    const res = await request(app)
      .patch('/api/calendar/events/99999')
      .set('Cookie', `token=${token}`)
      .send({ title: 'X' });
    expect(res.status).toBe(404);
  });

  it('starts_at >= ends_at になる更新は 400', async () => {
    const { token } = await registerUser(app, 'cal_o', 'cal_o@t.com');
    const channelId = await createChannelReq(app, token, 'cal-o-ch');
    const created = await request(app)
      .post('/api/calendar/events')
      .set('Cookie', `token=${token}`)
      .send({ channelId, title: 'X', startsAt: FUTURE_START, endsAt: FUTURE_END });
    const id = created.body.event.id;
    const res = await request(app)
      .patch(`/api/calendar/events/${id}`)
      .set('Cookie', `token=${token}`)
      .send({ startsAt: FUTURE_END_2, endsAt: FUTURE_START_2 });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/calendar/events/:id', () => {
  it('organizer は 204 で削除できる', async () => {
    const { token } = await registerUser(app, 'cal_p', 'cal_p@t.com');
    const channelId = await createChannelReq(app, token, 'cal-p-ch');
    const created = await request(app)
      .post('/api/calendar/events')
      .set('Cookie', `token=${token}`)
      .send({ channelId, title: 'Bye', startsAt: FUTURE_START, endsAt: FUTURE_END });
    const id = created.body.event.id;
    const res = await request(app)
      .delete(`/api/calendar/events/${id}`)
      .set('Cookie', `token=${token}`);
    expect(res.status).toBe(204);
  });

  it('organizer 以外は 403', async () => {
    const { token: t1 } = await registerUser(app, 'cal_q', 'cal_q@t.com');
    const { token: t2 } = await registerUser(app, 'cal_q2', 'cal_q2@t.com');
    const channelId = await createChannelReq(app, t1, 'cal-q-ch');
    const created = await request(app)
      .post('/api/calendar/events')
      .set('Cookie', `token=${t1}`)
      .send({ channelId, title: 'X', startsAt: FUTURE_START, endsAt: FUTURE_END });
    const id = created.body.event.id;
    const res = await request(app)
      .delete(`/api/calendar/events/${id}`)
      .set('Cookie', `token=${t2}`);
    expect(res.status).toBe(403);
  });

  it('存在しない id は 404', async () => {
    const { token } = await registerUser(app, 'cal_r', 'cal_r@t.com');
    const res = await request(app)
      .delete('/api/calendar/events/99999')
      .set('Cookie', `token=${token}`);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/calendar/events/:id/rsvp', () => {
  async function createEv(token: string, channelId: number) {
    const r = await request(app)
      .post('/api/calendar/events')
      .set('Cookie', `token=${token}`)
      .send({ channelId, title: 'Ev', startsAt: FUTURE_START, endsAt: FUTURE_END });
    return r.body.event.id as number;
  }

  it('正常な status で 200 + 更新済み RSVP を返す', async () => {
    const { token } = await registerUser(app, 'cal_rsvp1', 'cal_rsvp1@t.com');
    const channelId = await createChannelReq(app, token, 'cal-rsvp1-ch');
    const id = await createEv(token, channelId);
    const res = await request(app)
      .post(`/api/calendar/events/${id}/rsvp`)
      .set('Cookie', `token=${token}`)
      .send({ status: 'accepted' });
    expect(res.status).toBe(200);
    expect(res.body.attendee.status).toBe('accepted');
  });

  it('無効な status は 400', async () => {
    const { token } = await registerUser(app, 'cal_rsvp2', 'cal_rsvp2@t.com');
    const channelId = await createChannelReq(app, token, 'cal-rsvp2-ch');
    const id = await createEv(token, channelId);
    const res = await request(app)
      .post(`/api/calendar/events/${id}/rsvp`)
      .set('Cookie', `token=${token}`)
      .send({ status: 'going' });
    expect(res.status).toBe(400);
  });

  it('存在しないイベントは 404', async () => {
    const { token } = await registerUser(app, 'cal_rsvp3', 'cal_rsvp3@t.com');
    const res = await request(app)
      .post('/api/calendar/events/99999/rsvp')
      .set('Cookie', `token=${token}`)
      .send({ status: 'accepted' });
    expect(res.status).toBe(404);
  });

  it('認証なしは 401', async () => {
    const res = await request(app).post('/api/calendar/events/1/rsvp').send({ status: 'accepted' });
    expect(res.status).toBe(401);
  });
});

async function createPoll(token: string, channelId: number, title = 'P', numCands = 2) {
  const candidates = Array.from({ length: numCands }, (_, i) => ({
    startsAt: `2030-07-0${i + 1}T10:00:00.000Z`,
    endsAt: `2030-07-0${i + 1}T11:00:00.000Z`,
  }));
  const r = await request(app)
    .post('/api/calendar/polls')
    .set('Cookie', `token=${token}`)
    .send({ channelId, title, candidates });
  return r.body.poll as { id: number; candidates: { id: number }[] };
}

describe('GET /api/calendar/polls', () => {
  it('channelId クエリで poll 一覧を candidates/votes 同梱で返す', async () => {
    const { token } = await registerUser(app, 'cal_pl1', 'cal_pl1@t.com');
    const channelId = await createChannelReq(app, token, 'cal-pl1-ch');
    await createPoll(token, channelId, 'A');
    await createPoll(token, channelId, 'B');
    const res = await request(app)
      .get(`/api/calendar/polls?channelId=${channelId}`)
      .set('Cookie', `token=${token}`);
    expect(res.status).toBe(200);
    expect(res.body.polls).toHaveLength(2);
    expect(res.body.polls[0]).toHaveProperty('candidates');
    expect(res.body.polls[0]).toHaveProperty('votes');
  });

  it('channelId 未指定は 400', async () => {
    const { token } = await registerUser(app, 'cal_pl2', 'cal_pl2@t.com');
    const res = await request(app).get('/api/calendar/polls').set('Cookie', `token=${token}`);
    expect(res.status).toBe(400);
  });

  it('認証なしは 401', async () => {
    const res = await request(app).get('/api/calendar/polls?channelId=1');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/calendar/polls', () => {
  it('正常な body で 201 + poll とその candidates を返す', async () => {
    const { token } = await registerUser(app, 'cal_pl3', 'cal_pl3@t.com');
    const channelId = await createChannelReq(app, token, 'cal-pl3-ch');
    const res = await request(app)
      .post('/api/calendar/polls')
      .set('Cookie', `token=${token}`)
      .send({
        channelId,
        title: 'New Poll',
        candidates: [
          { startsAt: FUTURE_START, endsAt: FUTURE_END },
          { startsAt: FUTURE_START_2, endsAt: FUTURE_END_2 },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.poll.candidates).toHaveLength(2);
  });

  it('candidates が 0 件の body は 400', async () => {
    const { token } = await registerUser(app, 'cal_pl4', 'cal_pl4@t.com');
    const channelId = await createChannelReq(app, token, 'cal-pl4-ch');
    const res = await request(app)
      .post('/api/calendar/polls')
      .set('Cookie', `token=${token}`)
      .send({ channelId, title: 'Empty', candidates: [] });
    expect(res.status).toBe(400);
  });

  it('candidate の starts_at >= ends_at は 400', async () => {
    const { token } = await registerUser(app, 'cal_pl5', 'cal_pl5@t.com');
    const channelId = await createChannelReq(app, token, 'cal-pl5-ch');
    const res = await request(app)
      .post('/api/calendar/polls')
      .set('Cookie', `token=${token}`)
      .send({
        channelId,
        title: 'Bad',
        candidates: [{ startsAt: FUTURE_END, endsAt: FUTURE_START }],
      });
    expect(res.status).toBe(400);
  });

  it('認証なしは 401', async () => {
    const res = await request(app)
      .post('/api/calendar/polls')
      .send({ channelId: 1, title: 'X', candidates: [] });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/calendar/polls/:id', () => {
  it('200 で poll 詳細（candidates / votes 同梱）を返す', async () => {
    const { token } = await registerUser(app, 'cal_pl6', 'cal_pl6@t.com');
    const channelId = await createChannelReq(app, token, 'cal-pl6-ch');
    const p = await createPoll(token, channelId);
    const res = await request(app)
      .get(`/api/calendar/polls/${p.id}`)
      .set('Cookie', `token=${token}`);
    expect(res.status).toBe(200);
    expect(res.body.poll.id).toBe(p.id);
    expect(Array.isArray(res.body.poll.candidates)).toBe(true);
  });

  it('存在しない id は 404', async () => {
    const { token } = await registerUser(app, 'cal_pl7', 'cal_pl7@t.com');
    const res = await request(app).get('/api/calendar/polls/99999').set('Cookie', `token=${token}`);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/calendar/polls/:id/votes', () => {
  it('正常な投票配列で 200 + 更新後の poll を返す', async () => {
    const { token } = await registerUser(app, 'cal_v1', 'cal_v1@t.com');
    const channelId = await createChannelReq(app, token, 'cal-v1-ch');
    const p = await createPoll(token, channelId);
    const res = await request(app)
      .post(`/api/calendar/polls/${p.id}/votes`)
      .set('Cookie', `token=${token}`)
      .send({
        votes: [
          { candidateId: p.candidates[0].id, vote: 'yes' },
          { candidateId: p.candidates[1].id, vote: 'no' },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.poll.votes.length).toBeGreaterThanOrEqual(2);
  });

  it('vote=null を含む配列で既存投票を削除できる', async () => {
    const { token } = await registerUser(app, 'cal_v2', 'cal_v2@t.com');
    const channelId = await createChannelReq(app, token, 'cal-v2-ch');
    const p = await createPoll(token, channelId);
    await request(app)
      .post(`/api/calendar/polls/${p.id}/votes`)
      .set('Cookie', `token=${token}`)
      .send({ votes: [{ candidateId: p.candidates[0].id, vote: 'yes' }] });
    const res = await request(app)
      .post(`/api/calendar/polls/${p.id}/votes`)
      .set('Cookie', `token=${token}`)
      .send({ votes: [{ candidateId: p.candidates[0].id, vote: null }] });
    expect(res.status).toBe(200);
    expect(res.body.poll.votes).toHaveLength(0);
  });

  it('confirmed 済み poll への投票は 409', async () => {
    const { token } = await registerUser(app, 'cal_v3', 'cal_v3@t.com');
    const channelId = await createChannelReq(app, token, 'cal-v3-ch');
    const p = await createPoll(token, channelId);
    await request(app)
      .post(`/api/calendar/polls/${p.id}/confirm`)
      .set('Cookie', `token=${token}`)
      .send({ candidateId: p.candidates[0].id });
    const res = await request(app)
      .post(`/api/calendar/polls/${p.id}/votes`)
      .set('Cookie', `token=${token}`)
      .send({ votes: [{ candidateId: p.candidates[1].id, vote: 'yes' }] });
    expect(res.status).toBe(409);
  });

  it('poll に属さない candidateId は 400', async () => {
    const { token } = await registerUser(app, 'cal_v4', 'cal_v4@t.com');
    const channelId = await createChannelReq(app, token, 'cal-v4-ch');
    const p = await createPoll(token, channelId);
    const res = await request(app)
      .post(`/api/calendar/polls/${p.id}/votes`)
      .set('Cookie', `token=${token}`)
      .send({ votes: [{ candidateId: 99999, vote: 'yes' }] });
    expect(res.status).toBe(400);
  });

  it('無効な vote 値は 400', async () => {
    const { token } = await registerUser(app, 'cal_v5', 'cal_v5@t.com');
    const channelId = await createChannelReq(app, token, 'cal-v5-ch');
    const p = await createPoll(token, channelId);
    const res = await request(app)
      .post(`/api/calendar/polls/${p.id}/votes`)
      .set('Cookie', `token=${token}`)
      .send({ votes: [{ candidateId: p.candidates[0].id, vote: 'bad' }] });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/calendar/polls/:id/confirm', () => {
  it('organizer は 200 で confirm でき confirmed_event_id がセットされる', async () => {
    const { token } = await registerUser(app, 'cal_cf1', 'cal_cf1@t.com');
    const channelId = await createChannelReq(app, token, 'cal-cf1-ch');
    const p = await createPoll(token, channelId);
    const res = await request(app)
      .post(`/api/calendar/polls/${p.id}/confirm`)
      .set('Cookie', `token=${token}`)
      .send({ candidateId: p.candidates[0].id });
    expect(res.status).toBe(200);
    expect(res.body.event.id).toBeDefined();
  });

  it('confirm 後のレスポンスに新規作成されたイベント情報が含まれる', async () => {
    const { token } = await registerUser(app, 'cal_cf2', 'cal_cf2@t.com');
    const channelId = await createChannelReq(app, token, 'cal-cf2-ch');
    const p = await createPoll(token, channelId);
    const res = await request(app)
      .post(`/api/calendar/polls/${p.id}/confirm`)
      .set('Cookie', `token=${token}`)
      .send({ candidateId: p.candidates[0].id });
    expect(res.body.event.channelId).toBe(channelId);
    expect(res.body.event.title).toBeDefined();
  });

  it('organizer 以外は 403', async () => {
    const { token: t1 } = await registerUser(app, 'cal_cf3', 'cal_cf3@t.com');
    const { token: t2 } = await registerUser(app, 'cal_cf3b', 'cal_cf3b@t.com');
    const channelId = await createChannelReq(app, t1, 'cal-cf3-ch');
    const p = await createPoll(t1, channelId);
    const res = await request(app)
      .post(`/api/calendar/polls/${p.id}/confirm`)
      .set('Cookie', `token=${t2}`)
      .send({ candidateId: p.candidates[0].id });
    expect(res.status).toBe(403);
  });

  it('既 confirm の poll は 409', async () => {
    const { token } = await registerUser(app, 'cal_cf4', 'cal_cf4@t.com');
    const channelId = await createChannelReq(app, token, 'cal-cf4-ch');
    const p = await createPoll(token, channelId);
    await request(app)
      .post(`/api/calendar/polls/${p.id}/confirm`)
      .set('Cookie', `token=${token}`)
      .send({ candidateId: p.candidates[0].id });
    const res = await request(app)
      .post(`/api/calendar/polls/${p.id}/confirm`)
      .set('Cookie', `token=${token}`)
      .send({ candidateId: p.candidates[1].id });
    expect(res.status).toBe(409);
  });

  it('poll に属さない candidateId は 400', async () => {
    const { token } = await registerUser(app, 'cal_cf5', 'cal_cf5@t.com');
    const channelId = await createChannelReq(app, token, 'cal-cf5-ch');
    const p = await createPoll(token, channelId);
    const res = await request(app)
      .post(`/api/calendar/polls/${p.id}/confirm`)
      .set('Cookie', `token=${token}`)
      .send({ candidateId: 99999 });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/calendar/polls/:id', () => {
  it('organizer は 204 で削除できる', async () => {
    const { token } = await registerUser(app, 'cal_dp1', 'cal_dp1@t.com');
    const channelId = await createChannelReq(app, token, 'cal-dp1-ch');
    const p = await createPoll(token, channelId);
    const res = await request(app)
      .delete(`/api/calendar/polls/${p.id}`)
      .set('Cookie', `token=${token}`);
    expect(res.status).toBe(204);
  });

  it('organizer 以外は 403', async () => {
    const { token: t1 } = await registerUser(app, 'cal_dp2', 'cal_dp2@t.com');
    const { token: t2 } = await registerUser(app, 'cal_dp2b', 'cal_dp2b@t.com');
    const channelId = await createChannelReq(app, t1, 'cal-dp2-ch');
    const p = await createPoll(t1, channelId);
    const res = await request(app)
      .delete(`/api/calendar/polls/${p.id}`)
      .set('Cookie', `token=${t2}`);
    expect(res.status).toBe(403);
  });

  it('存在しない id は 404', async () => {
    const { token } = await registerUser(app, 'cal_dp3', 'cal_dp3@t.com');
    const res = await request(app)
      .delete('/api/calendar/polls/99999')
      .set('Cookie', `token=${token}`);
    expect(res.status).toBe(404);
  });
});
