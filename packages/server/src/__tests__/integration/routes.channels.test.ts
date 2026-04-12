/**
 * チャンネルルートのインテグレーションテスト
 *
 * テスト対象: /api/channels/* のHTTPルート層全体
 * - 各エンドポイントへの authenticateToken ミドルウェアの適用確認
 * - 権限エラー（403）のエラーハンドラー変換確認
 * - 正常系の基本動作確認
 *
 * DB 戦略: better-sqlite3 のインメモリ DB を使用
 */

import request from 'supertest';
import { createApp } from '../../app';

jest.mock('../../db/database', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const DatabaseLib = require('better-sqlite3') as typeof import('better-sqlite3');
  const db = new DatabaseLib(':memory:');
  db.pragma('foreign_keys = ON');
  const { initializeSchema } =
    jest.requireActual<typeof import('../../db/database')>('../../db/database');
  initializeSchema(db);
  return {
    getDatabase: () => db,
    initializeSchema,
    closeDatabase: jest.fn(),
  };
});

const app = createApp();

/** テスト用ユーザーを登録してCookieとuserIdを返す */
async function registerAndGetCookie(
  username: string,
  email: string,
): Promise<{ cookie: string; userId: number }> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ username, email, password: 'password123' });
  return {
    cookie: res.headers['set-cookie'][0] as string,
    userId: res.body.user.id as number,
  };
}

describe('GET /api/channels', () => {
  it('認証なしで401を返す（認証ガード適用確認）', async () => {
    const res = await request(app).get('/api/channels');
    expect(res.status).toBe(401);
  });

  it('認証済みで200とチャンネル一覧を返す', async () => {
    const { cookie } = await registerAndGetCookie('ch-list-user', 'ch-list@example.com');
    const res = await request(app).get('/api/channels').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.channels)).toBe(true);
  });
});

describe('POST /api/channels', () => {
  it('認証なしで401を返す（認証ガード適用確認）', async () => {
    const res = await request(app).post('/api/channels').send({ name: 'new-channel' });

    expect(res.status).toBe(401);
  });

  it('認証済みでチャンネルを作成すると201を返す', async () => {
    const { cookie } = await registerAndGetCookie('ch-create-user', 'ch-create@example.com');
    const res = await request(app)
      .post('/api/channels')
      .set('Cookie', cookie)
      .send({ name: 'new-channel' });

    expect(res.status).toBe(201);
    expect(res.body.channel).toMatchObject({ name: 'new-channel' });
  });

  it('name 欠損で400を返す', async () => {
    const { cookie } = await registerAndGetCookie('ch-noname-user', 'ch-noname@example.com');
    const res = await request(app).post('/api/channels').set('Cookie', cookie).send({});

    expect(res.status).toBe(400);
  });

  it('重複チャンネル名で409を返す', async () => {
    const { cookie } = await registerAndGetCookie('ch-dup-user', 'ch-dup@example.com');
    await request(app)
      .post('/api/channels')
      .set('Cookie', cookie)
      .send({ name: 'duplicate-channel' });

    const res = await request(app)
      .post('/api/channels')
      .set('Cookie', cookie)
      .send({ name: 'duplicate-channel' });

    expect(res.status).toBe(409);
  });
});

describe('GET /api/channels/:id', () => {
  let authCookie: string;
  let channelId: number;

  beforeAll(async () => {
    const { cookie, userId } = await registerAndGetCookie('ch-get-user', 'ch-get@example.com');
    authCookie = cookie;
    const res = await request(app)
      .post('/api/channels')
      .set('Cookie', cookie)
      .send({ name: `get-channel-${userId}` });
    channelId = res.body.channel.id as number;
  });

  it('認証なしで401を返す（認証ガード適用確認）', async () => {
    const res = await request(app).get(`/api/channels/${channelId}`);
    expect(res.status).toBe(401);
  });

  it('認証済みで200とチャンネルを返す', async () => {
    const res = await request(app).get(`/api/channels/${channelId}`).set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body.channel.id).toBe(channelId);
  });

  it('存在しないIDで404を返す', async () => {
    const res = await request(app).get('/api/channels/99999').set('Cookie', authCookie);

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/channels/:id', () => {
  let ownerCookie: string;
  let otherCookie: string;
  let channelId: number;

  beforeAll(async () => {
    const owner = await registerAndGetCookie('ch-del-owner', 'ch-del-owner@example.com');
    const other = await registerAndGetCookie('ch-del-other', 'ch-del-other@example.com');
    ownerCookie = owner.cookie;
    otherCookie = other.cookie;

    const res = await request(app)
      .post('/api/channels')
      .set('Cookie', owner.cookie)
      .send({ name: `del-channel-${owner.userId}` });
    channelId = res.body.channel.id as number;
  });

  it('認証なしで401を返す（認証ガード適用確認）', async () => {
    const res = await request(app).delete(`/api/channels/${channelId}`);
    expect(res.status).toBe(401);
  });

  it('作成者以外が削除すると403を返す', async () => {
    const res = await request(app).delete(`/api/channels/${channelId}`).set('Cookie', otherCookie);

    expect(res.status).toBe(403);
  });

  it('作成者が削除すると204を返す', async () => {
    const res = await request(app).delete(`/api/channels/${channelId}`).set('Cookie', ownerCookie);

    expect(res.status).toBe(204);
  });
});

describe('POST /api/channels/:id/join', () => {
  let authCookie: string;
  let channelId: number;

  beforeAll(async () => {
    const creator = await registerAndGetCookie('ch-join-creator', 'ch-join-creator@example.com');
    const { cookie } = await registerAndGetCookie('ch-join-user', 'ch-join-user@example.com');
    authCookie = cookie;

    const res = await request(app)
      .post('/api/channels')
      .set('Cookie', creator.cookie)
      .send({ name: `join-channel-${creator.userId}` });
    channelId = res.body.channel.id as number;
  });

  it('認証なしで401を返す（認証ガード適用確認）', async () => {
    const res = await request(app).post(`/api/channels/${channelId}/join`);
    expect(res.status).toBe(401);
  });

  it('認証済みでジョインすると204を返す', async () => {
    const res = await request(app)
      .post(`/api/channels/${channelId}/join`)
      .set('Cookie', authCookie);

    expect(res.status).toBe(204);
  });
});

describe('GET /api/channels/:channelId/messages', () => {
  let authCookie: string;
  let channelId: number;

  beforeAll(async () => {
    const { cookie, userId } = await registerAndGetCookie('ch-msg-user', 'ch-msg@example.com');
    authCookie = cookie;

    const res = await request(app)
      .post('/api/channels')
      .set('Cookie', cookie)
      .send({ name: `msg-channel-${userId}` });
    channelId = res.body.channel.id as number;
  });

  it('認証なしで401を返す（認証ガード適用確認）', async () => {
    const res = await request(app).get(`/api/channels/${channelId}/messages`);
    expect(res.status).toBe(401);
  });

  it('認証済みで200とメッセージ一覧を返す', async () => {
    const res = await request(app)
      .get(`/api/channels/${channelId}/messages`)
      .set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.messages)).toBe(true);
  });
});
