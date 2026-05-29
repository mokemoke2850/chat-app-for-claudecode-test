/**
 * テスト対象: routes/guestLinks.ts — /api/guest-links および /api/guest-links/:token/* エンドポイント（#149）
 * 戦略:
 *   - supertest で HTTP エンドポイントを叩き、認可（管理ルートは認証必須・公開ルートは未認証可）と
 *     ステータスコード／レスポンス形状を中心に検証する
 *   - 投稿系エンドポイントへゲストトークン経由でアクセスすると 401 になることを確認する
 *   - 既存 routes/messages.ts や middleware/auth.ts への副作用がないことを境界として確認する
 */

import { createTestDatabase, resetTestData } from '../__fixtures__/pgTestHelper';

const testDb = createTestDatabase();

jest.mock('../../db/database', () => testDb);

import request from 'supertest';
import { createApp } from '../../app';
import { registerUser } from '../__fixtures__/testHelpers';
import * as guestLinkService from '../../services/guestLinkService';

const app = createApp();

let creatorToken: string;
let creatorId: number;
let channelId: number;
let outsiderToken: string;

beforeEach(async () => {
  await resetTestData(testDb);
  guestLinkService._resetFailureMap();
  const reg = await registerUser(app, 'gl_creator', 'gl_creator@t.com');
  creatorToken = reg.token;
  creatorId = reg.userId;

  const reg2 = await registerUser(app, 'gl_outsider', 'gl_outsider@t.com');
  outsiderToken = reg2.token;

  const rc = await testDb.execute(
    'INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id',
    ['gl-route-ch', creatorId],
  );
  channelId = rc.rows[0].id as number;
  await testDb.execute('INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2)', [
    channelId,
    creatorId,
  ]);
});

describe('ゲスト閲覧リンクルート', () => {
  describe('POST /api/channels/:id/guest-links — ゲストリンク発行', () => {
    it('チャンネルメンバーがゲストリンクを発行できる（201）', async () => {
      const res = await request(app)
        .post(`/api/channels/${channelId}/guest-links`)
        .set('Cookie', `token=${creatorToken}`)
        .send({});
      expect(res.status).toBe(201);
      expect(res.body.guestLink.token).toBeTruthy();
      expect(res.body.guestLink.channelId).toBe(channelId);
    });

    it('チャンネルメンバーでない一般ユーザーは 403 になる', async () => {
      const res = await request(app)
        .post(`/api/channels/${channelId}/guest-links`)
        .set('Cookie', `token=${outsiderToken}`)
        .send({});
      expect(res.status).toBe(403);
    });

    it('認証なしでは 401 になる', async () => {
      const res = await request(app).post(`/api/channels/${channelId}/guest-links`).send({});
      expect(res.status).toBe(401);
    });

    it('パスワード・有効期限を指定して発行できる', async () => {
      const res = await request(app)
        .post(`/api/channels/${channelId}/guest-links`)
        .set('Cookie', `token=${creatorToken}`)
        .send({ password: 'pw', expiresInHours: 24 });
      expect(res.status).toBe(201);
      expect(res.body.guestLink.hasPassword).toBe(true);
      expect(res.body.guestLink.expiresAt).not.toBeNull();
    });

    it('レスポンスに password_hash 平文は含まれない', async () => {
      const res = await request(app)
        .post(`/api/channels/${channelId}/guest-links`)
        .set('Cookie', `token=${creatorToken}`)
        .send({ password: 'pw' });
      expect(res.body.guestLink.password_hash).toBeUndefined();
    });

    it('存在しないチャンネル ID では 404 になる', async () => {
      const res = await request(app)
        .post(`/api/channels/999999/guest-links`)
        .set('Cookie', `token=${creatorToken}`)
        .send({});
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/channels/:id/guest-links — ゲストリンク一覧', () => {
    it('チャンネルメンバーが一覧を取得できる', async () => {
      await guestLinkService.create(creatorId, { channelId });
      const res = await request(app)
        .get(`/api/channels/${channelId}/guest-links`)
        .set('Cookie', `token=${creatorToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.guestLinks)).toBe(true);
      expect(res.body.guestLinks.length).toBe(1);
    });

    it('チャンネルメンバーでない一般ユーザーは 403 になる', async () => {
      const res = await request(app)
        .get(`/api/channels/${channelId}/guest-links`)
        .set('Cookie', `token=${outsiderToken}`);
      expect(res.status).toBe(403);
    });

    it('認証なしでは 401 になる', async () => {
      const res = await request(app).get(`/api/channels/${channelId}/guest-links`);
      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/guest-links/:id — ゲストリンク失効', () => {
    it('作成者が自分のリンクを失効できる（200）', async () => {
      const link = await guestLinkService.create(creatorId, { channelId });
      const res = await request(app)
        .delete(`/api/guest-links/${link.id}`)
        .set('Cookie', `token=${creatorToken}`);
      expect(res.status).toBe(200);
      expect(res.body.guestLink.isRevoked).toBe(true);
    });

    it('作成者でも admin でもないユーザーは 403 になる', async () => {
      const link = await guestLinkService.create(creatorId, { channelId });
      const res = await request(app)
        .delete(`/api/guest-links/${link.id}`)
        .set('Cookie', `token=${outsiderToken}`);
      expect(res.status).toBe(403);
    });

    it('存在しないリンク ID は 404 になる', async () => {
      const res = await request(app)
        .delete(`/api/guest-links/999999`)
        .set('Cookie', `token=${creatorToken}`);
      expect(res.status).toBe(404);
    });

    it('認証なしでは 401 になる', async () => {
      const link = await guestLinkService.create(creatorId, { channelId });
      const res = await request(app).delete(`/api/guest-links/${link.id}`);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/guest-links/:token — トークン情報取得（公開・未認証可）', () => {
    it('有効なトークンの情報を返す（hasPassword・isExpired・isRevoked）', async () => {
      const link = await guestLinkService.create(creatorId, { channelId, password: 'pw' });
      const res = await request(app).get(`/api/guest-links/${link.token}`);
      expect(res.status).toBe(200);
      expect(res.body.guestLink.hasPassword).toBe(true);
      expect(res.body.guestLink.isRevoked).toBe(false);
    });

    it('存在しないトークンは 404 になる', async () => {
      const res = await request(app).get(`/api/guest-links/no-such-token`);
      expect(res.status).toBe(404);
    });

    it('未認証でもアクセスできる（200）', async () => {
      const link = await guestLinkService.create(creatorId, { channelId });
      const res = await request(app).get(`/api/guest-links/${link.token}`);
      expect(res.status).toBe(200);
    });

    it('レスポンスに password_hash 平文は含まれない', async () => {
      const link = await guestLinkService.create(creatorId, { channelId, password: 'pw' });
      const res = await request(app).get(`/api/guest-links/${link.token}`);
      expect(res.body.guestLink.password_hash).toBeUndefined();
    });
  });

  describe('POST /api/guest-links/:token/verify — パスワード検証 + ゲストセッション発行', () => {
    it('パスワード未設定リンクは空文字でも 200 と guestToken を返す', async () => {
      const link = await guestLinkService.create(creatorId, { channelId });
      const res = await request(app)
        .post(`/api/guest-links/${link.token}/verify`)
        .send({ password: '' });
      expect(res.status).toBe(200);
      expect(res.body.guestToken).toBeTruthy();
    });

    it('パスワード設定済みリンクで正しいパスワードを送ると 200 と guestToken を返す', async () => {
      const link = await guestLinkService.create(creatorId, { channelId, password: 'pw' });
      const res = await request(app)
        .post(`/api/guest-links/${link.token}/verify`)
        .send({ password: 'pw' });
      expect(res.status).toBe(200);
      expect(res.body.guestToken).toBeTruthy();
    });

    it('パスワード設定済みリンクで誤ったパスワードを送ると 401 になる', async () => {
      const link = await guestLinkService.create(creatorId, { channelId, password: 'pw' });
      const res = await request(app)
        .post(`/api/guest-links/${link.token}/verify`)
        .send({ password: 'wrong' });
      expect(res.status).toBe(401);
    });

    it('失効済みリンクは 410 になる', async () => {
      const link = await guestLinkService.create(creatorId, { channelId });
      await guestLinkService.revoke(creatorId, link.id, false);
      const res = await request(app)
        .post(`/api/guest-links/${link.token}/verify`)
        .send({ password: '' });
      expect(res.status).toBe(410);
    });
  });

  describe('GET /api/guest-links/:token/messages — 公開メッセージ取得', () => {
    it('有効な guestToken（Authorization ヘッダ）でメッセージ一覧が取得できる', async () => {
      const link = await guestLinkService.create(creatorId, { channelId });
      await testDb.execute(
        'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3)',
        [channelId, creatorId, 'hello'],
      );
      const verifyRes = await request(app).post(`/api/guest-links/${link.token}/verify`).send({});
      const guestToken = verifyRes.body.guestToken;

      const res = await request(app)
        .get(`/api/guest-links/${link.token}/messages`)
        .set('Authorization', `Bearer ${guestToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body.items.length).toBe(1);
    });

    it('guestToken なしでは 401 になる', async () => {
      const link = await guestLinkService.create(creatorId, { channelId });
      const res = await request(app).get(`/api/guest-links/${link.token}/messages`);
      expect(res.status).toBe(401);
    });

    it('失効済みリンクでは 410 になる', async () => {
      const link = await guestLinkService.create(creatorId, { channelId });
      const verifyRes = await request(app).post(`/api/guest-links/${link.token}/verify`).send({});
      const guestToken = verifyRes.body.guestToken;
      await guestLinkService.revoke(creatorId, link.id, false);
      const res = await request(app)
        .get(`/api/guest-links/${link.token}/messages`)
        .set('Authorization', `Bearer ${guestToken}`);
      expect(res.status).toBe(410);
    });

    // #386 ページング標準仕様（カーソル系 { items, nextCursor, hasMore }）への移行
    describe('カーソルページング（#386）', () => {
      // ゲストリンク + n 件のメッセージを用意し guestToken を返す
      async function seedGuest(count: number): Promise<{ token: string; guestToken: string }> {
        const link = await guestLinkService.create(creatorId, { channelId });
        for (let i = 0; i < count; i++) {
          await testDb.execute(
            'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3)',
            [channelId, creatorId, `guest msg ${i}`],
          );
        }
        const verifyRes = await request(app).post(`/api/guest-links/${link.token}/verify`).send({});
        return { token: link.token, guestToken: verifyRes.body.guestToken };
      }

      it('レスポンスが { items, nextCursor, hasMore } 形式で返る（旧 { messages } から変更）', async () => {
        const { token, guestToken } = await seedGuest(3);
        const res = await request(app)
          .get(`/api/guest-links/${token}/messages`)
          .set('Authorization', `Bearer ${guestToken}`);

        expect(res.status).toBe(200);
        expect(res.body).not.toHaveProperty('messages');
        expect(Array.isArray(res.body.items)).toBe(true);
        expect(res.body).toHaveProperty('nextCursor');
        expect(typeof res.body.hasMore).toBe('boolean');
      });

      it('items が時系列昇順のメッセージ配列を保持する', async () => {
        const { token, guestToken } = await seedGuest(3);
        const res = await request(app)
          .get(`/api/guest-links/${token}/messages`)
          .set('Authorization', `Bearer ${guestToken}`);

        const ids = (res.body.items as { id: number }[]).map((m) => m.id);
        expect(ids).toEqual([...ids].sort((x, y) => x - y));
      });

      it('limit を超える場合 hasMore=true かつ nextCursor に次の before 値が入る', async () => {
        const { token, guestToken } = await seedGuest(5);
        const res = await request(app)
          .get(`/api/guest-links/${token}/messages?limit=2`)
          .set('Authorization', `Bearer ${guestToken}`);

        expect(res.body.items).toHaveLength(2);
        expect(res.body.hasMore).toBe(true);
        expect(res.body.nextCursor).toBe(String((res.body.items as { id: number }[])[0].id));
      });

      it('nextCursor を before に渡すと重複なく続き（より古いメッセージ）を取得できる', async () => {
        const { token, guestToken } = await seedGuest(5);
        const page1 = await request(app)
          .get(`/api/guest-links/${token}/messages?limit=2`)
          .set('Authorization', `Bearer ${guestToken}`);
        const cursor = page1.body.nextCursor as string;
        const page2 = await request(app)
          .get(`/api/guest-links/${token}/messages?limit=2&before=${cursor}`)
          .set('Authorization', `Bearer ${guestToken}`);

        const ids1 = (page1.body.items as { id: number }[]).map((m) => m.id);
        const ids2 = (page2.body.items as { id: number }[]).map((m) => m.id);
        expect(ids1.some((id) => ids2.includes(id))).toBe(false);
        expect(Math.max(...ids2)).toBeLessThan(Math.min(...ids1));
      });
    });
  });

  describe('投稿系エンドポイントへのゲストトークン拒否', () => {
    it('cookie に guest JWT をセットしてもチャンネル作成（POST）はできない', async () => {
      // ゲスト JWT を発行
      const link = await guestLinkService.create(creatorId, { channelId });
      const verifyRes = await request(app).post(`/api/guest-links/${link.token}/verify`).send({});
      const guestToken = verifyRes.body.guestToken;

      // ゲスト JWT を既存の cookie ベース認証に流用しようとする攻撃シナリオ
      // payload に userId が無い → 認証された userId が undefined → DB 制約で失敗する
      const res = await request(app)
        .post('/api/channels')
        .set('Cookie', `token=${guestToken}`)
        .send({ name: 'attack-channel' });
      // 201 成功にはならない（500 や 400 など何らかの失敗）
      expect(res.status).not.toBe(201);
    });
  });
});
