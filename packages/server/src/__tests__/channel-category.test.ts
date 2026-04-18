/**
 * テスト対象: チャンネルカテゴリ（セクション）機能 - サーバーサイド
 *
 * 【仕様判断】
 * カテゴリは「ユーザー個人のサイドバー構成」として実装する（Slack方式）。
 * チャンネル自体はワークスペース共有のままで、カテゴリ分けは個人設定。
 * 他ユーザーのカテゴリ設定は一切参照されない。
 *
 * 【テーブル設計概要】
 * - channel_categories: id, user_id, name, position, is_collapsed, created_at, updated_at
 *   - user_id: カテゴリのオーナー（他ユーザーからは非表示）
 *   - position: 並び順（ユーザーが自由に変更可能）
 *   - is_collapsed: サイドバーでの折りたたみ状態
 * - channel_category_assignments: user_id, channel_id, category_id
 *   - user_id × channel_id がユニーク（1チャンネルは1カテゴリにのみ所属）
 *   - category_id が NULL の場合は「その他」扱い
 *
 * 戦略:
 *   - pg-mem のインメモリ PostgreSQL 互換 DB を使用
 *   - サービス層を直接テスト（unit系）と supertest で HTTP層をテスト（integration系）
 */

import { getSharedTestDatabase, resetTestData } from './__fixtures__/pgTestHelper';

const testDb = getSharedTestDatabase();

jest.mock('../db/database', () => testDb);

import request from 'supertest';
import { createApp } from '../app';
import { registerUser } from './__fixtures__/testHelpers';
import {
  createCategory,
  getCategoriesForUser,
  updateCategory,
  deleteCategory,
  reorderCategories,
  assignChannelToCategory,
  unassignChannelFromCategory,
  getChannelsWithCategory,
} from '../services/categoryService';

const app = createApp();

// ────────────────────────────────────────────────────────────────────────────
// テストフィクスチャセットアップ
// ────────────────────────────────────────────────────────────────────────────

let userId1: number;
let userId2: number;
let channelId: number;
let channelId2: number;

async function setupFixtures() {
  const r1 = await testDb.execute(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
    ['catuser1', 'cat1@t.com', 'h'],
  );
  userId1 = r1.rows[0].id as number;

  const r2 = await testDb.execute(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
    ['catuser2', 'cat2@t.com', 'h'],
  );
  userId2 = r2.rows[0].id as number;

  const rc1 = await testDb.execute(
    'INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id',
    ['cat-test-channel', userId1],
  );
  channelId = rc1.rows[0].id as number;

  const rc2 = await testDb.execute(
    'INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id',
    ['cat-test-channel2', userId1],
  );
  channelId2 = rc2.rows[0].id as number;
}

// ────────────────────────────────────────────────────────────────────────────
// サービス層テスト（unit）
// ────────────────────────────────────────────────────────────────────────────

describe('カテゴリCRUD: サービス層', () => {
  beforeEach(async () => {
    await resetTestData(testDb);
    await setupFixtures();
  });

  describe('createCategory', () => {
    it('カテゴリを作成できる', async () => {
      const cat = await createCategory(userId1, 'work');
      expect(cat.id).toBeDefined();
      expect(cat.userId).toBe(userId1);
      expect(cat.name).toBe('work');
      expect(cat.isCollapsed).toBe(false);
    });

    it('同じユーザーで同名カテゴリを作成するとエラーになる', async () => {
      await createCategory(userId1, 'work');
      await expect(createCategory(userId1, 'work')).rejects.toThrow('Category name already exists');
    });

    it('別ユーザーでは同名カテゴリを作成できる', async () => {
      await createCategory(userId1, 'work');
      const cat2 = await createCategory(userId2, 'work');
      expect(cat2.userId).toBe(userId2);
    });

    it('name が空文字のカテゴリ作成はエラーになる', async () => {
      await expect(createCategory(userId1, '')).rejects.toThrow('Category name is required');
    });
  });

  describe('getCategoriesForUser', () => {
    it('ユーザーのカテゴリ一覧を position 昇順で返す', async () => {
      await createCategory(userId1, 'bbb', 2);
      await createCategory(userId1, 'aaa', 0);
      await createCategory(userId1, 'ccc', 1);
      const cats = await getCategoriesForUser(userId1);
      expect(cats.map((c) => c.name)).toEqual(['aaa', 'ccc', 'bbb']);
    });

    it('カテゴリが存在しない場合は空配列を返す', async () => {
      const cats = await getCategoriesForUser(userId1);
      expect(cats).toEqual([]);
    });

    it('他のユーザーのカテゴリは含まれない', async () => {
      await createCategory(userId1, 'user1-cat');
      await createCategory(userId2, 'user2-cat');
      const cats = await getCategoriesForUser(userId1);
      expect(cats.every((c) => c.userId === userId1)).toBe(true);
      expect(cats).toHaveLength(1);
    });
  });

  describe('updateCategory', () => {
    it('カテゴリ名を更新できる', async () => {
      const cat = await createCategory(userId1, 'old-name');
      const updated = await updateCategory(userId1, cat.id, { name: 'new-name' });
      expect(updated.name).toBe('new-name');
    });

    it('is_collapsed を更新できる', async () => {
      const cat = await createCategory(userId1, 'collapsible');
      const updated = await updateCategory(userId1, cat.id, { isCollapsed: true });
      expect(updated.isCollapsed).toBe(true);
    });

    it('position を更新できる', async () => {
      const cat = await createCategory(userId1, 'moveable');
      const updated = await updateCategory(userId1, cat.id, { position: 5 });
      expect(updated.position).toBe(5);
    });

    it('他のユーザーのカテゴリは更新できない', async () => {
      const cat = await createCategory(userId1, 'other-cat');
      await expect(updateCategory(userId2, cat.id, { name: 'hacked' })).rejects.toThrow('Forbidden');
    });

    it('存在しないカテゴリの更新はエラーになる', async () => {
      await expect(updateCategory(userId1, 99999, { name: 'x' })).rejects.toThrow('Category not found');
    });
  });

  describe('deleteCategory', () => {
    it('カテゴリを削除できる', async () => {
      const cat = await createCategory(userId1, 'to-delete');
      await deleteCategory(userId1, cat.id);
      const cats = await getCategoriesForUser(userId1);
      expect(cats).toHaveLength(0);
    });

    it('カテゴリを削除すると、そのカテゴリに割り当てられていたチャンネルの割当が解除される（チャンネル自体は削除されない）', async () => {
      const cat = await createCategory(userId1, 'with-channels');
      await assignChannelToCategory(userId1, channelId, cat.id);
      await deleteCategory(userId1, cat.id);

      // チャンネル自体は残っている
      const ch = await testDb.query<{ id: number }>('SELECT id FROM channels WHERE id = $1', [channelId]);
      expect(ch).toHaveLength(1);

      // 割当は解除されている
      const assignments = await testDb.query(
        'SELECT * FROM channel_category_assignments WHERE channel_id = $1 AND user_id = $2',
        [channelId, userId1],
      );
      expect(assignments).toHaveLength(0);
    });

    it('他のユーザーのカテゴリは削除できない', async () => {
      const cat = await createCategory(userId1, 'other-delete');
      await expect(deleteCategory(userId2, cat.id)).rejects.toThrow('Forbidden');
    });

    it('存在しないカテゴリの削除はエラーになる', async () => {
      await expect(deleteCategory(userId1, 99999)).rejects.toThrow('Category not found');
    });
  });

  describe('reorderCategories', () => {
    it('カテゴリの並び順（position）を一括更新できる', async () => {
      const cat1 = await createCategory(userId1, 'first', 0);
      const cat2 = await createCategory(userId1, 'second', 1);
      const cat3 = await createCategory(userId1, 'third', 2);

      // 逆順に並び替え
      await reorderCategories(userId1, [cat3.id, cat2.id, cat1.id]);

      const cats = await getCategoriesForUser(userId1);
      expect(cats[0].name).toBe('third');
      expect(cats[1].name).toBe('second');
      expect(cats[2].name).toBe('first');
    });

    it('リクエストに含まれないカテゴリが存在する場合はエラーになる', async () => {
      await createCategory(userId1, 'cat1', 0);
      const cat2 = await createCategory(userId1, 'cat2', 1);

      // cat1 を含めず cat2 だけ渡す
      await expect(reorderCategories(userId1, [cat2.id])).rejects.toThrow('Invalid category_ids');
    });

    it('他のユーザーのカテゴリIDが含まれる場合はエラーになる', async () => {
      const cat1 = await createCategory(userId1, 'mycat', 0);
      const otherCat = await createCategory(userId2, 'other', 0);

      await expect(reorderCategories(userId1, [cat1.id, otherCat.id])).rejects.toThrow('Invalid category_ids');
    });
  });
});

describe('チャンネル割当: サービス層', () => {
  beforeEach(async () => {
    await resetTestData(testDb);
    await setupFixtures();
  });

  describe('assignChannelToCategory', () => {
    it('チャンネルをカテゴリに割り当てられる', async () => {
      const cat = await createCategory(userId1, 'work');
      await assignChannelToCategory(userId1, channelId, cat.id);
      const cats = await getCategoriesForUser(userId1);
      expect(cats[0].channelIds).toContain(channelId);
    });

    it('既に別カテゴリに割り当て済みのチャンネルを別カテゴリに移動できる（上書き更新）', async () => {
      const cat1 = await createCategory(userId1, 'cat1');
      const cat2 = await createCategory(userId1, 'cat2');
      await assignChannelToCategory(userId1, channelId, cat1.id);
      await assignChannelToCategory(userId1, channelId, cat2.id);

      const cats = await getCategoriesForUser(userId1);
      const cat1Data = cats.find((c) => c.id === cat1.id);
      const cat2Data = cats.find((c) => c.id === cat2.id);
      expect(cat1Data?.channelIds).not.toContain(channelId);
      expect(cat2Data?.channelIds).toContain(channelId);
    });

    it('存在しないカテゴリへの割り当てはエラーになる', async () => {
      await expect(assignChannelToCategory(userId1, channelId, 99999)).rejects.toThrow('Category not found');
    });

    it('存在しないチャンネルへの割り当てはエラーになる', async () => {
      const cat = await createCategory(userId1, 'work');
      await expect(assignChannelToCategory(userId1, 99999, cat.id)).rejects.toThrow('Channel not found');
    });

    it('他のユーザーのカテゴリへの割り当てはエラーになる', async () => {
      const otherCat = await createCategory(userId2, 'other-cat');
      await expect(assignChannelToCategory(userId1, channelId, otherCat.id)).rejects.toThrow('Forbidden');
    });
  });

  describe('unassignChannelFromCategory', () => {
    it('チャンネルのカテゴリ割当を解除できる（「その他」に戻る）', async () => {
      const cat = await createCategory(userId1, 'work');
      await assignChannelToCategory(userId1, channelId, cat.id);
      await unassignChannelFromCategory(userId1, channelId);

      const withCat = await getChannelsWithCategory(userId1);
      const chData = withCat.find((c) => c.channelId === channelId);
      expect(chData?.categoryId).toBeNull();
    });

    it('割り当てが存在しないチャンネルの解除はエラーになる', async () => {
      await expect(unassignChannelFromCategory(userId1, channelId)).rejects.toThrow('Assignment not found');
    });
  });

  describe('getChannelsWithCategory', () => {
    it('ユーザーのチャンネル一覧をカテゴリ情報付きで返す', async () => {
      const cat = await createCategory(userId1, 'work');
      await assignChannelToCategory(userId1, channelId, cat.id);
      const result = await getChannelsWithCategory(userId1);
      expect(result.length).toBeGreaterThan(0);
      const ch = result.find((r) => r.channelId === channelId);
      expect(ch?.categoryId).toBe(cat.id);
    });

    it('カテゴリ未割当のチャンネルは categoryId が null で返される', async () => {
      const result = await getChannelsWithCategory(userId1);
      const ch = result.find((r) => r.channelId === channelId);
      expect(ch?.categoryId).toBeNull();
    });

    it('他のユーザーのカテゴリ割当は反映されない（ユーザーごとに独立）', async () => {
      const cat = await createCategory(userId2, 'user2-cat');
      await assignChannelToCategory(userId2, channelId, cat.id);

      const result = await getChannelsWithCategory(userId1);
      const ch = result.find((r) => r.channelId === channelId);
      expect(ch?.categoryId).toBeNull();
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// REST API 統合テスト
// ────────────────────────────────────────────────────────────────────────────

describe('REST API: GET /api/channel-categories', () => {
  beforeEach(async () => {
    await resetTestData(testDb);
    await setupFixtures();
  });

  it('200 でログインユーザーのカテゴリ一覧を返す', async () => {
    const { token } = await registerUser(app, 'apiuser1', 'api1@t.com');
    const res = await request(app)
      .get('/api/channel-categories')
      .set('Cookie', `token=${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('categories');
    expect(Array.isArray(res.body.categories)).toBe(true);
  });

  it('認証なしで 401 を返す', async () => {
    const res = await request(app).get('/api/channel-categories');
    expect(res.status).toBe(401);
  });
});

describe('REST API: POST /api/channel-categories', () => {
  beforeEach(async () => {
    await resetTestData(testDb);
    await setupFixtures();
  });

  it('カテゴリ作成成功で 201 を返す', async () => {
    const { token } = await registerUser(app, 'apiuser2', 'api2@t.com');
    const res = await request(app)
      .post('/api/channel-categories')
      .set('Cookie', `token=${token}`)
      .send({ name: 'new-category' });
    expect(res.status).toBe(201);
    expect(res.body.category.name).toBe('new-category');
  });

  it('name が未指定で 400 を返す', async () => {
    const { token } = await registerUser(app, 'apiuser3', 'api3@t.com');
    const res = await request(app)
      .post('/api/channel-categories')
      .set('Cookie', `token=${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('認証なしで 401 を返す', async () => {
    const res = await request(app)
      .post('/api/channel-categories')
      .send({ name: 'test' });
    expect(res.status).toBe(401);
  });

  it('同名カテゴリの重複作成で 409 を返す', async () => {
    const { token } = await registerUser(app, 'apiuser4', 'api4@t.com');
    await request(app)
      .post('/api/channel-categories')
      .set('Cookie', `token=${token}`)
      .send({ name: 'dup-cat' });
    const res = await request(app)
      .post('/api/channel-categories')
      .set('Cookie', `token=${token}`)
      .send({ name: 'dup-cat' });
    expect(res.status).toBe(409);
  });
});

describe('REST API: PATCH /api/channel-categories/:id', () => {
  let token: string;
  let token2: string;
  let catId: number;

  beforeEach(async () => {
    await resetTestData(testDb);
    await setupFixtures();
    const u1 = await registerUser(app, 'patchuser1', 'patch1@t.com');
    const u2 = await registerUser(app, 'patchuser2', 'patch2@t.com');
    token = u1.token;
    token2 = u2.token;
    const res = await request(app)
      .post('/api/channel-categories')
      .set('Cookie', `token=${token}`)
      .send({ name: 'patch-target' });
    catId = (res.body as { category: { id: number } }).category.id;
  });

  it('カテゴリ更新成功で 200 を返す', async () => {
    const res = await request(app)
      .patch(`/api/channel-categories/${catId}`)
      .set('Cookie', `token=${token}`)
      .send({ name: 'updated-name' });
    expect(res.status).toBe(200);
    expect(res.body.category.name).toBe('updated-name');
  });

  it('認証なしで 401 を返す', async () => {
    const res = await request(app)
      .patch(`/api/channel-categories/${catId}`)
      .send({ name: 'x' });
    expect(res.status).toBe(401);
  });

  it('他のユーザーのカテゴリ更新で 403 を返す', async () => {
    const res = await request(app)
      .patch(`/api/channel-categories/${catId}`)
      .set('Cookie', `token=${token2}`)
      .send({ name: 'hacked' });
    expect(res.status).toBe(403);
  });

  it('存在しないカテゴリの更新で 404 を返す', async () => {
    const res = await request(app)
      .patch('/api/channel-categories/99999')
      .set('Cookie', `token=${token}`)
      .send({ name: 'x' });
    expect(res.status).toBe(404);
  });
});

describe('REST API: DELETE /api/channel-categories/:id', () => {
  let token: string;
  let token2: string;
  let catId: number;

  beforeEach(async () => {
    await resetTestData(testDb);
    await setupFixtures();
    const u1 = await registerUser(app, 'deluser1', 'del1@t.com');
    const u2 = await registerUser(app, 'deluser2', 'del2@t.com');
    token = u1.token;
    token2 = u2.token;
    const res = await request(app)
      .post('/api/channel-categories')
      .set('Cookie', `token=${token}`)
      .send({ name: 'delete-target' });
    catId = (res.body as { category: { id: number } }).category.id;
  });

  it('カテゴリ削除成功で 204 を返す', async () => {
    const res = await request(app)
      .delete(`/api/channel-categories/${catId}`)
      .set('Cookie', `token=${token}`);
    expect(res.status).toBe(204);
  });

  it('認証なしで 401 を返す', async () => {
    const res = await request(app).delete(`/api/channel-categories/${catId}`);
    expect(res.status).toBe(401);
  });

  it('他のユーザーのカテゴリ削除で 403 を返す', async () => {
    const res = await request(app)
      .delete(`/api/channel-categories/${catId}`)
      .set('Cookie', `token=${token2}`);
    expect(res.status).toBe(403);
  });

  it('存在しないカテゴリの削除で 404 を返す', async () => {
    const res = await request(app)
      .delete('/api/channel-categories/99999')
      .set('Cookie', `token=${token}`);
    expect(res.status).toBe(404);
  });
});

describe('REST API: PATCH /api/channel-categories/reorder', () => {
  let token: string;
  let catIds: number[];

  beforeEach(async () => {
    await resetTestData(testDb);
    await setupFixtures();
    const u1 = await registerUser(app, 'reorderuser1', 'reorder1@t.com');
    token = u1.token;
    catIds = [];
    for (const name of ['cat-a', 'cat-b', 'cat-c']) {
      const res = await request(app)
        .post('/api/channel-categories')
        .set('Cookie', `token=${token}`)
        .send({ name });
      catIds.push((res.body as { category: { id: number } }).category.id);
    }
  });

  it('並び替え成功で 200 を返す', async () => {
    const reversed = [...catIds].reverse();
    const res = await request(app)
      .patch('/api/channel-categories/reorder')
      .set('Cookie', `token=${token}`)
      .send({ categoryIds: reversed });
    expect(res.status).toBe(200);
  });

  it('認証なしで 401 を返す', async () => {
    const res = await request(app)
      .patch('/api/channel-categories/reorder')
      .send({ categoryIds: catIds });
    expect(res.status).toBe(401);
  });

  it('不正なペイロード（category_ids 未指定）で 400 を返す', async () => {
    const res = await request(app)
      .patch('/api/channel-categories/reorder')
      .set('Cookie', `token=${token}`)
      .send({});
    expect(res.status).toBe(400);
  });
});

describe('REST API: POST /api/channels/:id/category', () => {
  let token: string;
  let token2: string;
  let catId: number;

  beforeEach(async () => {
    await resetTestData(testDb);
    await setupFixtures();
    const u1 = await registerUser(app, 'assignuser1', 'assign1@t.com');
    const u2 = await registerUser(app, 'assignuser2', 'assign2@t.com');
    token = u1.token;
    token2 = u2.token;
    const res = await request(app)
      .post('/api/channel-categories')
      .set('Cookie', `token=${token}`)
      .send({ name: 'assign-cat' });
    catId = (res.body as { category: { id: number } }).category.id;
  });

  it('チャンネルをカテゴリに割り当てて 200 を返す', async () => {
    const res = await request(app)
      .post(`/api/channels/${channelId}/category`)
      .set('Cookie', `token=${token}`)
      .send({ categoryId: catId });
    expect(res.status).toBe(200);
  });

  it('categoryId が null のとき割当を解除して 200 を返す', async () => {
    // まず割り当て
    await request(app)
      .post(`/api/channels/${channelId}/category`)
      .set('Cookie', `token=${token}`)
      .send({ categoryId: catId });
    // 解除
    const res = await request(app)
      .post(`/api/channels/${channelId}/category`)
      .set('Cookie', `token=${token}`)
      .send({ categoryId: null });
    expect(res.status).toBe(200);
  });

  it('認証なしで 401 を返す', async () => {
    const res = await request(app)
      .post(`/api/channels/${channelId}/category`)
      .send({ categoryId: catId });
    expect(res.status).toBe(401);
  });

  it('存在しないカテゴリへの割り当てで 404 を返す', async () => {
    const res = await request(app)
      .post(`/api/channels/${channelId}/category`)
      .set('Cookie', `token=${token}`)
      .send({ categoryId: 99999 });
    expect(res.status).toBe(404);
  });

  it('他のユーザーのカテゴリへの割り当てで 403 を返す', async () => {
    const res = await request(app)
      .post(`/api/channels/${channelId}/category`)
      .set('Cookie', `token=${token2}`)
      .send({ categoryId: catId });
    expect(res.status).toBe(403);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 境界条件テスト
// ────────────────────────────────────────────────────────────────────────────

describe('境界条件: カテゴリ削除時のチャンネルの扱い', () => {
  beforeEach(async () => {
    await resetTestData(testDb);
    await setupFixtures();
  });

  it('カテゴリを削除してもチャンネル自体は削除されない', async () => {
    const cat = await createCategory(userId1, 'temp');
    await assignChannelToCategory(userId1, channelId, cat.id);
    await deleteCategory(userId1, cat.id);

    const ch = await testDb.query<{ id: number }>(
      'SELECT id FROM channels WHERE id = $1',
      [channelId],
    );
    expect(ch).toHaveLength(1);
  });

  it('カテゴリを削除すると、割り当てチャンネルは「その他（未割当）」に移る', async () => {
    const cat = await createCategory(userId1, 'will-delete');
    await assignChannelToCategory(userId1, channelId, cat.id);
    await deleteCategory(userId1, cat.id);

    const withCat = await getChannelsWithCategory(userId1);
    const ch = withCat.find((c) => c.channelId === channelId);
    expect(ch?.categoryId).toBeNull();
  });
});

describe('境界条件: ユーザー分離', () => {
  beforeEach(async () => {
    await resetTestData(testDb);
    await setupFixtures();
  });

  it('ユーザーAのカテゴリはユーザーBのAPI応答に含まれない', async () => {
    await createCategory(userId1, 'user1-only');
    const user2Cats = await getCategoriesForUser(userId2);
    expect(user2Cats).toHaveLength(0);
  });

  it('ユーザーAのチャンネル割当はユーザーBには影響しない', async () => {
    const cat = await createCategory(userId1, 'user1-cat');
    await assignChannelToCategory(userId1, channelId, cat.id);

    const user2WithCat = await getChannelsWithCategory(userId2);
    const ch = user2WithCat.find((c) => c.channelId === channelId);
    expect(ch?.categoryId).toBeNull();
  });
});

describe('境界条件: 空カテゴリ', () => {
  beforeEach(async () => {
    await resetTestData(testDb);
    await setupFixtures();
  });

  it('チャンネルが0件のカテゴリも一覧に表示される', async () => {
    await createCategory(userId1, 'empty-cat');
    const cats = await getCategoriesForUser(userId1);
    expect(cats).toHaveLength(1);
    expect(cats[0].channelIds).toEqual([]);
  });
});
