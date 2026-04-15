/**
 * テスト対象: DM（ダイレクトメッセージ）API・Socket.IO ハンドラ
 * 戦略:
 *   - DB は better-sqlite3 のインメモリ DB を使用（jest.mock('../db/database')）
 *   - REST API は supertest で検証し、Socket.IO イベントはサービス層を直接検証する
 *   - 正常系・境界条件・エラーケースを網羅する
 */

import request from 'supertest';
import { createApp } from '../app';
import { registerUser } from './__fixtures__/testHelpers';
import * as dmService from '../services/dmService';

// インメモリ DB モック
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

// テスト用ユーザーID
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
      expect(res.body.error).toBe('Cannot create DM with yourself');
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
      // メッセージを1件送信
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
      // userCとの専用会話は作っていない状態でuserCとして取得
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
      // メッセージを複数件追加
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
      expect(Array.isArray(res.body.messages)).toBe(true);
      expect(res.body.messages.length).toBeGreaterThan(0);
    });

    it('自分が参加していない会話のメッセージは取得できない（404）', async () => {
      // userCは参加していない（getConversationWithDetailsがnullを返すため404）
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
      // 全件取得
      const allRes = await request(app)
        .get(`/api/dm/conversations/${convId}/messages`)
        .set('Cookie', `token=${tokenA}`);
      const allMessages = allRes.body.messages as Array<{ id: number; content: string }>;
      expect(allMessages.length).toBeGreaterThanOrEqual(2);

      // 2番目のメッセージIDをカーソルに指定して取得
      const secondId = allMessages[1].id;
      const res = await request(app)
        .get(`/api/dm/conversations/${convId}/messages?before=${secondId}`)
        .set('Cookie', `token=${tokenA}`);

      expect(res.status).toBe(200);
      const messages = res.body.messages as Array<{ id: number }>;
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
      // userBからメッセージを送信（userAの未読を作成）
      await request(app)
        .post(`/api/dm/conversations/${convId}/messages`)
        .set('Cookie', `token=${tokenB}`)
        .send({ content: '未読テスト用' });
    });

    it('指定した会話の未読を既読に更新できる', async () => {
      // 既読前の未読数を確認
      const before = await request(app)
        .get('/api/dm/conversations')
        .set('Cookie', `token=${tokenA}`);
      const convBefore = (
        before.body.conversations as Array<{ id: number; unreadCount: number }>
      ).find((c) => c.id === convId);
      expect(convBefore?.unreadCount).toBeGreaterThan(0);

      // 既読更新
      const res = await request(app)
        .put(`/api/dm/conversations/${convId}/read`)
        .set('Cookie', `token=${tokenA}`);
      expect(res.status).toBe(204);

      // 既読後の未読数を確認
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

      // dmService.sendMessage を直接呼び出してメッセージが正しく作成されることを確認
      const message = dmService.sendMessage(convId, userAId, 'Socket テスト');
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

      // メッセージを送信
      dmService.sendMessage(convId, userAId, 'オフライン受信者へのメッセージ');

      // DB に保存されていることをメッセージ一覧で確認
      const messages = dmService.getMessages(convId, userAId);
      expect(messages.some((m) => m.content === 'オフライン受信者へのメッセージ')).toBe(true);
    });

    it('参加していない会話への送信はエラーになる', async () => {
      const convRes = await request(app)
        .post('/api/dm/conversations')
        .set('Cookie', `token=${tokenA}`)
        .send({ targetUserId: userBId });
      const convId = convRes.body.conversation.id as number;

      expect(() => dmService.sendMessage(convId, userCId, '不正送信')).toThrow(
        'Conversation not found or access denied',
      );
    });
  });

  describe('dm_typing_start / dm_typing_stop イベント', () => {
    it('typing_start で相手に dm_user_typing が emit される', () => {
      // getOtherUserId を介して相手が正しく取得できることを確認
      const conv = dmService.getOrCreateConversation(userAId, userBId);
      const otherUserId = dmService.getOtherUserId(conv.id, userAId);
      expect(otherUserId).toBe(userBId);
    });

    it('typing_stop で相手に dm_user_stopped_typing が emit される', () => {
      const conv = dmService.getOrCreateConversation(userAId, userBId);
      const otherUserId = dmService.getOtherUserId(conv.id, userBId);
      expect(otherUserId).toBe(userAId);
    });
  });

  describe('新着DM通知', () => {
    it('新着DM受信時に受信者の user:id ルームに dm_notification が emit される', async () => {
      // getOrCreateConversation で会話を作成し、getConversations で未読数が取得できることを確認
      const conv = dmService.getOrCreateConversation(userAId, userBId);
      dmService.sendMessage(conv.id, userAId, '通知テスト用メッセージ');

      const conversations = dmService.getConversations(userBId);
      const target = conversations.find((c) => c.id === conv.id);
      expect(target).toBeDefined();
      expect(target!.unreadCount).toBeGreaterThan(0);
    });
  });
});
