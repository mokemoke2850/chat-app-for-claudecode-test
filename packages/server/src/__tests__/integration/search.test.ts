/**
 * メッセージ検索 API のテスト
 *
 * テスト対象: GET /api/messages/search?q={query}
 * 戦略:
 *   - DB は pg-mem のインメモリ PostgreSQL 互換 DB を使用
 *   - supertest で HTTP リクエストを発行し、ステータスコードとボディを検証する
 *   - メッセージは DB に直接 INSERT して用意する
 */

import { createTestDatabase } from '../__fixtures__/pgTestHelper';

const testDb = createTestDatabase();

jest.mock('../../db/database', () => testDb);

import request from 'supertest';
import { createApp } from '../../app';
import { registerUser, createChannelReq, insertMessage } from '../__fixtures__/testHelpers';

const app = createApp();

describe('GET /api/messages/search', () => {
  describe('正常系', () => {
    it('q に一致するメッセージが返される', async () => {
      const { token, userId } = await registerUser(app, 'search1', 'search1@example.com');
      const channelId = await createChannelReq(app, token, 'search-ch1');
      await insertMessage(channelId, userId, 'ハローワールド');
      await insertMessage(channelId, userId, '全く関係ないメッセージ');

      const res = await request(app)
        .get(`/api/messages/search?q=${encodeURIComponent('ハロー')}`)
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.messages)).toBe(true);
      expect(res.body.messages).toHaveLength(1);
      expect(res.body.messages[0].content).toContain('ハローワールド');
    });

    it('複数チャンネルをまたいで検索できる', async () => {
      const { token, userId } = await registerUser(app, 'search2', 'search2@example.com');
      const ch1 = await createChannelReq(app, token, 'search-ch2a');
      const ch2 = await createChannelReq(app, token, 'search-ch2b');
      await insertMessage(ch1, userId, 'クロスチャンネル投稿A');
      await insertMessage(ch2, userId, 'クロスチャンネル投稿B');

      const res = await request(app)
        .get(`/api/messages/search?q=${encodeURIComponent('クロスチャンネル')}`)
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      expect(res.body.messages).toHaveLength(2);
    });

    it('検索結果にチャンネル名が含まれる', async () => {
      const { token, userId } = await registerUser(app, 'search3', 'search3@example.com');
      const channelId = await createChannelReq(app, token, 'search-ch3');
      await insertMessage(channelId, userId, 'チャンネル名確認テスト');

      const res = await request(app)
        .get(`/api/messages/search?q=${encodeURIComponent('チャンネル名確認')}`)
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      expect(res.body.messages[0].channelName).toBe('search-ch3');
    });

    it('削除済みメッセージは検索結果に含まれない', async () => {
      const { token, userId } = await registerUser(app, 'search4', 'search4@example.com');
      const channelId = await createChannelReq(app, token, 'search-ch4');
      const msgId = await insertMessage(channelId, userId, '削除済みキーワード');
      await testDb.execute('UPDATE messages SET is_deleted = true WHERE id = $1', [msgId]);

      const res = await request(app)
        .get(`/api/messages/search?q=${encodeURIComponent('削除済みキーワード')}`)
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      expect(res.body.messages).toHaveLength(0);
    });

    it('一致するメッセージがない場合は空配列を返す', async () => {
      const { token } = await registerUser(app, 'search5', 'search5@example.com');

      const res = await request(app)
        .get(`/api/messages/search?q=${encodeURIComponent('絶対にヒットしない文字列xyz123')}`)
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      expect(res.body.messages).toHaveLength(0);
    });
  });

  describe('エラー系', () => {
    it('q パラメータが空文字かつフィルターも未指定の場合 400 を返す', async () => {
      const { token } = await registerUser(app, 'search6', 'search6@example.com');

      const res = await request(app).get('/api/messages/search?q=').set('Cookie', `token=${token}`);

      expect(res.status).toBe(400);
    });

    it('q パラメータがなくフィルターも未指定の場合 400 を返す', async () => {
      const { token } = await registerUser(app, 'search7', 'search7@example.com');

      const res = await request(app).get('/api/messages/search').set('Cookie', `token=${token}`);

      expect(res.status).toBe(400);
    });
  });

  // #115 — クエリ無しでもフィルター指定で検索を許可
  describe('クエリ無しフィルター検索 (#115)', () => {
    it('q が空でも tagIds が指定されていれば 200 とフィルタ済み結果を返す', async () => {
      // TODO
    });

    it('q が空でも userId が指定されていれば 200 を返す', async () => {
      // TODO
    });

    it('q が空でも dateFrom が指定されていれば 200 を返す', async () => {
      // TODO
    });

    it('q が空でも hasAttachment が指定されていれば 200 を返す', async () => {
      // TODO
    });
  });
});
