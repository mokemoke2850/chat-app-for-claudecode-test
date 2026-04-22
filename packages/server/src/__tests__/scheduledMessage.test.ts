// テスト対象: 予約送信機能のCRUD APIとWorkerフロー (#110)
// 戦略:
//   - Express ルートハンドラを supertest で結合テスト
//   - DB は pg-mem のインメモリ、Socket.IO はモックで差し替える
//   - Worker の pickDue → createMessage → markSent の一連フローは
//     サービス層を直接呼んで検証する（setInterval はテスト中起動しない）
//   - タイムゾーンは UTC 保存 / 入力は ISO 文字列で受け取る前提を検証する

import { getSharedTestDatabase, resetTestData } from './__fixtures__/pgTestHelper';

const testDb = getSharedTestDatabase();
jest.mock('../db/database', () => testDb);

// Socket.IO サーバーモック
const mockEmit = jest.fn();
const mockSocketTo = jest.fn().mockReturnValue({ emit: mockEmit });
const mockSocketServer = { to: mockSocketTo };
jest.mock('../socket', () => ({
  getSocketServer: jest.fn(() => mockSocketServer),
}));

import request from 'supertest';
import { createApp } from '../app';
import { registerUser } from './__fixtures__/testHelpers';
import { pickDue, markSent, markFailed } from '../services/scheduledMessageService';
import { createMessage } from '../services/messageService';

const app = createApp();

let userId1: number;
let token1: string;
let userId2: number;
let token2: string;
let channelId: number;

async function setupFixtures() {
  const r1 = await testDb.execute(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
    ['api_sched_u1', 'api_sched_u1@t.com', 'h'],
  );
  userId1 = r1.rows[0].id as number;

  const r2 = await testDb.execute(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
    ['api_sched_u2', 'api_sched_u2@t.com', 'h'],
  );
  userId2 = r2.rows[0].id as number;

  const rc = await testDb.execute(
    'INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id',
    ['api-sched-ch', userId1],
  );
  channelId = rc.rows[0].id as number;
}

beforeEach(async () => {
  await resetTestData(testDb);
  await setupFixtures();
  mockSocketTo.mockClear();
  mockEmit.mockClear();
  mockSocketTo.mockReturnValue({ emit: mockEmit });

  // registerUser でトークン取得
  const reg1 = await registerUser(app, 'reg_sched1', 'reg_sched1@example.com');
  token1 = reg1.token;
  userId1 = reg1.userId;

  const reg2 = await registerUser(app, 'reg_sched2', 'reg_sched2@example.com');
  token2 = reg2.token;
  userId2 = reg2.userId;

  const rc = await testDb.execute(
    'INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id',
    ['sched-ch-api', userId1],
  );
  channelId = rc.rows[0].id as number;
});

const futureDate = (offsetMs = 60 * 60 * 1000) => new Date(Date.now() + offsetMs).toISOString();

describe('予約送信 (Scheduled Messages)', () => {
  describe('POST /api/scheduled-messages - 予約作成', () => {
    it('正常系: 未来日時を指定して予約できる', async () => {
      const scheduledAt = futureDate();
      const res = await request(app)
        .post('/api/scheduled-messages')
        .set('Cookie', `token=${token1}`)
        .send({ channelId, content: 'テスト予約', scheduledAt });

      expect(res.status).toBe(201);
      expect(res.body.scheduledMessage).toBeDefined();
      expect(res.body.scheduledMessage.status).toBe('pending');
      expect(res.body.scheduledMessage.content).toBe('テスト予約');
    });

    it('バリデーション: channelId が必須', async () => {
      const res = await request(app)
        .post('/api/scheduled-messages')
        .set('Cookie', `token=${token1}`)
        .send({ content: 'test', scheduledAt: futureDate() });

      expect(res.status).toBe(400);
    });

    it('バリデーション: content が空文字は拒否される', async () => {
      const res = await request(app)
        .post('/api/scheduled-messages')
        .set('Cookie', `token=${token1}`)
        .send({ channelId, content: '', scheduledAt: futureDate() });

      expect(res.status).toBe(400);
    });

    it('バリデーション: scheduledAt が必須', async () => {
      const res = await request(app)
        .post('/api/scheduled-messages')
        .set('Cookie', `token=${token1}`)
        .send({ channelId, content: 'test' });

      expect(res.status).toBe(400);
    });

    it('バリデーション: scheduledAt が過去日時の場合は 400 を返す', async () => {
      const pastDate = new Date(Date.now() - 60_000).toISOString();
      const res = await request(app)
        .post('/api/scheduled-messages')
        .set('Cookie', `token=${token1}`)
        .send({ channelId, content: 'test', scheduledAt: pastDate });

      expect(res.status).toBe(400);
    });

    it('バリデーション: scheduledAt の ISO 文字列は UTC として正規化して保存される', async () => {
      const scheduledAt = futureDate();
      const res = await request(app)
        .post('/api/scheduled-messages')
        .set('Cookie', `token=${token1}`)
        .send({ channelId, content: 'UTC test', scheduledAt });

      expect(res.status).toBe(201);
      // 返却値が有効な ISO 日時文字列であること
      expect(() => new Date(res.body.scheduledMessage.scheduledAt)).not.toThrow();
      expect(new Date(res.body.scheduledMessage.scheduledAt).getTime()).toBeCloseTo(
        new Date(scheduledAt).getTime(),
        -3,
      );
    });

    it('認証エラー: 未認証ユーザーは作成できない (401)', async () => {
      const res = await request(app)
        .post('/api/scheduled-messages')
        .send({ channelId, content: 'test', scheduledAt: futureDate() });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/scheduled-messages - 予約一覧', () => {
    it('正常系: 自分の予約一覧を取得できる', async () => {
      await request(app)
        .post('/api/scheduled-messages')
        .set('Cookie', `token=${token1}`)
        .send({ channelId, content: '自分の予約', scheduledAt: futureDate() });

      const res = await request(app)
        .get('/api/scheduled-messages')
        .set('Cookie', `token=${token1}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.scheduledMessages)).toBe(true);
      expect(res.body.scheduledMessages.length).toBeGreaterThanOrEqual(1);
      expect(
        res.body.scheduledMessages.every((sm: { userId: number }) => sm.userId === userId1),
      ).toBe(true);
    });

    it('他のユーザーの予約は一覧に含まれない', async () => {
      // user2 が予約作成
      await request(app)
        .post('/api/scheduled-messages')
        .set('Cookie', `token=${token2}`)
        .send({ channelId, content: 'user2の予約', scheduledAt: futureDate() });

      // user1 が取得 → user2 の予約は含まれない
      const res = await request(app)
        .get('/api/scheduled-messages')
        .set('Cookie', `token=${token1}`);

      expect(res.status).toBe(200);
      expect(
        res.body.scheduledMessages.every((sm: { userId: number }) => sm.userId !== userId2),
      ).toBe(true);
    });

    it('キャンセル済みの予約も一覧に含まれる（ステータスで区別可能）', async () => {
      // 予約して即キャンセル
      const postRes = await request(app)
        .post('/api/scheduled-messages')
        .set('Cookie', `token=${token1}`)
        .send({ channelId, content: 'キャンセル予定', scheduledAt: futureDate() });
      const smId = postRes.body.scheduledMessage.id as number;

      await request(app).delete(`/api/scheduled-messages/${smId}`).set('Cookie', `token=${token1}`);

      const res = await request(app)
        .get('/api/scheduled-messages')
        .set('Cookie', `token=${token1}`);

      expect(res.status).toBe(200);
      const canceled = res.body.scheduledMessages.find(
        (sm: { id: number; status: string }) => sm.id === smId,
      );
      expect(canceled).toBeDefined();
      expect(canceled.status).toBe('canceled');
    });

    it('認証エラー: 未認証ユーザーは取得できない (401)', async () => {
      const res = await request(app).get('/api/scheduled-messages');
      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/scheduled-messages/:id - 予約編集', () => {
    it('正常系: content と scheduledAt を更新できる', async () => {
      const postRes = await request(app)
        .post('/api/scheduled-messages')
        .set('Cookie', `token=${token1}`)
        .send({ channelId, content: '元の内容', scheduledAt: futureDate() });
      const smId = postRes.body.scheduledMessage.id as number;

      const newAt = futureDate(2 * 60 * 60 * 1000);
      const res = await request(app)
        .patch(`/api/scheduled-messages/${smId}`)
        .set('Cookie', `token=${token1}`)
        .send({ content: '更新後の内容', scheduledAt: newAt });

      expect(res.status).toBe(200);
      expect(res.body.scheduledMessage.content).toBe('更新後の内容');
    });

    it('バリデーション: 過去日時への変更は 400 を返す', async () => {
      const postRes = await request(app)
        .post('/api/scheduled-messages')
        .set('Cookie', `token=${token1}`)
        .send({ channelId, content: '編集テスト', scheduledAt: futureDate() });
      const smId = postRes.body.scheduledMessage.id as number;

      const pastDate = new Date(Date.now() - 60_000).toISOString();
      const res = await request(app)
        .patch(`/api/scheduled-messages/${smId}`)
        .set('Cookie', `token=${token1}`)
        .send({ scheduledAt: pastDate });

      expect(res.status).toBe(400);
    });

    it('他人の予約は編集できない (403 または 404)', async () => {
      const postRes = await request(app)
        .post('/api/scheduled-messages')
        .set('Cookie', `token=${token1}`)
        .send({ channelId, content: 'user1の予約', scheduledAt: futureDate() });
      const smId = postRes.body.scheduledMessage.id as number;

      const res = await request(app)
        .patch(`/api/scheduled-messages/${smId}`)
        .set('Cookie', `token=${token2}`)
        .send({ content: '書き換え' });

      expect([403, 404]).toContain(res.status);
    });

    it('認証エラー: 未認証ユーザーは編集できない (401)', async () => {
      const res = await request(app).patch('/api/scheduled-messages/1').send({ content: 'test' });

      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/scheduled-messages/:id - 予約キャンセル', () => {
    it('正常系: 自分の予約をキャンセルすると status=canceled になる', async () => {
      const postRes = await request(app)
        .post('/api/scheduled-messages')
        .set('Cookie', `token=${token1}`)
        .send({ channelId, content: 'キャンセル対象', scheduledAt: futureDate() });
      const smId = postRes.body.scheduledMessage.id as number;

      const res = await request(app)
        .delete(`/api/scheduled-messages/${smId}`)
        .set('Cookie', `token=${token1}`);

      expect(res.status).toBe(200);
      expect(res.body.scheduledMessage.status).toBe('canceled');
    });

    it('他人の予約はキャンセルできない (403 または 404)', async () => {
      const postRes = await request(app)
        .post('/api/scheduled-messages')
        .set('Cookie', `token=${token1}`)
        .send({ channelId, content: 'user1の予約', scheduledAt: futureDate() });
      const smId = postRes.body.scheduledMessage.id as number;

      const res = await request(app)
        .delete(`/api/scheduled-messages/${smId}`)
        .set('Cookie', `token=${token2}`);

      expect([403, 404]).toContain(res.status);
    });

    it('存在しないIDでは 404 を返す', async () => {
      const res = await request(app)
        .delete('/api/scheduled-messages/99999')
        .set('Cookie', `token=${token1}`);

      expect(res.status).toBe(404);
    });

    it('認証エラー: 未認証ユーザーはキャンセルできない (401)', async () => {
      const res = await request(app).delete('/api/scheduled-messages/1');
      expect(res.status).toBe(401);
    });
  });

  describe('Worker: pickDue と送信フロー', () => {
    it('scheduled_at <= NOW() かつ status=pending のレコードのみピックされる', async () => {
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

    it('未来日時の予約はピックされない', async () => {
      await testDb.execute(
        "INSERT INTO scheduled_messages (user_id, channel_id, content, scheduled_at, status) VALUES ($1, $2, $3, $4, 'pending')",
        [userId1, channelId, '未来', futureDate()],
      );

      const picked = await pickDue(10);
      expect(picked.length).toBe(0);
    });

    it('status=canceled の予約はピックされない', async () => {
      const past = new Date(Date.now() - 1000).toISOString();
      await testDb.execute(
        "INSERT INTO scheduled_messages (user_id, channel_id, content, scheduled_at, status) VALUES ($1, $2, $3, $4, 'canceled')",
        [userId1, channelId, 'キャンセル済み', past],
      );

      const picked = await pickDue(10);
      expect(picked.length).toBe(0);
    });

    it('status=sent の予約はピックされない（二重送信防止）', async () => {
      const past = new Date(Date.now() - 1000).toISOString();
      await testDb.execute(
        "INSERT INTO scheduled_messages (user_id, channel_id, content, scheduled_at, status) VALUES ($1, $2, $3, $4, 'sent')",
        [userId1, channelId, '送信済み', past],
      );

      const picked = await pickDue(10);
      expect(picked.length).toBe(0);
    });

    it('アトミックなステータス遷移: pickDue 時に pending → sending へ UPDATE され、同じレコードが二重にピックされない', async () => {
      const past = new Date(Date.now() - 1000).toISOString();
      await testDb.execute(
        "INSERT INTO scheduled_messages (user_id, channel_id, content, scheduled_at, status) VALUES ($1, $2, $3, $4, 'pending')",
        [userId1, channelId, 'アトミック確認', past],
      );

      const picked1 = await pickDue(10);
      expect(picked1.length).toBe(1);

      const picked2 = await pickDue(10);
      expect(picked2.length).toBe(0);
    });

    it('送信成功時: status=sent / sent_message_id に作成されたメッセージIDが入る', async () => {
      const past = new Date(Date.now() - 1000).toISOString();
      const r = await testDb.execute(
        "INSERT INTO scheduled_messages (user_id, channel_id, content, scheduled_at, status) VALUES ($1, $2, $3, $4, 'sending') RETURNING id",
        [userId1, channelId, '送信中テスト', past],
      );
      const smId = r.rows[0].id as number;

      const msg = await createMessage(channelId, userId1, '送信済みメッセージ');
      await markSent(smId, msg.id);

      const row = await testDb.execute(
        'SELECT status, sent_message_id FROM scheduled_messages WHERE id = $1',
        [smId],
      );
      expect(row.rows[0].status).toBe('sent');
      expect(row.rows[0].sent_message_id).toBe(msg.id);
    });

    it('送信成功時: messages テーブルに通常メッセージとして挿入される', async () => {
      const msg = await createMessage(channelId, userId1, '通常メッセージ確認');
      const row = await testDb.execute(
        'SELECT id, channel_id, user_id, content FROM messages WHERE id = $1',
        [msg.id],
      );
      expect(row.rows[0]).toBeDefined();
      expect(row.rows[0].channel_id).toBe(channelId);
      expect(row.rows[0].user_id).toBe(userId1);
    });

    it('送信失敗時: status=failed / error に理由が記録される', async () => {
      const past = new Date(Date.now() - 1000).toISOString();
      const r = await testDb.execute(
        "INSERT INTO scheduled_messages (user_id, channel_id, content, scheduled_at, status) VALUES ($1, $2, $3, $4, 'sending') RETURNING id",
        [userId1, channelId, '失敗予定', past],
      );
      const smId = r.rows[0].id as number;

      await markFailed(smId, 'チャンネルが削除されました');

      const row = await testDb.execute(
        'SELECT status, error FROM scheduled_messages WHERE id = $1',
        [smId],
      );
      expect(row.rows[0].status).toBe('failed');
      expect(row.rows[0].error).toBe('チャンネルが削除されました');
    });

    it('limit 引数で同時ピック件数を制限できる', async () => {
      const past = new Date(Date.now() - 1000).toISOString();
      for (let i = 0; i < 5; i++) {
        await testDb.execute(
          "INSERT INTO scheduled_messages (user_id, channel_id, content, scheduled_at, status) VALUES ($1, $2, $3, $4, 'pending')",
          [userId1, channelId, `limit test ${i}`, past],
        );
      }

      const picked = await pickDue(3);
      expect(picked.length).toBe(3);
    });
  });

  describe('サーバー再起動時の復旧', () => {
    it('起動時に pending かつ scheduled_at <= NOW() のレコードを pickDue で取得できる', async () => {
      const past = new Date(Date.now() - 1000).toISOString();
      await testDb.execute(
        "INSERT INTO scheduled_messages (user_id, channel_id, content, scheduled_at, status) VALUES ($1, $2, $3, $4, 'pending')",
        [userId1, channelId, '起動時復旧テスト', past],
      );

      const picked = await pickDue(100);
      expect(picked.some((sm) => sm.content === '起動時復旧テスト')).toBe(true);
    });
  });
});
