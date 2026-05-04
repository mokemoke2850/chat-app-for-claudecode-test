/**
 * テスト対象: mentions.channel_id=0 レガシーデータの既読化修正
 * - A. backfillMentionChannelId スクリプト: channel_id=0 のデータを messages から復旧する
 * - B. markChannelAsRead の修正: messages JOIN ベースのクエリで channel_id=0 でも正しく既読化する
 * - C. getChannelsForUser の mentionCount: channel_id=0 レガシーデータでも正しくカウントする
 * 戦略: pg-mem のインメモリ DB でレガシーフィクスチャ（channel_id=0）を直接 INSERT して動作検証する
 */

import { getSharedTestDatabase, resetTestData } from './__fixtures__/pgTestHelper';

const testDb = getSharedTestDatabase();

jest.mock('../db/database', () => testDb);

import { markChannelAsRead, getChannelsForUser } from '../services/channelService';
import { backfillMentionChannelId } from '../scripts/backfillMentionChannelId';

let userId1: number;
let userId2: number;
let channelId: number;
let channelId2: number;

beforeEach(async () => {
  await resetTestData(testDb);

  const r1 = await testDb.execute(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
    ['legacy-user1', 'legacy-u1@t.com', 'h'],
  );
  userId1 = r1.rows[0].id as number;

  const r2 = await testDb.execute(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
    ['legacy-user2', 'legacy-u2@t.com', 'h'],
  );
  userId2 = r2.rows[0].id as number;

  const rc1 = await testDb.execute(
    'INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id',
    ['legacy-test-channel', userId1],
  );
  channelId = rc1.rows[0].id as number;

  const rc2 = await testDb.execute(
    'INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id',
    ['legacy-other-channel', userId1],
  );
  channelId2 = rc2.rows[0].id as number;
});

describe('backfillMentionChannelId スクリプト', () => {
  describe('channel_id=0 のレガシーデータ復旧', () => {
    it('channel_id=0 のメンションレコードを messages.channel_id から正しく更新する', async () => {
      // メッセージを正しい channel_id で作成
      const msgRow = await testDb.execute(
        'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
        [channelId, userId2, 'hello @user1'],
      );
      const msgId = msgRow.rows[0].id as number;

      // channel_id=0 のレガシーメンションを直接INSERT
      await testDb.execute(
        'INSERT INTO mentions (message_id, mentioned_user_id, channel_id, is_read) VALUES ($1, $2, 0, false)',
        [msgId, userId1],
      );

      // バックフィル実行
      const updatedCount = await backfillMentionChannelId();

      // channel_id が messages.channel_id に更新されていること
      const mention = await testDb.queryOne<{ channel_id: number }>(
        'SELECT channel_id FROM mentions WHERE message_id = $1 AND mentioned_user_id = $2',
        [msgId, userId1],
      );
      expect(mention!.channel_id).toBe(channelId);
      expect(updatedCount).toBe(1);
    });

    it('channel_id=0 でないレコードは変更しない（正常データを上書きしない）', async () => {
      const msgRow = await testDb.execute(
        'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
        [channelId, userId2, 'hello @user1'],
      );
      const msgId = msgRow.rows[0].id as number;

      // channel_id が正常値（channelId2）のメンション（本来と異なるが意図的な値として扱う）
      await testDb.execute(
        'INSERT INTO mentions (message_id, mentioned_user_id, channel_id, is_read) VALUES ($1, $2, $3, false)',
        [msgId, userId1, channelId2],
      );

      await backfillMentionChannelId();

      // 正常データは channelId2 のまま変わらない
      const mention = await testDb.queryOne<{ channel_id: number }>(
        'SELECT channel_id FROM mentions WHERE message_id = $1 AND mentioned_user_id = $2',
        [msgId, userId1],
      );
      expect(mention!.channel_id).toBe(channelId2);
    });

    it('複数件の channel_id=0 レコードをまとめて更新できる', async () => {
      // 3つのメッセージを同一チャンネルに作成
      for (let i = 0; i < 3; i++) {
        const r = await testDb.execute(
          'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
          [channelId, userId2, `msg${i}`],
        );
        await testDb.execute(
          'INSERT INTO mentions (message_id, mentioned_user_id, channel_id, is_read) VALUES ($1, $2, 0, false)',
          [r.rows[0].id, userId1],
        );
      }

      const updatedCount = await backfillMentionChannelId();
      expect(updatedCount).toBe(3);

      // 全件が channelId に更新されていること
      const mentions = await testDb.query<{ channel_id: number }>(
        'SELECT channel_id FROM mentions WHERE mentioned_user_id = $1',
        [userId1],
      );
      expect(mentions.every((m) => m.channel_id === channelId)).toBe(true);
    });

    it('channel_id=0 のレコードがない場合は何も変更しない（冪等性）', async () => {
      const msgRow = await testDb.execute(
        'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
        [channelId, userId2, 'hello'],
      );
      // 正常な channel_id でメンション作成
      await testDb.execute(
        'INSERT INTO mentions (message_id, mentioned_user_id, channel_id, is_read) VALUES ($1, $2, $3, false)',
        [msgRow.rows[0].id, userId1, channelId],
      );

      const updatedCount = await backfillMentionChannelId();
      expect(updatedCount).toBe(0);
    });
  });
});

describe('markChannelAsRead - channel_id=0 レガシーデータの既読化', () => {
  describe('messages JOIN ベースの既読化クエリ', () => {
    it('channel_id=0 のレガシーメンションがチャンネルを開くと既読になる', async () => {
      const msgRow = await testDb.execute(
        'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
        [channelId, userId2, 'hello @user1'],
      );
      const msgId = msgRow.rows[0].id as number;

      // channel_id=0 のレガシーメンション
      await testDb.execute(
        'INSERT INTO mentions (message_id, mentioned_user_id, channel_id, is_read) VALUES ($1, $2, 0, false)',
        [msgId, userId1],
      );

      await markChannelAsRead(channelId, userId1);

      const mention = await testDb.queryOne<{ is_read: boolean }>(
        'SELECT is_read FROM mentions WHERE message_id = $1 AND mentioned_user_id = $2',
        [msgId, userId1],
      );
      expect(mention!.is_read).toBe(true);
    });

    it('channel_id が正常値のメンションも引き続き既読になる（regression なし）', async () => {
      const msgRow = await testDb.execute(
        'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
        [channelId, userId2, 'hello @user1'],
      );
      const msgId = msgRow.rows[0].id as number;

      // 正常な channel_id のメンション
      await testDb.execute(
        'INSERT INTO mentions (message_id, mentioned_user_id, channel_id, is_read) VALUES ($1, $2, $3, false)',
        [msgId, userId1, channelId],
      );

      await markChannelAsRead(channelId, userId1);

      const mention = await testDb.queryOne<{ is_read: boolean }>(
        'SELECT is_read FROM mentions WHERE message_id = $1 AND mentioned_user_id = $2',
        [msgId, userId1],
      );
      expect(mention!.is_read).toBe(true);
    });

    it('channel_id=0 と正常 channel_id が混在する場合、両方まとめて既読になる', async () => {
      // メッセージ1: channel_id=0 のレガシーメンション
      const msg1Row = await testDb.execute(
        'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
        [channelId, userId2, 'legacy msg'],
      );
      const msg1Id = msg1Row.rows[0].id as number;
      await testDb.execute(
        'INSERT INTO mentions (message_id, mentioned_user_id, channel_id, is_read) VALUES ($1, $2, 0, false)',
        [msg1Id, userId1],
      );

      // メッセージ2: 正常 channel_id のメンション
      const msg2Row = await testDb.execute(
        'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
        [channelId, userId2, 'normal msg'],
      );
      const msg2Id = msg2Row.rows[0].id as number;
      await testDb.execute(
        'INSERT INTO mentions (message_id, mentioned_user_id, channel_id, is_read) VALUES ($1, $2, $3, false)',
        [msg2Id, userId1, channelId],
      );

      await markChannelAsRead(channelId, userId1);

      const mentions = await testDb.query<{ is_read: boolean }>(
        'SELECT is_read FROM mentions WHERE mentioned_user_id = $1',
        [userId1],
      );
      expect(mentions.every((m) => m.is_read)).toBe(true);
    });

    it('別チャンネルのメンションは既読にならない', async () => {
      // channelId のメッセージ（channel_id=0 レガシー）
      const msg1Row = await testDb.execute(
        'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
        [channelId, userId2, 'ch1 msg'],
      );
      await testDb.execute(
        'INSERT INTO mentions (message_id, mentioned_user_id, channel_id, is_read) VALUES ($1, $2, 0, false)',
        [msg1Row.rows[0].id, userId1],
      );

      // channelId2 のメッセージ（別チャンネル）
      const msg2Row = await testDb.execute(
        'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
        [channelId2, userId2, 'ch2 msg'],
      );
      await testDb.execute(
        'INSERT INTO mentions (message_id, mentioned_user_id, channel_id, is_read) VALUES ($1, $2, $3, false)',
        [msg2Row.rows[0].id, userId1, channelId2],
      );

      // channelId のみ既読化
      await markChannelAsRead(channelId, userId1);

      const ch2Mention = await testDb.queryOne<{ is_read: boolean }>(
        'SELECT is_read FROM mentions WHERE message_id = $1 AND mentioned_user_id = $2',
        [msg2Row.rows[0].id, userId1],
      );
      // channelId2 のメンションは未読のまま
      expect(ch2Mention!.is_read).toBe(false);
    });
  });
});

describe('getChannelsForUser - channel_id=0 レガシーデータの mentionCount', () => {
  describe('messages JOIN ベースの mentionCount 集計', () => {
    it('channel_id=0 のレガシーメンションが mentionCount に含まれる', async () => {
      const msgRow = await testDb.execute(
        'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
        [channelId, userId2, 'legacy mention msg'],
      );
      const msgId = msgRow.rows[0].id as number;

      // channel_id=0 のレガシーメンションを挿入
      await testDb.execute(
        'INSERT INTO mentions (message_id, mentioned_user_id, channel_id, is_read) VALUES ($1, $2, 0, false)',
        [msgId, userId1],
      );

      const channels = await getChannelsForUser(userId1);
      const ch = channels.find((c) => c.id === channelId);
      expect(ch).toBeDefined();
      // channel_id=0 のレガシーデータもメンションカウントに含まれること
      expect(ch!.mentionCount).toBe(1);
    });

    it('channel_id=0 のレガシーメンションを既読化すると mentionCount が減る', async () => {
      const msgRow = await testDb.execute(
        'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
        [channelId, userId2, 'legacy mention msg'],
      );
      const msgId = msgRow.rows[0].id as number;

      await testDb.execute(
        'INSERT INTO mentions (message_id, mentioned_user_id, channel_id, is_read) VALUES ($1, $2, 0, false)',
        [msgId, userId1],
      );

      // 既読前: mentionCount = 1
      let channels = await getChannelsForUser(userId1);
      expect(channels.find((c) => c.id === channelId)!.mentionCount).toBe(1);

      // markChannelAsRead で既読化
      await markChannelAsRead(channelId, userId1);

      // 既読後: mentionCount = 0
      channels = await getChannelsForUser(userId1);
      expect(channels.find((c) => c.id === channelId)!.mentionCount).toBe(0);
    });
  });
});
