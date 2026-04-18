/**
 * チャンネルトピック・説明機能のテスト
 *
 * テスト対象:
 *   - PATCH /api/channels/:id/topic (バックエンドAPI)
 *   - channelService.updateChannelTopic
 *
 * 戦略: pg-mem のインメモリ PostgreSQL 互換 DB を使用。
 * 権限チェック（admin / 作成者 / 一般ユーザー）と
 * システムメッセージ送信を重点的にテストする。
 */

import { getSharedTestDatabase } from './__fixtures__/pgTestHelper';

const testDb = getSharedTestDatabase();
jest.mock('../db/database', () => testDb);

import request from 'supertest';
import { createApp } from '../app';
import { registerUser, createChannelReq } from './__fixtures__/testHelpers';

const app = createApp();

describe('PATCH /api/channels/:id/topic', () => {
  describe('正常系', () => {
    it('チャンネル作成者はトピックを更新できる', async () => {
      const { token } = await registerUser(app, 'topic_owner1', 'topic_owner1@example.com');
      const channelId = await createChannelReq(app, token, 'topic-ch-owner1');

      const res = await request(app)
        .patch(`/api/channels/${channelId}/topic`)
        .set('Cookie', `token=${token}`)
        .send({ topic: 'テストトピック' });

      expect(res.status).toBe(200);
      expect(res.body.channel.topic).toBe('テストトピック');
    });

    it('管理者はチャンネルのトピックを更新できる', async () => {
      const { token: ownerToken } = await registerUser(app, 'topic_owner2', 'topic_owner2@example.com');
      const channelId = await createChannelReq(app, ownerToken, 'topic-ch-admin1');

      // 管理者ユーザーを作成してロールをadminに変更
      const { token: adminToken, userId: adminId } = await registerUser(app, 'topic_admin1', 'topic_admin1@example.com');
      await testDb.execute("UPDATE users SET role = 'admin' WHERE id = $1", [adminId]);

      const res = await request(app)
        .patch(`/api/channels/${channelId}/topic`)
        .set('Cookie', `token=${adminToken}`)
        .send({ topic: '管理者設定トピック' });

      expect(res.status).toBe(200);
      expect(res.body.channel.topic).toBe('管理者設定トピック');
    });

    it('トピックをnullにするとトピックが削除される', async () => {
      const { token } = await registerUser(app, 'topic_owner3', 'topic_owner3@example.com');
      const channelId = await createChannelReq(app, token, 'topic-ch-null1');

      // 先にトピックを設定
      await request(app)
        .patch(`/api/channels/${channelId}/topic`)
        .set('Cookie', `token=${token}`)
        .send({ topic: '削除予定トピック' });

      // nullで削除
      const res = await request(app)
        .patch(`/api/channels/${channelId}/topic`)
        .set('Cookie', `token=${token}`)
        .send({ topic: null });

      expect(res.status).toBe(200);
      expect(res.body.channel.topic).toBeNull();
    });

    it('説明（description）も同時に更新できる', async () => {
      const { token } = await registerUser(app, 'topic_owner4', 'topic_owner4@example.com');
      const channelId = await createChannelReq(app, token, 'topic-ch-desc1');

      const res = await request(app)
        .patch(`/api/channels/${channelId}/topic`)
        .set('Cookie', `token=${token}`)
        .send({ topic: 'トピック', description: '説明テキスト' });

      expect(res.status).toBe(200);
      expect(res.body.channel.topic).toBe('トピック');
      expect(res.body.channel.description).toBe('説明テキスト');
    });
  });

  describe('システムメッセージ', () => {
    it('トピック更新後にシステムメッセージがチャンネルに投稿される', async () => {
      const { token } = await registerUser(app, 'topic_owner5', 'topic_owner5@example.com');
      const channelId = await createChannelReq(app, token, 'topic-ch-sysmsg1');

      await request(app)
        .patch(`/api/channels/${channelId}/topic`)
        .set('Cookie', `token=${token}`)
        .send({ topic: 'システムメッセージ確認' });

      // システムメッセージがDBに挿入されているか確認
      type MsgRow = { content: string; user_id: number | null };
      const msg = await testDb.queryOne(
        'SELECT content, user_id FROM messages WHERE channel_id = $1 ORDER BY id DESC LIMIT 1',
        [channelId],
      ) as MsgRow | null;
      expect(msg).not.toBeNull();
      expect(msg!.user_id).toBeNull(); // システムメッセージはuser_id=null
      expect(msg!.content).toContain('システムメッセージ確認');
    });
  });

  describe('権限チェック', () => {
    it('一般ユーザー（作成者以外）がトピックを更新しようとすると403が返る', async () => {
      const { token: ownerToken } = await registerUser(app, 'topic_perm_owner1', 'topic_perm_owner1@example.com');
      const { token: otherToken } = await registerUser(app, 'topic_perm_other1', 'topic_perm_other1@example.com');
      const channelId = await createChannelReq(app, ownerToken, 'topic-ch-forbidden1');

      const res = await request(app)
        .patch(`/api/channels/${channelId}/topic`)
        .set('Cookie', `token=${otherToken}`)
        .send({ topic: '不正更新' });

      expect(res.status).toBe(403);
    });

    it('未認証ユーザーがトピックを更新しようとすると401が返る', async () => {
      const res = await request(app)
        .patch('/api/channels/1/topic')
        .send({ topic: '不正' });

      expect(res.status).toBe(401);
    });

    it('存在しないチャンネルIDを指定すると404が返る', async () => {
      const { token } = await registerUser(app, 'topic_notfound1', 'topic_notfound1@example.com');

      const res = await request(app)
        .patch('/api/channels/99999/topic')
        .set('Cookie', `token=${token}`)
        .send({ topic: '存在しないチャンネル' });

      expect(res.status).toBe(404);
    });
  });
});

describe('updateChannelTopic（channelService）', () => {
  let testUserId: number;

  beforeAll(async () => {
    const result = await testDb.execute(
      "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
      ['svc_owner', 'svc_owner@test.com', 'hash'],
    );
    testUserId = result.rows[0].id as number;
  });

  it('topic と description が DB に保存される', async () => {
    const { updateChannelTopic } = await import('../services/channelService');

    const chResult = await testDb.execute(
      'INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id',
      [`svc-topic-ch-${Date.now()}`, testUserId],
    );
    const channelId = chResult.rows[0].id as number;

    await updateChannelTopic(channelId, testUserId, 'svc-topic', 'svc-description', false);

    type TopicRow = { topic: string | null; description: string | null };
    const row = await testDb.queryOne(
      'SELECT topic, description FROM channels WHERE id = $1',
      [channelId],
    ) as TopicRow | null;
    expect(row!.topic).toBe('svc-topic');
    expect(row!.description).toBe('svc-description');
  });

  it('topic のみ更新すると description は変更されない', async () => {
    const { updateChannelTopic } = await import('../services/channelService');

    const chResult = await testDb.execute(
      "INSERT INTO channels (name, description, created_by) VALUES ($1, $2, $3) RETURNING id",
      [`svc-topic-only-${Date.now()}`, '元の説明', testUserId],
    );
    const channelId = chResult.rows[0].id as number;

    await updateChannelTopic(channelId, testUserId, 'トピックのみ更新', undefined, false);

    type TopicRow2 = { topic: string | null; description: string | null };
    const row = await testDb.queryOne(
      'SELECT topic, description FROM channels WHERE id = $1',
      [channelId],
    ) as TopicRow2 | null;
    expect(row!.topic).toBe('トピックのみ更新');
    expect(row!.description).toBe('元の説明');
  });
});
