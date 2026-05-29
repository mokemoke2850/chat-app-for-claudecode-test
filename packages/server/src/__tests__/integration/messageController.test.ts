/**
 * messageController のHTTPレベルテスト
 *
 * テスト対象: packages/server/src/controllers/messageController.ts
 * 戦略: supertest でHTTPリクエストを発行し、レスポンスのステータスコードと
 * レスポンスボディを検証する。DB は pg-mem のインメモリ PostgreSQL 互換 DB を使用。
 * メッセージ作成はソケット経由のため、DBに直接挿入して検証する。
 */

import { createTestDatabase } from '../__fixtures__/pgTestHelper';

const testDb = createTestDatabase();

jest.mock('../../db/database', () => testDb);

import request from 'supertest';
import { createApp } from '../../app';
import { registerUser, createChannelReq, insertMessage } from '../__fixtures__/testHelpers';

const app = createApp();

describe('GET /api/channels/:channelId/messages', () => {
  it('正常: チャンネルのメッセージ一覧が返る', async () => {
    const { token, userId } = await registerUser(app, 'msg_get1', 'msg_get1@example.com');
    const channelId = await createChannelReq(app, token, 'msg-get-ch1');
    await insertMessage(channelId, userId, 'テストメッセージ');

    const res = await request(app)
      .get(`/api/channels/${channelId}/messages`)
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items[0].content).toBe('テストメッセージ');
  });

  it('正常: limit パラメータで件数を絞り込める', async () => {
    const { token, userId } = await registerUser(app, 'msg_get2', 'msg_get2@example.com');
    const channelId = await createChannelReq(app, token, 'msg-get-ch2');
    for (let i = 0; i < 5; i++) {
      await insertMessage(channelId, userId, `メッセージ${i}`);
    }

    const res = await request(app)
      .get(`/api/channels/${channelId}/messages?limit=3`)
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(3);
  });

  it('正常: before パラメータで指定ID以前のメッセージが返る（ページネーション）', async () => {
    const { token, userId } = await registerUser(app, 'msg_get3', 'msg_get3@example.com');
    const channelId = await createChannelReq(app, token, 'msg-get-ch3');
    const id1 = await insertMessage(channelId, userId, '古いメッセージ');
    const id2 = await insertMessage(channelId, userId, '新しいメッセージ');

    const res = await request(app)
      .get(`/api/channels/${channelId}/messages?before=${id2}`)
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    const ids = (res.body.items as { id: number }[]).map((m) => m.id);
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
    const { token, userId } = await registerUser(app, 'msg_edit1', 'msg_edit1@example.com');
    const channelId = await createChannelReq(app, token, 'msg-edit-ch1');
    const messageId = await insertMessage(channelId, userId, '元のメッセージ');

    const res = await request(app)
      .put(`/api/messages/${messageId}`)
      .set('Cookie', `token=${token}`)
      .send({ content: '編集後メッセージ' });

    expect(res.status).toBe(200);
    expect(res.body.message.content).toBe('編集後メッセージ');
    expect(res.body.message.isEdited).toBe(true);
  });

  it('正常: mentionedUserIds を更新できる', async () => {
    const { token, userId } = await registerUser(app, 'msg_edit2', 'msg_edit2@example.com');
    const { userId: mentionedId } = await registerUser(
      app,
      'msg_edit2_target',
      'msg_edit2_target@example.com',
    );
    const channelId = await createChannelReq(app, token, 'msg-edit-ch2');
    const messageId = await insertMessage(channelId, userId, '元のメッセージ');

    const res = await request(app)
      .put(`/api/messages/${messageId}`)
      .set('Cookie', `token=${token}`)
      .send({ content: 'メンションあり', mentionedUserIds: [mentionedId] });

    expect(res.status).toBe(200);
    expect(res.body.message.mentions).toContain(mentionedId);
  });

  it('異常: content が欠けていると400が返る', async () => {
    const { token, userId } = await registerUser(app, 'msg_edit3', 'msg_edit3@example.com');
    const channelId = await createChannelReq(app, token, 'msg-edit-ch3');
    const messageId = await insertMessage(channelId, userId, '元のメッセージ');

    const res = await request(app)
      .put(`/api/messages/${messageId}`)
      .set('Cookie', `token=${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('異常: 他人のメッセージを編集しようとすると403が返る', async () => {
    const { token: ownerToken, userId: ownerId } = await registerUser(
      app,
      'msg_edit4_owner',
      'msg_edit4_owner@example.com',
    );
    const { token: otherToken } = await registerUser(
      app,
      'msg_edit4_other',
      'msg_edit4_other@example.com',
    );
    const channelId = await createChannelReq(app, ownerToken, 'msg-edit-ch4');
    const messageId = await insertMessage(channelId, ownerId, '他人のメッセージ');

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
    const { token, userId } = await registerUser(app, 'msg_del1', 'msg_del1@example.com');
    const channelId = await createChannelReq(app, token, 'msg-del-ch1');
    const messageId = await insertMessage(channelId, userId, '削除対象メッセージ');

    const res = await request(app)
      .delete(`/api/messages/${messageId}`)
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(204);
  });

  it('異常: 他人のメッセージを削除しようとすると403が返る', async () => {
    const { token: ownerToken, userId: ownerId } = await registerUser(
      app,
      'msg_del2_owner',
      'msg_del2_owner@example.com',
    );
    const { token: otherToken } = await registerUser(
      app,
      'msg_del2_other',
      'msg_del2_other@example.com',
    );
    const channelId = await createChannelReq(app, ownerToken, 'msg-del-ch2');
    const messageId = await insertMessage(channelId, ownerId, '他人のメッセージ');

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

// #375 ページング仕様統一（カーソル系 { items, nextCursor, hasMore }）
// 対象: GET /api/channels/:channelId/messages
// 注: サービス層 getChannelMessages（Message[] を返す）は変更せず、
//     コントローラで limit+1 件取得して hasMore / nextCursor を導出する。
describe('GET /api/channels/:channelId/messages カーソルページング（#375）', () => {
  // n 件のメッセージを持つチャンネルを用意する（戻り値: token, channelId, 挿入順の id 配列）
  async function seedChannel(prefix: string, count: number) {
    const { token, userId } = await registerUser(app, prefix, `${prefix}@example.com`);
    const channelId = await createChannelReq(app, token, `${prefix}-ch`);
    const ids: number[] = [];
    for (let i = 0; i < count; i++) {
      ids.push(await insertMessage(channelId, userId, `${prefix}-msg-${i}`));
    }
    return { token, channelId, ids };
  }

  it('レスポンスが { items, nextCursor, hasMore } 形式で返る（旧 { messages } から変更）', async () => {
    const { token, channelId } = await seedChannel('cur1', 3);

    const res = await request(app)
      .get(`/api/channels/${channelId}/messages`)
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('messages');
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body).toHaveProperty('nextCursor');
    expect(typeof res.body.hasMore).toBe('boolean');
  });

  it('items が時系列昇順のメッセージ配列を保持する', async () => {
    const { token, channelId, ids } = await seedChannel('cur2', 3);

    const res = await request(app)
      .get(`/api/channels/${channelId}/messages`)
      .set('Cookie', `token=${token}`);

    const returnedIds = (res.body.items as { id: number }[]).map((m) => m.id);
    expect(returnedIds).toEqual(ids);
  });

  it('続きがある場合 hasMore=true かつ nextCursor に次の before 値が入る', async () => {
    const { token, channelId } = await seedChannel('cur3', 5);

    const res = await request(app)
      .get(`/api/channels/${channelId}/messages?limit=2`)
      .set('Cookie', `token=${token}`);

    expect(res.body.items).toHaveLength(2);
    expect(res.body.hasMore).toBe(true);
    // nextCursor は現在表示中の最古メッセージ ID（= items[0].id）
    expect(res.body.nextCursor).toBe(String((res.body.items as { id: number }[])[0].id));
  });

  it('最古まで読み込むと hasMore=false かつ nextCursor=null になる', async () => {
    const { token, channelId } = await seedChannel('cur4', 2);

    const res = await request(app)
      .get(`/api/channels/${channelId}/messages?limit=50`)
      .set('Cookie', `token=${token}`);

    expect(res.body.items).toHaveLength(2);
    expect(res.body.hasMore).toBe(false);
    expect(res.body.nextCursor).toBeNull();
  });

  it('nextCursor を before に渡すと重複なく続き（より古いメッセージ）を取得できる', async () => {
    const { token, channelId } = await seedChannel('cur5', 5);

    const page1 = await request(app)
      .get(`/api/channels/${channelId}/messages?limit=2`)
      .set('Cookie', `token=${token}`);
    const cursor = page1.body.nextCursor as string;

    const page2 = await request(app)
      .get(`/api/channels/${channelId}/messages?limit=2&before=${cursor}`)
      .set('Cookie', `token=${token}`);

    const ids1 = (page1.body.items as { id: number }[]).map((m) => m.id);
    const ids2 = (page2.body.items as { id: number }[]).map((m) => m.id);
    expect(ids1.some((id) => ids2.includes(id))).toBe(false);
    // page2 は page1 より古いメッセージ（より小さい ID）
    expect(Math.max(...ids2)).toBeLessThan(Math.min(...ids1));
  });

  it('メッセージ件数が limit 未満のチャンネルは hasMore=false / nextCursor=null', async () => {
    const { token, channelId } = await seedChannel('cur6', 2);

    const res = await request(app)
      .get(`/api/channels/${channelId}/messages?limit=10`)
      .set('Cookie', `token=${token}`);

    expect(res.body.items).toHaveLength(2);
    expect(res.body.hasMore).toBe(false);
    expect(res.body.nextCursor).toBeNull();
  });
});

// #386 ページング標準仕様（カーソル系 { items, nextCursor, hasMore }）への移行
// 対象: GET /api/messages/:id/replies（旧 { replies }）
describe('GET /api/messages/:id/replies カーソルページング（#386）', () => {
  // ルートメッセージ + n 件の返信を持つスレッドを用意する
  async function seedThread(prefix: string, replyCount: number) {
    const { token, userId } = await registerUser(app, prefix, `${prefix}@example.com`);
    const channelId = await createChannelReq(app, token, `${prefix}-ch`);
    const rootId = await insertMessage(channelId, userId, `${prefix}-root`);
    for (let i = 0; i < replyCount; i++) {
      await testDb.execute(
        `INSERT INTO messages (channel_id, user_id, content, parent_message_id, root_message_id)
         VALUES ($1, $2, $3, $4, $4)`,
        [channelId, userId, `${prefix}-reply-${i}`, rootId],
      );
    }
    return { token, rootId };
  }

  it('レスポンスが { items, nextCursor, hasMore } 形式で返る（旧 { replies } から変更）', async () => {
    const { token, rootId } = await seedThread('rep1', 3);
    const res = await request(app)
      .get(`/api/messages/${rootId}/replies`)
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('replies');
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body).toHaveProperty('nextCursor');
    expect(typeof res.body.hasMore).toBe('boolean');
  });

  it('items が時系列昇順のスレッド返信配列を保持する', async () => {
    const { token, rootId } = await seedThread('rep2', 3);
    const res = await request(app)
      .get(`/api/messages/${rootId}/replies`)
      .set('Cookie', `token=${token}`);

    expect(res.body.items).toHaveLength(3);
    const ids = (res.body.items as { id: number }[]).map((m) => m.id);
    expect(ids).toEqual([...ids].sort((x, y) => x - y));
  });

  it('返信件数が limit 未満なら hasMore=false / nextCursor=null', async () => {
    const { token, rootId } = await seedThread('rep3', 2);
    const res = await request(app)
      .get(`/api/messages/${rootId}/replies?limit=10`)
      .set('Cookie', `token=${token}`);

    expect(res.body.items).toHaveLength(2);
    expect(res.body.hasMore).toBe(false);
    expect(res.body.nextCursor).toBeNull();
  });

  it('limit を超える場合 hasMore=true かつ nextCursor が設定される', async () => {
    const { token, rootId } = await seedThread('rep4', 5);
    const res = await request(app)
      .get(`/api/messages/${rootId}/replies?limit=2`)
      .set('Cookie', `token=${token}`);

    expect(res.body.items).toHaveLength(2);
    expect(res.body.hasMore).toBe(true);
    expect(res.body.nextCursor).toBe(String((res.body.items as { id: number }[])[0].id));
  });

  it('nextCursor を before に渡すと重複なく続きを取得できる', async () => {
    const { token, rootId } = await seedThread('rep5', 5);
    const page1 = await request(app)
      .get(`/api/messages/${rootId}/replies?limit=2`)
      .set('Cookie', `token=${token}`);
    const cursor = page1.body.nextCursor as string;
    const page2 = await request(app)
      .get(`/api/messages/${rootId}/replies?limit=2&before=${cursor}`)
      .set('Cookie', `token=${token}`);

    const ids1 = (page1.body.items as { id: number }[]).map((m) => m.id);
    const ids2 = (page2.body.items as { id: number }[]).map((m) => m.id);
    expect(ids1.some((id) => ids2.includes(id))).toBe(false);
    expect(Math.max(...ids2)).toBeLessThan(Math.min(...ids1));
  });
});
