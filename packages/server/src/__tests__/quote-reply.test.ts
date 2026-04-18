/**
 * テスト対象: メッセージ引用返信機能
 * 戦略: pg-mem のインメモリ PostgreSQL 互換 DB を使いサービス層を直接テストする。
 * 外部キー制約を満たすため beforeAll でユーザー・チャンネルを挿入する。
 */

import { getSharedTestDatabase, resetTestData } from './__fixtures__/pgTestHelper';

const testDb = getSharedTestDatabase();

jest.mock('../db/database', () => testDb);

import type { Message } from '@chat-app/shared';
import { createMessage, getChannelMessages } from '../services/messageService';

let userId1: number;
let userId2: number;
let channelId: number;
let baseMessageId: number;

beforeEach(async () => {
  await resetTestData(testDb);

  const r1 = await testDb.execute(
    "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
    ['user1', 'u1@test.com', 'h'],
  );
  userId1 = r1.rows[0].id as number;

  const r2 = await testDb.execute(
    "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
    ['user2', 'u2@test.com', 'h'],
  );
  userId2 = r2.rows[0].id as number;

  const rc = await testDb.execute(
    "INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id",
    ['test-channel', userId1],
  );
  channelId = rc.rows[0].id as number;

  const rm = await testDb.execute(
    'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
    [channelId, userId1, 'Base message'],
  );
  baseMessageId = rm.rows[0].id as number;
});

describe('引用返信機能', () => {
  describe('引用返信メッセージの送信', () => {
    it('引用返信メッセージを送信できる', async () => {
      const message = await createMessage(channelId, userId2, 'Reply content', [], [], baseMessageId);
      expect(message).toBeDefined();
      expect(message.quotedMessageId).toBe(baseMessageId);
    });

    it('引用元メッセージIDを含むメッセージが保存される', async () => {
      const message = await createMessage(channelId, userId1, 'Another reply', [], [], baseMessageId);
      expect(message.quotedMessageId).toBe(baseMessageId);
      expect(message.id).toBeDefined();
    });

    it('存在しないメッセージIDを引用元に指定した場合はエラーになる', async () => {
      await expect(createMessage(channelId, userId1, 'Reply', [], [], 99999)).rejects.toThrow();
    });

    it('削除済みメッセージを引用元に指定した場合はエラーになる', async () => {
      const rd = await testDb.execute(
        'INSERT INTO messages (channel_id, user_id, content, is_deleted) VALUES ($1, $2, $3, true) RETURNING id',
        [channelId, userId1, 'Deleted msg'],
      );
      const deletedId = rd.rows[0].id as number;

      await expect(
        createMessage(channelId, userId1, 'Reply to deleted', [], [], deletedId),
      ).rejects.toThrow();
    });
  });

  describe('引用元メッセージ情報の取得', () => {
    it('引用元メッセージの内容が取得できる', async () => {
      const message = await createMessage(channelId, userId2, 'Test reply', [], [], baseMessageId);
      expect(message.quotedMessage).not.toBeNull();
      expect(message.quotedMessage!.content).toBe('Base message');
    });

    it('引用元メッセージの送信者情報が取得できる', async () => {
      const message = await createMessage(channelId, userId2, 'Test reply2', [], [], baseMessageId);
      expect(message.quotedMessage).not.toBeNull();
      expect(message.quotedMessage!.username).toBe('user1');
    });

    it('引用元メッセージのタイムスタンプが取得できる', async () => {
      const message = await createMessage(channelId, userId2, 'Test reply3', [], [], baseMessageId);
      expect(message.quotedMessage).not.toBeNull();
      expect(message.quotedMessage!.createdAt).toBeDefined();
    });

    it('引用返信を含むメッセージ一覧取得時に引用元情報がネストして返される', async () => {
      await createMessage(channelId, userId2, 'List test reply', [], [], baseMessageId);
      const messages = await getChannelMessages(channelId);
      const replyWithQuote = messages.find(
        (m: Message) => m.content === 'List test reply',
      );
      expect(replyWithQuote).toBeDefined();
      expect(replyWithQuote!.quotedMessage).not.toBeNull();
      expect(replyWithQuote!.quotedMessage!.id).toBe(baseMessageId);
    });
  });

  describe('引用返信の表示データ', () => {
    it('引用元メッセージが後から削除された場合も引用返信は表示される', async () => {
      // 引用元メッセージを作成
      const rq = await testDb.execute(
        'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
        [channelId, userId1, 'Will be deleted'],
      );
      const toBeDeletedId = rq.rows[0].id as number;

      // 引用返信を作成
      const reply = await createMessage(
        channelId,
        userId2,
        'Reply before delete',
        [],
        [],
        toBeDeletedId,
      );
      expect(reply.quotedMessage).not.toBeNull();

      // 引用元を削除（is_deleted = true にする）
      await testDb.execute('UPDATE messages SET is_deleted = true WHERE id = $1', [toBeDeletedId]);

      // 引用返信自体は取得できる（quoted_message_id は残る）
      const messages = await getChannelMessages(channelId);
      const found = messages.find((m: Message) => m.content === 'Reply before delete');
      expect(found).toBeDefined();
      expect(found!.quotedMessageId).toBe(toBeDeletedId);
    });

    it('同一チャンネル内のメッセージのみ引用できる', async () => {
      // 別チャンネルを作成
      const rc2 = await testDb.execute(
        "INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id",
        ['other-channel', userId1],
      );
      const otherChannelId = rc2.rows[0].id as number;

      const rm2 = await testDb.execute(
        'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
        [otherChannelId, userId1, 'Other channel message'],
      );
      const otherMessageId = rm2.rows[0].id as number;

      // 別チャンネルのメッセージを引用しようとするとエラー
      await expect(
        createMessage(channelId, userId1, 'Cross-channel reply', [], [], otherMessageId),
      ).rejects.toThrow();
    });
  });
});
