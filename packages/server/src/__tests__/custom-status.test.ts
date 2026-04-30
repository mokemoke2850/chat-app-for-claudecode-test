/**
 * テスト対象: カスタムステータス機能（サーバサイド）
 *
 * 戦略:
 *   - pg-mem のインメモリ PostgreSQL 互換 DB を使いサービス層・HTTP エンドポイントを検証する
 *   - PATCH /users/me/status エンドポイントのバリデーション・更新・取得を検証する
 *   - 期限切れ自動クリアのロジック（GET 時のフィルタ）を検証する
 *   - 絵文字のみ・テキストのみ・両方空でのクリアの各ケースを網羅する
 */

import { getSharedTestDatabase, resetTestData } from './__fixtures__/pgTestHelper';

const testDb = getSharedTestDatabase();

jest.mock('../db/database', () => testDb);

import request from 'supertest';
import { createApp } from '../app';
import { registerUser } from './__fixtures__/testHelpers';

const app = createApp();

describe('カスタムステータス機能', () => {
  let userId: number;
  let authToken: string;

  beforeEach(async () => {
    await resetTestData(testDb);
    const result = await registerUser(app, 'statususer', 'status@example.com');
    userId = result.userId;
    authToken = result.token;
  });

  describe('PATCH /users/me/status', () => {
    describe('ステータス設定', () => {
      it('絵文字とテキストと期限を設定できる', async () => {
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        const res = await request(app)
          .patch('/api/auth/me/status')
          .set('Cookie', `token=${authToken}`)
          .send({ emoji: '🎉', text: '会議中', expiresAt });

        expect(res.status).toBe(200);
        expect(res.body.user.status).toEqual({
          emoji: '🎉',
          text: '会議中',
          expiresAt: expect.any(String),
        });
      });

      it('絵文字のみでステータスを設定できる（テキストは省略可）', async () => {
        const res = await request(app)
          .patch('/api/auth/me/status')
          .set('Cookie', `token=${authToken}`)
          .send({ emoji: '🚀', text: null, expiresAt: null });

        expect(res.status).toBe(200);
        expect(res.body.user.status).toMatchObject({ emoji: '🚀', text: null });
      });

      it('テキストのみでステータスを設定できる（絵文字は省略可）', async () => {
        const res = await request(app)
          .patch('/api/auth/me/status')
          .set('Cookie', `token=${authToken}`)
          .send({ emoji: null, text: '集中モード', expiresAt: null });

        expect(res.status).toBe(200);
        expect(res.body.user.status).toMatchObject({ emoji: null, text: '集中モード' });
      });

      it('絵文字とテキストが両方空ならステータスをクリアできる', async () => {
        // まずステータスを設定
        await request(app)
          .patch('/api/auth/me/status')
          .set('Cookie', `token=${authToken}`)
          .send({ emoji: '🎉', text: '設定中', expiresAt: null });

        // クリア
        const res = await request(app)
          .patch('/api/auth/me/status')
          .set('Cookie', `token=${authToken}`)
          .send({ emoji: null, text: null, expiresAt: null });

        expect(res.status).toBe(200);
        expect(res.body.user.status).toBeNull();
      });

      it('expires_at に過去日時を指定するとバリデーションエラーになる', async () => {
        const pastDate = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const res = await request(app)
          .patch('/api/auth/me/status')
          .set('Cookie', `token=${authToken}`)
          .send({ emoji: '🎉', text: 'test', expiresAt: pastDate });

        expect(res.status).toBe(400);
      });

      it('認証なしでアクセスすると 401 が返る', async () => {
        const res = await request(app)
          .patch('/api/auth/me/status')
          .send({ emoji: '🎉', text: 'test', expiresAt: null });

        expect(res.status).toBe(401);
      });
    });

    describe('有効期限プリセット', () => {
      it('expires_at に未来日時（1時間後）を指定してステータスを設定できる', async () => {
        const oneHourLater = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        const res = await request(app)
          .patch('/api/auth/me/status')
          .set('Cookie', `token=${authToken}`)
          .send({ emoji: '⏰', text: '1時間後まで', expiresAt: oneHourLater });

        expect(res.status).toBe(200);
        expect(res.body.user.status.emoji).toBe('⏰');
      });

      it('expires_at を null にするとステータスが無期限になる', async () => {
        const res = await request(app)
          .patch('/api/auth/me/status')
          .set('Cookie', `token=${authToken}`)
          .send({ emoji: '♾️', text: '無期限', expiresAt: null });

        expect(res.status).toBe(200);
        expect(res.body.user.status.expiresAt).toBeNull();
      });
    });
  });

  describe('GET /api/auth/me（ステータス情報の返却）', () => {
    describe('期限切れフィルタ', () => {
      it('expires_at が現在時刻より未来ならステータスが返る', async () => {
        const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        await request(app)
          .patch('/api/auth/me/status')
          .set('Cookie', `token=${authToken}`)
          .send({ emoji: '🔥', text: '有効', expiresAt: future });

        const res = await request(app).get('/api/auth/me').set('Cookie', `token=${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.user.status).not.toBeNull();
        expect(res.body.user.status.emoji).toBe('🔥');
      });

      it('expires_at が現在時刻より過去なら status が null として返る', async () => {
        // DB に直接過去日時を書き込む
        await testDb.execute(
          'UPDATE users SET status_emoji = $1, status_text = $2, status_expires_at = $3 WHERE id = $4',
          ['⌛', '期限切れ', new Date(Date.now() - 60 * 60 * 1000).toISOString(), userId],
        );

        const res = await request(app).get('/api/auth/me').set('Cookie', `token=${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.user.status).toBeNull();
      });

      it('expires_at が null（無期限）のステータスは常に返る', async () => {
        await request(app)
          .patch('/api/auth/me/status')
          .set('Cookie', `token=${authToken}`)
          .send({ emoji: '♾️', text: '無期限', expiresAt: null });

        const res = await request(app).get('/api/auth/me').set('Cookie', `token=${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.user.status).not.toBeNull();
        expect(res.body.user.status.expiresAt).toBeNull();
      });
    });

    describe('ステータス情報の形式', () => {
      it('status フィールドに emoji / text / expiresAt が含まれる', async () => {
        const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        await request(app)
          .patch('/api/auth/me/status')
          .set('Cookie', `token=${authToken}`)
          .send({ emoji: '🎯', text: 'フォーマット確認', expiresAt: future });

        const res = await request(app).get('/api/auth/me').set('Cookie', `token=${authToken}`);

        expect(res.status).toBe(200);
        const status = res.body.user.status;
        expect(status).toHaveProperty('emoji');
        expect(status).toHaveProperty('text');
        expect(status).toHaveProperty('expiresAt');
      });

      it('ステータス未設定のユーザーは status が null として返る', async () => {
        const res = await request(app).get('/api/auth/me').set('Cookie', `token=${authToken}`);

        expect(res.status).toBe(200);
        // 新規登録ユーザーはステータス未設定
        expect(res.body.user.status).toBeNull();
      });
    });
  });

  describe('GET /api/auth/users（ユーザー一覧）', () => {
    it('ユーザー一覧にも各ユーザーのステータスが含まれる', async () => {
      await request(app)
        .patch('/api/auth/me/status')
        .set('Cookie', `token=${authToken}`)
        .send({ emoji: '🌟', text: 'アクティブ', expiresAt: null });

      const res = await request(app).get('/api/auth/users').set('Cookie', `token=${authToken}`);

      expect(res.status).toBe(200);
      const me = (res.body.users as { id: number; status?: { emoji: string } | null }[]).find(
        (u) => u.id === userId,
      );
      expect(me).toBeDefined();
      expect(me!.status).not.toBeNull();
      expect(me!.status!.emoji).toBe('🌟');
    });

    it('期限切れのステータスは null として返る', async () => {
      // DB に直接過去日時を書き込む
      await testDb.execute(
        'UPDATE users SET status_emoji = $1, status_text = $2, status_expires_at = $3 WHERE id = $4',
        ['⌛', '期限切れ', new Date(Date.now() - 60 * 60 * 1000).toISOString(), userId],
      );

      const res = await request(app).get('/api/auth/users').set('Cookie', `token=${authToken}`);

      expect(res.status).toBe(200);
      const me = (res.body.users as { id: number; status?: null }[]).find((u) => u.id === userId);
      expect(me!.status).toBeNull();
    });
  });
});
