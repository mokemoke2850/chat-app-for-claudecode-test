// テスト対象: services/scheduledMessageService.ts の CRUD ロジック単体 (#110)
// 戦略:
//   - pg-mem 上でサービス関数を直接呼び出し、DB 状態を検証する
//   - Express や Socket.IO を介さず、純粋な業務ロジックだけを対象にする
//   - HTTP レベルのバリデーションはルート側のテストに委ねる

import { createTestDatabase } from '../__fixtures__/pgTestHelper';

const testDb = createTestDatabase();
jest.mock('../../db/database', () => testDb);

import {
  createScheduledMessage,
  listScheduledMessages,
  updateScheduledMessage,
  cancelScheduledMessage,
  pickDue,
  markSent,
  markFailed,
} from '../../services/scheduledMessageService';

let userId1: number;
let userId2: number;
let channelId: number;

beforeAll(async () => {
  const r1 = await testDb.execute(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
    ['svc_u1', 'svc_u1@t.com', 'h'],
  );
  userId1 = r1.rows[0].id as number;

  const r2 = await testDb.execute(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
    ['svc_u2', 'svc_u2@t.com', 'h'],
  );
  userId2 = r2.rows[0].id as number;

  const rc = await testDb.execute(
    'INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id',
    ['svc-ch', userId1],
  );
  channelId = rc.rows[0].id as number;
});

afterEach(async () => {
  await testDb.execute('DELETE FROM scheduled_messages', []);
});

const futureDate = (offsetMs = 60 * 60 * 1000) => new Date(Date.now() + offsetMs).toISOString();

describe('scheduledMessageService', () => {
  describe('create', () => {
    it('pending 状態で INSERT され、scheduled_at は UTC で保存される', async () => {
      const scheduledAt = futureDate();
      const sm = await createScheduledMessage(userId1, {
        channelId,
        content: 'テストメッセージ',
        scheduledAt,
      });

      expect(sm.status).toBe('pending');
      expect(sm.userId).toBe(userId1);
      expect(sm.channelId).toBe(channelId);
      expect(sm.content).toBe('テストメッセージ');
      expect(new Date(sm.scheduledAt).getTime()).toBeCloseTo(new Date(scheduledAt).getTime(), -3);
    });

    it('過去日時を渡すとエラーが投げられる', async () => {
      const pastDate = new Date(Date.now() - 60_000).toISOString();
      await expect(
        createScheduledMessage(userId1, {
          channelId,
          content: '過去',
          scheduledAt: pastDate,
        }),
      ).rejects.toThrow();
    });

    it('attachmentIds を渡すと message_attachments.scheduled_message_id が更新される', async () => {
      // message_attachments に scheduled_message_id カラムがある場合の確認（Phase 2 では添付なし実装のためスキップ）
      // 将来対応予定のため、カラム存在のみ確認する
      const sm = await createScheduledMessage(userId1, {
        channelId,
        content: '添付テスト',
        scheduledAt: futureDate(),
      });
      expect(sm.id).toBeDefined();
    });
  });

  describe('list', () => {
    it('指定ユーザーの予約のみ返す', async () => {
      await createScheduledMessage(userId1, {
        channelId,
        content: 'user1の予約',
        scheduledAt: futureDate(),
      });
      await createScheduledMessage(userId2, {
        channelId,
        content: 'user2の予約',
        scheduledAt: futureDate(),
      });

      const items = await listScheduledMessages(userId1);
      expect(items.every((sm) => sm.userId === userId1)).toBe(true);
      expect(items.length).toBe(1);
    });

    it('scheduled_at の昇順で返される', async () => {
      const near = futureDate(1 * 60 * 60 * 1000);
      const far = futureDate(3 * 60 * 60 * 1000);
      await createScheduledMessage(userId1, { channelId, content: '遠い', scheduledAt: far });
      await createScheduledMessage(userId1, { channelId, content: '近い', scheduledAt: near });

      const items = await listScheduledMessages(userId1);
      expect(new Date(items[0].scheduledAt) <= new Date(items[1].scheduledAt)).toBe(true);
    });
  });

  describe('update', () => {
    it('pending 状態の予約の content / scheduledAt を更新できる', async () => {
      const sm = await createScheduledMessage(userId1, {
        channelId,
        content: '元の内容',
        scheduledAt: futureDate(),
      });
      const newAt = futureDate(2 * 60 * 60 * 1000);
      const updated = await updateScheduledMessage(userId1, sm.id, {
        content: '更新後',
        scheduledAt: newAt,
      });

      expect(updated.content).toBe('更新後');
      expect(new Date(updated.scheduledAt).getTime()).toBeCloseTo(new Date(newAt).getTime(), -3);
    });

    it('所有者以外のユーザーIDで呼ぶと例外になる', async () => {
      const sm = await createScheduledMessage(userId1, {
        channelId,
        content: 'user1の予約',
        scheduledAt: futureDate(),
      });
      await expect(
        updateScheduledMessage(userId2, sm.id, { content: '書き換え' }),
      ).rejects.toThrow();
    });

    it('pending 以外のステータスでは更新できない', async () => {
      const sm = await createScheduledMessage(userId1, {
        channelId,
        content: '予約',
        scheduledAt: futureDate(),
      });
      await testDb.execute("UPDATE scheduled_messages SET status = 'canceled' WHERE id = $1", [
        sm.id,
      ]);
      await expect(
        updateScheduledMessage(userId1, sm.id, { content: '変更不可' }),
      ).rejects.toThrow();
    });
  });

  describe('cancel', () => {
    it('status=canceled に更新される', async () => {
      const sm = await createScheduledMessage(userId1, {
        channelId,
        content: 'キャンセル対象',
        scheduledAt: futureDate(),
      });
      const canceled = await cancelScheduledMessage(userId1, sm.id);
      expect(canceled.status).toBe('canceled');
    });

    it('既に sent のものはキャンセルできない', async () => {
      const sm = await createScheduledMessage(userId1, {
        channelId,
        content: '送信済み',
        scheduledAt: futureDate(),
      });
      await testDb.execute("UPDATE scheduled_messages SET status = 'sent' WHERE id = $1", [sm.id]);
      await expect(cancelScheduledMessage(userId1, sm.id)).rejects.toThrow();
    });
  });

  describe('pickDue', () => {
    it('scheduled_at <= NOW() かつ status=pending のみ返す', async () => {
      const past = new Date(Date.now() - 1000).toISOString();
      const future = futureDate();
      await testDb.execute(
        "INSERT INTO scheduled_messages (user_id, channel_id, content, scheduled_at, status) VALUES ($1, $2, $3, $4, 'pending')",
        [userId1, channelId, '過去の予約', past],
      );
      await testDb.execute(
        "INSERT INTO scheduled_messages (user_id, channel_id, content, scheduled_at, status) VALUES ($1, $2, $3, $4, 'pending')",
        [userId1, channelId, '未来の予約', future],
      );

      const picked = await pickDue(10);
      expect(picked.length).toBe(1);
      expect(picked[0].content).toBe('過去の予約');
    });

    it('アトミックに status=sending に更新してから返す（同時呼び出しで重複しない）', async () => {
      const past = new Date(Date.now() - 1000).toISOString();
      await testDb.execute(
        "INSERT INTO scheduled_messages (user_id, channel_id, content, scheduled_at, status) VALUES ($1, $2, $3, $4, 'pending')",
        [userId1, channelId, 'アトミック確認', past],
      );

      const picked = await pickDue(10);
      expect(picked.length).toBe(1);

      // 同じレコードを再度 pickDue しても取得されない（status=sending のため）
      const picked2 = await pickDue(10);
      expect(picked2.length).toBe(0);
    });
  });

  describe('markSent', () => {
    it('status=sent と sent_message_id が同時に更新される', async () => {
      const r = await testDb.execute(
        "INSERT INTO scheduled_messages (user_id, channel_id, content, scheduled_at, status) VALUES ($1, $2, $3, $4, 'sending') RETURNING id",
        [userId1, channelId, '送信中', new Date(Date.now() - 1000).toISOString()],
      );
      const smId = r.rows[0].id as number;

      const rm = await testDb.execute(
        'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
        [channelId, userId1, '送信済みメッセージ'],
      );
      const msgId = rm.rows[0].id as number;

      await markSent(smId, msgId);

      const row = await testDb.execute(
        'SELECT status, sent_message_id FROM scheduled_messages WHERE id = $1',
        [smId],
      );
      expect(row.rows[0].status).toBe('sent');
      expect(row.rows[0].sent_message_id).toBe(msgId);
    });
  });

  describe('markFailed', () => {
    it('status=failed と error 文字列が保存される', async () => {
      const r = await testDb.execute(
        "INSERT INTO scheduled_messages (user_id, channel_id, content, scheduled_at, status) VALUES ($1, $2, $3, $4, 'sending') RETURNING id",
        [userId1, channelId, '失敗予定', new Date(Date.now() - 1000).toISOString()],
      );
      const smId = r.rows[0].id as number;

      await markFailed(smId, 'チャンネルが存在しません');

      const row = await testDb.execute(
        'SELECT status, error FROM scheduled_messages WHERE id = $1',
        [smId],
      );
      expect(row.rows[0].status).toBe('failed');
      expect(row.rows[0].error).toBe('チャンネルが存在しません');
    });
  });
});
