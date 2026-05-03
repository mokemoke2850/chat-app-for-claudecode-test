/**
 * 購読中スレッド一覧 API のテスト (Step 6c)
 *
 * テスト対象: GET /api/threads/subscribed
 * 戦略:
 *   - DB は pg-mem のインメモリ PostgreSQL 互換 DB を使用
 *   - supertest で HTTP リクエストを発行し、ステータスコードとボディを検証する
 *   - メッセージ・スレッド返信は DB に直接 INSERT して用意する
 *
 * 「購読中スレッド」の定義（Step 6c 確定スコープ）:
 *   - 自分が返信投稿（parent_message_id IS NOT NULL かつ user_id = me）したスレッドの
 *     ルートメッセージ一覧を返す
 *   - リアクションのみの関与・メンションのみの関与は対象外（後続 Step で拡張）
 *
 * レスポンス: { threads: [{ rootMessage, channelName, replyCount, lastReplyAt, unreadCount }] }
 *   - unreadCount は本 Step では 0 固定（thread_reads テーブルが未設計のため）
 *   - ソートは lastReplyAt 降順
 */

import { createTestDatabase } from '../__fixtures__/pgTestHelper';

const testDb = createTestDatabase();

jest.mock('../../db/database', () => testDb);

import request from 'supertest';
import { createApp } from '../../app';
import { registerUser, createChannelReq, insertMessage } from '../__fixtures__/testHelpers';

const app = createApp();

/** スレッド返信（root_message_id / parent_message_id 付き）を直接 INSERT する */
async function insertReply(
  channelId: number,
  userId: number,
  content: string,
  parentMessageId: number,
  rootMessageId: number,
): Promise<number> {
  const result = await testDb.execute(
    `INSERT INTO messages (channel_id, user_id, content, parent_message_id, root_message_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [channelId, userId, content, parentMessageId, rootMessageId],
  );
  return result.rows[0].id as number;
}

describe('GET /api/threads/subscribed', () => {
  describe('正常系', () => {
    it('自分が返信投稿したスレッドのルートメッセージが返される', async () => {
      const { token: aliceToken, userId: aliceId } = await registerUser(
        app,
        'th_alice1',
        'th_alice1@example.com',
      );
      const { userId: bobId } = await registerUser(app, 'th_bob1', 'th_bob1@example.com');
      const channelId = await createChannelReq(app, aliceToken, 'th-ch1');

      const rootId = await insertMessage(channelId, bobId, 'スレッドルート');
      await insertReply(channelId, aliceId, '私の返信', rootId, rootId);

      const res = await request(app)
        .get('/api/threads/subscribed')
        .set('Cookie', `token=${aliceToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.threads)).toBe(true);
      expect(res.body.threads).toHaveLength(1);
      expect(res.body.threads[0].rootMessage.id).toBe(rootId);
      expect(res.body.threads[0].rootMessage.content).toBe('スレッドルート');
    });

    it('自分が返信していないスレッドは返らない', async () => {
      const { token: aliceToken } = await registerUser(app, 'th_alice2', 'th_alice2@example.com');
      const { userId: bobId } = await registerUser(app, 'th_bob2', 'th_bob2@example.com');
      const { userId: charlieId } = await registerUser(
        app,
        'th_charlie2',
        'th_charlie2@example.com',
      );
      const channelId = await createChannelReq(app, aliceToken, 'th-ch2');

      const rootId = await insertMessage(channelId, bobId, 'alice 関与なし');
      await insertReply(channelId, charlieId, 'charlie の返信', rootId, rootId);

      const res = await request(app)
        .get('/api/threads/subscribed')
        .set('Cookie', `token=${aliceToken}`);

      expect(res.status).toBe(200);
      expect(res.body.threads).toHaveLength(0);
    });

    it('複数のスレッドに返信していれば、それぞれ 1 件ずつまとめて返る', async () => {
      const { token: aliceToken, userId: aliceId } = await registerUser(
        app,
        'th_alice3',
        'th_alice3@example.com',
      );
      const { userId: bobId } = await registerUser(app, 'th_bob3', 'th_bob3@example.com');
      const channelId = await createChannelReq(app, aliceToken, 'th-ch3');

      const root1 = await insertMessage(channelId, bobId, 'ルート1');
      const root2 = await insertMessage(channelId, bobId, 'ルート2');
      // alice が root1 に 2 回・root2 に 1 回返信
      await insertReply(channelId, aliceId, 'r1-1', root1, root1);
      await insertReply(channelId, aliceId, 'r1-2', root1, root1);
      await insertReply(channelId, aliceId, 'r2-1', root2, root2);

      const res = await request(app)
        .get('/api/threads/subscribed')
        .set('Cookie', `token=${aliceToken}`);

      expect(res.status).toBe(200);
      const ids = (res.body.threads as { rootMessage: { id: number } }[]).map(
        (t) => t.rootMessage.id,
      );
      expect(ids).toContain(root1);
      expect(ids).toContain(root2);
      expect(res.body.threads).toHaveLength(2);
    });

    it('レスポンスに channelName / replyCount / lastReplyAt が含まれる', async () => {
      const { token: aliceToken, userId: aliceId } = await registerUser(
        app,
        'th_alice4',
        'th_alice4@example.com',
      );
      const { userId: bobId } = await registerUser(app, 'th_bob4', 'th_bob4@example.com');
      const channelId = await createChannelReq(app, aliceToken, 'th-ch4');

      const rootId = await insertMessage(channelId, bobId, 'ルート');
      await insertReply(channelId, aliceId, '返信1', rootId, rootId);
      await insertReply(channelId, bobId, '返信2', rootId, rootId);

      const res = await request(app)
        .get('/api/threads/subscribed')
        .set('Cookie', `token=${aliceToken}`);

      expect(res.status).toBe(200);
      const t = res.body.threads[0];
      expect(t.channelName).toBe('th-ch4');
      expect(t.replyCount).toBe(2);
      expect(typeof t.lastReplyAt).toBe('string');
      expect(new Date(t.lastReplyAt).toString()).not.toBe('Invalid Date');
    });

    it('lastReplyAt 降順でソートされる', async () => {
      const { token: aliceToken, userId: aliceId } = await registerUser(
        app,
        'th_alice5',
        'th_alice5@example.com',
      );
      const { userId: bobId } = await registerUser(app, 'th_bob5', 'th_bob5@example.com');
      const channelId = await createChannelReq(app, aliceToken, 'th-ch5');

      // ルートを 2 つ作って、片方は古い時刻、もう片方は新しい時刻に最終返信を持たせる
      const rootOld = await insertMessage(channelId, bobId, '古いスレッド');
      const rootNew = await insertMessage(channelId, bobId, '新しいスレッド');
      // alice の返信を直接 INSERT して created_at を明示的に設定
      await testDb.execute(
        `INSERT INTO messages (channel_id, user_id, content, parent_message_id, root_message_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [channelId, aliceId, 'old reply', rootOld, rootOld, '2024-01-01T00:00:00Z'],
      );
      await testDb.execute(
        `INSERT INTO messages (channel_id, user_id, content, parent_message_id, root_message_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [channelId, aliceId, 'new reply', rootNew, rootNew, '2025-12-31T00:00:00Z'],
      );

      const res = await request(app)
        .get('/api/threads/subscribed')
        .set('Cookie', `token=${aliceToken}`);

      expect(res.status).toBe(200);
      const ids = (res.body.threads as { rootMessage: { id: number } }[]).map(
        (t) => t.rootMessage.id,
      );
      // 新しいスレッドが先に来る
      expect(ids[0]).toBe(rootNew);
      expect(ids[1]).toBe(rootOld);
    });

    it('ルートメッセージが論理削除されているスレッドは結果から除外される', async () => {
      const { token: aliceToken, userId: aliceId } = await registerUser(
        app,
        'th_alice6',
        'th_alice6@example.com',
      );
      const { userId: bobId } = await registerUser(app, 'th_bob6', 'th_bob6@example.com');
      const channelId = await createChannelReq(app, aliceToken, 'th-ch6');

      const rootId = await insertMessage(channelId, bobId, '削除対象ルート');
      await insertReply(channelId, aliceId, '返信', rootId, rootId);
      await testDb.execute('UPDATE messages SET is_deleted = true WHERE id = $1', [rootId]);

      const res = await request(app)
        .get('/api/threads/subscribed')
        .set('Cookie', `token=${aliceToken}`);

      expect(res.status).toBe(200);
      expect(res.body.threads).toHaveLength(0);
    });

    it('複数チャンネルをまたいで購読中スレッドを集約できる', async () => {
      const { token: aliceToken, userId: aliceId } = await registerUser(
        app,
        'th_alice7',
        'th_alice7@example.com',
      );
      const { userId: bobId } = await registerUser(app, 'th_bob7', 'th_bob7@example.com');
      const ch1 = await createChannelReq(app, aliceToken, 'th-ch7a');
      const ch2 = await createChannelReq(app, aliceToken, 'th-ch7b');

      const root1 = await insertMessage(ch1, bobId, 'ルートA');
      const root2 = await insertMessage(ch2, bobId, 'ルートB');
      await insertReply(ch1, aliceId, 'rA', root1, root1);
      await insertReply(ch2, aliceId, 'rB', root2, root2);

      const res = await request(app)
        .get('/api/threads/subscribed')
        .set('Cookie', `token=${aliceToken}`);

      expect(res.status).toBe(200);
      expect(res.body.threads).toHaveLength(2);
      const channelNames = (res.body.threads as { channelName: string }[]).map(
        (t) => t.channelName,
      );
      expect(channelNames).toEqual(expect.arrayContaining(['th-ch7a', 'th-ch7b']));
    });

    // unreadCount の本実装は #236 (thread_reads テーブル設計) にて対応予定。
    // 現状 0 固定の仕様を passing で残すと、本実装で 0 以外を返すようになったときに
    // 検出できない (期待値 0 は仕様変更後に偽陽性になる) ため skip する。
    it.skip('unreadCount は thread_reads 未読数を反映する (issue #236 で本実装)', async () => {
      const { token: aliceToken, userId: aliceId } = await registerUser(
        app,
        'th_alice8',
        'th_alice8@example.com',
      );
      const { userId: bobId } = await registerUser(app, 'th_bob8', 'th_bob8@example.com');
      const channelId = await createChannelReq(app, aliceToken, 'th-ch8');

      const rootId = await insertMessage(channelId, bobId, 'ルート');
      await insertReply(channelId, aliceId, '返信', rootId, rootId);

      const res = await request(app)
        .get('/api/threads/subscribed')
        .set('Cookie', `token=${aliceToken}`);

      expect(res.status).toBe(200);
      // TODO #236: thread_reads 実装後は実際の未読件数を期待値にする
      expect(res.body.threads[0].unreadCount).toBe(0);
    });
  });

  describe('認可・エラー系', () => {
    it('未認証アクセスは 401 を返す', async () => {
      const res = await request(app).get('/api/threads/subscribed');
      expect(res.status).toBe(401);
    });

    it('他人が返信したスレッドは自分の購読リストには含まれない', async () => {
      const { token: aliceToken } = await registerUser(app, 'th_alice9', 'th_alice9@example.com');
      const { userId: bobId } = await registerUser(app, 'th_bob9', 'th_bob9@example.com');
      const { userId: charlieId } = await registerUser(
        app,
        'th_charlie9',
        'th_charlie9@example.com',
      );
      const channelId = await createChannelReq(app, aliceToken, 'th-ch9');

      const rootId = await insertMessage(channelId, bobId, 'ルート');
      await insertReply(channelId, charlieId, 'charlie の返信', rootId, rootId);

      const res = await request(app)
        .get('/api/threads/subscribed')
        .set('Cookie', `token=${aliceToken}`);

      expect(res.status).toBe(200);
      expect(res.body.threads).toHaveLength(0);
    });
  });
});
