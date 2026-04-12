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

import {
  getChannelById,
  createChannel,
  deleteChannel,
  createPrivateChannel,
  addChannelMember,
  getChannelsForUser,
  markChannelAsRead,
} from '../../services/channelService';
import type { Channel } from '@chat-app/shared';
import { initializeSchema } from '../../db/database';
import DatabaseLib from 'better-sqlite3';

// チャンネルの created_by として使用するテスト用ユーザーの ID
let testUserId: number;

// 本番 DB モジュールをインメモリ SQLite に差し替える
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
  // channelService の外部キー制約を満たすため、
  // authService を経由せずテスト用ユーザーを直接 DB に挿入する
  const DB = DatabaseLib;
  const { getDatabase } = jest.requireMock<typeof import('../../db/database')>('../../db/database');
  const db = getDatabase() as InstanceType<typeof DB>;
  const result = db
    .prepare(
      "INSERT INTO users (username, email, password_hash) VALUES ('owner', 'owner@test.com', 'hash')",
    )
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

describe('PrivateChannel（プライベートチャンネル）', () => {
  let anotherUserId: number;

  beforeAll(() => {
    const { getDatabase } =
      jest.requireMock<typeof import('../../db/database')>('../../db/database');
    const db = getDatabase() as ReturnType<typeof DatabaseLib>;
    const result = db
      .prepare(
        "INSERT INTO users (username, email, password_hash) VALUES ('member', 'member@test.com', 'hash')",
      )
      .run();
    anotherUserId = result.lastInsertRowid as number;
  });

  describe('createPrivateChannel', () => {
    it('isPrivate=true のプライベートチャンネルを作成でき、作成者が初期メンバーになる', () => {
      const channel = createPrivateChannel('private-ch', undefined, testUserId, []);

      expect(channel.isPrivate).toBe(true);

      // 作成者が channel_members に追加されていることを DB で確認
      const { getDatabase } =
        jest.requireMock<typeof import('../../db/database')>('../../db/database');
      const db = getDatabase() as ReturnType<typeof DatabaseLib>;
      const member = db
        .prepare('SELECT * FROM channel_members WHERE channel_id = ? AND user_id = ?')
        .get(channel.id, testUserId);
      expect(member).toBeDefined();
    });

    it('指定したメンバーIDも初期メンバーとして追加される', () => {
      const channel = createPrivateChannel('private-ch2', undefined, testUserId, [anotherUserId]);

      const { getDatabase } =
        jest.requireMock<typeof import('../../db/database')>('../../db/database');
      const db = getDatabase() as ReturnType<typeof DatabaseLib>;
      const member = db
        .prepare('SELECT * FROM channel_members WHERE channel_id = ? AND user_id = ?')
        .get(channel.id, anotherUserId);
      expect(member).toBeDefined();
    });
  });

  describe('getChannelsForUser', () => {
    it('公開チャンネルは全ユーザーに返る', () => {
      const pub = createChannel('pub-ch-for-user', undefined, testUserId);

      const channels = getChannelsForUser(anotherUserId);
      expect(channels.some((c: Channel) => c.id === pub.id)).toBe(true);
    });

    it('プライベートチャンネルはメンバーのユーザーにのみ返る', () => {
      const priv = createPrivateChannel('priv-member', undefined, testUserId, [anotherUserId]);

      const channels = getChannelsForUser(anotherUserId);
      expect(channels.some((c: Channel) => c.id === priv.id)).toBe(true);
    });

    it('プライベートチャンネルは非メンバーのユーザーには返らない', () => {
      const priv = createPrivateChannel('priv-no-member', undefined, testUserId, []);

      const channels = getChannelsForUser(anotherUserId);
      expect(channels.some((c: Channel) => c.id === priv.id)).toBe(false);
    });

    it('返り値の各チャンネルに unreadCount フィールドが含まれる', () => {
      const ch = createChannel('unread-field-ch', undefined, testUserId);
      const channels = getChannelsForUser(testUserId);
      const found = channels.find((c: Channel) => c.id === ch.id);
      expect(found).toBeDefined();
      expect(typeof found?.unreadCount).toBe('number');
    });

    it('channel_read_status が存在しない（一度も開いていない）チャンネルは全メッセージ数を unreadCount として返す', () => {
      const { getDatabase } =
        jest.requireMock<typeof import('../../db/database')>('../../db/database');
      const db = getDatabase() as ReturnType<typeof DatabaseLib>;

      const ch = createChannel('unread-never-open', undefined, testUserId);
      // メッセージを2件挿入
      db.prepare('INSERT INTO messages (channel_id, user_id, content) VALUES (?, ?, ?)').run(
        ch.id,
        testUserId,
        'msg1',
      );
      db.prepare('INSERT INTO messages (channel_id, user_id, content) VALUES (?, ?, ?)').run(
        ch.id,
        testUserId,
        'msg2',
      );

      const channels = getChannelsForUser(anotherUserId);
      const found = channels.find((c: Channel) => c.id === ch.id);
      expect(found?.unreadCount).toBe(2);
    });

    it('channel_read_status が存在するチャンネルは last_read_message_id より後のメッセージ数を unreadCount として返す', () => {
      const { getDatabase } =
        jest.requireMock<typeof import('../../db/database')>('../../db/database');
      const db = getDatabase() as ReturnType<typeof DatabaseLib>;

      const ch = createChannel('unread-partial-read', undefined, testUserId);
      const r1 = db
        .prepare('INSERT INTO messages (channel_id, user_id, content) VALUES (?, ?, ?)')
        .run(ch.id, testUserId, 'first');
      db.prepare('INSERT INTO messages (channel_id, user_id, content) VALUES (?, ?, ?)').run(
        ch.id,
        testUserId,
        'second',
      );
      // r1 のメッセージIDまで既読にする
      db.prepare(
        `INSERT INTO channel_read_status (user_id, channel_id, last_read_message_id) VALUES (?, ?, ?)`,
      ).run(anotherUserId, ch.id, r1.lastInsertRowid);

      const channels = getChannelsForUser(anotherUserId);
      const found = channels.find((c: Channel) => c.id === ch.id);
      // 'second' の1件のみ未読
      expect(found?.unreadCount).toBe(1);
    });

    it('全メッセージを既読にした場合 unreadCount が 0 になる', () => {
      const { getDatabase } =
        jest.requireMock<typeof import('../../db/database')>('../../db/database');
      const db = getDatabase() as ReturnType<typeof DatabaseLib>;

      const ch = createChannel('unread-all-read', undefined, testUserId);
      const r = db
        .prepare('INSERT INTO messages (channel_id, user_id, content) VALUES (?, ?, ?)')
        .run(ch.id, testUserId, 'msg');
      db.prepare(
        `INSERT INTO channel_read_status (user_id, channel_id, last_read_message_id) VALUES (?, ?, ?)`,
      ).run(anotherUserId, ch.id, r.lastInsertRowid);

      const channels = getChannelsForUser(anotherUserId);
      const found = channels.find((c: Channel) => c.id === ch.id);
      expect(found?.unreadCount).toBe(0);
    });
  });

  describe('markChannelAsRead', () => {
    it('初回呼び出しで channel_read_status レコードが作成される', () => {
      const { getDatabase } =
        jest.requireMock<typeof import('../../db/database')>('../../db/database');
      const db = getDatabase() as ReturnType<typeof DatabaseLib>;

      const ch = createChannel('mark-read-init', undefined, testUserId);
      db.prepare('INSERT INTO messages (channel_id, user_id, content) VALUES (?, ?, ?)').run(
        ch.id,
        testUserId,
        'hello',
      );

      markChannelAsRead(ch.id, anotherUserId);

      const row = db
        .prepare('SELECT * FROM channel_read_status WHERE channel_id = ? AND user_id = ?')
        .get(ch.id, anotherUserId);
      expect(row).toBeDefined();
    });

    it('再度呼び出すと last_read_message_id が最新メッセージ ID に更新される', () => {
      const { getDatabase } =
        jest.requireMock<typeof import('../../db/database')>('../../db/database');
      const db = getDatabase() as ReturnType<typeof DatabaseLib>;

      const ch = createChannel('mark-read-update', undefined, testUserId);
      const r1 = db
        .prepare('INSERT INTO messages (channel_id, user_id, content) VALUES (?, ?, ?)')
        .run(ch.id, testUserId, 'first');

      markChannelAsRead(ch.id, anotherUserId);

      const r2 = db
        .prepare('INSERT INTO messages (channel_id, user_id, content) VALUES (?, ?, ?)')
        .run(ch.id, testUserId, 'second');

      markChannelAsRead(ch.id, anotherUserId);

      const row = db
        .prepare(
          'SELECT last_read_message_id FROM channel_read_status WHERE channel_id = ? AND user_id = ?',
        )
        .get(ch.id, anotherUserId) as { last_read_message_id: number };
      expect(row.last_read_message_id).toBe(r2.lastInsertRowid);
      expect(row.last_read_message_id).not.toBe(r1.lastInsertRowid);
    });

    it('メッセージが存在しないチャンネルで呼ぶと last_read_message_id が null になる', () => {
      const { getDatabase } =
        jest.requireMock<typeof import('../../db/database')>('../../db/database');
      const db = getDatabase() as ReturnType<typeof DatabaseLib>;

      const ch = createChannel('mark-read-empty', undefined, testUserId);
      markChannelAsRead(ch.id, anotherUserId);

      const row = db
        .prepare(
          'SELECT last_read_message_id FROM channel_read_status WHERE channel_id = ? AND user_id = ?',
        )
        .get(ch.id, anotherUserId) as { last_read_message_id: number | null };
      expect(row.last_read_message_id).toBeNull();
    });

    it('markChannelAsRead 後に getChannelsForUser を呼ぶと対象チャンネルの unreadCount が 0 になる', () => {
      const { getDatabase } =
        jest.requireMock<typeof import('../../db/database')>('../../db/database');
      const db = getDatabase() as ReturnType<typeof DatabaseLib>;

      const ch = createChannel('mark-read-then-list', undefined, testUserId);
      db.prepare('INSERT INTO messages (channel_id, user_id, content) VALUES (?, ?, ?)').run(
        ch.id,
        testUserId,
        'hello',
      );

      markChannelAsRead(ch.id, anotherUserId);

      const channels = getChannelsForUser(anotherUserId);
      const found = channels.find((c: Channel) => c.id === ch.id);
      expect(found?.unreadCount).toBe(0);
    });
  });

  describe('addChannelMember', () => {
    it('チャンネル作成者は他ユーザーをメンバーに追加できる', () => {
      const priv = createPrivateChannel('priv-add-member', undefined, testUserId, []);

      expect(() => addChannelMember(priv.id, testUserId, anotherUserId)).not.toThrow();

      const { getDatabase } =
        jest.requireMock<typeof import('../../db/database')>('../../db/database');
      const db = getDatabase() as ReturnType<typeof DatabaseLib>;
      const member = db
        .prepare('SELECT * FROM channel_members WHERE channel_id = ? AND user_id = ?')
        .get(priv.id, anotherUserId);
      expect(member).toBeDefined();
    });

    it('作成者以外がメンバー追加しようとすると 403 を投げる', () => {
      const priv = createPrivateChannel('priv-add-forbidden', undefined, testUserId, []);

      expect(() => addChannelMember(priv.id, anotherUserId, anotherUserId)).toThrow(
        expect.objectContaining({ statusCode: 403 }),
      );
    });

    it('存在しないチャンネルへのメンバー追加は 404 を投げる', () => {
      expect(() => addChannelMember(99999, testUserId, anotherUserId)).toThrow(
        expect.objectContaining({ statusCode: 404 }),
      );
    });
  });
});

// initializeSchema は jest.requireActual 経由でのみ使用しているため、
// TypeScript の未使用インポートエラーを抑制するための参照
void initializeSchema;
