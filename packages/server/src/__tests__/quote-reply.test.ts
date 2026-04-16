/**
 * テスト対象: メッセージ引用返信機能
 * 戦略: better-sqlite3 のインメモリ DB を使いサービス層を直接テストする。
 * 外部キー制約を満たすため beforeAll でユーザー・チャンネルを挿入する。
 */

import type { Message } from '@chat-app/shared';
import { createMessage, getChannelMessages } from '../services/messageService';

let userId1: number;
let userId2: number;
let channelId: number;
let baseMessageId: number;

jest.mock('../db/database', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const DB = require('better-sqlite3') as typeof import('better-sqlite3');
  const db = new DB(':memory:');
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

import DatabaseLib from 'better-sqlite3';

beforeAll(() => {
  const { getDatabase } = jest.requireMock<typeof import('../db/database')>('../db/database');
  const db = getDatabase() as InstanceType<typeof DatabaseLib>;

  const r1 = db
    .prepare("INSERT INTO users (username, email, password_hash) VALUES ('user1', 'u1@test.com', 'h')")
    .run();
  userId1 = r1.lastInsertRowid as number;

  const r2 = db
    .prepare("INSERT INTO users (username, email, password_hash) VALUES ('user2', 'u2@test.com', 'h')")
    .run();
  userId2 = r2.lastInsertRowid as number;

  const rc = db
    .prepare("INSERT INTO channels (name, created_by) VALUES ('test-channel', ?)")
    .run(userId1);
  channelId = rc.lastInsertRowid as number;

  const rm = db
    .prepare('INSERT INTO messages (channel_id, user_id, content) VALUES (?, ?, ?)')
    .run(channelId, userId1, 'Base message');
  baseMessageId = rm.lastInsertRowid as number;
});

describe('引用返信機能', () => {
  describe('引用返信メッセージの送信', () => {
    it('引用返信メッセージを送信できる', () => {
      const message = createMessage(channelId, userId2, 'Reply content', [], [], baseMessageId);
      expect(message).toBeDefined();
      expect(message.quotedMessageId).toBe(baseMessageId);
    });

    it('引用元メッセージIDを含むメッセージが保存される', () => {
      const message = createMessage(channelId, userId1, 'Another reply', [], [], baseMessageId);
      expect(message.quotedMessageId).toBe(baseMessageId);
      expect(message.id).toBeDefined();
    });

    it('存在しないメッセージIDを引用元に指定した場合はエラーになる', () => {
      expect(() => createMessage(channelId, userId1, 'Reply', [], [], 99999)).toThrow();
    });

    it('削除済みメッセージを引用元に指定した場合はエラーになる', () => {
      const { getDatabase } = jest.requireMock<typeof import('../db/database')>('../db/database');
      const db = getDatabase() as InstanceType<typeof DatabaseLib>;
      const rd = db
        .prepare('INSERT INTO messages (channel_id, user_id, content, is_deleted) VALUES (?, ?, ?, 1)')
        .run(channelId, userId1, 'Deleted msg');
      const deletedId = rd.lastInsertRowid as number;

      expect(() => createMessage(channelId, userId1, 'Reply to deleted', [], [], deletedId)).toThrow();
    });
  });

  describe('引用元メッセージ情報の取得', () => {
    it('引用元メッセージの内容が取得できる', () => {
      const message = createMessage(channelId, userId2, 'Test reply', [], [], baseMessageId);
      expect(message.quotedMessage).not.toBeNull();
      expect(message.quotedMessage!.content).toBe('Base message');
    });

    it('引用元メッセージの送信者情報が取得できる', () => {
      const message = createMessage(channelId, userId2, 'Test reply2', [], [], baseMessageId);
      expect(message.quotedMessage).not.toBeNull();
      expect(message.quotedMessage!.username).toBe('user1');
    });

    it('引用元メッセージのタイムスタンプが取得できる', () => {
      const message = createMessage(channelId, userId2, 'Test reply3', [], [], baseMessageId);
      expect(message.quotedMessage).not.toBeNull();
      expect(message.quotedMessage!.createdAt).toBeDefined();
    });

    it('引用返信を含むメッセージ一覧取得時に引用元情報がネストして返される', () => {
      createMessage(channelId, userId2, 'List test reply', [], [], baseMessageId);
      const messages = getChannelMessages(channelId);
      const replyWithQuote = messages.find(
        (m: Message) => m.content === 'List test reply',
      );
      expect(replyWithQuote).toBeDefined();
      expect(replyWithQuote!.quotedMessage).not.toBeNull();
      expect(replyWithQuote!.quotedMessage!.id).toBe(baseMessageId);
    });
  });

  describe('引用返信の表示データ', () => {
    it('引用元メッセージが後から削除された場合も引用返信は表示される', () => {
      const { getDatabase } = jest.requireMock<typeof import('../db/database')>('../db/database');
      const db = getDatabase() as InstanceType<typeof DatabaseLib>;

      // 引用元メッセージを作成
      const rq = db
        .prepare('INSERT INTO messages (channel_id, user_id, content) VALUES (?, ?, ?)')
        .run(channelId, userId1, 'Will be deleted');
      const toBeDeletedId = rq.lastInsertRowid as number;

      // 引用返信を作成
      const reply = createMessage(channelId, userId2, 'Reply before delete', [], [], toBeDeletedId);
      expect(reply.quotedMessage).not.toBeNull();

      // 引用元を削除（is_deleted = 1 にする）
      db.prepare('UPDATE messages SET is_deleted = 1 WHERE id = ?').run(toBeDeletedId);

      // 引用返信自体は取得できる（quoted_message_id は残る）
      const messages = getChannelMessages(channelId);
      const found = messages.find((m: Message) => m.content === 'Reply before delete');
      expect(found).toBeDefined();
      expect(found!.quotedMessageId).toBe(toBeDeletedId);
    });

    it('同一チャンネル内のメッセージのみ引用できる', () => {
      const { getDatabase } = jest.requireMock<typeof import('../db/database')>('../db/database');
      const db = getDatabase() as InstanceType<typeof DatabaseLib>;

      // 別チャンネルを作成
      const rc2 = db
        .prepare("INSERT INTO channels (name, created_by) VALUES ('other-channel', ?)")
        .run(userId1);
      const otherChannelId = rc2.lastInsertRowid as number;

      const rm2 = db
        .prepare('INSERT INTO messages (channel_id, user_id, content) VALUES (?, ?, ?)')
        .run(otherChannelId, userId1, 'Other channel message');
      const otherMessageId = rm2.lastInsertRowid as number;

      // 別チャンネルのメッセージを引用しようとするとエラー
      expect(() =>
        createMessage(channelId, userId1, 'Cross-channel reply', [], [], otherMessageId),
      ).toThrow();
    });
  });
});
