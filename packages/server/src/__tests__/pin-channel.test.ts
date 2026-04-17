/**
 * テスト対象: チャンネルピン留め機能（サーバーサイド）
 * 戦略: pg-mem のインメモリ PostgreSQL 互換 DB を使いサービス層・API層を直接テストする。
 *       pinned_channels テーブルへの CRUD 操作と、ユーザーごとの永続化を検証する。
 */

import { createTestDatabase } from './__fixtures__/pgTestHelper';

const testDb = createTestDatabase();

jest.mock('../db/database', () => testDb);

import request from 'supertest';
import { createApp } from '../app';
import { pinChannel, unpinChannel, getPinnedChannels } from '../services/pinChannelService';
import { registerUser } from './__fixtures__/testHelpers';

let userId1: number;
let userId2: number;
let channelId: number;
let channelId2: number;

const app = createApp();

beforeAll(async () => {
  const r1 = await testDb.execute(
    "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
    ['pcuser1', 'pc1@t.com', 'h'],
  );
  userId1 = r1.rows[0].id as number;

  const r2 = await testDb.execute(
    "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
    ['pcuser2', 'pc2@t.com', 'h'],
  );
  userId2 = r2.rows[0].id as number;

  const rc = await testDb.execute(
    "INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id",
    ['pin-test-channel', userId1],
  );
  channelId = rc.rows[0].id as number;

  const rc2 = await testDb.execute(
    "INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id",
    ['pin-test-channel2', userId1],
  );
  channelId2 = rc2.rows[0].id as number;
});

beforeEach(async () => {
  await testDb.execute('DELETE FROM pinned_channels');
});

describe('ピン留めチャンネル: サービス層', () => {
  describe('pinChannel', () => {
    it('チャンネルをピン留めできる', async () => {
      const pinned = await pinChannel(userId1, channelId);
      expect(pinned.id).toBeDefined();
      expect(pinned.userId).toBe(userId1);
      expect(pinned.channelId).toBe(channelId);
      expect(pinned.createdAt).toBeDefined();
    });

    it('存在しないチャンネルのピン留めはエラーになる', async () => {
      await expect(pinChannel(userId1, 99999)).rejects.toThrow('Channel not found');
    });

    it('同じチャンネルを同じユーザーが二重にピン留めしようとするとエラーになる', async () => {
      await pinChannel(userId1, channelId);
      await expect(pinChannel(userId1, channelId)).rejects.toThrow('Channel is already pinned');
    });
  });

  describe('unpinChannel', () => {
    it('ピン留めを解除できる', async () => {
      await pinChannel(userId1, channelId);
      await expect(unpinChannel(userId1, channelId)).resolves.not.toThrow();
    });

    it('ピン留めされていないチャンネルの解除はエラーになる', async () => {
      await expect(unpinChannel(userId1, channelId)).rejects.toThrow('Pin not found');
    });
  });

  describe('getPinnedChannels', () => {
    it('ユーザーのピン留めチャンネル一覧を返す', async () => {
      await pinChannel(userId1, channelId);
      const list = await getPinnedChannels(userId1);
      expect(list.length).toBe(1);
      expect(list[0].channelId).toBe(channelId);
    });

    it('ピン留めが存在しないユーザーでは空配列を返す', async () => {
      const list = await getPinnedChannels(userId1);
      expect(list).toEqual([]);
    });

    it('ピン留めは created_at の昇順（登録順）で返される', async () => {
      await pinChannel(userId1, channelId);
      await pinChannel(userId1, channelId2);
      const list = await getPinnedChannels(userId1);
      expect(list.length).toBe(2);
      // 先にピン留めしたものが先頭（昇順）
      expect(new Date(list[0].createdAt).getTime()).toBeLessThanOrEqual(
        new Date(list[1].createdAt).getTime(),
      );
    });

    it('別のユーザーのピン留め状態は返さない（ユーザーごとに独立）', async () => {
      await pinChannel(userId1, channelId);
      await pinChannel(userId2, channelId2);
      const list1 = await getPinnedChannels(userId1);
      const list2 = await getPinnedChannels(userId2);
      expect(list1.every((p) => p.userId === userId1)).toBe(true);
      expect(list2.every((p) => p.userId === userId2)).toBe(true);
      expect(list1.length).toBe(1);
      expect(list2.length).toBe(1);
    });
  });
});

describe('REST API: GET /api/channels/pinned', () => {
  it('200 でログインユーザーのピン留めチャンネル一覧を返す', async () => {
    const { token, userId } = await registerUser(app, 'pc_get1', 'pc_get1@example.com');
    const rc = await testDb.execute(
      "INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id",
      ['pc-get-ch', userId],
    );
    const cid = rc.rows[0].id as number;
    await pinChannel(userId, cid);

    const res = await request(app)
      .get('/api/channels/pinned')
      .set('Cookie', `token=${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.pinnedChannels)).toBe(true);
    expect(res.body.pinnedChannels.length).toBe(1);
    expect(res.body.pinnedChannels[0].channelId).toBe(cid);
  });

  it('認証なしで 401 を返す', async () => {
    const res = await request(app).get('/api/channels/pinned');
    expect(res.status).toBe(401);
  });
});

describe('REST API: POST /api/channels/:id/pin', () => {
  it('ピン留め成功で 201 を返す', async () => {
    const { token, userId } = await registerUser(app, 'pc_post1', 'pc_post1@example.com');
    const rc = await testDb.execute(
      "INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id",
      ['pc-post-ch', userId],
    );
    const cid = rc.rows[0].id as number;

    const res = await request(app)
      .post(`/api/channels/${cid}/pin`)
      .set('Cookie', `token=${token}`);
    expect(res.status).toBe(201);
    expect(res.body.pinnedChannel.channelId).toBe(cid);
  });

  it('認証なしで 401 を返す', async () => {
    const res = await request(app).post(`/api/channels/${channelId}/pin`);
    expect(res.status).toBe(401);
  });

  it('存在しないチャンネルIDで 404 を返す', async () => {
    const { token } = await registerUser(app, 'pc_post2', 'pc_post2@example.com');
    const res = await request(app)
      .post('/api/channels/99999/pin')
      .set('Cookie', `token=${token}`);
    expect(res.status).toBe(404);
  });

  it('既にピン留め済みで 409 を返す', async () => {
    const { token, userId } = await registerUser(app, 'pc_post3', 'pc_post3@example.com');
    const rc = await testDb.execute(
      "INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id",
      ['pc-dup-ch', userId],
    );
    const cid = rc.rows[0].id as number;

    await request(app).post(`/api/channels/${cid}/pin`).set('Cookie', `token=${token}`);
    const res = await request(app)
      .post(`/api/channels/${cid}/pin`)
      .set('Cookie', `token=${token}`);
    expect(res.status).toBe(409);
  });
});

describe('REST API: DELETE /api/channels/:id/pin', () => {
  it('ピン留め解除成功で 204 を返す', async () => {
    const { token, userId } = await registerUser(app, 'pc_del1', 'pc_del1@example.com');
    const rc = await testDb.execute(
      "INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id",
      ['pc-del-ch', userId],
    );
    const cid = rc.rows[0].id as number;

    await request(app).post(`/api/channels/${cid}/pin`).set('Cookie', `token=${token}`);
    const res = await request(app)
      .delete(`/api/channels/${cid}/pin`)
      .set('Cookie', `token=${token}`);
    expect(res.status).toBe(204);
  });

  it('認証なしで 401 を返す', async () => {
    const res = await request(app).delete(`/api/channels/${channelId}/pin`);
    expect(res.status).toBe(401);
  });

  it('ピン留めが存在しない場合 404 を返す', async () => {
    const { token } = await registerUser(app, 'pc_del2', 'pc_del2@example.com');
    const res = await request(app)
      .delete(`/api/channels/${channelId}/pin`)
      .set('Cookie', `token=${token}`);
    expect(res.status).toBe(404);
  });
});
