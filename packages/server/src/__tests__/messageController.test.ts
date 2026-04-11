/**
 * messageController のHTTPレベルテスト
 *
 * テスト対象: packages/server/src/controllers/messageController.ts
 * 戦略: supertest でHTTPリクエストを発行し、レスポンスのステータスコードと
 * レスポンスボディを検証する。DB は better-sqlite3 のインメモリ DBを使用。
 * メッセージ作成はソケット経由のため、DBに直接挿入して検証する。
 */

import request from 'supertest';
import { createApp } from '../app';
import { generateToken } from '../middleware/auth';
import { getDatabase } from '../db/database';

jest.mock('../db/database', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const DatabaseLib = require('better-sqlite3') as typeof import('better-sqlite3');
  const db = new DatabaseLib(':memory:');
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

const app = createApp();

/** テスト用ユーザーを登録して token を返すヘルパー */
async function registerUser(
  username: string,
  email: string,
  password = 'password123',
): Promise<{ token: string; userId: number }> {
  const res = await request(app).post('/api/auth/register').send({ username, email, password });
  const userId = (res.body as { user: { id: number } }).user.id;
  return { token: generateToken(userId, username), userId };
}

/** テスト用チャンネルを作成して ID を返すヘルパー */
async function createChannel(token: string, name: string): Promise<number> {
  const res = await request(app)
    .post('/api/channels')
    .set('Cookie', `token=${token}`)
    .send({ name });
  return (res.body as { channel: { id: number } }).channel.id;
}

/** DBに直接メッセージを挿入してIDを返すヘルパー */
function insertMessage(channelId: number, userId: number, content: string): number {
  const db = getDatabase();
  const result = db
    .prepare('INSERT INTO messages (channel_id, user_id, content) VALUES (?, ?, ?)')
    .run(channelId, userId, content);
  return result.lastInsertRowid as number;
}

describe('GET /api/channels/:channelId/messages', () => {
  it('正常: チャンネルのメッセージ一覧が返る', async () => {
    const { token, userId } = await registerUser('msg_get1', 'msg_get1@example.com');
    const channelId = await createChannel(token, 'msg-get-ch1');
    insertMessage(channelId, userId, 'テストメッセージ');

    const res = await request(app)
      .get(`/api/channels/${channelId}/messages`)
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.messages)).toBe(true);
    expect(res.body.messages.length).toBeGreaterThan(0);
    expect(res.body.messages[0].content).toBe('テストメッセージ');
  });

  it('正常: limit パラメータで件数を絞り込める', async () => {
    const { token, userId } = await registerUser('msg_get2', 'msg_get2@example.com');
    const channelId = await createChannel(token, 'msg-get-ch2');
    for (let i = 0; i < 5; i++) {
      insertMessage(channelId, userId, `メッセージ${i}`);
    }

    const res = await request(app)
      .get(`/api/channels/${channelId}/messages?limit=3`)
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body.messages.length).toBe(3);
  });

  it('正常: before パラメータで指定ID以前のメッセージが返る（ページネーション）', async () => {
    const { token, userId } = await registerUser('msg_get3', 'msg_get3@example.com');
    const channelId = await createChannel(token, 'msg-get-ch3');
    const id1 = insertMessage(channelId, userId, '古いメッセージ');
    const id2 = insertMessage(channelId, userId, '新しいメッセージ');

    const res = await request(app)
      .get(`/api/channels/${channelId}/messages?before=${id2}`)
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    const ids = (res.body.messages as { id: number }[]).map((m) => m.id);
    expect(ids).toContain(id1);
    expect(ids).not.toContain(id2);
  });

  it('異常: トークンなしで401が返る', async () => {
    const res = await request(app).get('/api/channels/1/messages');

    expect(res.status).toBe(401);
  });
});

describe('PUT /api/messages/:id', () => {
  it('正常: 自分のメッセージを編集すると200と更新後メッセージが返る', async () => {
    const { token, userId } = await registerUser('msg_edit1', 'msg_edit1@example.com');
    const channelId = await createChannel(token, 'msg-edit-ch1');
    const messageId = insertMessage(channelId, userId, '元のメッセージ');

    const res = await request(app)
      .put(`/api/messages/${messageId}`)
      .set('Cookie', `token=${token}`)
      .send({ content: '編集後メッセージ' });

    expect(res.status).toBe(200);
    expect(res.body.message.content).toBe('編集後メッセージ');
    expect(res.body.message.isEdited).toBe(true);
  });

  it('正常: mentionedUserIds を更新できる', async () => {
    const { token, userId } = await registerUser('msg_edit2', 'msg_edit2@example.com');
    const { userId: mentionedId } = await registerUser(
      'msg_edit2_target',
      'msg_edit2_target@example.com',
    );
    const channelId = await createChannel(token, 'msg-edit-ch2');
    const messageId = insertMessage(channelId, userId, '元のメッセージ');

    const res = await request(app)
      .put(`/api/messages/${messageId}`)
      .set('Cookie', `token=${token}`)
      .send({ content: 'メンションあり', mentionedUserIds: [mentionedId] });

    expect(res.status).toBe(200);
    expect(res.body.message.mentions).toContain(mentionedId);
  });

  it('異常: content が欠けていると400が返る', async () => {
    const { token, userId } = await registerUser('msg_edit3', 'msg_edit3@example.com');
    const channelId = await createChannel(token, 'msg-edit-ch3');
    const messageId = insertMessage(channelId, userId, '元のメッセージ');

    const res = await request(app)
      .put(`/api/messages/${messageId}`)
      .set('Cookie', `token=${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('異常: 他人のメッセージを編集しようとすると403が返る', async () => {
    const { token: ownerToken, userId: ownerId } = await registerUser(
      'msg_edit4_owner',
      'msg_edit4_owner@example.com',
    );
    const { token: otherToken } = await registerUser(
      'msg_edit4_other',
      'msg_edit4_other@example.com',
    );
    const channelId = await createChannel(ownerToken, 'msg-edit-ch4');
    const messageId = insertMessage(channelId, ownerId, '他人のメッセージ');

    const res = await request(app)
      .put(`/api/messages/${messageId}`)
      .set('Cookie', `token=${otherToken}`)
      .send({ content: '不正編集' });

    expect(res.status).toBe(403);
  });

  it('異常: トークンなしで401が返る', async () => {
    const res = await request(app).put('/api/messages/1').send({ content: '編集' });

    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/messages/:id', () => {
  it('正常: 自分のメッセージを削除すると204が返る', async () => {
    const { token, userId } = await registerUser('msg_del1', 'msg_del1@example.com');
    const channelId = await createChannel(token, 'msg-del-ch1');
    const messageId = insertMessage(channelId, userId, '削除対象メッセージ');

    const res = await request(app)
      .delete(`/api/messages/${messageId}`)
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(204);
  });

  it('異常: 他人のメッセージを削除しようとすると403が返る', async () => {
    const { token: ownerToken, userId: ownerId } = await registerUser(
      'msg_del2_owner',
      'msg_del2_owner@example.com',
    );
    const { token: otherToken } = await registerUser(
      'msg_del2_other',
      'msg_del2_other@example.com',
    );
    const channelId = await createChannel(ownerToken, 'msg-del-ch2');
    const messageId = insertMessage(channelId, ownerId, '他人のメッセージ');

    const res = await request(app)
      .delete(`/api/messages/${messageId}`)
      .set('Cookie', `token=${otherToken}`);

    expect(res.status).toBe(403);
  });

  it('異常: トークンなしで401が返る', async () => {
    const res = await request(app).delete('/api/messages/1');

    expect(res.status).toBe(401);
  });
});
