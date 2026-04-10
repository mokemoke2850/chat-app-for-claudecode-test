/**
 * ChannelService のユニットテスト
 *
 * テスト対象: packages/server/src/services/channelService.ts
 * - createChannel: チャンネル作成（名前の一意制約あり）
 * - getAllChannels: 全チャンネルを一覧取得
 * - getChannelById: ID でチャンネルを取得
 * - deleteChannel: チャンネル削除（作成者のみ許可）
 *
 * DB 戦略: better-sqlite3 のインメモリ DB を使用。
 * チャンネルは users.id への外部キーを持つため、
 * beforeAll でテスト用オーナーユーザーを直接 INSERT している。
 */

import { getAllChannels, getChannelById, createChannel, deleteChannel } from '../services/channelService';
import { initializeSchema } from '../db/database';
import DatabaseLib from 'better-sqlite3';

// チャンネルの created_by として使用するテスト用ユーザーの ID
let testUserId: number;

// 本番 DB モジュールをインメモリ SQLite に差し替える
jest.mock('../db/database', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const DB = require('better-sqlite3') as typeof import('better-sqlite3');
  const db = new DB(':memory:');
  db.pragma('foreign_keys = ON');
  const { initializeSchema: init } = jest.requireActual<typeof import('../db/database')>('../db/database');
  init(db);
  return {
    getDatabase: () => db,
    initializeSchema: init,
    closeDatabase: jest.fn(),
  };
});

beforeAll(() => {
  // channelService の外部キー制約を満たすため、
  // authService を経由せずテスト用ユーザーを直接 DB に挿入する
  const DB = DatabaseLib;
  const { getDatabase } = jest.requireMock<typeof import('../db/database')>('../db/database');
  const db = getDatabase() as InstanceType<typeof DB>;
  const result = db
    .prepare("INSERT INTO users (username, email, password_hash) VALUES ('owner', 'owner@test.com', 'hash')")
    .run();
  testUserId = result.lastInsertRowid as number;
});

describe('ChannelService', () => {
  describe('createChannel', () => {
    it('チャンネルを作成し、作成されたチャンネルオブジェクトを返す', () => {
      const channel = createChannel('general', 'General chat', testUserId);

      expect(channel.id).toBeDefined();
      expect(channel.name).toBe('general');
      // createdBy に作成者の userId が格納されていること
      expect(channel.createdBy).toBe(testUserId);
    });

    it('同じチャンネル名を重複登録しようとすると 409 を投げる', () => {
      createChannel('unique-ch', undefined, testUserId);

      // チャンネル名の一意制約違反 → 409 Conflict
      expect(() => createChannel('unique-ch', undefined, testUserId)).toThrow(
        expect.objectContaining({ statusCode: 409 }),
      );
    });
  });

  describe('getAllChannels', () => {
    it('チャンネル一覧を配列で返す', () => {
      const channels = getAllChannels();
      expect(Array.isArray(channels)).toBe(true);
    });
  });

  describe('getChannelById', () => {
    it('存在する ID を渡すとチャンネルを返す', () => {
      const created = createChannel('find-me', undefined, testUserId);
      const found = getChannelById(created.id);
      expect(found?.name).toBe('find-me');
    });

    it('存在しない ID を渡すと null を返す', () => {
      expect(getChannelById(99999)).toBeNull();
    });
  });

  describe('deleteChannel', () => {
    it('作成者が削除すると正常に完了し、取得できなくなる', () => {
      const channel = createChannel('to-delete', undefined, testUserId);

      // 削除が例外を投げないこと
      expect(() => deleteChannel(channel.id, testUserId)).not.toThrow();
      // 削除後は取得できないこと
      expect(getChannelById(channel.id)).toBeNull();
    });

    it('作成者以外が削除しようとすると 403 を投げる', () => {
      const channel = createChannel('protected', undefined, testUserId);

      // 異なる userId による削除は禁止 → 403 Forbidden
      expect(() => deleteChannel(channel.id, testUserId + 999)).toThrow(
        expect.objectContaining({ statusCode: 403 }),
      );
    });

    it('存在しないチャンネルを削除しようとすると 404 を投げる', () => {
      expect(() => deleteChannel(99999, testUserId)).toThrow(
        expect.objectContaining({ statusCode: 404 }),
      );
    });
  });
});

// initializeSchema は jest.requireActual 経由でのみ使用しているため、
// TypeScript の未使用インポートエラーを抑制するための参照
void initializeSchema;
