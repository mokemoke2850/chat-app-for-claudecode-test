/**
 * channelController のHTTPレベルテスト
 *
 * テスト対象: packages/server/src/controllers/channelController.ts
 * 戦略: supertest でHTTPリクエストを発行し、レスポンスのステータスコードと
 * レスポンスボディを検証する。DB は better-sqlite3 のインメモリ DBを使用。
 */

import request from 'supertest';
import { createApp } from '../app';
import { generateToken } from '../middleware/auth';

jest.mock('../db/database', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const DatabaseLib = require('better-sqlite3') as typeof import('better-sqlite3');
  const db = new DatabaseLib(':memory:');
  db.pragma('foreign_keys = ON');
  const { initializeSchema: init } =
    jest.requireActual<typeof import('../db/database')>('../db/database');
  init(db);
  return {
    getDatabase: () => db,
    initializeSchema: init,
    closeDatabase: jest.fn(),
  };
});

const app = createApp();

/** テスト用ユーザーを登録して token を返すヘルパー */
async function registerUser(
  username: string,
  email: string,
  password = 'password123',
): Promise<{ token: string; userId: number }> {
  const res = await request(app).post('/api/auth/register').send({ username, email, password });
  const userId = (res.body as { user: { id: number } }).user.id;
  return { token: generateToken(userId, username), userId };
}

/** 認証済みリクエストでチャンネルを作成して返すヘルパー */
async function createChannel(
  token: string,
  name: string,
  description?: string,
): Promise<{ id: number; name: string }> {
  const res = await request(app)
    .post('/api/channels')
    .set('Cookie', `token=${token}`)
    .send({ name, description });
  return (res.body as { channel: { id: number; name: string } }).channel;
}

describe('GET /api/channels', () => {
  it('正常: 全チャンネルのリストが返る', async () => {
    const { token } = await registerUser('ch_list1', 'ch_list1@example.com');
    await createChannel(token, 'ch-list-general');

    const res = await request(app).get('/api/channels').set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.channels)).toBe(true);
    expect(res.body.channels.length).toBeGreaterThan(0);
  });

  it('異常: トークンなしで401が返る', async () => {
    const res = await request(app).get('/api/channels');

    expect(res.status).toBe(401);
  });
});

describe('GET /api/channels/:id', () => {
  it('正常: 指定IDのチャンネルが返る', async () => {
    const { token } = await registerUser('ch_get1', 'ch_get1@example.com');
    const channel = await createChannel(token, 'ch-get-test');

    const res = await request(app)
      .get(`/api/channels/${channel.id}`)
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body.channel.id).toBe(channel.id);
    expect(res.body.channel.name).toBe('ch-get-test');
  });

  it('異常: 存在しないIDで404が返る', async () => {
    const { token } = await registerUser('ch_get2', 'ch_get2@example.com');

    const res = await request(app).get('/api/channels/99999').set('Cookie', `token=${token}`);

    expect(res.status).toBe(404);
  });

  it('異常: トークンなしで401が返る', async () => {
    const res = await request(app).get('/api/channels/1');

    expect(res.status).toBe(401);
  });
});

describe('POST /api/channels', () => {
  it('正常: name を渡すと201でチャンネルが返る', async () => {
    const { token } = await registerUser('ch_create1', 'ch_create1@example.com');

    const res = await request(app)
      .post('/api/channels')
      .set('Cookie', `token=${token}`)
      .send({ name: 'ch-create-test1' });

    expect(res.status).toBe(201);
    expect(res.body.channel.name).toBe('ch-create-test1');
  });

  it('正常: name と description を渡すとチャンネルが作成される', async () => {
    const { token } = await registerUser('ch_create2', 'ch_create2@example.com');

    const res = await request(app)
      .post('/api/channels')
      .set('Cookie', `token=${token}`)
      .send({ name: 'ch-create-test2', description: 'テスト用チャンネル' });

    expect(res.status).toBe(201);
    expect(res.body.channel.description).toBe('テスト用チャンネル');
  });

  it('異常: name が欠けていると400が返る', async () => {
    const { token } = await registerUser('ch_create3', 'ch_create3@example.com');

    const res = await request(app)
      .post('/api/channels')
      .set('Cookie', `token=${token}`)
      .send({ description: 'nameなし' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('異常: トークンなしで401が返る', async () => {
    const res = await request(app).post('/api/channels').send({ name: 'ch-unauthorized' });

    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/channels/:id', () => {
  it('正常: チャンネル作成者が削除すると204が返る', async () => {
    const { token } = await registerUser('ch_del1', 'ch_del1@example.com');
    const channel = await createChannel(token, 'ch-delete-test1');

    const res = await request(app)
      .delete(`/api/channels/${channel.id}`)
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(204);
  });

  it('異常: 作成者以外が削除しようとすると403が返る', async () => {
    const { token: ownerToken } = await registerUser('ch_del2_owner', 'ch_del2_owner@example.com');
    const { token: otherToken } = await registerUser('ch_del2_other', 'ch_del2_other@example.com');
    const channel = await createChannel(ownerToken, 'ch-delete-test2');

    const res = await request(app)
      .delete(`/api/channels/${channel.id}`)
      .set('Cookie', `token=${otherToken}`);

    expect(res.status).toBe(403);
  });

  it('異常: トークンなしで401が返る', async () => {
    const res = await request(app).delete('/api/channels/1');

    expect(res.status).toBe(401);
  });
});

describe('POST /api/channels/:id/join', () => {
  it('正常: チャンネルに参加すると204が返る', async () => {
    const { token: ownerToken } = await registerUser(
      'ch_join1_owner',
      'ch_join1_owner@example.com',
    );
    const { token: memberToken } = await registerUser(
      'ch_join1_member',
      'ch_join1_member@example.com',
    );
    const channel = await createChannel(ownerToken, 'ch-join-test1');

    const res = await request(app)
      .post(`/api/channels/${channel.id}/join`)
      .set('Cookie', `token=${memberToken}`);

    expect(res.status).toBe(204);
  });

  it('異常: トークンなしで401が返る', async () => {
    const res = await request(app).post('/api/channels/1/join');

    expect(res.status).toBe(401);
  });
});
