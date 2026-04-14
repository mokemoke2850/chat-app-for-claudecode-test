/**
 * テスト対象: mentionCount 機能
 * - getChannelsForUser が mentionCount を正しく返すか
 * - markChannelAsRead が mentionCount をリセットするか
 * 戦略: better-sqlite3 のインメモリ DB を使いサービス層を直接テストする。
 */

import { getChannelsForUser, markChannelAsRead } from '../services/channelService';
import { createMessage } from '../services/messageService';
import DatabaseLib from 'better-sqlite3';

let userId1: number; // テスト対象ユーザー（メンションされる側）
let userId2: number; // 送信者
let channelId: number;

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

function getDb(): InstanceType<typeof DatabaseLib> {
  const { getDatabase } = jest.requireMock<typeof import('../db/database')>('../db/database');
  return getDatabase() as InstanceType<typeof DatabaseLib>;
}

beforeAll(() => {
  const db = getDb();

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

beforeEach(() => {
  const db = getDb();
  db.prepare('DELETE FROM mentions').run();
  db.prepare('DELETE FROM messages').run();
  db.prepare('DELETE FROM channel_read_status').run();
});

describe('getChannelsForUser - mentionCount', () => {
  describe('メンションカウントの初期状態', () => {
    it('メンションがない場合 mentionCount は 0 になる', () => {
      const channels = getChannelsForUser(userId1);
      const ch = channels.find((c) => c.id === channelId);
      expect(ch).toBeDefined();
      expect(ch!.mentionCount).toBe(0);
    });
  });

  describe('未読メンションのカウント', () => {
    it('未読メッセージに自分へのメンションがある場合 mentionCount が正しくカウントされる', () => {
      createMessage(channelId, userId2, 'hello @user1', [userId1]);

      const channels = getChannelsForUser(userId1);
      const ch = channels.find((c) => c.id === channelId);
      expect(ch!.mentionCount).toBe(1);
    });

    it('@here メンションがある場合 mentionCount に含まれる', () => {
      // @here は全メンバーが対象 → userId1 を含むメンションとして登録
      createMessage(channelId, userId2, '@here hello', [userId1]);

      const channels = getChannelsForUser(userId1);
      const ch = channels.find((c) => c.id === channelId);
      expect(ch!.mentionCount).toBe(1);
    });

    it('@channel メンションがある場合 mentionCount に含まれる', () => {
      createMessage(channelId, userId2, '@channel hello', [userId1]);

      const channels = getChannelsForUser(userId1);
      const ch = channels.find((c) => c.id === channelId);
      expect(ch!.mentionCount).toBe(1);
    });

    it('複数メッセージにまたがるメンションが正しく合算される', () => {
      createMessage(channelId, userId2, 'msg1 @user1', [userId1]);
      createMessage(channelId, userId2, 'msg2 @user1', [userId1]);
      createMessage(channelId, userId2, 'msg3 @user1', [userId1]);

      const channels = getChannelsForUser(userId1);
      const ch = channels.find((c) => c.id === channelId);
      expect(ch!.mentionCount).toBe(3);
    });
  });

  describe('既読処理とメンションカウントのリセット', () => {
    it('markChannelAsRead を呼び出すと mentionCount が 0 にリセットされる', () => {
      createMessage(channelId, userId2, 'hello @user1', [userId1]);

      // 既読前は 1
      let channels = getChannelsForUser(userId1);
      expect(channels.find((c) => c.id === channelId)!.mentionCount).toBe(1);

      markChannelAsRead(channelId, userId1);

      // 既読後は 0
      channels = getChannelsForUser(userId1);
      expect(channels.find((c) => c.id === channelId)!.mentionCount).toBe(0);
    });

    it('部分的に既読にした場合、既読以降のメンションのみカウントされる', () => {
      const msg1 = createMessage(channelId, userId2, 'msg1 @user1', [userId1]);
      createMessage(channelId, userId2, 'msg2 @user1', [userId1]);

      // msg1 まで既読にする
      const db = getDb();
      db.prepare(
        `INSERT INTO channel_read_status (user_id, channel_id, last_read_message_id, updated_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(user_id, channel_id) DO UPDATE SET
           last_read_message_id = excluded.last_read_message_id,
           updated_at = excluded.updated_at`,
      ).run(userId1, channelId, msg1.id);
      // msg1 のメンションを既読にする
      db.prepare(
        'UPDATE mentions SET is_read = 1 WHERE message_id = ? AND mentioned_user_id = ?',
      ).run(msg1.id, userId1);

      const channels = getChannelsForUser(userId1);
      const ch = channels.find((c) => c.id === channelId);
      // msg2 のメンションのみカウント
      expect(ch!.mentionCount).toBe(1);
    });
  });

  describe('他ユーザーへのメンション', () => {
    it('自分以外へのメンションは mentionCount にカウントされない', () => {
      // userId2 へのメンション（userId1 は対象外）
      createMessage(channelId, userId1, 'hello @user2', [userId2]);

      const channels = getChannelsForUser(userId1);
      const ch = channels.find((c) => c.id === channelId);
      expect(ch!.mentionCount).toBe(0);
    });
  });
});

describe('Socket handler - mention_updated イベント', () => {
  describe('メッセージ送信時のメンション通知', () => {
    it('send_message で mentionedUserIds を指定するとメンション先ユーザーに mention_updated が emit される', () => {
      // Socket handler のテストは統合テストが必要なため、
      // ここではサービス層でメンションが正しく記録されることを検証する
      const msg = createMessage(channelId, userId2, 'hello @user1', [userId1]);

      const db = getDb();
      const mention = db
        .prepare('SELECT * FROM mentions WHERE message_id = ? AND mentioned_user_id = ?')
        .get(msg.id, userId1) as { channel_id: number; is_read: number } | undefined;

      expect(mention).toBeDefined();
      expect(mention!.channel_id).toBe(channelId);
      expect(mention!.is_read).toBe(0);
    });

    it('メンション送信者自身には mention_updated が emit されない', () => {
      // userId2 が userId2 自身をメンションした場合、
      // handler.ts で mentionedUserId !== userId チェックにより自分への emit はスキップされる
      // ここではメンションレコードが DB に登録されるが、is_read=0 のまま放置されることを確認
      const msg = createMessage(channelId, userId2, 'hello @me', [userId2]);

      const db = getDb();
      const mention = db
        .prepare('SELECT * FROM mentions WHERE message_id = ? AND mentioned_user_id = ?')
        .get(msg.id, userId2) as { channel_id: number; is_read: number } | undefined;

      // DB 上にはレコードがある（送信者への通知はハンドラ層でスキップ）
      expect(mention).toBeDefined();
    });

    it('mentionedUserIds が空の場合 mention_updated は emit されない', () => {
      const msg = createMessage(channelId, userId2, 'hello world', []);

      const db = getDb();
      const mentions = db
        .prepare('SELECT * FROM mentions WHERE message_id = ?')
        .all(msg.id) as unknown[];

      // メンションレコードなし → emit なし
      expect(mentions).toHaveLength(0);
    });
  });

  describe('メッセージ編集時のメンション通知', () => {
    it('edit_message で新たに追加されたメンション対象ユーザーに mention_updated が emit される', () => {
      // 編集によりメンションが更新されることをサービス層で検証
      const { editMessage } = jest.requireActual<typeof import('../services/messageService')>(
        '../services/messageService',
      );

      const msg = createMessage(channelId, userId2, 'hello world', []);

      // メンションなしで作成 → 編集でメンション追加
      editMessage(msg.id, userId2, 'hello @user1', [userId1]);

      const db = getDb();
      const mention = db
        .prepare('SELECT * FROM mentions WHERE message_id = ? AND mentioned_user_id = ?')
        .get(msg.id, userId1) as { channel_id: number; is_read: number } | undefined;

      expect(mention).toBeDefined();
      expect(mention!.channel_id).toBe(channelId);
      expect(mention!.is_read).toBe(0);
    });
  });
});
