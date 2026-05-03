/**
 * テスト対象: threadService（thread_reads テーブル / unreadCount 計算）
 * 戦略:
 *   - pg-mem のインメモリ DB を使用してサービス関数を直接呼び出す
 *   - thread_reads の UPSERT と unreadCount 計算ロジックを検証する
 *   - AGENTS.md「テスト設計方針」に従い境界値・エラーケースを網羅する
 */

import { getSharedTestDatabase, resetTestData } from '../__fixtures__/pgTestHelper';

const testDb = getSharedTestDatabase();

jest.mock('../../db/database', () => testDb);

import * as threadService from '../../services/threadService';

/** スレッド返信を直接 INSERT してIDを返す */
async function insertReply(
  channelId: number,
  userId: number,
  content: string,
  parentMessageId: number,
  rootMessageId: number,
  createdAt?: string,
): Promise<number> {
  const result = await testDb.execute(
    createdAt
      ? `INSERT INTO messages (channel_id, user_id, content, parent_message_id, root_message_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`
      : `INSERT INTO messages (channel_id, user_id, content, parent_message_id, root_message_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    createdAt
      ? [channelId, userId, content, parentMessageId, rootMessageId, createdAt]
      : [channelId, userId, content, parentMessageId, rootMessageId],
  );
  return result.rows[0].id as number;
}

describe('threadService - thread_reads / unreadCount', () => {
  let aliceId: number;
  let bobId: number;
  let channelId: number;

  beforeEach(async () => {
    await resetTestData(testDb);

    const ra = await testDb.execute(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
      ['ts_alice', 'ts_alice@example.com', 'hash'],
    );
    aliceId = ra.rows[0].id as number;

    const rb = await testDb.execute(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
      ['ts_bob', 'ts_bob@example.com', 'hash'],
    );
    bobId = rb.rows[0].id as number;

    const rc = await testDb.execute(
      'INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id',
      ['ts-ch', aliceId],
    );
    channelId = rc.rows[0].id as number;

    await testDb.execute('INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2)', [
      channelId,
      aliceId,
    ]);
    await testDb.execute('INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2)', [
      channelId,
      bobId,
    ]);
  });

  describe('markThreadAsRead - thread_reads の更新', () => {
    it('スレッドを既読にすると thread_reads に last_read_at が記録される', async () => {
      const rootId = (
        await testDb.execute(
          'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
          [channelId, bobId, 'ルート'],
        )
      ).rows[0].id as number;

      await threadService.markThreadAsRead(aliceId, rootId);

      const rows = await testDb.execute(
        'SELECT * FROM thread_reads WHERE user_id = $1 AND root_message_id = $2',
        [aliceId, rootId],
      );
      expect(rows.rowCount).toBe(1);
      expect(rows.rows[0].last_read_at).toBeTruthy();
    });

    it('同一スレッドを再度既読にすると last_read_at が更新される（UPSERT）', async () => {
      const rootId = (
        await testDb.execute(
          'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
          [channelId, bobId, 'ルート'],
        )
      ).rows[0].id as number;

      await threadService.markThreadAsRead(aliceId, rootId);
      const firstRows = await testDb.execute(
        'SELECT last_read_at FROM thread_reads WHERE user_id = $1 AND root_message_id = $2',
        [aliceId, rootId],
      );
      const firstReadAt = firstRows.rows[0].last_read_at as Date;

      // 少し後に再度既読化
      await new Promise((r) => setTimeout(r, 10));
      await threadService.markThreadAsRead(aliceId, rootId);

      const secondRows = await testDb.execute(
        'SELECT last_read_at FROM thread_reads WHERE user_id = $1 AND root_message_id = $2',
        [aliceId, rootId],
      );
      const secondReadAt = secondRows.rows[0].last_read_at as Date;

      // レコードは 1 件のまま（重複なし）
      const countRows = await testDb.execute(
        'SELECT COUNT(*) as cnt FROM thread_reads WHERE user_id = $1 AND root_message_id = $2',
        [aliceId, rootId],
      );
      expect(Number(countRows.rows[0].cnt)).toBe(1);
      // last_read_at が更新されている（同じか後の時刻）
      expect(new Date(secondReadAt).getTime()).toBeGreaterThanOrEqual(
        new Date(firstReadAt).getTime(),
      );
    });

    it('存在しないメッセージIDで既読化しても例外にならず正常終了する', async () => {
      await expect(threadService.markThreadAsRead(aliceId, 99999)).resolves.not.toThrow();
    });
  });

  describe('listSubscribedThreads - unreadCount 計算', () => {
    it('thread_reads レコードがない場合（一度も既読化していない）は全返信数が unreadCount になる', async () => {
      const rootId = (
        await testDb.execute(
          'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
          [channelId, bobId, 'ルート'],
        )
      ).rows[0].id as number;

      // alice が返信してスレッド購読
      await insertReply(channelId, aliceId, 'alice の返信', rootId, rootId);
      // bob もさらに返信（2件目）
      await insertReply(channelId, bobId, 'bob の返信', rootId, rootId);

      // thread_reads は未登録（既読化なし）
      const threads = await threadService.listSubscribedThreads(aliceId);

      expect(threads).toHaveLength(1);
      // 全返信2件（alice + bob）のうち alice 自身の返信を除く bob の1件が未読
      expect(threads[0].unreadCount).toBe(1);
    });

    it('last_read_at 以降の返信のみ unreadCount にカウントされる', async () => {
      const rootId = (
        await testDb.execute(
          'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
          [channelId, bobId, 'ルート'],
        )
      ).rows[0].id as number;

      // alice が返信してスレッド購読（古い時刻）
      await insertReply(channelId, aliceId, 'alice の返信', rootId, rootId, '2024-01-01T00:00:00Z');
      // bob の返信（古い）
      await insertReply(channelId, bobId, '古い bob 返信', rootId, rootId, '2024-01-01T01:00:00Z');

      // alice が既読化
      await threadService.markThreadAsRead(aliceId, rootId);

      // 既読化後に bob がさらに返信（新しい）
      await insertReply(channelId, bobId, '新しい bob 返信', rootId, rootId);

      const threads = await threadService.listSubscribedThreads(aliceId);

      expect(threads).toHaveLength(1);
      // last_read_at 以降の bob の返信1件だけが未読
      expect(threads[0].unreadCount).toBe(1);
    });

    it('全返信を既読化済みの場合 unreadCount が 0 になる', async () => {
      const rootId = (
        await testDb.execute(
          'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
          [channelId, bobId, 'ルート'],
        )
      ).rows[0].id as number;

      await insertReply(channelId, aliceId, 'alice の返信', rootId, rootId);
      await insertReply(channelId, bobId, 'bob の返信', rootId, rootId);

      // 全返信が完了してから既読化
      await threadService.markThreadAsRead(aliceId, rootId);

      const threads = await threadService.listSubscribedThreads(aliceId);

      expect(threads).toHaveLength(1);
      expect(threads[0].unreadCount).toBe(0);
    });

    it('自分の返信は unreadCount にカウントしない', async () => {
      const rootId = (
        await testDb.execute(
          'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
          [channelId, bobId, 'ルート'],
        )
      ).rows[0].id as number;

      // alice のみが返信（自分の返信のみ）
      await insertReply(channelId, aliceId, 'alice の返信1', rootId, rootId);
      await insertReply(channelId, aliceId, 'alice の返信2', rootId, rootId);

      // thread_reads 未登録（既読化なし）
      const threads = await threadService.listSubscribedThreads(aliceId);

      expect(threads).toHaveLength(1);
      // 自分の返信のみなので unreadCount は 0
      expect(threads[0].unreadCount).toBe(0);
    });

    it('複数スレッドそれぞれで unreadCount が独立して計算される', async () => {
      const root1 = (
        await testDb.execute(
          'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
          [channelId, bobId, 'ルート1'],
        )
      ).rows[0].id as number;
      const root2 = (
        await testDb.execute(
          'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
          [channelId, bobId, 'ルート2'],
        )
      ).rows[0].id as number;

      // alice が両スレッドに返信
      await insertReply(channelId, aliceId, 'alice r1', root1, root1);
      await insertReply(channelId, aliceId, 'alice r2', root2, root2);

      // bob はスレッド1に2件、スレッド2に1件追加返信
      await insertReply(channelId, bobId, 'bob r1-1', root1, root1);
      await insertReply(channelId, bobId, 'bob r1-2', root1, root1);
      await insertReply(channelId, bobId, 'bob r2-1', root2, root2);

      // スレッド1だけ既読化
      await threadService.markThreadAsRead(aliceId, root1);

      const threads = await threadService.listSubscribedThreads(aliceId);

      expect(threads).toHaveLength(2);
      const t1 = threads.find((t) => t.rootMessage.id === root1)!;
      const t2 = threads.find((t) => t.rootMessage.id === root2)!;

      // スレッド1は既読化済みなので unreadCount = 0
      expect(t1.unreadCount).toBe(0);
      // スレッド2は未読化のまま bob の1件が未読
      expect(t2.unreadCount).toBe(1);
    });
  });
});
