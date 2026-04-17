// テスト対象: リマインダー機能 (POST /api/reminders, GET /api/reminders, DELETE /api/reminders/:id, 通知処理)
// 戦略: Express ルートハンドラを supertest で結合テスト。DB は pg-mem のインメモリ、Socket.IO はモックで差し替える

import { createTestDatabase } from './__fixtures__/pgTestHelper';

const testDb = createTestDatabase();

jest.mock('../db/database', () => testDb);

// Socket.IO サーバーモック
const mockSocketTo = jest.fn().mockReturnValue({ emit: jest.fn() });
const mockSocketServer = {
  to: mockSocketTo,
};

jest.mock('../socket', () => ({
  getSocketServer: jest.fn(() => mockSocketServer),
}));

import request from 'supertest';
import { createApp } from '../app';
import { registerUser } from './__fixtures__/testHelpers';
import { checkAndSendReminders } from '../services/reminderService';

let userId1: number;
let userId2: number;
let channelId: number;
let messageId: number;

const app = createApp();

beforeAll(async () => {
  const r1 = await testDb.execute(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
    ['rem_user1', 'rem1@t.com', 'h'],
  );
  userId1 = r1.rows[0].id as number;

  const r2 = await testDb.execute(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
    ['rem_user2', 'rem2@t.com', 'h'],
  );
  userId2 = r2.rows[0].id as number;

  const rc = await testDb.execute(
    'INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id',
    ['rem-channel', userId1],
  );
  channelId = rc.rows[0].id as number;

  const rm = await testDb.execute(
    'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
    [channelId, userId1, 'リマインドされるメッセージ'],
  );
  messageId = rm.rows[0].id as number;
});

beforeEach(async () => {
  await testDb.execute('DELETE FROM reminders');
  mockSocketTo.mockClear();
  mockSocketTo.mockReturnValue({ emit: jest.fn() });
});

describe('POST /api/reminders - リマインダー作成', () => {
  it('正常系: リマインダーを作成できる', async () => {
    const { token } = await registerUser(app, 'rem_create1', 'rem_create1@example.com');
    const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const res = await request(app)
      .post('/api/reminders')
      .set('Cookie', `token=${token}`)
      .send({ messageId, remindAt: futureDate });
    expect(res.status).toBe(201);
    expect(res.body.reminder).toBeDefined();
    expect(res.body.reminder.messageId).toBe(messageId);
    expect(res.body.reminder.remindAt).toBeDefined();
  });

  it('バリデーション: messageIdが必須', async () => {
    const { token } = await registerUser(app, 'rem_val1', 'rem_val1@example.com');
    const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const res = await request(app)
      .post('/api/reminders')
      .set('Cookie', `token=${token}`)
      .send({ remindAt: futureDate });
    expect(res.status).toBe(400);
  });

  it('バリデーション: remind_atが必須', async () => {
    const { token } = await registerUser(app, 'rem_val2', 'rem_val2@example.com');
    const res = await request(app)
      .post('/api/reminders')
      .set('Cookie', `token=${token}`)
      .send({ messageId });
    expect(res.status).toBe(400);
  });

  it('バリデーション: remind_atは未来の日時でなければならない', async () => {
    const { token } = await registerUser(app, 'rem_val3', 'rem_val3@example.com');
    const pastDate = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const res = await request(app)
      .post('/api/reminders')
      .set('Cookie', `token=${token}`)
      .send({ messageId, remindAt: pastDate });
    expect(res.status).toBe(400);
  });

  it('認証エラー: 未認証ユーザーは作成できない', async () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const res = await request(app)
      .post('/api/reminders')
      .send({ messageId, remindAt: futureDate });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/reminders - リマインダー一覧', () => {
  it('正常系: 自分のリマインダー一覧を取得できる', async () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await testDb.execute(
      'INSERT INTO reminders (user_id, message_id, remind_at) VALUES ($1, $2, $3)',
      [userId1, messageId, futureDate],
    );
    const { token } = await registerUser(app, 'rem_get1', 'rem_get1@example.com');
    // 自分のリマインダーを追加
    const r = await testDb.execute(
      'SELECT id FROM users WHERE username = $1',
      ['rem_get1'],
    );
    const uid = r.rows[0].id as number;
    await testDb.execute(
      'INSERT INTO reminders (user_id, message_id, remind_at) VALUES ($1, $2, $3)',
      [uid, messageId, futureDate],
    );

    const res = await request(app)
      .get('/api/reminders')
      .set('Cookie', `token=${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.reminders)).toBe(true);
    expect(res.body.reminders.every((r: { userId: number }) => r.userId === uid)).toBe(true);
  });

  it('他のユーザーのリマインダーは含まれない', async () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await testDb.execute(
      'INSERT INTO reminders (user_id, message_id, remind_at) VALUES ($1, $2, $3)',
      [userId1, messageId, futureDate],
    );
    const { token } = await registerUser(app, 'rem_get2', 'rem_get2@example.com');
    const res = await request(app)
      .get('/api/reminders')
      .set('Cookie', `token=${token}`);
    expect(res.status).toBe(200);
    expect(res.body.reminders.every((r: { userId: number }) => r.userId !== userId1)).toBe(true);
  });

  it('済みリマインダーはデフォルトで除外される', async () => {
    const { token } = await registerUser(app, 'rem_get3', 'rem_get3@example.com');
    const r = await testDb.execute(
      'SELECT id FROM users WHERE username = $1',
      ['rem_get3'],
    );
    const uid = r.rows[0].id as number;
    // 過去の日時（送信済み）のリマインダー
    const pastDate = new Date(Date.now() - 60 * 1000).toISOString();
    await testDb.execute(
      'INSERT INTO reminders (user_id, message_id, remind_at, is_sent) VALUES ($1, $2, $3, true)',
      [uid, messageId, pastDate],
    );
    const res = await request(app)
      .get('/api/reminders')
      .set('Cookie', `token=${token}`);
    expect(res.status).toBe(200);
    expect(res.body.reminders.every((r: { isSent: boolean }) => !r.isSent)).toBe(true);
  });

  it('認証エラー: 未認証ユーザーは取得できない', async () => {
    const res = await request(app).get('/api/reminders');
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/reminders/:id - リマインダー削除', () => {
  it('正常系: 自分のリマインダーを削除できる', async () => {
    const { token } = await registerUser(app, 'rem_del1', 'rem_del1@example.com');
    const r = await testDb.execute(
      'SELECT id FROM users WHERE username = $1',
      ['rem_del1'],
    );
    const uid = r.rows[0].id as number;
    const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const ri = await testDb.execute(
      'INSERT INTO reminders (user_id, message_id, remind_at) VALUES ($1, $2, $3) RETURNING id',
      [uid, messageId, futureDate],
    );
    const reminderId = ri.rows[0].id as number;

    const res = await request(app)
      .delete(`/api/reminders/${reminderId}`)
      .set('Cookie', `token=${token}`);
    expect(res.status).toBe(204);
  });

  it('他のユーザーのリマインダーは削除できない', async () => {
    const { token } = await registerUser(app, 'rem_del2', 'rem_del2@example.com');
    const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const ri = await testDb.execute(
      'INSERT INTO reminders (user_id, message_id, remind_at) VALUES ($1, $2, $3) RETURNING id',
      [userId1, messageId, futureDate],
    );
    const reminderId = ri.rows[0].id as number;

    const res = await request(app)
      .delete(`/api/reminders/${reminderId}`)
      .set('Cookie', `token=${token}`);
    expect(res.status).toBe(404);
  });

  it('存在しないIDでは404を返す', async () => {
    const { token } = await registerUser(app, 'rem_del3', 'rem_del3@example.com');
    const res = await request(app)
      .delete('/api/reminders/99999')
      .set('Cookie', `token=${token}`);
    expect(res.status).toBe(404);
  });
});

describe('リマインダー通知', () => {
  it('指定時刻になるとSocket.IOでnotificationイベントが送信される', async () => {
    const pastDate = new Date(Date.now() - 1000).toISOString();
    const ri = await testDb.execute(
      'INSERT INTO reminders (user_id, message_id, remind_at, is_sent) VALUES ($1, $2, $3, false) RETURNING id',
      [userId1, messageId, pastDate],
    );
    const reminderId = ri.rows[0].id as number;

    const mockEmit = jest.fn();
    mockSocketTo.mockReturnValue({ emit: mockEmit });

    await checkAndSendReminders();

    expect(mockSocketTo).toHaveBeenCalledWith(`user:${userId1}`);
    expect(mockEmit).toHaveBeenCalledWith('notification', expect.objectContaining({
      type: 'reminder',
      reminderId,
    }));
  });

  it('送信済みリマインダーは再送されない', async () => {
    const pastDate = new Date(Date.now() - 1000).toISOString();
    await testDb.execute(
      'INSERT INTO reminders (user_id, message_id, remind_at, is_sent) VALUES ($1, $2, $3, true)',
      [userId1, messageId, pastDate],
    );

    const mockEmit = jest.fn();
    mockSocketTo.mockReturnValue({ emit: mockEmit });

    await checkAndSendReminders();

    expect(mockEmit).not.toHaveBeenCalled();
  });
});
