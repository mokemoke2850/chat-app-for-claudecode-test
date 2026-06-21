/**
 * テスト対象: routes/pins.ts のピン留めカテゴリHTTP API
 * 戦略: supertest と pg-mem を使い、認証、入力、ステータス、レスポンス契約、
 * 失敗時の非更新をHTTPレベルで検証する。
 */

import { createTestDatabase, resetTestData } from '../__fixtures__/pgTestHelper';

const testDb = createTestDatabase();
jest.mock('../../db/database', () => testDb);

import request from 'supertest';
import { createApp } from '../../app';
import { createChannelReq, insertMessage, registerUser } from '../__fixtures__/testHelpers';

const app = createApp();

async function setup(suffix: string) {
  await resetTestData(testDb);
  const { token, userId } = await registerUser(app, `pin_${suffix}`, `pin_${suffix}@example.com`);
  const channelId = await createChannelReq(app, token, `pin-${suffix}`);
  const messageId = await insertMessage(channelId, userId, 'pin message');
  return { token, userId, channelId, messageId };
}

async function firstCategory(token: string, channelId: number) {
  const response = await request(app)
    .get(`/api/channels/${channelId}/pins/categories`)
    .set('Cookie', `token=${token}`);
  return response.body.categories[0] as { id: number; name: string };
}

describe('ピン留めカテゴリ REST API', () => {
  describe('GET /api/channels/:channelId/pins/categories', () => {
    it('認証済みユーザーへ200でデフォルトと任意カテゴリの一覧を返す', async () => {
      const { token, channelId } = await setup('list');
      await request(app)
        .post(`/api/channels/${channelId}/pins/categories`)
        .set('Cookie', `token=${token}`)
        .send({ name: '任意' });
      const response = await request(app)
        .get(`/api/channels/${channelId}/pins/categories`)
        .set('Cookie', `token=${token}`);
      expect(response.status).toBe(200);
      expect(response.body.categories.map((category: { name: string }) => category.name)).toEqual([
        '決定事項',
        'リンク',
        'FAQ',
        '任意',
      ]);
    });

    it('未認証では401を返す', async () => {
      const { channelId } = await setup('list_auth');
      expect((await request(app).get(`/api/channels/${channelId}/pins/categories`)).status).toBe(
        401,
      );
    });

    it('不正なチャンネルIDでは400を返す', async () => {
      const { token } = await setup('list_bad');
      const response = await request(app)
        .get('/api/channels/invalid/pins/categories')
        .set('Cookie', `token=${token}`);
      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/channels/:channelId/pins/categories', () => {
    it('カテゴリ名を送ると201で作成したカテゴリを返す', async () => {
      const { token, channelId } = await setup('create');
      const response = await request(app)
        .post(`/api/channels/${channelId}/pins/categories`)
        .set('Cookie', `token=${token}`)
        .send({ name: '重要' });
      expect(response.status).toBe(201);
      expect(response.body.category).toMatchObject({ name: '重要', channelId });
    });

    it('未認証では401を返す', async () => {
      const { channelId } = await setup('create_auth');
      const response = await request(app)
        .post(`/api/channels/${channelId}/pins/categories`)
        .send({ name: '重要' });
      expect(response.status).toBe(401);
    });

    it('存在しないチャンネルでは404を返す', async () => {
      const { token } = await setup('create_missing');
      const response = await request(app)
        .post('/api/channels/99999/pins/categories')
        .set('Cookie', `token=${token}`)
        .send({ name: '重要' });
      expect(response.status).toBe(404);
    });

    it('空白だけのカテゴリ名では400を返しDBを変更しない', async () => {
      const { token, channelId } = await setup('create_blank');
      const response = await request(app)
        .post(`/api/channels/${channelId}/pins/categories`)
        .set('Cookie', `token=${token}`)
        .send({ name: '  ' });
      expect(response.status).toBe(400);
      expect(
        await testDb.query('SELECT * FROM pin_categories WHERE channel_id = $1', [channelId]),
      ).toEqual([]);
    });

    it('同名カテゴリでは409を返しDBを変更しない', async () => {
      const { token, channelId } = await setup('create_duplicate');
      const url = `/api/channels/${channelId}/pins/categories`;
      await request(app).post(url).set('Cookie', `token=${token}`).send({ name: '重要' });
      const response = await request(app)
        .post(url)
        .set('Cookie', `token=${token}`)
        .send({ name: '重要' });
      expect(response.status).toBe(409);
      const rows = await testDb.query(
        'SELECT * FROM pin_categories WHERE channel_id = $1 AND name = $2',
        [channelId, '重要'],
      );
      expect(rows).toHaveLength(1);
    });
  });

  describe('POST /api/channels/:channelId/pins/:messageId', () => {
    it('categoryId付きのリクエストは201でカテゴリ付きピンを返す', async () => {
      const { token, channelId, messageId } = await setup('pin_category');
      const category = await firstCategory(token, channelId);
      const response = await request(app)
        .post(`/api/channels/${channelId}/pins/${messageId}`)
        .set('Cookie', `token=${token}`)
        .send({ categoryId: category.id });
      expect(response.status).toBe(201);
      expect(response.body.pinnedMessage.categoryId).toBe(category.id);
    });

    it('categoryId省略の従来リクエストは201でcategoryId nullのピンを返す', async () => {
      const { token, channelId, messageId } = await setup('pin_legacy');
      const response = await request(app)
        .post(`/api/channels/${channelId}/pins/${messageId}`)
        .set('Cookie', `token=${token}`);
      expect(response.status).toBe(201);
      expect(response.body.pinnedMessage.categoryId).toBeNull();
    });

    it('未認証では401を返す', async () => {
      const { channelId, messageId } = await setup('pin_auth');
      expect((await request(app).post(`/api/channels/${channelId}/pins/${messageId}`)).status).toBe(
        401,
      );
    });

    it('不正型のcategoryIdでは400を返しピンを作成しない', async () => {
      const { token, channelId, messageId } = await setup('pin_bad');
      const response = await request(app)
        .post(`/api/channels/${channelId}/pins/${messageId}`)
        .set('Cookie', `token=${token}`)
        .send({ categoryId: 'bad' });
      expect(response.status).toBe(400);
      expect(await testDb.query('SELECT * FROM pinned_messages', [])).toEqual([]);
    });

    it('別チャンネルのカテゴリでは400を返しピンを作成しない', async () => {
      const { token, channelId, messageId } = await setup('pin_other');
      const otherChannelId = await createChannelReq(app, token, 'pin-other-category');
      const category = await firstCategory(token, otherChannelId);
      const response = await request(app)
        .post(`/api/channels/${channelId}/pins/${messageId}`)
        .set('Cookie', `token=${token}`)
        .send({ categoryId: category.id });
      expect(response.status).toBe(400);
      expect(await testDb.query('SELECT * FROM pinned_messages', [])).toEqual([]);
    });
  });

  describe('PATCH /api/channels/:channelId/pins/:messageId/category', () => {
    async function setupPinned(suffix: string) {
      const data = await setup(suffix);
      const category = await firstCategory(data.token, data.channelId);
      await request(app)
        .post(`/api/channels/${data.channelId}/pins/${data.messageId}`)
        .set('Cookie', `token=${data.token}`)
        .send({ categoryId: category.id });
      return { ...data, category };
    }

    it('categoryIdを送ると200で変更後のピンを返す', async () => {
      const data = await setupPinned('update');
      const created = await request(app)
        .post(`/api/channels/${data.channelId}/pins/categories`)
        .set('Cookie', `token=${data.token}`)
        .send({ name: '変更先' });
      const response = await request(app)
        .patch(`/api/channels/${data.channelId}/pins/${data.messageId}/category`)
        .set('Cookie', `token=${data.token}`)
        .send({ categoryId: created.body.category.id });
      expect(response.status).toBe(200);
      expect(response.body.pinnedMessage.category.name).toBe('変更先');
    });

    it('categoryId nullを送ると200で未分類のピンを返す', async () => {
      const data = await setupPinned('update_null');
      const response = await request(app)
        .patch(`/api/channels/${data.channelId}/pins/${data.messageId}/category`)
        .set('Cookie', `token=${data.token}`)
        .send({ categoryId: null });
      expect(response.status).toBe(200);
      expect(response.body.pinnedMessage.categoryId).toBeNull();
    });

    it('未認証では401を返す', async () => {
      const data = await setupPinned('update_auth');
      const response = await request(app)
        .patch(`/api/channels/${data.channelId}/pins/${data.messageId}/category`)
        .send({ categoryId: null });
      expect(response.status).toBe(401);
    });

    it('不正なメッセージIDでは400を返す', async () => {
      const data = await setupPinned('update_bad_id');
      const response = await request(app)
        .patch(`/api/channels/${data.channelId}/pins/invalid/category`)
        .set('Cookie', `token=${data.token}`)
        .send({ categoryId: null });
      expect(response.status).toBe(400);
    });

    it('不正型または欠落したcategoryIdでは400を返し元カテゴリを維持する', async () => {
      const data = await setupPinned('update_bad_category');
      const url = `/api/channels/${data.channelId}/pins/${data.messageId}/category`;
      expect(
        (
          await request(app)
            .patch(url)
            .set('Cookie', `token=${data.token}`)
            .send({ categoryId: 'bad' })
        ).status,
      ).toBe(400);
      expect(
        (await request(app).patch(url).set('Cookie', `token=${data.token}`).send({})).status,
      ).toBe(400);
      const [row] = await testDb.query<{ category_id: number }>(
        'SELECT category_id FROM pinned_messages WHERE message_id = $1',
        [data.messageId],
      );
      expect(row.category_id).toBe(data.category.id);
    });

    it('存在しないカテゴリでは404を返し元カテゴリを維持する', async () => {
      const data = await setupPinned('update_missing_category');
      const response = await request(app)
        .patch(`/api/channels/${data.channelId}/pins/${data.messageId}/category`)
        .set('Cookie', `token=${data.token}`)
        .send({ categoryId: 99999 });
      expect(response.status).toBe(404);
      const [row] = await testDb.query<{ category_id: number }>(
        'SELECT category_id FROM pinned_messages WHERE message_id = $1',
        [data.messageId],
      );
      expect(row.category_id).toBe(data.category.id);
    });

    it('別チャンネルのカテゴリでは400を返し元カテゴリを維持する', async () => {
      const data = await setupPinned('update_other');
      const otherChannelId = await createChannelReq(app, data.token, 'update-other');
      const category = await firstCategory(data.token, otherChannelId);
      const response = await request(app)
        .patch(`/api/channels/${data.channelId}/pins/${data.messageId}/category`)
        .set('Cookie', `token=${data.token}`)
        .send({ categoryId: category.id });
      expect(response.status).toBe(400);
      const [row] = await testDb.query<{ category_id: number }>(
        'SELECT category_id FROM pinned_messages WHERE message_id = $1',
        [data.messageId],
      );
      expect(row.category_id).toBe(data.category.id);
    });

    it('存在しないピンでは404を返す', async () => {
      const { token, channelId, messageId } = await setup('update_missing_pin');
      const response = await request(app)
        .patch(`/api/channels/${channelId}/pins/${messageId}/category`)
        .set('Cookie', `token=${token}`)
        .send({ categoryId: null });
      expect(response.status).toBe(404);
    });
  });

  describe('プライベートチャンネルのアクセス制御', () => {
    it('非メンバーはカテゴリ・ピンの取得、作成、変更、解除をすべて403にする', async () => {
      await resetTestData(testDb);
      const owner = await registerUser(app, 'pin_private_owner', 'pin_private_owner@example.com');
      const outsider = await registerUser(
        app,
        'pin_private_outsider',
        'pin_private_outsider@example.com',
      );
      const createResponse = await request(app)
        .post('/api/channels')
        .set('Cookie', `token=${owner.token}`)
        .send({ name: 'pin-private', is_private: true });
      const channelId = createResponse.body.channel.id as number;
      const messageId = await insertMessage(channelId, owner.userId, 'private pin');
      const category = await firstCategory(owner.token, channelId);
      await request(app)
        .post(`/api/channels/${channelId}/pins/${messageId}`)
        .set('Cookie', `token=${owner.token}`)
        .send({ categoryId: category.id });

      const cookie = `token=${outsider.token}`;
      const responses = await Promise.all([
        request(app).get(`/api/channels/${channelId}/pins`).set('Cookie', cookie),
        request(app).get(`/api/channels/${channelId}/pins/categories`).set('Cookie', cookie),
        request(app)
          .post(`/api/channels/${channelId}/pins/categories`)
          .set('Cookie', cookie)
          .send({ name: '侵入' }),
        request(app)
          .post(`/api/channels/${channelId}/pins/${messageId}`)
          .set('Cookie', cookie)
          .send({ categoryId: null }),
        request(app)
          .patch(`/api/channels/${channelId}/pins/${messageId}/category`)
          .set('Cookie', cookie)
          .send({ categoryId: null }),
        request(app).delete(`/api/channels/${channelId}/pins/${messageId}`).set('Cookie', cookie),
      ]);

      expect(responses.map((response) => response.status)).toEqual([403, 403, 403, 403, 403, 403]);
      expect(
        await testDb.query('SELECT * FROM pin_categories WHERE channel_id = $1 AND name = $2', [
          channelId,
          '侵入',
        ]),
      ).toEqual([]);
      expect(
        await testDb.query<{ category_id: number }>(
          'SELECT category_id FROM pinned_messages WHERE message_id = $1',
          [messageId],
        ),
      ).toEqual([expect.objectContaining({ category_id: category.id })]);
    });
  });
});
