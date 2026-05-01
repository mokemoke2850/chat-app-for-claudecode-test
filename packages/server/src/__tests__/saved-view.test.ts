/**
 * テスト対象: 保存ビュー機能 - サーバーサイド
 *
 * 【仕様概要】
 * ユーザーが検索条件（キーワード・期間・投稿者・チャンネル・タグ）に名前を付けて保存できる機能。
 * 保存ビューは個人専用（user_id で隔離）、件数上限なし。
 * 並べ替えは position フィールドで管理し、上下ボタンで操作する。
 *
 * 【テーブル: saved_views】
 *   id serial pk, user_id fk users, name text, query jsonb, position integer,
 *   created_at, updated_at
 *   一意制約: (user_id, name)
 *
 * 戦略:
 *   - createTestDatabase() + resetTestData() でインメモリDB共有
 *   - savedViewService 関数を直接呼び出すユニットテスト
 *   - HTTP エンドポイントを supertest で検証する統合テスト
 */

import { createTestDatabase, resetTestData } from './__fixtures__/pgTestHelper';

const testDb = createTestDatabase();

jest.mock('../db/database', () => testDb);

import request from 'supertest';
import { createApp } from '../app';
import { registerAndGetCookie } from './__fixtures__/testHelpers';
import * as savedViewService from '../services/savedViewService';

const app = createApp();

// ────────────────────────────────────────────────────────────────────────────
// フィクスチャセットアップ
// ────────────────────────────────────────────────────────────────────────────

let userId1: number;
let userId2: number;

async function setupFixtures() {
  const r1 = await testDb.execute(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
    ['svuser1', 'sv1@t.com', 'h'],
  );
  userId1 = r1.rows[0].id as number;

  const r2 = await testDb.execute(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
    ['svuser2', 'sv2@t.com', 'h'],
  );
  userId2 = r2.rows[0].id as number;
}

beforeEach(async () => {
  await resetTestData(testDb);
  await setupFixtures();
});

// ────────────────────────────────────────────────────────────────────────────
// サービス層ユニットテスト
// ────────────────────────────────────────────────────────────────────────────

describe('savedViewService', () => {
  describe('保存ビュー作成', () => {
    it('名前と query を指定して保存ビューを作成できる', async () => {
      const query = { keyword: 'test', tagIds: [1, 2] };
      const view = await savedViewService.createSavedView(userId1, '今週のバグ', query);

      expect(view.id).toBeDefined();
      expect(view.userId).toBe(userId1);
      expect(view.name).toBe('今週のバグ');
      expect(view.query).toEqual(query);
    });

    it('作成された保存ビューの position はデフォルト 0 になる', async () => {
      const view = await savedViewService.createSavedView(userId1, 'テスト', {});
      expect(view.position).toBe(0);
    });

    it('同一ユーザーで同じ名前を再度作成すると一意制約エラーになる', async () => {
      await savedViewService.createSavedView(userId1, '重複テスト', {});
      await expect(savedViewService.createSavedView(userId1, '重複テスト', {})).rejects.toThrow();
    });

    it('異なるユーザーが同じ名前で作成しても一意制約エラーにならない', async () => {
      await savedViewService.createSavedView(userId1, '同名ビュー', {});
      const view2 = await savedViewService.createSavedView(userId2, '同名ビュー', {});
      expect(view2.userId).toBe(userId2);
      expect(view2.name).toBe('同名ビュー');
    });

    it('query の中身は jsonb としてそのまま保存される（キーワード・期間・userId・tagIds を含む）', async () => {
      const query = {
        keyword: 'hello',
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
        userId: 42,
        tagIds: [10, 20],
        hasAttachment: true,
      };
      const view = await savedViewService.createSavedView(userId1, 'フルクエリ', query);
      expect(view.query).toEqual(query);
    });
  });

  describe('保存ビュー取得', () => {
    it('ユーザーの保存ビュー一覧を position 昇順で取得できる', async () => {
      await testDb.execute(
        'INSERT INTO saved_views (user_id, name, query, position) VALUES ($1, $2, $3, $4)',
        [userId1, 'ビューC', '{}', 2],
      );
      await testDb.execute(
        'INSERT INTO saved_views (user_id, name, query, position) VALUES ($1, $2, $3, $4)',
        [userId1, 'ビューA', '{}', 0],
      );
      await testDb.execute(
        'INSERT INTO saved_views (user_id, name, query, position) VALUES ($1, $2, $3, $4)',
        [userId1, 'ビューB', '{}', 1],
      );

      const views = await savedViewService.getSavedViews(userId1);
      expect(views).toHaveLength(3);
      expect(views[0].name).toBe('ビューA');
      expect(views[1].name).toBe('ビューB');
      expect(views[2].name).toBe('ビューC');
    });

    it('他ユーザーの保存ビューは取得されない', async () => {
      await savedViewService.createSavedView(userId1, 'user1のビュー', {});
      await savedViewService.createSavedView(userId2, 'user2のビュー', {});

      const views1 = await savedViewService.getSavedViews(userId1);
      expect(views1.every((v) => v.userId === userId1)).toBe(true);
    });

    it('保存ビューが 0 件のとき空配列を返す', async () => {
      const views = await savedViewService.getSavedViews(userId1);
      expect(views).toEqual([]);
    });
  });

  describe('保存ビュー更新', () => {
    it('名前を変更できる', async () => {
      const created = await savedViewService.createSavedView(userId1, '旧名前', {});
      const updated = await savedViewService.updateSavedView(userId1, created.id, {
        name: '新名前',
      });
      expect(updated.name).toBe('新名前');
    });

    it('query を変更できる', async () => {
      const created = await savedViewService.createSavedView(userId1, 'クエリ更新テスト', {
        keyword: 'old',
      });
      const newQuery = { keyword: 'new', tagIds: [5] };
      const updated = await savedViewService.updateSavedView(userId1, created.id, {
        query: newQuery,
      });
      expect(updated.query).toEqual(newQuery);
    });

    it('他ユーザーの保存ビューを更新しようとするとエラーになる', async () => {
      const created = await savedViewService.createSavedView(userId1, '他人のビュー', {});
      await expect(
        savedViewService.updateSavedView(userId2, created.id, { name: '書き換え' }),
      ).rejects.toThrow();
    });

    it('存在しない id を更新しようとするとエラーになる', async () => {
      await expect(
        savedViewService.updateSavedView(userId1, 99999, { name: '存在しない' }),
      ).rejects.toThrow();
    });

    it('変更後の名前が同一ユーザーの既存保存ビュー名と重複する場合はエラーになる', async () => {
      await savedViewService.createSavedView(userId1, 'ビュー1', {});
      const view2 = await savedViewService.createSavedView(userId1, 'ビュー2', {});
      await expect(
        savedViewService.updateSavedView(userId1, view2.id, { name: 'ビュー1' }),
      ).rejects.toThrow();
    });
  });

  describe('保存ビュー削除', () => {
    it('自分の保存ビューを削除できる', async () => {
      const created = await savedViewService.createSavedView(userId1, '削除対象', {});
      await savedViewService.deleteSavedView(userId1, created.id);
      const views = await savedViewService.getSavedViews(userId1);
      expect(views.find((v) => v.id === created.id)).toBeUndefined();
    });

    it('他ユーザーの保存ビューを削除しようとするとエラーになる', async () => {
      const created = await savedViewService.createSavedView(userId1, '他人のビュー', {});
      await expect(savedViewService.deleteSavedView(userId2, created.id)).rejects.toThrow();
    });

    it('存在しない id を削除しようとするとエラーになる', async () => {
      await expect(savedViewService.deleteSavedView(userId1, 99999)).rejects.toThrow();
    });
  });

  describe('並べ替え', () => {
    it('保存ビューの順序を id 配列で指定して並べ替えできる', async () => {
      const v1 = await savedViewService.createSavedView(userId1, 'ビュー1', {});
      const v2 = await savedViewService.createSavedView(userId1, 'ビュー2', {});
      const v3 = await savedViewService.createSavedView(userId1, 'ビュー3', {});

      await savedViewService.reorderSavedViews(userId1, [v3.id, v2.id, v1.id]);

      const views = await savedViewService.getSavedViews(userId1);
      expect(views[0].id).toBe(v3.id);
      expect(views[1].id).toBe(v2.id);
      expect(views[2].id).toBe(v1.id);
    });

    it('自分の保存ビューのみ並べ替えでき、他ユーザーの id が含まれてもエラーになる', async () => {
      const v1 = await savedViewService.createSavedView(userId1, 'ビュー1', {});
      const v2other = await savedViewService.createSavedView(userId2, '他人のビュー', {});
      await expect(
        savedViewService.reorderSavedViews(userId1, [v1.id, v2other.id]),
      ).rejects.toThrow();
    });

    it('並べ替え後に取得すると新しい position 順で返る', async () => {
      const v1 = await savedViewService.createSavedView(userId1, 'ビュー1', {});
      const v2 = await savedViewService.createSavedView(userId1, 'ビュー2', {});

      await savedViewService.reorderSavedViews(userId1, [v2.id, v1.id]);

      const views = await savedViewService.getSavedViews(userId1);
      expect(views[0].name).toBe('ビュー2');
      expect(views[0].position).toBe(0);
      expect(views[1].name).toBe('ビュー1');
      expect(views[1].position).toBe(1);
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// HTTP 統合テスト
// ────────────────────────────────────────────────────────────────────────────

describe('保存ビュー APIエンドポイント', () => {
  describe('GET /saved-views', () => {
    it('認証済みユーザーが自分の保存ビュー一覧を取得できる (200)', async () => {
      const { cookie } = await registerAndGetCookie(app, 'svapi1', 'svapi1@t.com', 'password123');

      await request(app)
        .post('/api/saved-views')
        .set('Cookie', cookie)
        .send({ name: 'テストビュー', query: { keyword: 'hello' } });

      const res = await request(app).get('/api/saved-views').set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.savedViews).toHaveLength(1);
      expect(res.body.savedViews[0].name).toBe('テストビュー');
    });

    it('認証なしで 401 を返す', async () => {
      const res = await request(app).get('/api/saved-views');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /saved-views', () => {
    it('保存ビューを新規作成すると 201 と作成データが返る', async () => {
      const { cookie } = await registerAndGetCookie(app, 'svapi2', 'svapi2@t.com', 'password123');

      const res = await request(app)
        .post('/api/saved-views')
        .set('Cookie', cookie)
        .send({ name: '新規ビュー', query: { keyword: 'test' } });

      expect(res.status).toBe(201);
      expect(res.body.savedView).toBeDefined();
      expect(res.body.savedView.name).toBe('新規ビュー');
      expect(res.body.savedView.query).toEqual({ keyword: 'test' });
    });

    it('同名保存ビューを作成すると 409 を返す', async () => {
      const { cookie } = await registerAndGetCookie(app, 'svapi3', 'svapi3@t.com', 'password123');

      await request(app)
        .post('/api/saved-views')
        .set('Cookie', cookie)
        .send({ name: '重複ビュー', query: {} });

      const res = await request(app)
        .post('/api/saved-views')
        .set('Cookie', cookie)
        .send({ name: '重複ビュー', query: {} });

      expect(res.status).toBe(409);
    });

    it('name が空文字の場合は 400 を返す', async () => {
      const { cookie } = await registerAndGetCookie(app, 'svapi4', 'svapi4@t.com', 'password123');

      const res = await request(app)
        .post('/api/saved-views')
        .set('Cookie', cookie)
        .send({ name: '', query: {} });

      expect(res.status).toBe(400);
    });

    it('認証なしで 401 を返す', async () => {
      const res = await request(app).post('/api/saved-views').send({ name: 'ビュー', query: {} });
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /saved-views/:id', () => {
    it('保存ビューの名前・query を更新すると 200 と更新後データが返る', async () => {
      const { cookie } = await registerAndGetCookie(app, 'svapi5', 'svapi5@t.com', 'password123');

      const createRes = await request(app)
        .post('/api/saved-views')
        .set('Cookie', cookie)
        .send({ name: '旧名前', query: {} });
      const id = createRes.body.savedView.id as number;

      const res = await request(app)
        .put(`/api/saved-views/${id}`)
        .set('Cookie', cookie)
        .send({ name: '新名前', query: { keyword: 'updated' } });

      expect(res.status).toBe(200);
      expect(res.body.savedView.name).toBe('新名前');
      expect(res.body.savedView.query).toEqual({ keyword: 'updated' });
    });

    it('他ユーザーの保存ビューを更新しようとすると 403 を返す', async () => {
      const { cookie: cookie1 } = await registerAndGetCookie(
        app,
        'svapi6a',
        'svapi6a@t.com',
        'password123',
      );

      const createRes = await request(app)
        .post('/api/saved-views')
        .set('Cookie', cookie1)
        .send({ name: 'user1のビュー', query: {} });
      const id = createRes.body.savedView.id as number;

      const { cookie: cookie2 } = await registerAndGetCookie(
        app,
        'svapi6b',
        'svapi6b@t.com',
        'password123',
      );

      const res = await request(app)
        .put(`/api/saved-views/${id}`)
        .set('Cookie', cookie2)
        .send({ name: '書き換え' });

      expect(res.status).toBe(403);
    });

    it('存在しない id を更新しようとすると 404 を返す', async () => {
      const { cookie } = await registerAndGetCookie(app, 'svapi7', 'svapi7@t.com', 'password123');

      const res = await request(app)
        .put('/api/saved-views/99999')
        .set('Cookie', cookie)
        .send({ name: '存在しない' });

      expect(res.status).toBe(404);
    });

    it('認証なしで 401 を返す', async () => {
      const res = await request(app).put('/api/saved-views/1').send({ name: 'テスト' });
      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /saved-views/:id', () => {
    it('保存ビューを削除すると 204 を返す', async () => {
      const { cookie } = await registerAndGetCookie(app, 'svapi8', 'svapi8@t.com', 'password123');

      const createRes = await request(app)
        .post('/api/saved-views')
        .set('Cookie', cookie)
        .send({ name: '削除対象', query: {} });
      const id = createRes.body.savedView.id as number;

      const res = await request(app).delete(`/api/saved-views/${id}`).set('Cookie', cookie);

      expect(res.status).toBe(204);
    });

    it('他ユーザーの保存ビューを削除しようとすると 403 を返す', async () => {
      const { cookie: cookie1 } = await registerAndGetCookie(
        app,
        'svapi9a',
        'svapi9a@t.com',
        'password123',
      );

      const createRes = await request(app)
        .post('/api/saved-views')
        .set('Cookie', cookie1)
        .send({ name: 'user1のビュー', query: {} });
      const id = createRes.body.savedView.id as number;

      const { cookie: cookie2 } = await registerAndGetCookie(
        app,
        'svapi9b',
        'svapi9b@t.com',
        'password123',
      );

      const res = await request(app).delete(`/api/saved-views/${id}`).set('Cookie', cookie2);

      expect(res.status).toBe(403);
    });

    it('存在しない id を削除しようとすると 404 を返す', async () => {
      const { cookie } = await registerAndGetCookie(app, 'svapi10', 'svapi10@t.com', 'password123');

      const res = await request(app).delete('/api/saved-views/99999').set('Cookie', cookie);

      expect(res.status).toBe(404);
    });

    it('認証なしで 401 を返す', async () => {
      const res = await request(app).delete('/api/saved-views/1');
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /saved-views/order', () => {
    it('id 配列の順序で保存ビューを並べ替えると 200 を返す', async () => {
      const { cookie } = await registerAndGetCookie(app, 'svapi11', 'svapi11@t.com', 'password123');

      const r1 = await request(app)
        .post('/api/saved-views')
        .set('Cookie', cookie)
        .send({ name: 'ビュー1', query: {} });
      const r2 = await request(app)
        .post('/api/saved-views')
        .set('Cookie', cookie)
        .send({ name: 'ビュー2', query: {} });

      const id1 = r1.body.savedView.id as number;
      const id2 = r2.body.savedView.id as number;

      const res = await request(app)
        .put('/api/saved-views/order')
        .set('Cookie', cookie)
        .send({ ids: [id2, id1] });

      expect(res.status).toBe(200);
    });

    it('他ユーザーの id が含まれていると 403 を返す', async () => {
      const { cookie: cookie1 } = await registerAndGetCookie(
        app,
        'svapi12a',
        'svapi12a@t.com',
        'password123',
      );

      const r1 = await request(app)
        .post('/api/saved-views')
        .set('Cookie', cookie1)
        .send({ name: 'user1のビュー', query: {} });

      const { cookie: cookie2 } = await registerAndGetCookie(
        app,
        'svapi12b',
        'svapi12b@t.com',
        'password123',
      );

      const r2 = await request(app)
        .post('/api/saved-views')
        .set('Cookie', cookie2)
        .send({ name: 'user2のビュー', query: {} });

      const id1 = r1.body.savedView.id as number;
      const id2 = r2.body.savedView.id as number;

      const res = await request(app)
        .put('/api/saved-views/order')
        .set('Cookie', cookie1)
        .send({ ids: [id1, id2] });

      expect(res.status).toBe(403);
    });

    it('認証なしで 401 を返す', async () => {
      const res = await request(app)
        .put('/api/saved-views/order')
        .send({ ids: [1, 2] });
      expect(res.status).toBe(401);
    });
  });
});
