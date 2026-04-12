/**
 * メッセージルートのインテグレーションテスト
 *
 * テスト対象: /api/messages/* のHTTPルート層全体
 * - authenticateToken ミドルウェアの適用確認（401の返却）
 * - 他人のメッセージ操作時の403返却
 * - next(err) → errorHandler → 適切なHTTPステータスコードへの変換
 *
 * DB 戦略: better-sqlite3 のインメモリ DB を使用
 */

import request from 'supertest';
import { createApp } from '../../app';
import { createChannel, joinChannel } from '../../services/channelService';
import { createMessage } from '../../services/messageService';

jest.mock('../../db/database', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const DatabaseLib = require('better-sqlite3') as typeof import('better-sqlite3');
  const db = new DatabaseLib(':memory:');
  db.pragma('foreign_keys = ON');
  const { initializeSchema } =
    jest.requireActual<typeof import('../../db/database')>('../../db/database');
  initializeSchema(db);
  return {
    getDatabase: () => db,
    initializeSchema,
    closeDatabase: jest.fn(),
  };
});

const app = createApp();

/** テスト用ユーザーを登録してCookieを返す */
async function registerAndGetCookie(
  username: string,
  email: string,
): Promise<{ cookie: string; userId: number }> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ username, email, password: 'password123' });
  return {
    cookie: res.headers['set-cookie'][0] as string,
    userId: res.body.user.id as number,
  };
}

describe('PUT /api/messages/:id', () => {
  let ownerCookie: string;
  let ownerUserId: number;
  let otherCookie: string;
  let messageId: number;

  beforeAll(async () => {
    const owner = await registerAndGetCookie('msgowner', 'msgowner@example.com');
    const other = await registerAndGetCookie('msgother', 'msgother@example.com');
    ownerCookie = owner.cookie;
    ownerUserId = owner.userId;
    otherCookie = other.cookie;

    // チャンネルとメッセージを作成
    const channel = createChannel('msg-test-channel', undefined, ownerUserId);
    joinChannel(channel.id, other.userId);
    const msg = createMessage(channel.id, ownerUserId, 'original content');
    messageId = msg.id;
  });

  it('認証なしで401を返す（認証ガード適用確認）', async () => {
    const res = await request(app).put(`/api/messages/${messageId}`).send({ content: 'updated' });

    expect(res.status).toBe(401);
  });

  it('他人のメッセージ編集で403を返す', async () => {
    const res = await request(app)
      .put(`/api/messages/${messageId}`)
      .set('Cookie', otherCookie)
      .send({ content: 'updated by other' });

    expect(res.status).toBe(403);
  });

  it('作者本人が編集すると200と更新済みメッセージを返す', async () => {
    const res = await request(app)
      .put(`/api/messages/${messageId}`)
      .set('Cookie', ownerCookie)
      .send({ content: 'updated content' });

    expect(res.status).toBe(200);
    expect(res.body.message.content).toBe('updated content');
  });

  it('存在しないメッセージIDで404を返す', async () => {
    const res = await request(app)
      .put('/api/messages/99999')
      .set('Cookie', ownerCookie)
      .send({ content: 'updated' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/messages/:id', () => {
  let ownerCookie: string;
  let ownerUserId: number;
  let otherCookie: string;
  let messageId: number;

  beforeAll(async () => {
    const owner = await registerAndGetCookie('delowner', 'delowner@example.com');
    const other = await registerAndGetCookie('delother', 'delother@example.com');
    ownerCookie = owner.cookie;
    ownerUserId = owner.userId;
    otherCookie = other.cookie;

    const channel = createChannel('del-test-channel', undefined, ownerUserId);
    joinChannel(channel.id, other.userId);
    const msg = createMessage(channel.id, ownerUserId, 'to be deleted');
    messageId = msg.id;
  });

  it('認証なしで401を返す（認証ガード適用確認）', async () => {
    const res = await request(app).delete(`/api/messages/${messageId}`);

    expect(res.status).toBe(401);
  });

  it('他人のメッセージ削除で403を返す', async () => {
    const res = await request(app).delete(`/api/messages/${messageId}`).set('Cookie', otherCookie);

    expect(res.status).toBe(403);
  });

  it('作者本人が削除すると204を返す', async () => {
    const res = await request(app).delete(`/api/messages/${messageId}`).set('Cookie', ownerCookie);

    expect(res.status).toBe(204);
  });
});

describe('GET /api/messages/search', () => {
  let authCookie: string;
  let userId: number;

  beforeAll(async () => {
    const user = await registerAndGetCookie('searchuser', 'searchuser@example.com');
    authCookie = user.cookie;
    userId = user.userId;

    const channel = createChannel('search-channel', undefined, userId);
    createMessage(channel.id, userId, 'hello world message');
  });

  it('認証なしで401を返す（認証ガード適用確認）', async () => {
    const res = await request(app).get('/api/messages/search?q=hello');

    expect(res.status).toBe(401);
  });

  it('q パラメータなしで400を返す', async () => {
    const res = await request(app).get('/api/messages/search').set('Cookie', authCookie);

    expect(res.status).toBe(400);
  });

  it('q パラメータありで200と検索結果を返す', async () => {
    const res = await request(app).get('/api/messages/search?q=hello').set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.messages)).toBe(true);
  });
});
