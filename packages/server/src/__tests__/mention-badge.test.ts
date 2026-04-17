/**
 * テスト対象: mentionCount 機能
 * - getChannelsForUser が mentionCount を正しく返すか
 * - markChannelAsRead が mentionCount をリセットするか
 * 戦略: pg-mem のインメモリ PostgreSQL 互換 DB を使いサービス層を直接テストする。
 */

import { getSharedTestDatabase } from './__fixtures__/pgTestHelper';

const testDb = getSharedTestDatabase();

jest.mock('../db/database', () => testDb);

import { getChannelsForUser, markChannelAsRead } from '../services/channelService';
import { createMessage } from '../services/messageService';

let userId1: number; // テスト対象ユーザー（メンションされる側）
let userId2: number; // 送信者
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

beforeEach(async () => {
  await testDb.execute('DELETE FROM mentions');
  await testDb.execute('DELETE FROM messages');
  await testDb.execute('DELETE FROM channel_read_status');
});

describe('getChannelsForUser - mentionCount', () => {
  describe('メンションカウントの初期状態', () => {
    it('メンションがない場合 mentionCount は 0 になる', async () => {
      const channels = await getChannelsForUser(userId1);
      const ch = channels.find((c) => c.id === channelId);
      expect(ch).toBeDefined();
      expect(ch!.mentionCount).toBe(0);
    });
  });

  describe('未読メンションのカウント', () => {
    it('未読メッセージに自分へのメンションがある場合 mentionCount が正しくカウントされる', async () => {
      await createMessage(channelId, userId2, 'hello @user1', [userId1]);

      const channels = await getChannelsForUser(userId1);
      const ch = channels.find((c) => c.id === channelId);
      expect(ch!.mentionCount).toBe(1);
    });

    it('@here メンションがある場合 mentionCount に含まれる', async () => {
      // @here は全メンバーが対象 → userId1 を含むメンションとして登録
      await createMessage(channelId, userId2, '@here hello', [userId1]);

      const channels = await getChannelsForUser(userId1);
      const ch = channels.find((c) => c.id === channelId);
      expect(ch!.mentionCount).toBe(1);
    });

    it('@channel メンションがある場合 mentionCount に含まれる', async () => {
      await createMessage(channelId, userId2, '@channel hello', [userId1]);

      const channels = await getChannelsForUser(userId1);
      const ch = channels.find((c) => c.id === channelId);
      expect(ch!.mentionCount).toBe(1);
    });

    it('複数メッセージにまたがるメンションが正しく合算される', async () => {
      await createMessage(channelId, userId2, 'msg1 @user1', [userId1]);
      await createMessage(channelId, userId2, 'msg2 @user1', [userId1]);
      await createMessage(channelId, userId2, 'msg3 @user1', [userId1]);

      const channels = await getChannelsForUser(userId1);
      const ch = channels.find((c) => c.id === channelId);
      expect(ch!.mentionCount).toBe(3);
    });
  });

  describe('既読処理とメンションカウントのリセット', () => {
    it('markChannelAsRead を呼び出すと mentionCount が 0 にリセットされる', async () => {
      await createMessage(channelId, userId2, 'hello @user1', [userId1]);

      // 既読前は 1
      let channels = await getChannelsForUser(userId1);
      expect(channels.find((c) => c.id === channelId)!.mentionCount).toBe(1);

      await markChannelAsRead(channelId, userId1);

      // 既読後は 0
      channels = await getChannelsForUser(userId1);
      expect(channels.find((c) => c.id === channelId)!.mentionCount).toBe(0);
    });

    it('部分的に既読にした場合、既読以降のメンションのみカウントされる', async () => {
      const msg1 = await createMessage(channelId, userId2, 'msg1 @user1', [userId1]);
      await createMessage(channelId, userId2, 'msg2 @user1', [userId1]);

      // msg1 まで既読にする
      await testDb.execute(
        `INSERT INTO channel_read_status (user_id, channel_id, last_read_message_id, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT(user_id, channel_id) DO UPDATE SET
           last_read_message_id = EXCLUDED.last_read_message_id,
           updated_at = EXCLUDED.updated_at`,
        [userId1, channelId, msg1.id],
      );
      // msg1 のメンションを既読にする
      await testDb.execute(
        'UPDATE mentions SET is_read = true WHERE message_id = $1 AND mentioned_user_id = $2',
        [msg1.id, userId1],
      );

      const channels = await getChannelsForUser(userId1);
      const ch = channels.find((c) => c.id === channelId);
      // msg2 のメンションのみカウント
      expect(ch!.mentionCount).toBe(1);
    });
  });

  describe('他ユーザーへのメンション', () => {
    it('自分以外へのメンションは mentionCount にカウントされない', async () => {
      // userId2 へのメンション（userId1 は対象外）
      await createMessage(channelId, userId1, 'hello @user2', [userId2]);

      const channels = await getChannelsForUser(userId1);
      const ch = channels.find((c) => c.id === channelId);
      expect(ch!.mentionCount).toBe(0);
    });
  });
});

describe('Socket handler - mention_updated イベント', () => {
  describe('メッセージ送信時のメンション通知', () => {
    it('send_message で mentionedUserIds を指定するとメンション先ユーザーに mention_updated が emit される', async () => {
      // Socket handler のテストは統合テストが必要なため、
      // ここではサービス層でメンションが正しく記録されることを検証する
      const msg = await createMessage(channelId, userId2, 'hello @user1', [userId1]);

      const mention = await testDb.queryOne<{ channel_id: number; is_read: boolean }>(
        'SELECT * FROM mentions WHERE message_id = $1 AND mentioned_user_id = $2',
        [msg.id, userId1],
      );

      expect(mention).toBeDefined();
      expect(mention!.channel_id).toBe(channelId);
      expect(mention!.is_read).toBe(false);
    });

    it('メンション送信者自身には mention_updated が emit されない', async () => {
      // userId2 が userId2 自身をメンションした場合、
      // handler.ts で mentionedUserId !== userId チェックにより自分への emit はスキップされる
      // ここではメンションレコードが DB に登録されるが、is_read=false のまま放置されることを確認
      const msg = await createMessage(channelId, userId2, 'hello @me', [userId2]);

      const mention = await testDb.queryOne(
        'SELECT * FROM mentions WHERE message_id = $1 AND mentioned_user_id = $2',
        [msg.id, userId2],
      );

      // DB 上にはレコードがある（送信者への通知はハンドラ層でスキップ）
      expect(mention).toBeDefined();
    });

    it('mentionedUserIds が空の場合 mention_updated は emit されない', async () => {
      const msg = await createMessage(channelId, userId2, 'hello world', []);

      const mentions = await testDb.query(
        'SELECT * FROM mentions WHERE message_id = $1',
        [msg.id],
      );

      // メンションレコードなし → emit なし
      expect(mentions).toHaveLength(0);
    });
  });

  describe('メッセージ編集時のメンション通知', () => {
    it('edit_message で新たに追加されたメンション対象ユーザーに mention_updated が emit される', async () => {
      // 編集によりメンションが更新されることをサービス層で検証
      const { editMessage } = await import('../services/messageService');

      const msg = await createMessage(channelId, userId2, 'hello world', []);

      // メンションなしで作成 → 編集でメンション追加
      await editMessage(msg.id, userId2, 'hello @user1', [userId1]);

      const mention = await testDb.queryOne<{ channel_id: number; is_read: boolean }>(
        'SELECT * FROM mentions WHERE message_id = $1 AND mentioned_user_id = $2',
        [msg.id, userId1],
      );

      expect(mention).toBeDefined();
      expect(mention!.channel_id).toBe(channelId);
      expect(mention!.is_read).toBe(false);
    });
  });
});
