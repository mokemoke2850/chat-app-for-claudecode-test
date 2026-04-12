/**
 * MessageService - リアクション機能のユニットテスト
 *
 * テスト対象: packages/server/src/services/messageService.ts
 * - addReaction: リアクション追加
 * - removeReaction: リアクション削除
 * - getReactions: リアクション取得
 * - getChannelMessages: reactionsフィールドが含まれること
 *
 * DB 戦略: better-sqlite3 のインメモリ DB を使用。
 * メッセージは users と channels への外部キーを持つため、
 * beforeAll でテスト用ユーザー・チャンネル・メッセージを直接 INSERT している。
 */

import {
  addReaction,
  removeReaction,
  getReactions,
  createMessage,
  getChannelMessages,
} from '../../services/messageService';
import { initializeSchema } from '../../db/database';
import DatabaseLib from 'better-sqlite3';

let userId1: number;
let userId2: number;
let channelId: number;

jest.mock('../../db/database', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const DB = require('better-sqlite3') as typeof import('better-sqlite3');
  const db = new DB(':memory:');
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

beforeAll(() => {
  const DB = DatabaseLib;
  const { getDatabase } = jest.requireMock<typeof import('../../db/database')>('../../db/database');
  const db = getDatabase() as InstanceType<typeof DB>;

  const r1 = db
    .prepare("INSERT INTO users (username, email, password_hash) VALUES ('user1', 'u1@t.com', 'h')")
    .run();
  userId1 = r1.lastInsertRowid as number;

  const r2 = db
    .prepare("INSERT INTO users (username, email, password_hash) VALUES ('user2', 'u2@t.com', 'h')")
    .run();
  userId2 = r2.lastInsertRowid as number;

  const rc = db
    .prepare("INSERT INTO channels (name, created_by) VALUES ('test-channel', ?)")
    .run(userId1);
  channelId = rc.lastInsertRowid as number;
});

const sampleContent = JSON.stringify({ ops: [{ insert: 'Hello\n' }] });

describe('MessageService - リアクション機能', () => {
  describe('addReaction', () => {
    it('指定した絵文字のリアクションを追加できる', () => {
      const msg = createMessage(channelId, userId1, sampleContent);
      const reactions = addReaction(msg.id, userId1, '👍');

      expect(reactions.some((r) => r.emoji === '👍')).toBe(true);
    });

    it('追加後に返される Reaction[] にその絵文字・count・userIds が含まれる', () => {
      const msg = createMessage(channelId, userId1, sampleContent);
      const reactions = addReaction(msg.id, userId1, '❤️');

      const reaction = reactions.find((r) => r.emoji === '❤️');
      expect(reaction).toBeDefined();
      expect(reaction!.count).toBe(1);
      expect(reaction!.userIds).toContain(userId1);
    });

    it('同じユーザーが同じ絵文字を二重に追加しても重複しない（UNIQUE制約）', () => {
      const msg = createMessage(channelId, userId1, sampleContent);
      addReaction(msg.id, userId1, '🎉');
      const reactions = addReaction(msg.id, userId1, '🎉');

      const reaction = reactions.find((r) => r.emoji === '🎉');
      expect(reaction!.count).toBe(1);
      expect(reaction!.userIds.filter((id) => id === userId1).length).toBe(1);
    });

    it('複数ユーザーが同じ絵文字をリアクションすると count が増える', () => {
      const msg = createMessage(channelId, userId1, sampleContent);
      addReaction(msg.id, userId1, '🔥');
      const reactions = addReaction(msg.id, userId2, '🔥');

      const reaction = reactions.find((r) => r.emoji === '🔥');
      expect(reaction!.count).toBe(2);
      expect(reaction!.userIds).toContain(userId1);
      expect(reaction!.userIds).toContain(userId2);
    });

    it('存在しないメッセージにリアクションしようとするとエラーになる', () => {
      expect(() => addReaction(99999, userId1, '👍')).toThrow();
    });
  });

  describe('removeReaction', () => {
    it('追加済みのリアクションを削除できる', () => {
      const msg = createMessage(channelId, userId1, sampleContent);
      addReaction(msg.id, userId1, '👀');
      const reactions = removeReaction(msg.id, userId1, '👀');

      const reaction = reactions.find((r) => r.emoji === '👀');
      expect(reaction).toBeUndefined();
    });

    it('削除後の Reaction[] にそのユーザーの userId が含まれない', () => {
      const msg = createMessage(channelId, userId1, sampleContent);
      addReaction(msg.id, userId1, '🚀');
      addReaction(msg.id, userId2, '🚀');
      const reactions = removeReaction(msg.id, userId1, '🚀');

      const reaction = reactions.find((r) => r.emoji === '🚀');
      expect(reaction).toBeDefined();
      expect(reaction!.userIds).not.toContain(userId1);
      expect(reaction!.userIds).toContain(userId2);
    });

    it('存在しないリアクションを削除しようとしてもエラーにならない', () => {
      const msg = createMessage(channelId, userId1, sampleContent);
      expect(() => removeReaction(msg.id, userId1, '❌')).not.toThrow();
    });
  });

  describe('getReactions', () => {
    it('メッセージにリアクションがない場合は空配列を返す', () => {
      const msg = createMessage(channelId, userId1, sampleContent);
      const reactions = getReactions(msg.id);

      expect(reactions).toEqual([]);
    });

    it('emoji ごとにグループ化して Reaction[] を返す', () => {
      const msg = createMessage(channelId, userId1, sampleContent);
      addReaction(msg.id, userId1, '👍');
      addReaction(msg.id, userId2, '👍');
      addReaction(msg.id, userId1, '❤️');

      const reactions = getReactions(msg.id);

      expect(reactions.length).toBe(2);
      expect(reactions.map((r) => r.emoji)).toContain('👍');
      expect(reactions.map((r) => r.emoji)).toContain('❤️');
    });

    it('各 Reaction に emoji・count・userIds が含まれる', () => {
      const msg = createMessage(channelId, userId1, sampleContent);
      addReaction(msg.id, userId1, '💯');

      const reactions = getReactions(msg.id);
      const reaction = reactions.find((r) => r.emoji === '💯');

      expect(reaction).toBeDefined();
      expect(typeof reaction!.emoji).toBe('string');
      expect(typeof reaction!.count).toBe('number');
      expect(Array.isArray(reaction!.userIds)).toBe(true);
    });
  });

  describe('getChannelMessages - reactions フィールドの付与', () => {
    it('取得したメッセージに reactions フィールドが含まれる', () => {
      const msg = createMessage(channelId, userId1, sampleContent);
      addReaction(msg.id, userId1, '⭐');

      const messages = getChannelMessages(channelId);
      const found = messages.find((m) => m.id === msg.id);

      expect(found).toBeDefined();
      expect(Array.isArray(found!.reactions)).toBe(true);
      expect(found!.reactions.some((r) => r.emoji === '⭐')).toBe(true);
    });

    it('リアクションがないメッセージの reactions は空配列になる', () => {
      const msg = createMessage(channelId, userId1, sampleContent);

      const messages = getChannelMessages(channelId);
      const found = messages.find((m) => m.id === msg.id);

      expect(found).toBeDefined();
      expect(found!.reactions).toEqual([]);
    });
  });
});

// initializeSchema は jest.requireActual 経由でのみ使用しているため、
// TypeScript の未使用インポートエラーを抑制するための参照
void initializeSchema;
