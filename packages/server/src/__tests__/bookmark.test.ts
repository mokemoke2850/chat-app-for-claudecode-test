/**
 * テスト対象: bookmarkService のブックマーク機能
 * 戦略: pg-mem のインメモリ PostgreSQL 互換 DB を使いサービス層を直接テストする。
 * 外部キー制約を満たすため beforeAll でユーザー・チャンネル・メッセージを挿入する。
 * ブックマークはユーザーごとに個別管理されることを重点的に検証する。
 */

import { createTestDatabase } from './__fixtures__/pgTestHelper';

const testDb = createTestDatabase();

jest.mock('../db/database', () => testDb);

import request from 'supertest';
import { createApp } from '../app';
import { addBookmark, removeBookmark, getBookmarks } from '../services/bookmarkService';
import { registerUser } from './__fixtures__/testHelpers';

let userId1: number;
let userId2: number;
let channelId: number;
let messageId: number;
let messageId2: number;
let deletedMessageId: number;

const app = createApp();

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

  const rm = await testDb.execute(
    'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
    [channelId, userId1, 'Hello'],
  );
  messageId = rm.rows[0].id as number;

  const rm2 = await testDb.execute(
    'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
    [channelId, userId1, 'World'],
  );
  messageId2 = rm2.rows[0].id as number;

  const rdm = await testDb.execute(
    'INSERT INTO messages (channel_id, user_id, content, is_deleted) VALUES ($1, $2, $3, true) RETURNING id',
    [channelId, userId1, 'Deleted message'],
  );
  deletedMessageId = rdm.rows[0].id as number;
});

beforeEach(async () => {
  await testDb.execute('DELETE FROM bookmarks');
});

describe('addBookmark', () => {
  it('メッセージをブックマーク登録できる', async () => {
    const bookmark = await addBookmark(userId1, messageId);
    expect(bookmark.id).toBeDefined();
    expect(bookmark.userId).toBe(userId1);
    expect(bookmark.messageId).toBe(messageId);
    expect(bookmark.bookmarkedAt).toBeDefined();
  });

  it('存在しないメッセージのブックマークはエラーになる', async () => {
    await expect(addBookmark(userId1, 99999)).rejects.toThrow('Message not found');
  });

  it('同じメッセージを同一ユーザーが二重にブックマークしようとするとエラーになる', async () => {
    await addBookmark(userId1, messageId);
    await expect(addBookmark(userId1, messageId)).rejects.toThrow('Message is already bookmarked');
  });

  it('削除済みメッセージはブックマークできない', async () => {
    await expect(addBookmark(userId1, deletedMessageId)).rejects.toThrow(
      'Cannot bookmark a deleted message',
    );
  });

  it('別のユーザーが同じメッセージをブックマークできる（ユーザーごとに独立）', async () => {
    await addBookmark(userId1, messageId);
    const bookmark = await addBookmark(userId2, messageId);
    expect(bookmark.userId).toBe(userId2);
    expect(bookmark.messageId).toBe(messageId);
  });
});

describe('removeBookmark', () => {
  it('ブックマークを解除できる', async () => {
    await addBookmark(userId1, messageId);
    await expect(removeBookmark(userId1, messageId)).resolves.not.toThrow();
  });

  it('ブックマークされていないメッセージの解除はエラーになる', async () => {
    await expect(removeBookmark(userId1, messageId)).rejects.toThrow('Bookmark not found');
  });

  it('存在しないメッセージの解除はエラーになる', async () => {
    await expect(removeBookmark(userId1, 99999)).rejects.toThrow('Message not found');
  });

  it('他のユーザーのブックマークを解除しようとするとエラーになる', async () => {
    await addBookmark(userId1, messageId);
    await expect(removeBookmark(userId2, messageId)).rejects.toThrow('Bookmark not found');
  });
});

describe('getBookmarks', () => {
  it('ユーザーのブックマーク一覧を返す', async () => {
    await addBookmark(userId1, messageId);
    const bookmarks = await getBookmarks(userId1);
    expect(bookmarks.length).toBe(1);
    expect(bookmarks[0].messageId).toBe(messageId);
  });

  it('ブックマークが存在しないユーザーでは空配列を返す', async () => {
    const bookmarks = await getBookmarks(userId1);
    expect(bookmarks).toEqual([]);
  });

  it('ブックマークは登録日時の降順で返される', async () => {
    await addBookmark(userId1, messageId);
    await addBookmark(userId1, messageId2);
    const bookmarks = await getBookmarks(userId1);
    expect(bookmarks.length).toBe(2);
    expect(new Date(bookmarks[0].bookmarkedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(bookmarks[1].bookmarkedAt).getTime(),
    );
  });

  it('削除済みメッセージはブックマーク一覧から除外される', async () => {
    // 削除済みメッセージを直接 INSERT（addBookmark はガードするため）
    await testDb.execute(
      'INSERT INTO bookmarks (user_id, message_id) VALUES ($1, $2)',
      [userId1, deletedMessageId],
    );
    const bookmarks = await getBookmarks(userId1);
    expect(bookmarks.every((b) => b.messageId !== deletedMessageId)).toBe(true);
  });

  it('他のユーザーのブックマークは含まれない', async () => {
    await addBookmark(userId1, messageId);
    await addBookmark(userId2, messageId2);
    const bookmarks = await getBookmarks(userId1);
    expect(bookmarks.every((b) => b.userId === userId1)).toBe(true);
  });
});

describe('REST API: GET /api/bookmarks', () => {
  it('認証済みユーザーが自分のブックマーク一覧を 200 で取得できる', async () => {
    const { token } = await registerUser(app, 'bm_get1', 'bm_get1@example.com');
    const res = await request(app).get('/api/bookmarks').set('Cookie', `token=${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.bookmarks)).toBe(true);
  });

  it('認証なしで 401 を返す', async () => {
    const res = await request(app).get('/api/bookmarks');
    expect(res.status).toBe(401);
  });
});

describe('REST API: POST /api/bookmarks/:messageId', () => {
  it('ブックマーク登録成功で 201 を返す', async () => {
    const { token, userId } = await registerUser(app, 'bm_post1', 'bm_post1@example.com');
    const rc = await testDb.execute(
      "INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id",
      ['bm-ch1', userId],
    );
    const rm = await testDb.execute(
      'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
      [rc.rows[0].id as number, userId, 'test msg'],
    );
    const mid = rm.rows[0].id as number;

    const res = await request(app).post(`/api/bookmarks/${mid}`).set('Cookie', `token=${token}`);
    expect(res.status).toBe(201);
    expect(res.body.bookmark.messageId).toBe(mid);
  });

  it('認証なしで 401 を返す', async () => {
    const res = await request(app).post(`/api/bookmarks/${messageId}`);
    expect(res.status).toBe(401);
  });

  it('存在しないメッセージIDで 404 を返す', async () => {
    const { token } = await registerUser(app, 'bm_post2', 'bm_post2@example.com');
    const res = await request(app).post('/api/bookmarks/99999').set('Cookie', `token=${token}`);
    expect(res.status).toBe(404);
  });

  it('既にブックマーク済みで 409 を返す', async () => {
    const { token, userId } = await registerUser(app, 'bm_post3', 'bm_post3@example.com');
    const rc = await testDb.execute(
      "INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id",
      ['bm-ch2', userId],
    );
    const rm = await testDb.execute(
      'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
      [rc.rows[0].id as number, userId, 'dup msg'],
    );
    const mid = rm.rows[0].id as number;

    await request(app).post(`/api/bookmarks/${mid}`).set('Cookie', `token=${token}`);
    const res = await request(app).post(`/api/bookmarks/${mid}`).set('Cookie', `token=${token}`);
    expect(res.status).toBe(409);
  });

  it('不正なメッセージIDで 400 を返す', async () => {
    const { token } = await registerUser(app, 'bm_post4', 'bm_post4@example.com');
    const res = await request(app).post('/api/bookmarks/abc').set('Cookie', `token=${token}`);
    expect(res.status).toBe(400);
  });
});

describe('REST API: DELETE /api/bookmarks/:messageId', () => {
  it('ブックマーク解除成功で 204 を返す', async () => {
    const { token, userId } = await registerUser(app, 'bm_del1', 'bm_del1@example.com');
    const rc = await testDb.execute(
      "INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id",
      ['bm-ch3', userId],
    );
    const rm = await testDb.execute(
      'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
      [rc.rows[0].id as number, userId, 'del msg'],
    );
    const mid = rm.rows[0].id as number;

    await request(app).post(`/api/bookmarks/${mid}`).set('Cookie', `token=${token}`);
    const res = await request(app).delete(`/api/bookmarks/${mid}`).set('Cookie', `token=${token}`);
    expect(res.status).toBe(204);
  });

  it('認証なしで 401 を返す', async () => {
    const res = await request(app).delete(`/api/bookmarks/${messageId}`);
    expect(res.status).toBe(401);
  });

  it('ブックマークが存在しない場合 404 を返す', async () => {
    const { token } = await registerUser(app, 'bm_del2', 'bm_del2@example.com');
    const res = await request(app)
      .delete(`/api/bookmarks/${messageId}`)
      .set('Cookie', `token=${token}`);
    expect(res.status).toBe(404);
  });

  it('不正なメッセージIDで 400 を返す', async () => {
    const { token } = await registerUser(app, 'bm_del3', 'bm_del3@example.com');
    const res = await request(app).delete('/api/bookmarks/abc').set('Cookie', `token=${token}`);
    expect(res.status).toBe(400);
  });
});
