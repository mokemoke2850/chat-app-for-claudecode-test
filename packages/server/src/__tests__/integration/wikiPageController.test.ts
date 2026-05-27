/**
 * wikiPageController のHTTPレベルテスト（#355）
 *
 * テスト対象: packages/server/src/routes/wikiPages.ts
 * 戦略:
 *   - supertest でHTTPリクエストを発行し、レスポンスのステータスコードと
 *     レスポンスボディを検証する
 *   - DB は pg-mem のインメモリ PostgreSQL 互換 DB を使用
 *   - 認証・認可・楽観ロックの 401/403/409 を中心に検証する
 */

import { createTestDatabase } from '../__fixtures__/pgTestHelper';

const testDb = createTestDatabase();

jest.mock('../../db/database', () => testDb);

import request from 'supertest';
import { createApp } from '../../app';
import { registerUser, createChannelReq } from '../__fixtures__/testHelpers';

const app = createApp();

async function makeChannelMember(channelId: number, userId: number): Promise<void> {
  await testDb.execute(
    `INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [channelId, userId],
  );
}

describe('POST /api/channels/:channelId/wiki-pages', () => {
  it('正常: タイトルと本文を指定するとページが作成され201と作成されたページが返る', async () => {
    const { token } = await registerUser(app, 'wp_post1', 'wp_post1@test.com');
    const channelId = await createChannelReq(app, token, 'wp-ch-post1');

    const res = await request(app)
      .post(`/api/channels/${channelId}/wiki-pages`)
      .set('Cookie', `token=${token}`)
      .send({ title: 'タイトル', content: '本文' });

    expect(res.status).toBe(201);
    expect(res.body.page.title).toBe('タイトル');
    expect(res.body.page.content).toBe('本文');
  });

  it('正常: tagIdsを指定するとタグが紐付いた状態で返る', async () => {
    const { token } = await registerUser(app, 'wp_post2', 'wp_post2@test.com');
    const channelId = await createChannelReq(app, token, 'wp-ch-post2');
    const tag = await testDb.queryOne<{ id: number }>(
      `INSERT INTO tags (name) VALUES ('wp-tag1') RETURNING id`,
      [],
    );

    const res = await request(app)
      .post(`/api/channels/${channelId}/wiki-pages`)
      .set('Cookie', `token=${token}`)
      .send({ title: 't', tagIds: [tag!.id] });

    expect(res.status).toBe(201);
    expect(res.body.page.tags.length).toBe(1);
    expect(res.body.page.tags[0].id).toBe(tag!.id);
  });

  it('異常: トークンなしで401が返る', async () => {
    const res = await request(app).post(`/api/channels/1/wiki-pages`).send({ title: 't' });
    expect(res.status).toBe(401);
  });

  it('異常: チャンネル非メンバーは403が返る', async () => {
    const { token: t1 } = await registerUser(app, 'wp_post3a', 'wp_post3a@test.com');
    const { token: t2 } = await registerUser(app, 'wp_post3b', 'wp_post3b@test.com');
    const channelId = await createChannelReq(app, t1, 'wp-ch-post3');

    const res = await request(app)
      .post(`/api/channels/${channelId}/wiki-pages`)
      .set('Cookie', `token=${t2}`)
      .send({ title: 't' });

    expect(res.status).toBe(403);
  });

  it('異常: タイトルが空文字列だと400が返る', async () => {
    const { token } = await registerUser(app, 'wp_post4', 'wp_post4@test.com');
    const channelId = await createChannelReq(app, token, 'wp-ch-post4');

    const res = await request(app)
      .post(`/api/channels/${channelId}/wiki-pages`)
      .set('Cookie', `token=${token}`)
      .send({ title: '   ' });

    expect(res.status).toBe(400);
  });

  it('異常: 存在しないchannelIdだと404が返る', async () => {
    const { token } = await registerUser(app, 'wp_post5', 'wp_post5@test.com');
    const res = await request(app)
      .post(`/api/channels/99999/wiki-pages`)
      .set('Cookie', `token=${token}`)
      .send({ title: 't' });

    expect(res.status).toBe(404);
  });
});

describe('GET /api/channels/:channelId/wiki-pages', () => {
  it('正常: そのチャンネルのページ一覧が返る', async () => {
    const { token } = await registerUser(app, 'wp_list1', 'wp_list1@test.com');
    const channelId = await createChannelReq(app, token, 'wp-ch-list1');

    await request(app)
      .post(`/api/channels/${channelId}/wiki-pages`)
      .set('Cookie', `token=${token}`)
      .send({ title: 'p1' });
    await request(app)
      .post(`/api/channels/${channelId}/wiki-pages`)
      .set('Cookie', `token=${token}`)
      .send({ title: 'p2' });

    const res = await request(app)
      .get(`/api/channels/${channelId}/wiki-pages`)
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body.pages.length).toBe(2);
  });

  it('正常: クエリパラメータq でタイトル/本文の部分一致検索ができる', async () => {
    const { token } = await registerUser(app, 'wp_list2', 'wp_list2@test.com');
    const channelId = await createChannelReq(app, token, 'wp-ch-list2');

    await request(app)
      .post(`/api/channels/${channelId}/wiki-pages`)
      .set('Cookie', `token=${token}`)
      .send({ title: 'apple' });
    await request(app)
      .post(`/api/channels/${channelId}/wiki-pages`)
      .set('Cookie', `token=${token}`)
      .send({ title: 'banana' });

    const res = await request(app)
      .get(`/api/channels/${channelId}/wiki-pages?q=apple`)
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body.pages.length).toBe(1);
    expect(res.body.pages[0].title).toBe('apple');
  });

  it('正常: 該当ページが0件のときは空配列が返る', async () => {
    const { token } = await registerUser(app, 'wp_list3', 'wp_list3@test.com');
    const channelId = await createChannelReq(app, token, 'wp-ch-list3');

    const res = await request(app)
      .get(`/api/channels/${channelId}/wiki-pages`)
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body.pages).toEqual([]);
  });

  it('異常: トークンなしで401が返る', async () => {
    const res = await request(app).get(`/api/channels/1/wiki-pages`);
    expect(res.status).toBe(401);
  });

  it('異常: チャンネル非メンバーは403が返る', async () => {
    const { token: t1 } = await registerUser(app, 'wp_list4a', 'wp_list4a@test.com');
    const { token: t2 } = await registerUser(app, 'wp_list4b', 'wp_list4b@test.com');
    const channelId = await createChannelReq(app, t1, 'wp-ch-list4');

    const res = await request(app)
      .get(`/api/channels/${channelId}/wiki-pages`)
      .set('Cookie', `token=${t2}`);
    expect(res.status).toBe(403);
  });
});

describe('GET /api/wiki-pages/:id', () => {
  it('正常: 指定IDのページ詳細（タグ含む）が返る', async () => {
    const { token } = await registerUser(app, 'wp_get1', 'wp_get1@test.com');
    const channelId = await createChannelReq(app, token, 'wp-ch-get1');
    const create = await request(app)
      .post(`/api/channels/${channelId}/wiki-pages`)
      .set('Cookie', `token=${token}`)
      .send({ title: 'g' });
    const pageId = create.body.page.id;

    const res = await request(app).get(`/api/wiki-pages/${pageId}`).set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body.page.id).toBe(pageId);
    expect(Array.isArray(res.body.page.tags)).toBe(true);
  });

  it('異常: 存在しないIDで404が返る', async () => {
    const { token } = await registerUser(app, 'wp_get2', 'wp_get2@test.com');
    const res = await request(app).get(`/api/wiki-pages/99999`).set('Cookie', `token=${token}`);
    expect(res.status).toBe(404);
  });

  it('異常: チャンネル非メンバーは403が返る', async () => {
    const { token: t1 } = await registerUser(app, 'wp_get3a', 'wp_get3a@test.com');
    const { token: t2 } = await registerUser(app, 'wp_get3b', 'wp_get3b@test.com');
    const channelId = await createChannelReq(app, t1, 'wp-ch-get3');
    const create = await request(app)
      .post(`/api/channels/${channelId}/wiki-pages`)
      .set('Cookie', `token=${t1}`)
      .send({ title: 'g' });

    const res = await request(app)
      .get(`/api/wiki-pages/${create.body.page.id}`)
      .set('Cookie', `token=${t2}`);
    expect(res.status).toBe(403);
  });

  it('異常: トークンなしで401が返る', async () => {
    const res = await request(app).get(`/api/wiki-pages/1`);
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/wiki-pages/:id', () => {
  it('正常: 作成者が編集すると200と更新後ページが返る', async () => {
    const { token } = await registerUser(app, 'wp_patch1', 'wp_patch1@test.com');
    const channelId = await createChannelReq(app, token, 'wp-ch-patch1');
    const create = await request(app)
      .post(`/api/channels/${channelId}/wiki-pages`)
      .set('Cookie', `token=${token}`)
      .send({ title: 'orig' });

    const res = await request(app)
      .patch(`/api/wiki-pages/${create.body.page.id}`)
      .set('Cookie', `token=${token}`)
      .send({ title: 'updated', expectedUpdatedAt: create.body.page.updatedAt });

    expect(res.status).toBe(200);
    expect(res.body.page.title).toBe('updated');
  });

  it('正常: チャンネル作成者は他人作成のページも編集できる', async () => {
    const { token: ownerToken, userId: ownerId } = await registerUser(
      app,
      'wp_patch2_owner',
      'wp_patch2_owner@test.com',
    );
    const { token: memberToken, userId: memberId } = await registerUser(
      app,
      'wp_patch2_member',
      'wp_patch2_member@test.com',
    );
    const channelId = await createChannelReq(app, ownerToken, 'wp-ch-patch2');
    await makeChannelMember(channelId, memberId);

    // member がページを作成
    const create = await request(app)
      .post(`/api/channels/${channelId}/wiki-pages`)
      .set('Cookie', `token=${memberToken}`)
      .send({ title: 'orig' });

    // owner（チャンネル作成者）が編集
    const res = await request(app)
      .patch(`/api/wiki-pages/${create.body.page.id}`)
      .set('Cookie', `token=${ownerToken}`)
      .send({ title: 'by-owner', expectedUpdatedAt: create.body.page.updatedAt });

    expect(res.status).toBe(200);
    expect(res.body.page.title).toBe('by-owner');
    // 未使用警告抑止
    void ownerId;
  });

  it('正常: 管理者は編集できる', async () => {
    const { token: t1 } = await registerUser(app, 'wp_patch3_user', 'wp_patch3_user@test.com');
    const { token: adminToken, userId: adminId } = await registerUser(
      app,
      'wp_patch3_admin',
      'wp_patch3_admin@test.com',
    );
    await testDb.execute(`UPDATE users SET role = 'admin' WHERE id = $1`, [adminId]);

    const channelId = await createChannelReq(app, t1, 'wp-ch-patch3');
    const create = await request(app)
      .post(`/api/channels/${channelId}/wiki-pages`)
      .set('Cookie', `token=${t1}`)
      .send({ title: 'o' });

    const res = await request(app)
      .patch(`/api/wiki-pages/${create.body.page.id}`)
      .set('Cookie', `token=${adminToken}`)
      .send({ title: 'admin', expectedUpdatedAt: create.body.page.updatedAt });
    expect(res.status).toBe(200);
  });

  it('正常: tagIdsを更新すると紐付けが置換される', async () => {
    const { token } = await registerUser(app, 'wp_patch4', 'wp_patch4@test.com');
    const channelId = await createChannelReq(app, token, 'wp-ch-patch4');
    const t1 = await testDb.queryOne<{ id: number }>(
      `INSERT INTO tags (name) VALUES ('p4t1') RETURNING id`,
      [],
    );
    const t2 = await testDb.queryOne<{ id: number }>(
      `INSERT INTO tags (name) VALUES ('p4t2') RETURNING id`,
      [],
    );
    const create = await request(app)
      .post(`/api/channels/${channelId}/wiki-pages`)
      .set('Cookie', `token=${token}`)
      .send({ title: 't', tagIds: [t1!.id] });

    const res = await request(app)
      .patch(`/api/wiki-pages/${create.body.page.id}`)
      .set('Cookie', `token=${token}`)
      .send({ tagIds: [t2!.id], expectedUpdatedAt: create.body.page.updatedAt });
    expect(res.status).toBe(200);
    expect(res.body.page.tags.map((x: { id: number }) => x.id)).toEqual([t2!.id]);
  });

  it('異常: 編集権限のない一般メンバーは403が返る', async () => {
    const { token: owner } = await registerUser(app, 'wp_patch5_owner', 'wp_patch5o@test.com');
    const { token: m, userId: mId } = await registerUser(app, 'wp_patch5_m', 'wp_patch5m@test.com');
    const { token: other, userId: otherId } = await registerUser(
      app,
      'wp_patch5_other',
      'wp_patch5x@test.com',
    );
    const channelId = await createChannelReq(app, owner, 'wp-ch-patch5');
    await makeChannelMember(channelId, mId);
    await makeChannelMember(channelId, otherId);

    const create = await request(app)
      .post(`/api/channels/${channelId}/wiki-pages`)
      .set('Cookie', `token=${m}`)
      .send({ title: 'o' });

    const res = await request(app)
      .patch(`/api/wiki-pages/${create.body.page.id}`)
      .set('Cookie', `token=${other}`)
      .send({ title: 'x', expectedUpdatedAt: create.body.page.updatedAt });
    expect(res.status).toBe(403);
  });

  it('異常: expectedUpdatedAtが現状と不一致なら409が返る（楽観ロック）', async () => {
    const { token } = await registerUser(app, 'wp_patch6', 'wp_patch6@test.com');
    const channelId = await createChannelReq(app, token, 'wp-ch-patch6');
    const create = await request(app)
      .post(`/api/channels/${channelId}/wiki-pages`)
      .set('Cookie', `token=${token}`)
      .send({ title: 'o' });

    const res = await request(app)
      .patch(`/api/wiki-pages/${create.body.page.id}`)
      .set('Cookie', `token=${token}`)
      .send({ title: 'x', expectedUpdatedAt: '2000-01-01T00:00:00.000Z' });
    expect(res.status).toBe(409);
  });

  it('異常: 存在しないIDで404が返る', async () => {
    const { token } = await registerUser(app, 'wp_patch7', 'wp_patch7@test.com');
    const res = await request(app)
      .patch(`/api/wiki-pages/99999`)
      .set('Cookie', `token=${token}`)
      .send({ title: 'x', expectedUpdatedAt: '2020-01-01T00:00:00.000Z' });
    expect(res.status).toBe(404);
  });

  it('異常: トークンなしで401が返る', async () => {
    const res = await request(app)
      .patch(`/api/wiki-pages/1`)
      .send({ title: 'x', expectedUpdatedAt: '2020-01-01T00:00:00.000Z' });
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/wiki-pages/:id', () => {
  it('正常: チャンネル作成者は削除できる（204）', async () => {
    const { token } = await registerUser(app, 'wp_del1', 'wp_del1@test.com');
    const channelId = await createChannelReq(app, token, 'wp-ch-del1');
    const create = await request(app)
      .post(`/api/channels/${channelId}/wiki-pages`)
      .set('Cookie', `token=${token}`)
      .send({ title: 'd' });

    const res = await request(app)
      .delete(`/api/wiki-pages/${create.body.page.id}`)
      .set('Cookie', `token=${token}`);
    expect(res.status).toBe(204);
  });

  it('正常: 管理者は削除できる', async () => {
    const { token: t1 } = await registerUser(app, 'wp_del2_user', 'wp_del2_user@test.com');
    const { token: adminToken, userId: adminId } = await registerUser(
      app,
      'wp_del2_admin',
      'wp_del2_admin@test.com',
    );
    await testDb.execute(`UPDATE users SET role = 'admin' WHERE id = $1`, [adminId]);

    const channelId = await createChannelReq(app, t1, 'wp-ch-del2');
    const create = await request(app)
      .post(`/api/channels/${channelId}/wiki-pages`)
      .set('Cookie', `token=${t1}`)
      .send({ title: 'd' });

    const res = await request(app)
      .delete(`/api/wiki-pages/${create.body.page.id}`)
      .set('Cookie', `token=${adminToken}`);
    expect(res.status).toBe(204);
  });

  it('異常: ページ作成者であってもチャンネル作成者でなければ403', async () => {
    const { token: owner } = await registerUser(app, 'wp_del3_owner', 'wp_del3_owner@test.com');
    const { token: m, userId: mId } = await registerUser(app, 'wp_del3_m', 'wp_del3_m@test.com');
    const channelId = await createChannelReq(app, owner, 'wp-ch-del3');
    await makeChannelMember(channelId, mId);

    const create = await request(app)
      .post(`/api/channels/${channelId}/wiki-pages`)
      .set('Cookie', `token=${m}`)
      .send({ title: 'd' });

    const res = await request(app)
      .delete(`/api/wiki-pages/${create.body.page.id}`)
      .set('Cookie', `token=${m}`);
    expect(res.status).toBe(403);
  });

  it('異常: 一般メンバーは403が返る', async () => {
    const { token: owner } = await registerUser(app, 'wp_del4_owner', 'wp_del4_owner@test.com');
    const { token: other, userId: otherId } = await registerUser(
      app,
      'wp_del4_other',
      'wp_del4_other@test.com',
    );
    const channelId = await createChannelReq(app, owner, 'wp-ch-del4');
    await makeChannelMember(channelId, otherId);
    const create = await request(app)
      .post(`/api/channels/${channelId}/wiki-pages`)
      .set('Cookie', `token=${owner}`)
      .send({ title: 'd' });

    const res = await request(app)
      .delete(`/api/wiki-pages/${create.body.page.id}`)
      .set('Cookie', `token=${other}`);
    expect(res.status).toBe(403);
  });

  it('異常: 存在しないIDで404が返る', async () => {
    const { token } = await registerUser(app, 'wp_del5', 'wp_del5@test.com');
    const res = await request(app).delete(`/api/wiki-pages/99999`).set('Cookie', `token=${token}`);
    expect(res.status).toBe(404);
  });

  it('異常: トークンなしで401が返る', async () => {
    const res = await request(app).delete(`/api/wiki-pages/1`);
    expect(res.status).toBe(401);
  });
});
