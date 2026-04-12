/**
 * MessageService のユニットテスト
 *
 * テスト対象: packages/server/src/services/messageService.ts
 * - createMessage: メッセージ作成（メンション付き投稿も対応）
 * - getChannelMessages: チャンネルのメッセージ一覧取得（カーソルページネーション）
 * - editMessage: メッセージ編集（投稿者のみ許可）
 * - deleteMessage: メッセージのソフトデリート（投稿者のみ許可）
 * - getMessageById: ID でメッセージを取得
 *
 * DB 戦略: better-sqlite3 のインメモリ DB を使用。
 * メッセージは users と channels への外部キーを持つため、
 * beforeAll でテスト用ユーザー・チャンネルを直接 INSERT している。
 */

import {
  createMessage,
  getChannelMessages,
  editMessage,
  deleteMessage,
  getMessageById,
} from '../../services/messageService';
import { initializeSchema } from '../../db/database';
import DatabaseLib from 'better-sqlite3';

// テスト全体で共有するユーザー・チャンネルの ID
let userId1: number;
let userId2: number;
let channelId: number;

// 本番 DB モジュールをインメモリ SQLite に差し替える
jest.mock('../../db/database', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const DB = require('better-sqlite3') as typeof import('better-sqlite3');
  const db = new DB(':memory:');
  db.pragma('foreign_keys = ON');
  const { initializeSchema: init } = jest.requireActual<typeof import('../../db/database')>('../../db/database');
  init(db);
  return {
    getDatabase: () => db,
    initializeSchema: init,
    closeDatabase: jest.fn(),
  };
});

beforeAll(() => {
  // messageService の外部キー制約を満たすため、
  // 2ユーザー（投稿者・第三者）とテスト用チャンネルを直接 DB に挿入する
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

// ProseMirror JSON 形式のサンプルメッセージコンテンツ
const sampleContent = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }] });

describe('MessageService', () => {
  describe('createMessage', () => {
    it('メッセージを作成し、必要なフィールドをすべて持つオブジェクトを返す', () => {
      const msg = createMessage(channelId, userId1, sampleContent);

      expect(msg.id).toBeDefined();
      expect(msg.channelId).toBe(channelId);
      expect(msg.userId).toBe(userId1);
      expect(msg.content).toBe(sampleContent);
      // 新規作成直後は未編集・未削除状態
      expect(msg.isEdited).toBe(false);
      expect(msg.isDeleted).toBe(false);
    });

    it('mentionedUserIds を渡すと mentions フィールドにユーザー ID が含まれる', () => {
      // @メンション機能: mentions テーブルへの挿入と取得の確認
      const msg = createMessage(channelId, userId1, sampleContent, [userId2]);
      expect(msg.mentions).toContain(userId2);
    });
  });

  describe('getChannelMessages', () => {
    it('メッセージを昇順（古い順）で返す', () => {
      createMessage(channelId, userId1, sampleContent);
      createMessage(channelId, userId2, sampleContent);
      const messages = getChannelMessages(channelId);

      expect(messages.length).toBeGreaterThan(0);
      // id の昇順になっていること（内部では DESC で取得して reverse() している）
      for (let i = 1; i < messages.length; i++) {
        expect(messages[i].id).toBeGreaterThanOrEqual(messages[i - 1].id);
      }
    });

    it('before パラメータを指定するとカーソル以前のメッセージだけを返す', () => {
      const first = createMessage(channelId, userId1, sampleContent);
      const second = createMessage(channelId, userId1, sampleContent);

      // second.id をカーソルとして指定 → second 自身は含まれず first は含まれる
      const page = getChannelMessages(channelId, 10, second.id);
      const ids = page.map((m) => m.id);

      expect(ids).not.toContain(second.id);
      expect(ids).toContain(first.id);
    });
  });

  describe('editMessage', () => {
    it('投稿者がメッセージを編集すると内容が更新され isEdited が true になる', () => {
      const msg = createMessage(channelId, userId1, sampleContent);
      const newContent = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Updated' }] }] });

      const edited = editMessage(msg.id, userId1, newContent);

      expect(edited.content).toBe(newContent);
      // 編集済みフラグが立っていること
      expect(edited.isEdited).toBe(true);
    });

    it('投稿者以外が編集しようとすると 403 を投げる', () => {
      const msg = createMessage(channelId, userId1, sampleContent);

      // userId2 は投稿者ではないため編集不可 → 403 Forbidden
      expect(() => editMessage(msg.id, userId2, sampleContent)).toThrow(
        expect.objectContaining({ statusCode: 403 }),
      );
    });

    it('存在しないメッセージを編集しようとすると 404 を投げる', () => {
      expect(() => editMessage(99999, userId1, sampleContent)).toThrow(
        expect.objectContaining({ statusCode: 404 }),
      );
    });
  });

  describe('deleteMessage', () => {
    it('投稿者が削除するとソフトデリートされ isDeleted が true になる', () => {
      const msg = createMessage(channelId, userId1, sampleContent);

      // 物理削除ではなくソフトデリート（is_deleted = 1）
      deleteMessage(msg.id, userId1);
      const found = getMessageById(msg.id);
      expect(found?.isDeleted).toBe(true);
    });

    it('投稿者以外が削除しようとすると 403 を投げる', () => {
      const msg = createMessage(channelId, userId1, sampleContent);

      // userId2 は投稿者ではないため削除不可 → 403 Forbidden
      expect(() => deleteMessage(msg.id, userId2)).toThrow(
        expect.objectContaining({ statusCode: 403 }),
      );
    });

    it('存在しないメッセージを削除しようとすると 404 を投げる', () => {
      expect(() => deleteMessage(99999, userId1)).toThrow(
        expect.objectContaining({ statusCode: 404 }),
      );
    });
  });

  describe('getMessageById', () => {
    it('存在する ID を渡すとメッセージを返す', () => {
      const msg = createMessage(channelId, userId1, sampleContent);
      expect(getMessageById(msg.id)).not.toBeNull();
    });

    it('存在しない ID を渡すと null を返す', () => {
      expect(getMessageById(99999)).toBeNull();
    });
  });
});

// initializeSchema は jest.requireActual 経由でのみ使用しているため、
// TypeScript の未使用インポートエラーを抑制するための参照
void initializeSchema;
