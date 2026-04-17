/**
 * MessageService - リアクション機能のユニットテスト
 *
 * テスト対象: packages/server/src/services/messageService.ts
 * - addReaction: リアクション追加
 * - removeReaction: リアクション削除
 * - getReactions: リアクション取得
 * - getChannelMessages: reactionsフィールドが含まれること
 *
 * DB 戦略: pg-mem のインメモリ PostgreSQL 互換 DB を使用。
 * メッセージは users と channels への外部キーを持つため、
 * beforeAll でテスト用ユーザー・チャンネル・メッセージを直接 INSERT している。
 */

import { createTestDatabase } from '../__fixtures__/pgTestHelper';

const testDb = createTestDatabase();

jest.mock('../../db/database', () => testDb);

import {
  addReaction,
  removeReaction,
  getReactions,
  createMessage,
  getChannelMessages,
} from '../../services/messageService';

let userId1: number;
let userId2: number;
let channelId: number;

beforeAll(async () => {
  const r1 = await testDb.execute(
    "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
    ['user1', 'u1@t.com', 'h'],
  );
  userId1 = r1.rows[0].id as number;

  const r2 = await testDb.execute(
    "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
    ['user2', 'u2@t.com', 'h'],
  );
  userId2 = r2.rows[0].id as number;

  const rc = await testDb.execute(
    "INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id",
    ['test-channel', userId1],
  );
  channelId = rc.rows[0].id as number;
});

const sampleContent = JSON.stringify({ ops: [{ insert: 'Hello\n' }] });

describe('MessageService - リアクション機能', () => {
  describe('addReaction', () => {
    it('指定した絵文字のリアクションを追加できる', async () => {
      const msg = await createMessage(channelId, userId1, sampleContent);
      const reactions = await addReaction(msg.id, userId1, '👍');

      expect(reactions.some((r) => r.emoji === '👍')).toBe(true);
    });

    it('追加後に返される Reaction[] にその絵文字・count・userIds が含まれる', async () => {
      const msg = await createMessage(channelId, userId1, sampleContent);
      const reactions = await addReaction(msg.id, userId1, '❤️');

      const reaction = reactions.find((r) => r.emoji === '❤️');
      expect(reaction).toBeDefined();
      expect(reaction!.count).toBe(1);
      expect(reaction!.userIds).toContain(userId1);
    });

    it('同じユーザーが同じ絵文字を二重に追加しても重複しない（UNIQUE制約）', async () => {
      const msg = await createMessage(channelId, userId1, sampleContent);
      await addReaction(msg.id, userId1, '🎉');
      const reactions = await addReaction(msg.id, userId1, '🎉');

      const reaction = reactions.find((r) => r.emoji === '🎉');
      expect(reaction!.count).toBe(1);
      expect(reaction!.userIds.filter((id) => id === userId1).length).toBe(1);
    });

    it('複数ユーザーが同じ絵文字をリアクションすると count が増える', async () => {
      const msg = await createMessage(channelId, userId1, sampleContent);
      await addReaction(msg.id, userId1, '🔥');
      const reactions = await addReaction(msg.id, userId2, '🔥');

      const reaction = reactions.find((r) => r.emoji === '🔥');
      expect(reaction!.count).toBe(2);
      expect(reaction!.userIds).toContain(userId1);
      expect(reaction!.userIds).toContain(userId2);
    });

    it('存在しないメッセージにリアクションしようとするとエラーになる', async () => {
      await expect(addReaction(99999, userId1, '👍')).rejects.toThrow();
    });
  });

  describe('removeReaction', () => {
    it('追加済みのリアクションを削除できる', async () => {
      const msg = await createMessage(channelId, userId1, sampleContent);
      await addReaction(msg.id, userId1, '👀');
      const reactions = await removeReaction(msg.id, userId1, '👀');

      const reaction = reactions.find((r) => r.emoji === '👀');
      expect(reaction).toBeUndefined();
    });

    it('削除後の Reaction[] にそのユーザーの userId が含まれない', async () => {
      const msg = await createMessage(channelId, userId1, sampleContent);
      await addReaction(msg.id, userId1, '🚀');
      await addReaction(msg.id, userId2, '🚀');
      const reactions = await removeReaction(msg.id, userId1, '🚀');

      const reaction = reactions.find((r) => r.emoji === '🚀');
      expect(reaction).toBeDefined();
      expect(reaction!.userIds).not.toContain(userId1);
      expect(reaction!.userIds).toContain(userId2);
    });

    it('存在しないリアクションを削除しようとしてもエラーにならない', async () => {
      const msg = await createMessage(channelId, userId1, sampleContent);
      await expect(removeReaction(msg.id, userId1, '❌')).resolves.not.toThrow();
    });
  });

  describe('getReactions', () => {
    it('メッセージにリアクションがない場合は空配列を返す', async () => {
      const msg = await createMessage(channelId, userId1, sampleContent);
      const reactions = await getReactions(msg.id);

      expect(reactions).toEqual([]);
    });

    it('emoji ごとにグループ化して Reaction[] を返す', async () => {
      const msg = await createMessage(channelId, userId1, sampleContent);
      await addReaction(msg.id, userId1, '👍');
      await addReaction(msg.id, userId2, '👍');
      await addReaction(msg.id, userId1, '❤️');

      const reactions = await getReactions(msg.id);

      expect(reactions.length).toBe(2);
      expect(reactions.map((r) => r.emoji)).toContain('👍');
      expect(reactions.map((r) => r.emoji)).toContain('❤️');
    });

    it('各 Reaction に emoji・count・userIds が含まれる', async () => {
      const msg = await createMessage(channelId, userId1, sampleContent);
      await addReaction(msg.id, userId1, '💯');

      const reactions = await getReactions(msg.id);
      const reaction = reactions.find((r) => r.emoji === '💯');

      expect(reaction).toBeDefined();
      expect(typeof reaction!.emoji).toBe('string');
      expect(typeof reaction!.count).toBe('number');
      expect(Array.isArray(reaction!.userIds)).toBe(true);
    });
  });

  describe('getChannelMessages - reactions フィールドの付与', () => {
    it('取得したメッセージに reactions フィールドが含まれる', async () => {
      const msg = await createMessage(channelId, userId1, sampleContent);
      await addReaction(msg.id, userId1, '⭐');

      const messages = await getChannelMessages(channelId);
      const found = messages.find((m) => m.id === msg.id);

      expect(found).toBeDefined();
      expect(Array.isArray(found!.reactions)).toBe(true);
      expect(found!.reactions.some((r) => r.emoji === '⭐')).toBe(true);
    });

    it('リアクションがないメッセージの reactions は空配列になる', async () => {
      const msg = await createMessage(channelId, userId1, sampleContent);

      const messages = await getChannelMessages(channelId);
      const found = messages.find((m) => m.id === msg.id);

      expect(found).toBeDefined();
      expect(found!.reactions).toEqual([]);
    });
  });
});
