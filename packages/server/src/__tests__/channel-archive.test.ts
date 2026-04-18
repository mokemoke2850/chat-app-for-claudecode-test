/**
 * チャンネルアーカイブ機能のサーバーサイドテスト
 *
 * テスト対象:
 *   - channelService: archiveChannel / unarchiveChannel / getArchivedChannels
 *   - channelController: PATCH /api/channels/:id/archive, DELETE /api/channels/:id/archive
 *                        GET /api/channels/archived
 *   - messageController: アーカイブ済みチャンネルへのメッセージ送信禁止
 *
 * 戦略: pg-mem のインメモリ PostgreSQL 互換 DB を使い、
 *       サービス層直接呼び出しと supertest HTTP テストを組み合わせて検証する。
 *       channels テーブルに is_archived カラムが追加されることを前提とする。
 */

import { getSharedTestDatabase, resetTestData } from './__fixtures__/pgTestHelper';

const testDb = getSharedTestDatabase();

jest.mock('../db/database', () => testDb);

import request from 'supertest';
import { createApp } from '../app';
import { registerUser, createChannelReq, insertMessage } from './__fixtures__/testHelpers';
import * as channelService from '../services/channelService';

const app = createApp();

// ---------------------------------------------------------------------------
// サービス層テスト
// ---------------------------------------------------------------------------

describe('チャンネルアーカイブ: サービス層', () => {
  beforeEach(async () => {
    await resetTestData(testDb);
  });

  describe('archiveChannel', () => {
    it('チャンネルをアーカイブすると is_archived が true になる', async () => {
      const { userId } = await registerUser(app, 'user1', 'user1@example.com');
      const channelId = await createChannelViaService('ch-archive-1', userId);

      await channelService.archiveChannel(channelId, userId, false);

      const channel = await channelService.getChannelById(channelId);
      expect(channel?.isArchived).toBe(true);
    });

    it('存在しないチャンネルのアーカイブはエラーになる（404相当）', async () => {
      const { userId } = await registerUser(app, 'user1', 'user1@example.com');

      await expect(channelService.archiveChannel(99999, userId, false)).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('作成者以外によるアーカイブはエラーになる（403相当）', async () => {
      const { userId: owner } = await registerUser(app, 'owner1', 'owner1@example.com');
      const { userId: other } = await registerUser(app, 'other1', 'other1@example.com');
      const channelId = await createChannelViaService('ch-archive-2', owner);

      await expect(channelService.archiveChannel(channelId, other, false)).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it('既にアーカイブ済みのチャンネルを再度アーカイブしようとするとエラーになる', async () => {
      const { userId } = await registerUser(app, 'user1', 'user1@example.com');
      const channelId = await createChannelViaService('ch-archive-3', userId);

      await channelService.archiveChannel(channelId, userId, false);

      await expect(channelService.archiveChannel(channelId, userId, false)).rejects.toMatchObject({
        statusCode: 409,
      });
    });

    it('管理者（admin）は他者が作成したチャンネルもアーカイブできる', async () => {
      const { userId: owner } = await registerUser(app, 'owner2', 'owner2@example.com');
      const { userId: adminId } = await registerUser(app, 'admin1', 'admin1@example.com');
      await testDb.execute("UPDATE users SET role = 'admin' WHERE id = $1", [adminId]);

      const channelId = await createChannelViaService('ch-archive-4', owner);

      await expect(channelService.archiveChannel(channelId, adminId, true)).resolves.not.toThrow();

      const channel = await channelService.getChannelById(channelId);
      expect(channel?.isArchived).toBe(true);
    });
  });

  describe('unarchiveChannel（アーカイブ解除）', () => {
    it('アーカイブ済みチャンネルを解除すると is_archived が false になる', async () => {
      const { userId } = await registerUser(app, 'user1', 'user1@example.com');
      const channelId = await createChannelViaService('ch-unarchive-1', userId);

      await channelService.archiveChannel(channelId, userId, false);
      await channelService.unarchiveChannel(channelId, userId, false);

      const channel = await channelService.getChannelById(channelId);
      expect(channel?.isArchived).toBe(false);
    });

    it('アーカイブされていないチャンネルの解除はエラーになる', async () => {
      const { userId } = await registerUser(app, 'user1', 'user1@example.com');
      const channelId = await createChannelViaService('ch-unarchive-2', userId);

      await expect(channelService.unarchiveChannel(channelId, userId, false)).rejects.toMatchObject({
        statusCode: 409,
      });
    });

    it('作成者以外によるアーカイブ解除はエラーになる（403相当）', async () => {
      const { userId: owner } = await registerUser(app, 'owner3', 'owner3@example.com');
      const { userId: other } = await registerUser(app, 'other2', 'other2@example.com');
      const channelId = await createChannelViaService('ch-unarchive-3', owner);

      await channelService.archiveChannel(channelId, owner, false);

      await expect(channelService.unarchiveChannel(channelId, other, false)).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it('管理者（admin）は他者が作成したチャンネルもアーカイブ解除できる', async () => {
      const { userId: owner } = await registerUser(app, 'owner4', 'owner4@example.com');
      const { userId: adminId } = await registerUser(app, 'admin2', 'admin2@example.com');
      await testDb.execute("UPDATE users SET role = 'admin' WHERE id = $1", [adminId]);

      const channelId = await createChannelViaService('ch-unarchive-4', owner);
      await channelService.archiveChannel(channelId, owner, false);

      await expect(channelService.unarchiveChannel(channelId, adminId, true)).resolves.not.toThrow();

      const channel = await channelService.getChannelById(channelId);
      expect(channel?.isArchived).toBe(false);
    });
  });

  describe('getChannelsForUser（アーカイブ済みの除外）', () => {
    it('アーカイブ済みチャンネルは通常の一覧に含まれない', async () => {
      const { userId } = await registerUser(app, 'user1', 'user1@example.com');
      const channelId = await createChannelViaService('ch-list-1', userId);

      await channelService.archiveChannel(channelId, userId, false);

      const channels = await channelService.getChannelsForUser(userId);
      expect(channels.find((ch) => ch.id === channelId)).toBeUndefined();
    });

    it('アーカイブされていないチャンネルは通常の一覧に含まれる', async () => {
      const { userId } = await registerUser(app, 'user1', 'user1@example.com');
      const channelId = await createChannelViaService('ch-list-2', userId);

      const channels = await channelService.getChannelsForUser(userId);
      expect(channels.find((ch) => ch.id === channelId)).toBeDefined();
    });

    it('複数チャンネルが混在する場合、アーカイブ済みのみが除外される', async () => {
      const { userId } = await registerUser(app, 'user1', 'user1@example.com');
      const archivedId = await createChannelViaService('ch-list-archived', userId);
      const activeId = await createChannelViaService('ch-list-active', userId);

      await channelService.archiveChannel(archivedId, userId, false);

      const channels = await channelService.getChannelsForUser(userId);
      expect(channels.find((ch) => ch.id === archivedId)).toBeUndefined();
      expect(channels.find((ch) => ch.id === activeId)).toBeDefined();
    });
  });

  describe('getArchivedChannels（アーカイブ一覧取得）', () => {
    it('アーカイブ済みチャンネルの一覧を返す', async () => {
      const { userId } = await registerUser(app, 'user1', 'user1@example.com');
      const channelId = await createChannelViaService('ch-archived-1', userId);

      await channelService.archiveChannel(channelId, userId, false);

      const archived = await channelService.getArchivedChannels(userId);
      expect(archived.find((ch) => ch.id === channelId)).toBeDefined();
    });

    it('アーカイブ済みが存在しない場合は空配列を返す', async () => {
      const { userId } = await registerUser(app, 'user1', 'user1@example.com');

      const archived = await channelService.getArchivedChannels(userId);
      expect(archived).toEqual([]);
    });

    it('非アーカイブのチャンネルはアーカイブ一覧に含まれない', async () => {
      const { userId } = await registerUser(app, 'user1', 'user1@example.com');
      const activeId = await createChannelViaService('ch-archived-active', userId);

      const archived = await channelService.getArchivedChannels(userId);
      expect(archived.find((ch) => ch.id === activeId)).toBeUndefined();
    });

    it('アーカイブ一覧は名前の昇順で返される', async () => {
      const { userId } = await registerUser(app, 'user1', 'user1@example.com');
      const idZ = await createChannelViaService('ch-z-archived', userId);
      const idA = await createChannelViaService('ch-a-archived', userId);

      await channelService.archiveChannel(idZ, userId, false);
      await channelService.archiveChannel(idA, userId, false);

      const archived = await channelService.getArchivedChannels(userId);
      const names = archived.map((ch) => ch.name);
      expect(names).toEqual([...names].sort());
    });

    it('プライベートチャンネルはメンバーのみがアーカイブ一覧で参照できる', async () => {
      const { userId: owner } = await registerUser(app, 'owner5', 'owner5@example.com');
      const { userId: nonMember } = await registerUser(app, 'nonmember1', 'nonmember1@example.com');

      const row = await testDb.queryOne<{ id: number }>(
        "INSERT INTO channels (name, created_by, is_private) VALUES ('ch-private-archived', $1, true) RETURNING id",
        [owner],
      );
      const privateChannelId = row!.id;
      await testDb.execute(
        'INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2)',
        [privateChannelId, owner],
      );
      await testDb.execute(
        'UPDATE channels SET is_archived = true WHERE id = $1',
        [privateChannelId],
      );

      const memberArchived = await channelService.getArchivedChannels(owner);
      const nonMemberArchived = await channelService.getArchivedChannels(nonMember);

      expect(memberArchived.find((ch) => ch.id === privateChannelId)).toBeDefined();
      expect(nonMemberArchived.find((ch) => ch.id === privateChannelId)).toBeUndefined();
    });
  });
});

// ---------------------------------------------------------------------------
// REST API 統合テスト: アーカイブ操作エンドポイント
// ---------------------------------------------------------------------------

describe('REST API: PATCH /api/channels/:id/archive（アーカイブ）', () => {
  beforeEach(async () => {
    await resetTestData(testDb);
  });

  it('チャンネル作成者がアーカイブすると 200 とアーカイブ済みチャンネルが返る', async () => {
    const { token } = await registerUser(app, 'user1', 'user1@example.com');
    const channelId = await createChannelReq(app, token, 'ch-api-archive-1');

    const res = await request(app)
      .patch(`/api/channels/${channelId}/archive`)
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body.channel.isArchived).toBe(true);
  });

  it('認証なしで 401 を返す', async () => {
    const res = await request(app).patch('/api/channels/1/archive');
    expect(res.status).toBe(401);
  });

  it('存在しないチャンネルIDで 404 を返す', async () => {
    const { token } = await registerUser(app, 'user1', 'user1@example.com');

    const res = await request(app)
      .patch('/api/channels/99999/archive')
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(404);
  });

  it('作成者以外がアーカイブしようとすると 403 を返す', async () => {
    const { token: ownerToken } = await registerUser(app, 'owner1', 'owner1@example.com');
    const { token: otherToken } = await registerUser(app, 'other1', 'other1@example.com');

    const channelId = await createChannelReq(app, ownerToken, 'ch-api-archive-2');

    const res = await request(app)
      .patch(`/api/channels/${channelId}/archive`)
      .set('Cookie', `token=${otherToken}`);

    expect(res.status).toBe(403);
  });

  it('既にアーカイブ済みのチャンネルを再度アーカイブすると 409 を返す', async () => {
    const { token } = await registerUser(app, 'user1', 'user1@example.com');
    const channelId = await createChannelReq(app, token, 'ch-api-archive-3');

    await request(app)
      .patch(`/api/channels/${channelId}/archive`)
      .set('Cookie', `token=${token}`);

    const res = await request(app)
      .patch(`/api/channels/${channelId}/archive`)
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(409);
  });

  it('管理者（admin）は他者のチャンネルをアーカイブできる（200が返る）', async () => {
    const { token: ownerToken } = await registerUser(app, 'owner2', 'owner2@example.com');
    const { token: adminToken, userId: adminId } = await registerUser(app, 'admin1', 'admin1@example.com');
    await testDb.execute("UPDATE users SET role = 'admin' WHERE id = $1", [adminId]);

    const channelId = await createChannelReq(app, ownerToken, 'ch-api-archive-4');

    const res = await request(app)
      .patch(`/api/channels/${channelId}/archive`)
      .set('Cookie', `token=${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.channel.isArchived).toBe(true);
  });
});

describe('REST API: DELETE /api/channels/:id/archive（アーカイブ解除）', () => {
  beforeEach(async () => {
    await resetTestData(testDb);
  });

  it('チャンネル作成者がアーカイブ解除すると 200 と解除済みチャンネルが返る', async () => {
    const { token } = await registerUser(app, 'user1', 'user1@example.com');
    const channelId = await createChannelReq(app, token, 'ch-api-unarchive-1');

    await request(app)
      .patch(`/api/channels/${channelId}/archive`)
      .set('Cookie', `token=${token}`);

    const res = await request(app)
      .delete(`/api/channels/${channelId}/archive`)
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body.channel.isArchived).toBe(false);
  });

  it('認証なしで 401 を返す', async () => {
    const res = await request(app).delete('/api/channels/1/archive');
    expect(res.status).toBe(401);
  });

  it('存在しないチャンネルIDで 404 を返す', async () => {
    const { token } = await registerUser(app, 'user1', 'user1@example.com');

    const res = await request(app)
      .delete('/api/channels/99999/archive')
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(404);
  });

  it('作成者以外がアーカイブ解除しようとすると 403 を返す', async () => {
    const { token: ownerToken } = await registerUser(app, 'owner3', 'owner3@example.com');
    const { token: otherToken } = await registerUser(app, 'other2', 'other2@example.com');

    const channelId = await createChannelReq(app, ownerToken, 'ch-api-unarchive-2');

    await request(app)
      .patch(`/api/channels/${channelId}/archive`)
      .set('Cookie', `token=${ownerToken}`);

    const res = await request(app)
      .delete(`/api/channels/${channelId}/archive`)
      .set('Cookie', `token=${otherToken}`);

    expect(res.status).toBe(403);
  });

  it('アーカイブされていないチャンネルの解除は 409 を返す', async () => {
    const { token } = await registerUser(app, 'user1', 'user1@example.com');
    const channelId = await createChannelReq(app, token, 'ch-api-unarchive-3');

    const res = await request(app)
      .delete(`/api/channels/${channelId}/archive`)
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(409);
  });
});

describe('REST API: GET /api/channels/archived（アーカイブ一覧）', () => {
  beforeEach(async () => {
    await resetTestData(testDb);
  });

  it('認証済みユーザーにアーカイブ済みチャンネル一覧を返す（200）', async () => {
    const { token } = await registerUser(app, 'user1', 'user1@example.com');

    const res = await request(app)
      .get('/api/channels/archived')
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.channels)).toBe(true);
  });

  it('認証なしで 401 を返す', async () => {
    const res = await request(app).get('/api/channels/archived');
    expect(res.status).toBe(401);
  });

  it('レスポンスに is_archived=true のチャンネルのみ含まれる', async () => {
    const { token } = await registerUser(app, 'user1', 'user1@example.com');
    const channelId = await createChannelReq(app, token, 'ch-archived-api-1');

    await request(app)
      .patch(`/api/channels/${channelId}/archive`)
      .set('Cookie', `token=${token}`);

    await createChannelReq(app, token, 'ch-active-api-1');

    const res = await request(app)
      .get('/api/channels/archived')
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    const channels = res.body.channels as { isArchived: boolean }[];
    expect(channels.every((ch) => ch.isArchived === true)).toBe(true);
  });

  it('プライベートかつアーカイブ済みのチャンネルはメンバーにのみ返る', async () => {
    const { token: ownerToken } = await registerUser(app, 'owner6', 'owner6@example.com');

    const createRes = await request(app)
      .post('/api/channels')
      .set('Cookie', `token=${ownerToken}`)
      .send({ name: 'ch-private-api-archived', is_private: true });
    const privateChannelId = createRes.body.channel.id as number;

    await request(app)
      .patch(`/api/channels/${privateChannelId}/archive`)
      .set('Cookie', `token=${ownerToken}`);

    const memberRes = await request(app)
      .get('/api/channels/archived')
      .set('Cookie', `token=${ownerToken}`);

    expect(memberRes.body.channels.some((ch: { id: number }) => ch.id === privateChannelId)).toBe(true);
  });

  it('プライベートかつアーカイブ済みのチャンネルは非メンバーには返らない', async () => {
    const { token: ownerToken } = await registerUser(app, 'owner7', 'owner7@example.com');
    const { token: nonMemberToken } = await registerUser(app, 'nonmember2', 'nonmember2@example.com');

    const createRes = await request(app)
      .post('/api/channels')
      .set('Cookie', `token=${ownerToken}`)
      .send({ name: 'ch-private-api-archived2', is_private: true });
    const privateChannelId = createRes.body.channel.id as number;

    await request(app)
      .patch(`/api/channels/${privateChannelId}/archive`)
      .set('Cookie', `token=${ownerToken}`);

    const nonMemberRes = await request(app)
      .get('/api/channels/archived')
      .set('Cookie', `token=${nonMemberToken}`);

    expect(nonMemberRes.body.channels.some((ch: { id: number }) => ch.id === privateChannelId)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// REST API 統合テスト: アーカイブ済みチャンネルへのメッセージ送信禁止
// ---------------------------------------------------------------------------

describe('REST API: アーカイブ済みチャンネルへのメッセージ送信禁止', () => {
  beforeEach(async () => {
    await resetTestData(testDb);
  });

  it('アーカイブ済みチャンネルへの GET /api/channels/:id/messages は 200 で返る（読み取りは可能）', async () => {
    const { token, userId } = await registerUser(app, 'user1', 'user1@example.com');
    const channelId = await createChannelReq(app, token, 'ch-msg-read-archived');

    await insertMessage(channelId, userId, 'テストメッセージ');
    await request(app)
      .patch(`/api/channels/${channelId}/archive`)
      .set('Cookie', `token=${token}`);

    const res = await request(app)
      .get(`/api/channels/${channelId}/messages`)
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.messages)).toBe(true);
  });

  it('アーカイブ済みチャンネルへのメッセージ送信（HTTP POST）は 403 を返す', async () => {
    const { token } = await registerUser(app, 'user1', 'user1@example.com');
    const channelId = await createChannelReq(app, token, 'ch-msg-send-archived');

    await request(app)
      .patch(`/api/channels/${channelId}/archive`)
      .set('Cookie', `token=${token}`);

    const res = await request(app)
      .post(`/api/channels/${channelId}/messages`)
      .set('Cookie', `token=${token}`)
      .send({ content: 'このメッセージは送れないはず' });

    expect(res.status).toBe(403);
  });

  it('非アーカイブのチャンネルへのメッセージ送信は通常通り成功する', async () => {
    const { token } = await registerUser(app, 'user1', 'user1@example.com');
    const channelId = await createChannelReq(app, token, 'ch-msg-send-active');

    const res = await request(app)
      .post(`/api/channels/${channelId}/messages`)
      .set('Cookie', `token=${token}`)
      .send({ content: 'テストメッセージ' });

    expect(res.status).toBe(201);
  });
});

// ---------------------------------------------------------------------------
// 型・スキーマの境界条件
// ---------------------------------------------------------------------------

describe('Channel 型: is_archived フィールド境界条件', () => {
  beforeEach(async () => {
    await resetTestData(testDb);
  });

  it('GET /api/channels レスポンスの各チャンネルに isArchived フィールドが含まれる', async () => {
    const { token } = await registerUser(app, 'user1', 'user1@example.com');
    await createChannelReq(app, token, 'ch-type-check-1');

    const res = await request(app)
      .get('/api/channels')
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    const channels = res.body.channels as { isArchived?: boolean }[];
    expect(channels.length).toBeGreaterThan(0);
    expect(channels.every((ch) => typeof ch.isArchived === 'boolean')).toBe(true);
  });

  it('GET /api/channels/archived レスポンスの各チャンネルの isArchived が true である', async () => {
    const { token } = await registerUser(app, 'user1', 'user1@example.com');
    const channelId = await createChannelReq(app, token, 'ch-type-check-2');

    await request(app)
      .patch(`/api/channels/${channelId}/archive`)
      .set('Cookie', `token=${token}`);

    const res = await request(app)
      .get('/api/channels/archived')
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    const channels = res.body.channels as { isArchived: boolean }[];
    expect(channels.every((ch) => ch.isArchived === true)).toBe(true);
  });

  it('新規作成チャンネルの isArchived はデフォルトで false である', async () => {
    const { token } = await registerUser(app, 'user1', 'user1@example.com');

    const res = await request(app)
      .post('/api/channels')
      .set('Cookie', `token=${token}`)
      .send({ name: 'ch-type-check-3' });

    expect(res.status).toBe(201);
    expect(res.body.channel.isArchived).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// テストヘルパー
// ---------------------------------------------------------------------------

async function createChannelViaService(name: string, userId: number): Promise<number> {
  const channel = await channelService.createChannel(name, undefined, userId);
  return channel.id;
}
