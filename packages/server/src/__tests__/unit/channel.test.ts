/**
 * ChannelService のユニットテスト
 *
 * テスト対象: packages/server/src/services/channelService.ts
 * - createChannel: チャンネル作成（名前の一意制約あり）
 * - getAllChannels: 全チャンネルを一覧取得
 * - getChannelById: ID でチャンネルを取得
 * - deleteChannel: チャンネル削除（作成者のみ許可）
 *
 * DB 戦略: pg-mem のインメモリ PostgreSQL 互換 DB を使用。
 * チャンネルは users.id への外部キーを持つため、
 * beforeAll でテスト用オーナーユーザーを直接 INSERT している。
 */

import { createTestDatabase } from '../__fixtures__/pgTestHelper';

const testDb = createTestDatabase();

jest.mock('../../db/database', () => testDb);

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

// チャンネルの created_by として使用するテスト用ユーザーの ID
let testUserId: number;

beforeAll(async () => {
  // channelService の外部キー制約を満たすため、
  // authService を経由せずテスト用ユーザーを直接 DB に挿入する
  const result = await testDb.execute(
    "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
    ['owner', 'owner@test.com', 'hash'],
  );
  testUserId = result.rows[0].id as number;
});

describe('ChannelService', () => {
  describe('createChannel', () => {
    it('チャンネルを作成し、作成されたチャンネルオブジェクトを返す', async () => {
      const channel = await createChannel('general', 'General chat', testUserId);

      expect(channel.id).toBeDefined();
      expect(channel.name).toBe('general');
      // createdBy に作成者の userId が格納されていること
      expect(channel.createdBy).toBe(testUserId);
    });

    it('同じチャンネル名を重複登録しようとすると 409 を投げる', async () => {
      await createChannel('unique-ch', undefined, testUserId);

      // チャンネル名の一意制約違反 → 409 Conflict
      await expect(createChannel('unique-ch', undefined, testUserId)).rejects.toMatchObject({
        statusCode: 409,
      });
    });
  });

  describe('getChannelById', () => {
    it('存在する ID を渡すとチャンネルを返す', async () => {
      const created = await createChannel('find-me', undefined, testUserId);
      const found = await getChannelById(created.id);
      expect(found?.name).toBe('find-me');
    });

    it('存在しない ID を渡すと null を返す', async () => {
      expect(await getChannelById(99999)).toBeNull();
    });
  });

  describe('deleteChannel', () => {
    it('作成者が削除すると正常に完了し、取得できなくなる', async () => {
      const channel = await createChannel('to-delete', undefined, testUserId);

      // 削除が例外を投げないこと
      await expect(deleteChannel(channel.id, testUserId)).resolves.not.toThrow();
      // 削除後は取得できないこと
      expect(await getChannelById(channel.id)).toBeNull();
    });

    it('作成者以外が削除しようとすると 403 を投げる', async () => {
      const channel = await createChannel('protected', undefined, testUserId);

      // 異なる userId による削除は禁止 → 403 Forbidden
      await expect(deleteChannel(channel.id, testUserId + 999)).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it('存在しないチャンネルを削除しようとすると 404 を投げる', async () => {
      await expect(deleteChannel(99999, testUserId)).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });
});

describe('PrivateChannel（プライベートチャンネル）', () => {
  let anotherUserId: number;

  beforeAll(async () => {
    const result = await testDb.execute(
      "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
      ['member', 'member@test.com', 'hash'],
    );
    anotherUserId = result.rows[0].id as number;
  });

  describe('createPrivateChannel', () => {
    it('isPrivate=true のプライベートチャンネルを作成でき、作成者が初期メンバーになる', async () => {
      const channel = await createPrivateChannel('private-ch', undefined, testUserId, []);

      expect(channel.isPrivate).toBe(true);

      // 作成者が channel_members に追加されていることを DB で確認
      const member = await testDb.queryOne(
        'SELECT * FROM channel_members WHERE channel_id = $1 AND user_id = $2',
        [channel.id, testUserId],
      );
      expect(member).toBeDefined();
    });

    it('指定したメンバーIDも初期メンバーとして追加される', async () => {
      const channel = await createPrivateChannel('private-ch2', undefined, testUserId, [anotherUserId]);

      const member = await testDb.queryOne(
        'SELECT * FROM channel_members WHERE channel_id = $1 AND user_id = $2',
        [channel.id, anotherUserId],
      );
      expect(member).toBeDefined();
    });
  });

  describe('getChannelsForUser', () => {
    it('公開チャンネルは全ユーザーに返る', async () => {
      const pub = await createChannel('pub-ch-for-user', undefined, testUserId);

      const channels = await getChannelsForUser(anotherUserId);
      expect(channels.some((c: Channel) => c.id === pub.id)).toBe(true);
    });

    it('プライベートチャンネルはメンバーのユーザーにのみ返る', async () => {
      const priv = await createPrivateChannel('priv-member', undefined, testUserId, [anotherUserId]);

      const channels = await getChannelsForUser(anotherUserId);
      expect(channels.some((c: Channel) => c.id === priv.id)).toBe(true);
    });

    it('プライベートチャンネルは非メンバーのユーザーには返らない', async () => {
      const priv = await createPrivateChannel('priv-no-member', undefined, testUserId, []);

      const channels = await getChannelsForUser(anotherUserId);
      expect(channels.some((c: Channel) => c.id === priv.id)).toBe(false);
    });

    it('返り値の各チャンネルに unreadCount フィールドが含まれる', async () => {
      const ch = await createChannel('unread-field-ch', undefined, testUserId);
      const channels = await getChannelsForUser(testUserId);
      const found = channels.find((c: Channel) => c.id === ch.id);
      expect(found).toBeDefined();
      expect(typeof found?.unreadCount).toBe('number');
    });

    it('channel_read_status が存在しない（一度も開いていない）チャンネルは全メッセージ数を unreadCount として返す', async () => {
      const ch = await createChannel('unread-never-open', undefined, testUserId);
      // メッセージを2件挿入
      await testDb.execute(
        'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3)',
        [ch.id, testUserId, 'msg1'],
      );
      await testDb.execute(
        'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3)',
        [ch.id, testUserId, 'msg2'],
      );

      const channels = await getChannelsForUser(anotherUserId);
      const found = channels.find((c: Channel) => c.id === ch.id);
      expect(found?.unreadCount).toBe(2);
    });

    it('channel_read_status が存在するチャンネルは last_read_message_id より後のメッセージ数を unreadCount として返す', async () => {
      const ch = await createChannel('unread-partial-read', undefined, testUserId);
      const r1 = await testDb.execute(
        'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
        [ch.id, testUserId, 'first'],
      );
      await testDb.execute(
        'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3)',
        [ch.id, testUserId, 'second'],
      );
      // r1 のメッセージIDまで既読にする
      await testDb.execute(
        'INSERT INTO channel_read_status (user_id, channel_id, last_read_message_id) VALUES ($1, $2, $3)',
        [anotherUserId, ch.id, r1.rows[0].id],
      );

      const channels = await getChannelsForUser(anotherUserId);
      const found = channels.find((c: Channel) => c.id === ch.id);
      // 'second' の1件のみ未読
      expect(found?.unreadCount).toBe(1);
    });

    it('全メッセージを既読にした場合 unreadCount が 0 になる', async () => {
      const ch = await createChannel('unread-all-read', undefined, testUserId);
      const r = await testDb.execute(
        'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
        [ch.id, testUserId, 'msg'],
      );
      await testDb.execute(
        'INSERT INTO channel_read_status (user_id, channel_id, last_read_message_id) VALUES ($1, $2, $3)',
        [anotherUserId, ch.id, r.rows[0].id],
      );

      const channels = await getChannelsForUser(anotherUserId);
      const found = channels.find((c: Channel) => c.id === ch.id);
      expect(found?.unreadCount).toBe(0);
    });
  });

  describe('markChannelAsRead', () => {
    it('初回呼び出しで channel_read_status レコードが作成される', async () => {
      const ch = await createChannel('mark-read-init', undefined, testUserId);
      await testDb.execute(
        'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3)',
        [ch.id, testUserId, 'hello'],
      );

      await markChannelAsRead(ch.id, anotherUserId);

      const row = await testDb.queryOne(
        'SELECT * FROM channel_read_status WHERE channel_id = $1 AND user_id = $2',
        [ch.id, anotherUserId],
      );
      expect(row).toBeDefined();
    });

    it('再度呼び出すと last_read_message_id が最新メッセージ ID に更新される', async () => {
      const ch = await createChannel('mark-read-update', undefined, testUserId);
      const r1 = await testDb.execute(
        'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
        [ch.id, testUserId, 'first'],
      );

      await markChannelAsRead(ch.id, anotherUserId);

      const r2 = await testDb.execute(
        'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
        [ch.id, testUserId, 'second'],
      );

      await markChannelAsRead(ch.id, anotherUserId);

      const row = await testDb.queryOne<{ last_read_message_id: number }>(
        'SELECT last_read_message_id FROM channel_read_status WHERE channel_id = $1 AND user_id = $2',
        [ch.id, anotherUserId],
      );
      expect(row!.last_read_message_id).toBe(r2.rows[0].id);
      expect(row!.last_read_message_id).not.toBe(r1.rows[0].id);
    });

    it('メッセージが存在しないチャンネルで呼ぶと last_read_message_id が null になる', async () => {
      const ch = await createChannel('mark-read-empty', undefined, testUserId);
      await markChannelAsRead(ch.id, anotherUserId);

      const row = await testDb.queryOne<{ last_read_message_id: number | null }>(
        'SELECT last_read_message_id FROM channel_read_status WHERE channel_id = $1 AND user_id = $2',
        [ch.id, anotherUserId],
      );
      expect(row!.last_read_message_id).toBeNull();
    });

    it('markChannelAsRead 後に getChannelsForUser を呼ぶと対象チャンネルの unreadCount が 0 になる', async () => {
      const ch = await createChannel('mark-read-then-list', undefined, testUserId);
      await testDb.execute(
        'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3)',
        [ch.id, testUserId, 'hello'],
      );

      await markChannelAsRead(ch.id, anotherUserId);

      const channels = await getChannelsForUser(anotherUserId);
      const found = channels.find((c: Channel) => c.id === ch.id);
      expect(found?.unreadCount).toBe(0);
    });
  });

  describe('addChannelMember', () => {
    it('チャンネル作成者は他ユーザーをメンバーに追加できる', async () => {
      const priv = await createPrivateChannel('priv-add-member', undefined, testUserId, []);

      await expect(addChannelMember(priv.id, testUserId, anotherUserId)).resolves.not.toThrow();

      const member = await testDb.queryOne(
        'SELECT * FROM channel_members WHERE channel_id = $1 AND user_id = $2',
        [priv.id, anotherUserId],
      );
      expect(member).toBeDefined();
    });

    it('作成者以外がメンバー追加しようとすると 403 を投げる', async () => {
      const priv = await createPrivateChannel('priv-add-forbidden', undefined, testUserId, []);

      await expect(addChannelMember(priv.id, anotherUserId, anotherUserId)).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it('存在しないチャンネルへのメンバー追加は 404 を投げる', async () => {
      await expect(addChannelMember(99999, testUserId, anotherUserId)).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });
});
