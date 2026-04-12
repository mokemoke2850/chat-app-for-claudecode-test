/**
 * メッセージ検索 API のテスト
 *
 * テスト対象: GET /api/messages/search?q={query}
 * 戦略:
 *   - DB は better-sqlite3 インメモリ DB を使用
 *   - supertest で HTTP リクエストを発行し、ステータスコードとボディを検証する
 *   - メッセージは DB に直接 INSERT して用意する
 */

import request from 'supertest';
import { createApp } from '../../app';
import { generateToken } from '../../middleware/auth';
import { getDatabase } from '../../db/database';

jest.mock('../../db/database', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const DatabaseLib = require('better-sqlite3') as typeof import('better-sqlite3');
  const db = new DatabaseLib(':memory:');
  db.pragma('foreign_keys = ON');
  const { initializeSchema: init } =
    jest.requireActual<typeof import('../../db/database')>('../../db/database');
  init(db);
  return {
    getDatabase: () => db,
    initializeSchema: init,
    closeDatabase: jest.fn(),
  };
});

const app = createApp();

async function registerUser(
  username: string,
  email: string,
): Promise<{ token: string; userId: number }> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ username, email, password: 'password123' });
  const userId = (res.body as { user: { id: number } }).user.id;
  return { token: generateToken(userId, username), userId };
}

async function createChannel(token: string, name: string): Promise<number> {
  const res = await request(app)
    .post('/api/channels')
    .set('Cookie', `token=${token}`)
    .send({ name });
  return (res.body as { channel: { id: number } }).channel.id;
}

function insertMessage(channelId: number, userId: number, content: string): number {
  const db = getDatabase();
  const result = db
    .prepare('INSERT INTO messages (channel_id, user_id, content) VALUES (?, ?, ?)')
    .run(channelId, userId, content);
  return result.lastInsertRowid as number;
}

describe('GET /api/messages/search', () => {
  describe('正常系', () => {
    it('q に一致するメッセージが返される', async () => {
      const { token, userId } = await registerUser('search1', 'search1@example.com');
      const channelId = await createChannel(token, 'search-ch1');
      insertMessage(channelId, userId, 'ハローワールド');
      insertMessage(channelId, userId, '全く関係ないメッセージ');

      const res = await request(app)
        .get(`/api/messages/search?q=${encodeURIComponent('ハロー')}`)
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.messages)).toBe(true);
      expect(res.body.messages).toHaveLength(1);
      expect(res.body.messages[0].content).toContain('ハローワールド');
    });

    it('複数チャンネルをまたいで検索できる', async () => {
      const { token, userId } = await registerUser('search2', 'search2@example.com');
      const ch1 = await createChannel(token, 'search-ch2a');
      const ch2 = await createChannel(token, 'search-ch2b');
      insertMessage(ch1, userId, 'クロスチャンネル投稿A');
      insertMessage(ch2, userId, 'クロスチャンネル投稿B');

      const res = await request(app)
        .get(`/api/messages/search?q=${encodeURIComponent('クロスチャンネル')}`)
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      expect(res.body.messages).toHaveLength(2);
    });

    it('検索結果にチャンネル名が含まれる', async () => {
      const { token, userId } = await registerUser('search3', 'search3@example.com');
      const channelId = await createChannel(token, 'search-ch3');
      insertMessage(channelId, userId, 'チャンネル名確認テスト');

      const res = await request(app)
        .get(`/api/messages/search?q=${encodeURIComponent('チャンネル名確認')}`)
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      expect(res.body.messages[0].channelName).toBe('search-ch3');
    });

    it('削除済みメッセージは検索結果に含まれない', async () => {
      const { token, userId } = await registerUser('search4', 'search4@example.com');
      const channelId = await createChannel(token, 'search-ch4');
      const msgId = insertMessage(channelId, userId, '削除済みキーワード');
      getDatabase().prepare('UPDATE messages SET is_deleted = 1 WHERE id = ?').run(msgId);

      const res = await request(app)
        .get(`/api/messages/search?q=${encodeURIComponent('削除済みキーワード')}`)
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      expect(res.body.messages).toHaveLength(0);
    });

    it('一致するメッセージがない場合は空配列を返す', async () => {
      const { token } = await registerUser('search5', 'search5@example.com');

      const res = await request(app)
        .get(`/api/messages/search?q=${encodeURIComponent('絶対にヒットしない文字列xyz123')}`)
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      expect(res.body.messages).toHaveLength(0);
    });
  });

  describe('エラー系', () => {
    it('q パラメータが空文字の場合 400 を返す', async () => {
      const { token } = await registerUser('search6', 'search6@example.com');

      const res = await request(app).get('/api/messages/search?q=').set('Cookie', `token=${token}`);

      expect(res.status).toBe(400);
    });

    it('q パラメータがない場合 400 を返す', async () => {
      const { token } = await registerUser('search7', 'search7@example.com');

      const res = await request(app).get('/api/messages/search').set('Cookie', `token=${token}`);

      expect(res.status).toBe(400);
    });
  });
});
