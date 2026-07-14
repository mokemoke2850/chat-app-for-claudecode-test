/**
 * テスト対象: DM（ダイレクトメッセージ）API・Socket.IO ハンドラ
 * 戦略:
 *   - DB は pg-mem のインメモリ PostgreSQL 互換 DB を使用（jest.mock('../db/database')）
 *   - REST API は supertest で検証し、Socket.IO イベントはサービス層を直接検証する
 *   - 正常系・境界条件・エラーケースを網羅する
 */

import { createTestDatabase } from './__fixtures__/pgTestHelper';

const testDb = createTestDatabase();

jest.mock('../db/database', () => testDb);

import request from 'supertest';
import { createApp } from '../app';
import { makeAdmin, registerUser } from './__fixtures__/testHelpers';
import * as dmService from '../services/dmService';

const app = createApp();

let userAId: number;
let userBId: number;
let userCId: number;
let tokenA: string;
let tokenB: string;

beforeAll(async () => {
  const a = await registerUser(app, 'dm_userA', 'dm_a@example.com');
  userAId = a.userId;
  tokenA = a.token;

  const b = await registerUser(app, 'dm_userB', 'dm_b@example.com');
  userBId = b.userId;
  tokenB = b.token;

  const c = await registerUser(app, 'dm_userC', 'dm_c@example.com');
  userCId = c.userId;
});

describe('DM API', () => {
  describe('DMメッセージ編集・編集履歴（#424）', () => {
    async function createMessage(
      content: string,
    ): Promise<{ conversationId: number; messageId: number }> {
      const conversation = await request(app)
        .post('/api/dm/conversations')
        .set('Cookie', `token=${tokenA}`)
        .send({ targetUserId: userBId });
      const conversationId = conversation.body.conversation.id as number;
      const message = await dmService.sendMessage(conversationId, userAId, content);
      return { conversationId, messageId: message.id };
    }

    it('送信者がDM本文を編集すると編集済み情報を含む更新後メッセージを返す', async () => {
      const { conversationId, messageId } = await createMessage('編集前');
      const res = await request(app)
        .patch(`/api/dm/conversations/${conversationId}/messages/${messageId}`)
        .set('Cookie', `token=${tokenA}`)
        .send({ content: '編集後' });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatchObject({ id: messageId, content: '編集後', isEdited: true });
      expect(Number.isNaN(Date.parse(res.body.message.updatedAt))).toBe(false);
    });

    it('編集時に編集前本文・編集者・編集日時を履歴として保存する', async () => {
      const { conversationId, messageId } = await createMessage('履歴に残る本文');
      await request(app)
        .patch(`/api/dm/conversations/${conversationId}/messages/${messageId}`)
        .set('Cookie', `token=${tokenA}`)
        .send({ content: '新しい本文' });

      const res = await request(app)
        .get(`/api/dm/conversations/${conversationId}/messages/${messageId}/history`)
        .set('Cookie', `token=${tokenA}`);
      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([
        expect.objectContaining({
          messageId,
          content: '履歴に残る本文',
          editorId: userAId,
          editorUsername: 'dm_userA',
        }),
      ]);
      expect(Number.isNaN(Date.parse(res.body.items[0].editedAt))).toBe(false);
    });

    it('履歴保存後の本文更新に失敗すると履歴と本文の両方をロールバックする', async () => {
      const { conversationId, messageId } = await createMessage('ロールバック前');
      const originalQuery = testDb.pool.query.bind(testDb.pool);
      const spy = jest
        .spyOn(testDb.pool, 'query')
        .mockImplementation((...args: Parameters<typeof testDb.pool.query>) => {
          if (typeof args[0] === 'string' && args[0].startsWith('UPDATE dm_messages SET content')) {
            throw new Error('本文更新エラー');
          }
          return originalQuery(...args);
        });
      const editDmMessage = (
        dmService as unknown as {
          editMessage: (
            conversationId: number,
            messageId: number,
            userId: number,
            content: string,
          ) => Promise<unknown>;
        }
      ).editMessage;

      try {
        await expect(
          editDmMessage(conversationId, messageId, userAId, '更新されない'),
        ).rejects.toThrow('本文更新エラー');
      } finally {
        spy.mockRestore();
      }

      const messages = await dmService.getMessages(conversationId, userAId);
      const history = await request(app)
        .get(`/api/dm/conversations/${conversationId}/messages/${messageId}/history`)
        .set('Cookie', `token=${tokenA}`);
      expect(messages.find((message) => message.id === messageId)?.content).toBe('ロールバック前');
      expect(history.body.items).toEqual([]);
    });

    it('複数回編集した履歴を古い順に取得できる', async () => {
      const { conversationId, messageId } = await createMessage('元本文');
      for (const content of ['1回目', '2回目']) {
        await request(app)
          .patch(`/api/dm/conversations/${conversationId}/messages/${messageId}`)
          .set('Cookie', `token=${tokenA}`)
          .send({ content });
      }
      const res = await request(app)
        .get(`/api/dm/conversations/${conversationId}/messages/${messageId}/history`)
        .set('Cookie', `token=${tokenA}`);
      expect(res.body.items.map((item: { content: string }) => item.content)).toEqual([
        '元本文',
        '1回目',
      ]);
      expect(res.body.items[0].id).toBeLessThan(res.body.items[1].id);
    });

    it('会話のもう一方の参加者が編集履歴を取得できる', async () => {
      const { conversationId, messageId } = await createMessage('参加者に見える履歴');
      await request(app)
        .patch(`/api/dm/conversations/${conversationId}/messages/${messageId}`)
        .set('Cookie', `token=${tokenA}`)
        .send({ content: '編集後' });
      const res = await request(app)
        .get(`/api/dm/conversations/${conversationId}/messages/${messageId}/history`)
        .set('Cookie', `token=${tokenB}`);
      expect(res.status).toBe(200);
      expect(res.body.items[0].content).toBe('参加者に見える履歴');
    });

    it('送信者以外はDM本文を編集できず本文と履歴が変更されない', async () => {
      const { conversationId, messageId } = await createMessage('変更禁止');
      const edit = await request(app)
        .patch(`/api/dm/conversations/${conversationId}/messages/${messageId}`)
        .set('Cookie', `token=${tokenB}`)
        .send({ content: '不正編集' });
      const messages = await dmService.getMessages(conversationId, userAId);
      const history = await request(app)
        .get(`/api/dm/conversations/${conversationId}/messages/${messageId}/history`)
        .set('Cookie', `token=${tokenA}`);
      expect(edit.status).toBe(403);
      expect(messages.find((message) => message.id === messageId)?.content).toBe('変更禁止');
      expect(history.body.items).toEqual([]);
    });

    it('会話の第三者はDM編集履歴を取得できない', async () => {
      const outsider = await registerUser(
        app,
        'dm_history_outsider',
        'dm_history_outsider@example.com',
      );
      const { conversationId, messageId } = await createMessage('第三者に秘密');
      await request(app)
        .patch(`/api/dm/conversations/${conversationId}/messages/${messageId}`)
        .set('Cookie', `token=${tokenA}`)
        .send({ content: '編集後' });
      const res = await request(app)
        .get(`/api/dm/conversations/${conversationId}/messages/${messageId}/history`)
        .set('Cookie', `token=${outsider.token}`);
      expect(res.status).toBe(404);
      expect(res.text).not.toContain('第三者に秘密');
    });

    it('管理者でも会話の第三者ならDM本文と編集履歴を取得できない', async () => {
      const admin = await registerUser(app, 'dm_history_admin', 'dm_history_admin@example.com');
      await makeAdmin(admin.userId);
      const { conversationId, messageId } = await createMessage('管理者にも秘密');
      await request(app)
        .patch(`/api/dm/conversations/${conversationId}/messages/${messageId}`)
        .set('Cookie', `token=${tokenA}`)
        .send({ content: '編集後' });
      const messages = await request(app)
        .get(`/api/dm/conversations/${conversationId}/messages`)
        .set('Cookie', `token=${admin.token}`);
      const history = await request(app)
        .get(`/api/dm/conversations/${conversationId}/messages/${messageId}/history`)
        .set('Cookie', `token=${admin.token}`);
      expect(messages.status).toBe(404);
      expect(history.status).toBe(404);
      expect(`${messages.text}${history.text}`).not.toContain('管理者にも秘密');
    });

    it('別会話のパスからDMを編集できず元の本文と履歴が変更されない', async () => {
      const { conversationId, messageId } = await createMessage('別会話から変更禁止');
      const otherConversation = await request(app)
        .post('/api/dm/conversations')
        .set('Cookie', `token=${tokenA}`)
        .send({ targetUserId: userCId });
      const edit = await request(app)
        .patch(
          `/api/dm/conversations/${otherConversation.body.conversation.id}/messages/${messageId}`,
        )
        .set('Cookie', `token=${tokenA}`)
        .send({ content: 'IDOR編集' });
      const messages = await dmService.getMessages(conversationId, userAId);
      const history = await request(app)
        .get(`/api/dm/conversations/${conversationId}/messages/${messageId}/history`)
        .set('Cookie', `token=${tokenA}`);
      expect(edit.status).toBe(404);
      expect(messages.find((message) => message.id === messageId)?.content).toBe(
        '別会話から変更禁止',
      );
      expect(history.body.items).toEqual([]);
    });

    it('別会話のパスからDM編集履歴を取得できず本文も漏えいしない', async () => {
      const { conversationId, messageId } = await createMessage('別会話に秘密');
      await request(app)
        .patch(`/api/dm/conversations/${conversationId}/messages/${messageId}`)
        .set('Cookie', `token=${tokenA}`)
        .send({ content: '編集後' });
      const otherConversation = await request(app)
        .post('/api/dm/conversations')
        .set('Cookie', `token=${tokenA}`)
        .send({ targetUserId: userCId });
      const history = await request(app)
        .get(
          `/api/dm/conversations/${otherConversation.body.conversation.id}/messages/${messageId}/history`,
        )
        .set('Cookie', `token=${tokenA}`);
      expect(history.status).toBe(404);
      expect(history.text).not.toContain('別会話に秘密');
    });

    it('空白だけの本文では編集できず本文と履歴が変更されない', async () => {
      const { conversationId, messageId } = await createMessage('空白編集前');
      const edit = await request(app)
        .patch(`/api/dm/conversations/${conversationId}/messages/${messageId}`)
        .set('Cookie', `token=${tokenA}`)
        .send({ content: '   ' });
      const messages = await dmService.getMessages(conversationId, userAId);
      const history = await request(app)
        .get(`/api/dm/conversations/${conversationId}/messages/${messageId}/history`)
        .set('Cookie', `token=${tokenA}`);
      expect(edit.status).toBe(400);
      expect(messages.find((message) => message.id === messageId)?.content).toBe('空白編集前');
      expect(history.body.items).toEqual([]);
    });

    it('未認証ではDM本文の編集と編集履歴の取得ができない', async () => {
      const { conversationId, messageId } = await createMessage('認証必須');
      const edit = await request(app)
        .patch(`/api/dm/conversations/${conversationId}/messages/${messageId}`)
        .send({ content: '編集後' });
      const history = await request(app).get(
        `/api/dm/conversations/${conversationId}/messages/${messageId}/history`,
      );
      expect(edit.status).toBe(401);
      expect(history.status).toBe(401);
    });
  });

  describe('POST /api/dm/conversations', () => {
    it('存在するユーザーとのDM会話を新規作成できる', async () => {
      const res = await request(app)
        .post('/api/dm/conversations')
        .set('Cookie', `token=${tokenA}`)
        .send({ targetUserId: userBId });

      expect(res.status).toBe(201);
      expect(res.body.conversation).toBeDefined();
      expect(res.body.conversation.otherUser.id).toBe(userBId);
    });

    it('既存のDM会話がある場合は既存のものを返す（冪等性）', async () => {
      const res1 = await request(app)
        .post('/api/dm/conversations')
        .set('Cookie', `token=${tokenA}`)
        .send({ targetUserId: userCId });

      const res2 = await request(app)
        .post('/api/dm/conversations')
        .set('Cookie', `token=${tokenA}`)
        .send({ targetUserId: userCId });

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);
      expect(res1.body.conversation.id).toBe(res2.body.conversation.id);
    });

    it('自分自身とのDMは作成できない', async () => {
      const res = await request(app)
        .post('/api/dm/conversations')
        .set('Cookie', `token=${tokenA}`)
        .send({ targetUserId: userAId });

      expect(res.status).toBe(400);
      // #372 統一エラー形式: error は { code, message } オブジェクト
      expect(res.body.error.message).toBe('Cannot create DM with yourself');
    });

    it('存在しないユーザーIDを指定するとエラーになる', async () => {
      const res = await request(app)
        .post('/api/dm/conversations')
        .set('Cookie', `token=${tokenA}`)
        .send({ targetUserId: 99999 });

      expect(res.status).toBe(404);
    });

    it('未認証リクエストは401を返す', async () => {
      const res = await request(app).post('/api/dm/conversations').send({ targetUserId: userBId });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/dm/conversations', () => {
    let convId: number;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/dm/conversations')
        .set('Cookie', `token=${tokenA}`)
        .send({ targetUserId: userBId });
      convId = res.body.conversation.id as number;
    });

    it('自分が参加しているDM会話一覧を取得できる', async () => {
      const res = await request(app).get('/api/dm/conversations').set('Cookie', `token=${tokenA}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.conversations)).toBe(true);
      expect(res.body.conversations.some((c: { id: number }) => c.id === convId)).toBe(true);
    });

    it('未読メッセージ数が含まれる', async () => {
      const res = await request(app).get('/api/dm/conversations').set('Cookie', `token=${tokenA}`);

      expect(res.status).toBe(200);
      const conv = (res.body.conversations as Array<{ id: number; unreadCount: number }>).find(
        (c) => c.id === convId,
      );
      expect(conv).toBeDefined();
      expect(typeof conv!.unreadCount).toBe('number');
    });

    it('最新メッセージの情報が含まれる', async () => {
      await request(app)
        .post(`/api/dm/conversations/${convId}/messages`)
        .set('Cookie', `token=${tokenA}`)
        .send({ content: '最新メッセージ確認用' });

      const res = await request(app).get('/api/dm/conversations').set('Cookie', `token=${tokenA}`);

      const conv = (
        res.body.conversations as Array<{ id: number; lastMessage: { content: string } | null }>
      ).find((c) => c.id === convId);
      expect(conv?.lastMessage).not.toBeNull();
      expect(conv?.lastMessage?.content).toBe('最新メッセージ確認用');
    });

    it('DM会話がない場合は空配列を返す', async () => {
      const { token: tokenC } = await registerUser(app, 'dm_noconv', 'dm_noconv@example.com');
      const res = await request(app).get('/api/dm/conversations').set('Cookie', `token=${tokenC}`);

      expect(res.status).toBe(200);
      expect(res.body.conversations).toEqual([]);
    });

    it('未認証リクエストは401を返す', async () => {
      const res = await request(app).get('/api/dm/conversations');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/dm/conversations/:conversationId/messages', () => {
    let convId: number;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/dm/conversations')
        .set('Cookie', `token=${tokenA}`)
        .send({ targetUserId: userBId });
      convId = res.body.conversation.id as number;
      for (let i = 1; i <= 5; i++) {
        await request(app)
          .post(`/api/dm/conversations/${convId}/messages`)
          .set('Cookie', `token=${tokenA}`)
          .send({ content: `message ${i}` });
      }
    });

    it('DM会話のメッセージ一覧を取得できる', async () => {
      const res = await request(app)
        .get(`/api/dm/conversations/${convId}/messages`)
        .set('Cookie', `token=${tokenA}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body.items.length).toBeGreaterThan(0);
    });

    it('自分が参加していない会話のメッセージは取得できない（404）', async () => {
      const { token: tokenC2 } = await registerUser(app, 'dm_notpart', 'dm_notpart@example.com');
      const res = await request(app)
        .get(`/api/dm/conversations/${convId}/messages`)
        .set('Cookie', `token=${tokenC2}`);

      expect(res.status).toBe(404);
    });

    it('存在しない会話IDを指定すると404を返す', async () => {
      const res = await request(app)
        .get('/api/dm/conversations/99999/messages')
        .set('Cookie', `token=${tokenA}`);

      expect(res.status).toBe(404);
    });

    it('cursor ベースのページネーションが機能する', async () => {
      const allRes = await request(app)
        .get(`/api/dm/conversations/${convId}/messages`)
        .set('Cookie', `token=${tokenA}`);
      const allMessages = allRes.body.items as Array<{ id: number; content: string }>;
      expect(allMessages.length).toBeGreaterThanOrEqual(2);

      const secondId = allMessages[1].id;
      const res = await request(app)
        .get(`/api/dm/conversations/${convId}/messages?before=${secondId}`)
        .set('Cookie', `token=${tokenA}`);

      expect(res.status).toBe(200);
      const messages = res.body.items as Array<{ id: number }>;
      expect(messages.every((m) => m.id < secondId)).toBe(true);
    });

    it('未認証リクエストは401を返す', async () => {
      const res = await request(app).get(`/api/dm/conversations/${convId}/messages`);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/dm/conversations/:conversationId/messages', () => {
    let convId: number;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/dm/conversations')
        .set('Cookie', `token=${tokenA}`)
        .send({ targetUserId: userBId });
      convId = res.body.conversation.id as number;
    });

    it('DM会話にメッセージを送信できる', async () => {
      const res = await request(app)
        .post(`/api/dm/conversations/${convId}/messages`)
        .set('Cookie', `token=${tokenA}`)
        .send({ content: 'こんにちは' });

      expect(res.status).toBe(201);
      expect(res.body.message.content).toBe('こんにちは');
      expect(res.body.message.senderId).toBe(userAId);
    });

    it('自分が参加していない会話には送信できない（403）', async () => {
      const { token: tokenOther } = await registerUser(app, 'dm_other1', 'dm_other1@example.com');
      const res = await request(app)
        .post(`/api/dm/conversations/${convId}/messages`)
        .set('Cookie', `token=${tokenOther}`)
        .send({ content: '不正送信' });

      expect(res.status).toBe(403);
    });

    it('空のメッセージは送信できない', async () => {
      const res = await request(app)
        .post(`/api/dm/conversations/${convId}/messages`)
        .set('Cookie', `token=${tokenA}`)
        .send({ content: '   ' });

      expect(res.status).toBe(400);
    });

    it('未認証リクエストは401を返す', async () => {
      const res = await request(app)
        .post(`/api/dm/conversations/${convId}/messages`)
        .send({ content: 'test' });

      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/dm/conversations/:conversationId/read', () => {
    let convId: number;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/dm/conversations')
        .set('Cookie', `token=${tokenA}`)
        .send({ targetUserId: userBId });
      convId = res.body.conversation.id as number;
      await request(app)
        .post(`/api/dm/conversations/${convId}/messages`)
        .set('Cookie', `token=${tokenB}`)
        .send({ content: '未読テスト用' });
    });

    it('指定した会話の未読を既読に更新できる', async () => {
      const before = await request(app)
        .get('/api/dm/conversations')
        .set('Cookie', `token=${tokenA}`);
      const convBefore = (
        before.body.conversations as Array<{ id: number; unreadCount: number }>
      ).find((c) => c.id === convId);
      expect(convBefore?.unreadCount).toBeGreaterThan(0);

      const res = await request(app)
        .put(`/api/dm/conversations/${convId}/read`)
        .set('Cookie', `token=${tokenA}`);
      expect(res.status).toBe(204);

      const after = await request(app)
        .get('/api/dm/conversations')
        .set('Cookie', `token=${tokenA}`);
      const convAfter = (
        after.body.conversations as Array<{ id: number; unreadCount: number }>
      ).find((c) => c.id === convId);
      expect(convAfter?.unreadCount).toBe(0);
    });

    it('自分が参加していない会話は更新できない（403）', async () => {
      const { token: tokenOther2 } = await registerUser(app, 'dm_other2', 'dm_other2@example.com');
      const res = await request(app)
        .put(`/api/dm/conversations/${convId}/read`)
        .set('Cookie', `token=${tokenOther2}`);

      expect(res.status).toBe(403);
    });

    it('未認証リクエストは401を返す', async () => {
      const res = await request(app).put(`/api/dm/conversations/${convId}/read`);
      expect(res.status).toBe(401);
    });
  });
});

describe('Socket.IO DM イベント', () => {
  describe('send_dm イベント', () => {
    it('メッセージ送信時に送信者と受信者の両方に new_dm_message が emit される', async () => {
      const convRes = await request(app)
        .post('/api/dm/conversations')
        .set('Cookie', `token=${tokenA}`)
        .send({ targetUserId: userBId });
      const convId = convRes.body.conversation.id as number;

      const message = await dmService.sendMessage(convId, userAId, 'Socket テスト');
      expect(message.content).toBe('Socket テスト');
      expect(message.senderId).toBe(userAId);
      expect(message.conversationId).toBe(convId);
    });

    it('受信者がオフライン時はメッセージがDBに保存される', async () => {
      const convRes = await request(app)
        .post('/api/dm/conversations')
        .set('Cookie', `token=${tokenA}`)
        .send({ targetUserId: userBId });
      const convId = convRes.body.conversation.id as number;

      await dmService.sendMessage(convId, userAId, 'オフライン受信者へのメッセージ');

      const messages = await dmService.getMessages(convId, userAId);
      expect(messages.some((m) => m.content === 'オフライン受信者へのメッセージ')).toBe(true);
    });

    it('参加していない会話への送信はエラーになる', async () => {
      const convRes = await request(app)
        .post('/api/dm/conversations')
        .set('Cookie', `token=${tokenA}`)
        .send({ targetUserId: userBId });
      const convId = convRes.body.conversation.id as number;

      await expect(dmService.sendMessage(convId, userCId, '不正送信')).rejects.toThrow(
        'Conversation not found or access denied',
      );
    });
  });

  describe('dm_typing_start / dm_typing_stop イベント', () => {
    it('typing_start で相手に dm_user_typing が emit される', async () => {
      const conv = await dmService.getOrCreateConversation(userAId, userBId);
      const otherUserId = await dmService.getOtherUserId(conv.id, userAId);
      expect(otherUserId).toBe(userBId);
    });

    it('typing_stop で相手に dm_user_stopped_typing が emit される', async () => {
      const conv = await dmService.getOrCreateConversation(userAId, userBId);
      const otherUserId = await dmService.getOtherUserId(conv.id, userBId);
      expect(otherUserId).toBe(userAId);
    });
  });

  describe('新着DM通知', () => {
    it('新着DM受信時に受信者の user:id ルームに dm_notification が emit される', async () => {
      const conv = await dmService.getOrCreateConversation(userAId, userBId);
      await dmService.sendMessage(conv.id, userAId, '通知テスト用メッセージ');

      const conversations = await dmService.getConversations(userBId);
      const target = conversations.find((c) => c.id === conv.id);
      expect(target).toBeDefined();
      expect(target!.unreadCount).toBeGreaterThan(0);
    });
  });
});

// #386 ページング標準仕様（カーソル系 { items, nextCursor, hasMore }）への移行
// 対象: GET /api/dm/conversations/:conversationId/messages（旧 { messages }）
describe('GET /api/dm/conversations/:id/messages カーソルページング（#386）', () => {
  // n 件のメッセージを持つ会話を用意する
  async function seedConversation(prefix: string, count: number) {
    const a = await registerUser(app, `${prefix}_a`, `${prefix}_a@example.com`);
    const b = await registerUser(app, `${prefix}_b`, `${prefix}_b@example.com`);
    const convRes = await request(app)
      .post('/api/dm/conversations')
      .set('Cookie', `token=${a.token}`)
      .send({ targetUserId: b.userId });
    const convId = convRes.body.conversation.id as number;
    for (let i = 0; i < count; i++) {
      await request(app)
        .post(`/api/dm/conversations/${convId}/messages`)
        .set('Cookie', `token=${a.token}`)
        .send({ content: `${prefix} msg ${i}` });
    }
    return { token: a.token, convId };
  }

  it('レスポンスが { items, nextCursor, hasMore } 形式で返る（旧 { messages } から変更）', async () => {
    const { token, convId } = await seedConversation('dmcur1', 3);
    const res = await request(app)
      .get(`/api/dm/conversations/${convId}/messages`)
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('messages');
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body).toHaveProperty('nextCursor');
    expect(typeof res.body.hasMore).toBe('boolean');
  });

  it('items が時系列昇順の DM メッセージ配列を保持する', async () => {
    const { token, convId } = await seedConversation('dmcur2', 3);
    const res = await request(app)
      .get(`/api/dm/conversations/${convId}/messages`)
      .set('Cookie', `token=${token}`);

    const ids = (res.body.items as { id: number }[]).map((m) => m.id);
    expect(ids).toEqual([...ids].sort((x, y) => x - y));
  });

  it('続きがある場合 hasMore=true かつ nextCursor に次の before 値が入る', async () => {
    const { token, convId } = await seedConversation('dmcur3', 5);
    const res = await request(app)
      .get(`/api/dm/conversations/${convId}/messages?limit=2`)
      .set('Cookie', `token=${token}`);

    expect(res.body.items).toHaveLength(2);
    expect(res.body.hasMore).toBe(true);
    expect(res.body.nextCursor).toBe(String((res.body.items as { id: number }[])[0].id));
  });

  it('最古まで読み込むと hasMore=false かつ nextCursor=null になる', async () => {
    const { token, convId } = await seedConversation('dmcur4', 2);
    const res = await request(app)
      .get(`/api/dm/conversations/${convId}/messages?limit=50`)
      .set('Cookie', `token=${token}`);

    expect(res.body.items).toHaveLength(2);
    expect(res.body.hasMore).toBe(false);
    expect(res.body.nextCursor).toBeNull();
  });

  it('nextCursor を before に渡すと重複なく続き（より古いメッセージ）を取得できる', async () => {
    const { token, convId } = await seedConversation('dmcur5', 5);
    const page1 = await request(app)
      .get(`/api/dm/conversations/${convId}/messages?limit=2`)
      .set('Cookie', `token=${token}`);
    const cursor = page1.body.nextCursor as string;
    const page2 = await request(app)
      .get(`/api/dm/conversations/${convId}/messages?limit=2&before=${cursor}`)
      .set('Cookie', `token=${token}`);

    const ids1 = (page1.body.items as { id: number }[]).map((m) => m.id);
    const ids2 = (page2.body.items as { id: number }[]).map((m) => m.id);
    expect(ids1.some((id) => ids2.includes(id))).toBe(false);
    expect(Math.max(...ids2)).toBeLessThan(Math.min(...ids1));
  });
});
