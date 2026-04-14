/**
 * テスト対象: bookmarkService のブックマーク機能
 * 戦略: better-sqlite3 のインメモリ DB を使いサービス層を直接テストする。
 * 外部キー制約を満たすため beforeAll でユーザー・チャンネル・メッセージを挿入する。
 * ブックマークはユーザーごとに個別管理されることを重点的に検証する。
 */

import request from 'supertest';
import { createApp } from '../app';
import { addBookmark, removeBookmark, getBookmarks } from '../services/bookmarkService';
import DatabaseLib from 'better-sqlite3';
import { registerUser } from './__fixtures__/testHelpers';

let userId1: number;
let userId2: number;
let channelId: number;
let messageId: number;
let messageId2: number;
let deletedMessageId: number;

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

const app = createApp();

beforeAll(() => {
  const { getDatabase } = jest.requireMock<typeof import('../db/database')>('../db/database');
  const db = getDatabase() as InstanceType<typeof DatabaseLib>;

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

  const rm = db
    .prepare('INSERT INTO messages (channel_id, user_id, content) VALUES (?, ?, ?)')
    .run(channelId, userId1, 'Hello');
  messageId = rm.lastInsertRowid as number;

  const rm2 = db
    .prepare('INSERT INTO messages (channel_id, user_id, content) VALUES (?, ?, ?)')
    .run(channelId, userId1, 'World');
  messageId2 = rm2.lastInsertRowid as number;

  const rdm = db
    .prepare('INSERT INTO messages (channel_id, user_id, content, is_deleted) VALUES (?, ?, ?, 1)')
    .run(channelId, userId1, 'Deleted message');
  deletedMessageId = rdm.lastInsertRowid as number;
});

beforeEach(() => {
  const { getDatabase } = jest.requireMock<typeof import('../db/database')>('../db/database');
  const db = getDatabase() as InstanceType<typeof DatabaseLib>;
  db.prepare('DELETE FROM bookmarks').run();
});

describe('addBookmark', () => {
  it('メッセージをブックマーク登録できる', () => {
    const bookmark = addBookmark(userId1, messageId);
    expect(bookmark.id).toBeDefined();
    expect(bookmark.userId).toBe(userId1);
    expect(bookmark.messageId).toBe(messageId);
    expect(bookmark.bookmarkedAt).toBeDefined();
  });

  it('存在しないメッセージのブックマークはエラーになる', () => {
    expect(() => addBookmark(userId1, 99999)).toThrow('Message not found');
  });

  it('同じメッセージを同一ユーザーが二重にブックマークしようとするとエラーになる', () => {
    addBookmark(userId1, messageId);
    expect(() => addBookmark(userId1, messageId)).toThrow('Message is already bookmarked');
  });

  it('削除済みメッセージはブックマークできない', () => {
    expect(() => addBookmark(userId1, deletedMessageId)).toThrow(
      'Cannot bookmark a deleted message',
    );
  });

  it('別のユーザーが同じメッセージをブックマークできる（ユーザーごとに独立）', () => {
    addBookmark(userId1, messageId);
    const bookmark = addBookmark(userId2, messageId);
    expect(bookmark.userId).toBe(userId2);
    expect(bookmark.messageId).toBe(messageId);
  });
});

describe('removeBookmark', () => {
  it('ブックマークを解除できる', () => {
    addBookmark(userId1, messageId);
    expect(() => removeBookmark(userId1, messageId)).not.toThrow();
  });

  it('ブックマークされていないメッセージの解除はエラーになる', () => {
    expect(() => removeBookmark(userId1, messageId)).toThrow('Bookmark not found');
  });

  it('存在しないメッセージの解除はエラーになる', () => {
    expect(() => removeBookmark(userId1, 99999)).toThrow('Message not found');
  });

  it('他のユーザーのブックマークを解除しようとするとエラーになる', () => {
    addBookmark(userId1, messageId);
    expect(() => removeBookmark(userId2, messageId)).toThrow('Bookmark not found');
  });
});

describe('getBookmarks', () => {
  it('ユーザーのブックマーク一覧を返す', () => {
    addBookmark(userId1, messageId);
    const bookmarks = getBookmarks(userId1);
    expect(bookmarks.length).toBe(1);
    expect(bookmarks[0].messageId).toBe(messageId);
  });

  it('ブックマークが存在しないユーザーでは空配列を返す', () => {
    const bookmarks = getBookmarks(userId1);
    expect(bookmarks).toEqual([]);
  });

  it('ブックマークは登録日時の降順で返される', () => {
    addBookmark(userId1, messageId);
    addBookmark(userId1, messageId2);
    const bookmarks = getBookmarks(userId1);
    expect(bookmarks.length).toBe(2);
    expect(new Date(bookmarks[0].bookmarkedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(bookmarks[1].bookmarkedAt).getTime(),
    );
  });

  it('削除済みメッセージはブックマーク一覧から除外される', () => {
    const { getDatabase } = jest.requireMock<typeof import('../db/database')>('../db/database');
    const db = getDatabase() as InstanceType<typeof DatabaseLib>;
    // 削除済みメッセージを直接 INSERT（addBookmark はガードするため）
    db.prepare('INSERT INTO bookmarks (user_id, message_id) VALUES (?, ?)').run(
      userId1,
      deletedMessageId,
    );
    const bookmarks = getBookmarks(userId1);
    expect(bookmarks.every((b) => b.messageId !== deletedMessageId)).toBe(true);
  });

  it('他のユーザーのブックマークは含まれない', () => {
    addBookmark(userId1, messageId);
    addBookmark(userId2, messageId2);
    const bookmarks = getBookmarks(userId1);
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
    const { getDatabase } = jest.requireMock<typeof import('../db/database')>('../db/database');
    const db = getDatabase() as InstanceType<typeof DatabaseLib>;
    const rc = db
      .prepare("INSERT INTO channels (name, created_by) VALUES ('bm-ch1', ?)")
      .run(userId);
    const rm = db
      .prepare('INSERT INTO messages (channel_id, user_id, content) VALUES (?, ?, ?)')
      .run(rc.lastInsertRowid, userId, 'test msg');
    const mid = rm.lastInsertRowid as number;

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
    const { getDatabase } = jest.requireMock<typeof import('../db/database')>('../db/database');
    const db = getDatabase() as InstanceType<typeof DatabaseLib>;
    const rc = db
      .prepare("INSERT INTO channels (name, created_by) VALUES ('bm-ch2', ?)")
      .run(userId);
    const rm = db
      .prepare('INSERT INTO messages (channel_id, user_id, content) VALUES (?, ?, ?)')
      .run(rc.lastInsertRowid, userId, 'dup msg');
    const mid = rm.lastInsertRowid as number;

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
    const { getDatabase } = jest.requireMock<typeof import('../db/database')>('../db/database');
    const db = getDatabase() as InstanceType<typeof DatabaseLib>;
    const rc = db
      .prepare("INSERT INTO channels (name, created_by) VALUES ('bm-ch3', ?)")
      .run(userId);
    const rm = db
      .prepare('INSERT INTO messages (channel_id, user_id, content) VALUES (?, ?, ?)')
      .run(rc.lastInsertRowid, userId, 'del msg');
    const mid = rm.lastInsertRowid as number;

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
