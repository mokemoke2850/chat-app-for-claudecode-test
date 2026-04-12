/**
 * channelController のHTTPレベルテスト
 *
 * テスト対象: packages/server/src/controllers/channelController.ts
 * 戦略: supertest でHTTPリクエストを発行し、レスポンスのステータスコードと
 * レスポンスボディを検証する。DB は better-sqlite3 のインメモリ DBを使用。
 */

import request from 'supertest';
import { createApp } from '../../app';
import { generateToken } from '../../middleware/auth';

jest.mock('../../db/database', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const DatabaseLib = require('better-sqlite3') as typeof import('better-sqlite3');
  const db = new DatabaseLib(':memory:');
  db.pragma('foreign_keys = ON');
  const { initializeSchema: init } =
    jest.requireActual<typeof import('../../db/database')>('../../db/database');
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

describe('POST /api/channels（プライベートチャンネル作成）', () => {
  it('正常: is_private=true を指定すると isPrivate=true のチャンネルが作成される', async () => {
    const { token } = await registerUser('priv_create1', 'priv_create1@example.com');

    const res = await request(app)
      .post('/api/channels')
      .set('Cookie', `token=${token}`)
      .send({ name: 'priv-ch-1', is_private: true });

    expect(res.status).toBe(201);
    expect(res.body.channel.isPrivate).toBe(true);
  });

  it('正常: is_private=true で作成者は channel_members に自動追加される', async () => {
    const { token, userId } = await registerUser('priv_create2', 'priv_create2@example.com');

    const res = await request(app)
      .post('/api/channels')
      .set('Cookie', `token=${token}`)
      .send({ name: 'priv-ch-2', is_private: true });

    expect(res.status).toBe(201);
    const channelId = (res.body as { channel: { id: number } }).channel.id;

    // メンバー一覧エンドポイントで確認
    const membersRes = await request(app)
      .get(`/api/channels/${channelId}/members`)
      .set('Cookie', `token=${token}`);
    expect(membersRes.status).toBe(200);
    expect(
      (membersRes.body as { members: { id: number }[] }).members.some((m) => m.id === userId),
    ).toBe(true);
  });

  it('正常: is_private=true + memberIds を指定すると指定ユーザーもメンバー追加される', async () => {
    const { token } = await registerUser('priv_create3', 'priv_create3@example.com');
    const { userId: memberId } = await registerUser('priv_member3', 'priv_member3@example.com');

    const res = await request(app)
      .post('/api/channels')
      .set('Cookie', `token=${token}`)
      .send({ name: 'priv-ch-3', is_private: true, memberIds: [memberId] });

    expect(res.status).toBe(201);
    const channelId = (res.body as { channel: { id: number } }).channel.id;

    const membersRes = await request(app)
      .get(`/api/channels/${channelId}/members`)
      .set('Cookie', `token=${token}`);
    expect(membersRes.status).toBe(200);
    expect(
      (membersRes.body as { members: { id: number }[] }).members.some((m) => m.id === memberId),
    ).toBe(true);
  });
});

describe('GET /api/channels（プライベートチャンネルのフィルタリング）', () => {
  it('正常: プライベートチャンネルはメンバーのユーザーに返る', async () => {
    const { token: ownerToken } = await registerUser(
      'priv_filter_owner1',
      'priv_filter_owner1@example.com',
    );
    const { token: memberToken, userId: memberId } = await registerUser(
      'priv_filter_member1',
      'priv_filter_member1@example.com',
    );

    const createRes = await request(app)
      .post('/api/channels')
      .set('Cookie', `token=${ownerToken}`)
      .send({ name: 'priv-filter-ch-1', is_private: true, memberIds: [memberId] });
    const channelId = (createRes.body as { channel: { id: number } }).channel.id;

    const res = await request(app).get('/api/channels').set('Cookie', `token=${memberToken}`);

    expect(res.status).toBe(200);
    expect(
      (res.body as { channels: { id: number }[] }).channels.some((c) => c.id === channelId),
    ).toBe(true);
  });

  it('正常: プライベートチャンネルは非メンバーのユーザーに返らない', async () => {
    const { token: ownerToken } = await registerUser(
      'priv_filter_owner2',
      'priv_filter_owner2@example.com',
    );
    const { token: nonMemberToken } = await registerUser(
      'priv_filter_non2',
      'priv_filter_non2@example.com',
    );

    const createRes = await request(app)
      .post('/api/channels')
      .set('Cookie', `token=${ownerToken}`)
      .send({ name: 'priv-filter-ch-2', is_private: true });
    const channelId = (createRes.body as { channel: { id: number } }).channel.id;

    const res = await request(app).get('/api/channels').set('Cookie', `token=${nonMemberToken}`);

    expect(res.status).toBe(200);
    expect(
      (res.body as { channels: { id: number }[] }).channels.some((c) => c.id === channelId),
    ).toBe(false);
  });

  it('正常: 公開チャンネルは全ユーザーに返る', async () => {
    const { token: ownerToken } = await registerUser(
      'pub_filter_owner1',
      'pub_filter_owner1@example.com',
    );
    const { token: otherToken } = await registerUser(
      'pub_filter_other1',
      'pub_filter_other1@example.com',
    );

    const createRes = await request(app)
      .post('/api/channels')
      .set('Cookie', `token=${ownerToken}`)
      .send({ name: 'pub-filter-ch-1' });
    const channelId = (createRes.body as { channel: { id: number } }).channel.id;

    const res = await request(app).get('/api/channels').set('Cookie', `token=${otherToken}`);

    expect(res.status).toBe(200);
    expect(
      (res.body as { channels: { id: number }[] }).channels.some((c) => c.id === channelId),
    ).toBe(true);
  });
});

describe('POST /api/channels/:id/members（メンバー追加）', () => {
  it('正常: チャンネル作成者がメンバーを追加すると 204 が返る', async () => {
    const { token: ownerToken } = await registerUser(
      'add_member_owner1',
      'add_member_owner1@example.com',
    );
    const { userId: newMemberId } = await registerUser(
      'add_member_new1',
      'add_member_new1@example.com',
    );
    const channel = await createChannel(ownerToken, 'add-member-ch-1');

    const res = await request(app)
      .post(`/api/channels/${channel.id}/members`)
      .set('Cookie', `token=${ownerToken}`)
      .send({ userId: newMemberId });

    expect(res.status).toBe(204);
  });

  it('異常: 作成者以外がメンバー追加すると 403 が返る', async () => {
    const { token: ownerToken } = await registerUser(
      'add_member_owner2',
      'add_member_owner2@example.com',
    );
    const { token: otherToken } = await registerUser(
      'add_member_other2',
      'add_member_other2@example.com',
    );
    const { userId: newMemberId } = await registerUser(
      'add_member_new2',
      'add_member_new2@example.com',
    );
    const channel = await createChannel(ownerToken, 'add-member-ch-2');

    const res = await request(app)
      .post(`/api/channels/${channel.id}/members`)
      .set('Cookie', `token=${otherToken}`)
      .send({ userId: newMemberId });

    expect(res.status).toBe(403);
  });

  it('異常: 存在しないチャンネルへのメンバー追加は 404 が返る', async () => {
    const { token } = await registerUser('add_member_owner3', 'add_member_owner3@example.com');
    const { userId: newMemberId } = await registerUser(
      'add_member_new3',
      'add_member_new3@example.com',
    );

    const res = await request(app)
      .post('/api/channels/99999/members')
      .set('Cookie', `token=${token}`)
      .send({ userId: newMemberId });

    expect(res.status).toBe(404);
  });

  it('異常: トークンなしで 401 が返る', async () => {
    const res = await request(app).post('/api/channels/1/members').send({ userId: 1 });

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
