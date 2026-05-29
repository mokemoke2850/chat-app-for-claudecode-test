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
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].content).toContain('ハローワールド');
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
      expect(res.body.items).toHaveLength(2);
    });

    it('検索結果にチャンネル名が含まれる', async () => {
      const { token, userId } = await registerUser(app, 'search3', 'search3@example.com');
      const channelId = await createChannelReq(app, token, 'search-ch3');
      await insertMessage(channelId, userId, 'チャンネル名確認テスト');

      const res = await request(app)
        .get(`/api/messages/search?q=${encodeURIComponent('チャンネル名確認')}`)
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      expect(res.body.items[0].channelName).toBe('search-ch3');
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
      expect(res.body.items).toHaveLength(0);
    });

    it('一致するメッセージがない場合は空配列を返す', async () => {
      const { token } = await registerUser(app, 'search5', 'search5@example.com');

      const res = await request(app)
        .get(`/api/messages/search?q=${encodeURIComponent('絶対にヒットしない文字列xyz123')}`)
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(0);
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
      const { token, userId } = await registerUser(app, 'fsearch1', 'fsearch1@example.com');
      const channelId = await createChannelReq(app, token, 'fsearch-ch1');
      const taggedMsg = await insertMessage(channelId, userId, 'タグあり投稿');
      await insertMessage(channelId, userId, 'タグなし投稿');

      // タグを直接 INSERT して付与
      const tagRes = await testDb.execute(
        'INSERT INTO tags (name, created_by) VALUES ($1, $2) RETURNING id',
        ['urgent', userId],
      );
      const tagId = tagRes.rows[0].id as number;
      await testDb.execute(
        'INSERT INTO message_tags (message_id, tag_id, created_by) VALUES ($1, $2, $3)',
        [taggedMsg, tagId, userId],
      );

      const res = await request(app)
        .get(`/api/messages/search?q=&tagIds=${tagId}`)
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].id).toBe(taggedMsg);
    });

    it('q が空でも userId が指定されていれば 200 を返す', async () => {
      const { token, userId } = await registerUser(app, 'fsearch2', 'fsearch2@example.com');
      const { userId: otherUserId } = await registerUser(app, 'fsearch2b', 'fsearch2b@example.com');
      const channelId = await createChannelReq(app, token, 'fsearch-ch2');
      const myMsg = await insertMessage(channelId, userId, 'mine');
      await insertMessage(channelId, otherUserId, 'theirs');

      const res = await request(app)
        .get(`/api/messages/search?q=&userId=${userId}`)
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      const ids = (res.body.items as { id: number }[]).map((m) => m.id);
      expect(ids).toContain(myMsg);
    });

    it('q が空でも dateFrom が指定されていれば 200 を返す', async () => {
      const { token } = await registerUser(app, 'fsearch3', 'fsearch3@example.com');

      const res = await request(app)
        .get('/api/messages/search?q=&dateFrom=2024-01-01')
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.items)).toBe(true);
    });

    it('q が空でも hasAttachment が指定されていれば 200 を返す', async () => {
      const { token } = await registerUser(app, 'fsearch4', 'fsearch4@example.com');

      const res = await request(app)
        .get('/api/messages/search?q=&hasAttachment=true')
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.items)).toBe(true);
    });

    // Step 7c-1: in:channel 構文サポートのため channelId フィルタを追加
    it('q が空でも channelId が指定されていれば 200 を返す', async () => {
      const { token } = await registerUser(app, 'fsearch5', 'fsearch5@example.com');

      const res = await request(app)
        .get('/api/messages/search?q=&channelId=1')
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.items)).toBe(true);
    });

    it('channelId フィルタで指定したチャンネルのメッセージのみ返る', async () => {
      const { token, userId } = await registerUser(app, 'fsearch6', 'fsearch6@example.com');
      const ch1 = await createChannelReq(app, token, 'fsearch-ch6a');
      const ch2 = await createChannelReq(app, token, 'fsearch-ch6b');
      const msg1 = await insertMessage(ch1, userId, 'チャンネル1の投稿');
      await insertMessage(ch2, userId, 'チャンネル2の投稿');

      const res = await request(app)
        .get(`/api/messages/search?q=&channelId=${ch1}`)
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      const ids = (res.body.items as { id: number }[]).map((m) => m.id);
      expect(ids).toContain(msg1);
      expect(res.body.items).toHaveLength(1);
    });

    it('channelId + q の組み合わせで keyword + チャンネル絞り込みが効く', async () => {
      const { token, userId } = await registerUser(app, 'fsearch7', 'fsearch7@example.com');
      const ch1 = await createChannelReq(app, token, 'fsearch-ch7a');
      const ch2 = await createChannelReq(app, token, 'fsearch-ch7b');
      const target = await insertMessage(ch1, userId, '探したい単語スシ');
      await insertMessage(ch1, userId, 'ch1だけど不一致');
      await insertMessage(ch2, userId, '探したい単語スシ'); // 別チャンネル

      const res = await request(app)
        .get(`/api/messages/search?q=${encodeURIComponent('スシ')}&channelId=${ch1}`)
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].id).toBe(target);
    });
  });

  describe('Step 6b: mentionedToMe / unreadOnly フィルタ', () => {
    it('mentionedToMe=true で自分宛メンションのみが返される', async () => {
      const { token: aliceToken, userId: aliceId } = await registerUser(
        app,
        'mfilter_alice',
        'mfilter_alice@example.com',
      );
      const { userId: bobId } = await registerUser(app, 'mfilter_bob', 'mfilter_bob@example.com');
      const channelId = await createChannelReq(app, aliceToken, 'mfilter-ch1');

      // bob から alice へのメンション
      const msgToAlice = await insertMessage(channelId, bobId, '@alice チェックお願いします');
      await testDb.execute(
        'INSERT INTO mentions (message_id, mentioned_user_id, channel_id, is_read) VALUES ($1, $2, $3, $4)',
        [msgToAlice, aliceId, channelId, false],
      );

      // alice 自身の発言（メンション無し）
      await insertMessage(channelId, aliceId, 'メモ書き');

      const res = await request(app)
        .get('/api/messages/search?q=&mentionedToMe=true')
        .set('Cookie', `token=${aliceToken}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].id).toBe(msgToAlice);
    });

    it('unreadOnly=true で未読メンションのみが返される', async () => {
      const { token: aliceToken, userId: aliceId } = await registerUser(
        app,
        'mfilter_alice2',
        'mfilter_alice2@example.com',
      );
      const { userId: bobId } = await registerUser(app, 'mfilter_bob2', 'mfilter_bob2@example.com');
      const channelId = await createChannelReq(app, aliceToken, 'mfilter-ch2');

      // bob → alice のメンション 2 件 (1 件は既読、1 件は未読)
      const readMsg = await insertMessage(channelId, bobId, '@alice 既読のメンション');
      await testDb.execute(
        'INSERT INTO mentions (message_id, mentioned_user_id, channel_id, is_read) VALUES ($1, $2, $3, $4)',
        [readMsg, aliceId, channelId, true],
      );
      const unreadMsg = await insertMessage(channelId, bobId, '@alice 未読のメンション');
      await testDb.execute(
        'INSERT INTO mentions (message_id, mentioned_user_id, channel_id, is_read) VALUES ($1, $2, $3, $4)',
        [unreadMsg, aliceId, channelId, false],
      );

      const res = await request(app)
        .get('/api/messages/search?q=&mentionedToMe=true&unreadOnly=true')
        .set('Cookie', `token=${aliceToken}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].id).toBe(unreadMsg);
    });

    it('他人宛のメンションは mentionedToMe=true で返らない', async () => {
      const { token: aliceToken } = await registerUser(
        app,
        'mfilter_alice3',
        'mfilter_alice3@example.com',
      );
      const { userId: bobId } = await registerUser(app, 'mfilter_bob3', 'mfilter_bob3@example.com');
      const { userId: charlieId } = await registerUser(
        app,
        'mfilter_charlie3',
        'mfilter_charlie3@example.com',
      );
      const channelId = await createChannelReq(app, aliceToken, 'mfilter-ch3');

      // bob から charlie へのメンション
      const msgToCharlie = await insertMessage(channelId, bobId, '@charlie 確認');
      await testDb.execute(
        'INSERT INTO mentions (message_id, mentioned_user_id, channel_id, is_read) VALUES ($1, $2, $3, $4)',
        [msgToCharlie, charlieId, channelId, false],
      );

      const res = await request(app)
        .get('/api/messages/search?q=&mentionedToMe=true')
        .set('Cookie', `token=${aliceToken}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(0);
    });
  });

  // #375 ページング仕様統一（オフセット系 { items, total, limit, offset }）
  describe('ページング（オフセット系 #375）', () => {
    // 同一キーワードを含むメッセージを n 件用意するヘルパ
    async function seedMessages(prefix: string, keyword: string, count: number) {
      const { token, userId } = await registerUser(app, prefix, `${prefix}@example.com`);
      const channelId = await createChannelReq(app, token, `${prefix}-ch`);
      for (let i = 0; i < count; i++) {
        await insertMessage(channelId, userId, `${keyword}-${i}`);
      }
      return { token };
    }

    it('レスポンスが { items, total, limit, offset } 形式で返る', async () => {
      const { token } = await seedMessages('pg1', 'ページング検索', 3);

      const res = await request(app)
        .get(`/api/messages/search?q=${encodeURIComponent('ページング検索')}`)
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(typeof res.body.total).toBe('number');
      expect(typeof res.body.limit).toBe('number');
      expect(typeof res.body.offset).toBe('number');
    });

    it('items が旧 messages 配列と同じ検索結果を保持する', async () => {
      const { token } = await seedMessages('pg2', 'アイテム保持', 2);

      const res = await request(app)
        .get(`/api/messages/search?q=${encodeURIComponent('アイテム保持')}`)
        .set('Cookie', `token=${token}`);

      expect(res.body.items).toHaveLength(2);
      expect(res.body.items[0].content).toContain('アイテム保持');
    });

    it('total はフィルタ適用後の総件数を表す（limit で切られても全件数）', async () => {
      const { token } = await seedMessages('pg3', 'トータル件数', 5);

      const res = await request(app)
        .get(`/api/messages/search?q=${encodeURIComponent('トータル件数')}&limit=2`)
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(2);
      expect(res.body.total).toBe(5);
    });

    it('limit / offset 未指定時は既定値（limit=既定, offset=0）が適用される', async () => {
      const { token } = await seedMessages('pg4', '既定値検索', 3);

      const res = await request(app)
        .get(`/api/messages/search?q=${encodeURIComponent('既定値検索')}`)
        .set('Cookie', `token=${token}`);

      expect(res.body.limit).toBe(50);
      expect(res.body.offset).toBe(0);
    });

    it('limit でページサイズを制限でき items が limit 件以内になる', async () => {
      const { token } = await seedMessages('pg5', '上限制限', 4);

      const res = await request(app)
        .get(`/api/messages/search?q=${encodeURIComponent('上限制限')}&limit=2`)
        .set('Cookie', `token=${token}`);

      expect(res.body.items.length).toBeLessThanOrEqual(2);
      expect(res.body.limit).toBe(2);
    });

    it('offset を進めると前ページと重複しない次ページが取得できる', async () => {
      const { token } = await seedMessages('pg6', '重複なしページ', 5);
      const kw = encodeURIComponent('重複なしページ');

      const page1 = await request(app)
        .get(`/api/messages/search?q=${kw}&limit=2&offset=0`)
        .set('Cookie', `token=${token}`);
      const page2 = await request(app)
        .get(`/api/messages/search?q=${kw}&limit=2&offset=2`)
        .set('Cookie', `token=${token}`);

      const ids1 = (page1.body.items as { id: number }[]).map((m) => m.id);
      const ids2 = (page2.body.items as { id: number }[]).map((m) => m.id);
      expect(ids1).toHaveLength(2);
      expect(ids2).toHaveLength(2);
      expect(ids1.some((id) => ids2.includes(id))).toBe(false);
    });

    it('offset が total を超える場合は items が空配列で total は維持される', async () => {
      const { token } = await seedMessages('pg7', '範囲外オフセット', 3);

      const res = await request(app)
        .get(`/api/messages/search?q=${encodeURIComponent('範囲外オフセット')}&offset=100`)
        .set('Cookie', `token=${token}`);

      expect(res.body.items).toHaveLength(0);
      expect(res.body.total).toBe(3);
    });

    it('limit は上限値を超えるとサーバ側でクランプされる', async () => {
      const { token } = await seedMessages('pg8', 'クランプ検索', 1);

      const res = await request(app)
        .get(`/api/messages/search?q=${encodeURIComponent('クランプ検索')}&limit=9999`)
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      expect(res.body.limit).toBe(100);
    });

    it('limit / offset が数値以外・負数の場合は 400 を返す', async () => {
      const { token } = await registerUser(app, 'pg9', 'pg9@example.com');

      const badLimit = await request(app)
        .get('/api/messages/search?q=test&limit=abc')
        .set('Cookie', `token=${token}`);
      expect(badLimit.status).toBe(400);

      const negativeOffset = await request(app)
        .get('/api/messages/search?q=test&offset=-1')
        .set('Cookie', `token=${token}`);
      expect(negativeOffset.status).toBe(400);
    });
  });
});
