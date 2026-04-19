/**
 * テスト対象: messageTemplateService / REST API（/api/templates）
 * 戦略:
 *   - pg-mem のインメモリ PostgreSQL 互換 DB を使いサービス層を直接テストする
 *   - CRUD・並び順整合性・他人の ID でのアクセス禁止を重点的に検証する
 *   - REST API テストでは supertest を使い HTTP 契約のみを確認する
 */

import { getSharedTestDatabase, resetTestData } from './__fixtures__/pgTestHelper';

const testDb = getSharedTestDatabase();

jest.mock('../db/database', () => testDb);

import request from 'supertest';
import { createApp } from '../app';
import { generateToken } from '../middleware/auth';
import * as templateService from '../services/messageTemplateService';

const app = createApp();

let userId1: number;
let userId2: number;
let token1: string;
let token2: string;

async function setupFixtures() {
  const r1 = await testDb.execute(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
    ['tpl_user1', 'tpl1@t.com', 'h'],
  );
  userId1 = r1.rows[0].id as number;

  const r2 = await testDb.execute(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
    ['tpl_user2', 'tpl2@t.com', 'h'],
  );
  userId2 = r2.rows[0].id as number;

  token1 = generateToken(userId1, 'tpl_user1');
  token2 = generateToken(userId2, 'tpl_user2');
}

beforeEach(async () => {
  await resetTestData(testDb);
  await setupFixtures();
});

// ─── サービス層テスト ─────────────────────────────────────────────────────────

describe('createTemplate', () => {
  it('タイトルと本文を指定してテンプレートを作成できる', async () => {
    const tpl = await templateService.createTemplate(userId1, {
      title: '挨拶',
      body: 'こんにちは！',
    });
    expect(tpl.title).toBe('挨拶');
    expect(tpl.body).toBe('こんにちは！');
    expect(tpl.userId).toBe(userId1);
    expect(tpl.id).toBeGreaterThan(0);
  });

  it('タイトルが空文字の場合はエラーになる', async () => {
    await expect(
      templateService.createTemplate(userId1, { title: '', body: '本文' }),
    ).rejects.toThrow();
  });

  it('本文が空文字の場合はエラーになる', async () => {
    await expect(
      templateService.createTemplate(userId1, { title: 'タイトル', body: '' }),
    ).rejects.toThrow();
  });

  it('タイトルが100文字を超える場合はエラーになる', async () => {
    const longTitle = 'あ'.repeat(101);
    await expect(
      templateService.createTemplate(userId1, { title: longTitle, body: '本文' }),
    ).rejects.toThrow();
  });

  it('作成されたテンプレートの position はリストの末尾に設定される', async () => {
    const tpl1 = await templateService.createTemplate(userId1, { title: '1つ目', body: '本文1' });
    const tpl2 = await templateService.createTemplate(userId1, { title: '2つ目', body: '本文2' });
    expect(tpl2.position).toBeGreaterThan(tpl1.position);
  });
});

describe('listTemplates', () => {
  it('ユーザーのテンプレート一覧を position 昇順で返す', async () => {
    await templateService.createTemplate(userId1, { title: 'A', body: 'a' });
    await templateService.createTemplate(userId1, { title: 'B', body: 'b' });
    await templateService.createTemplate(userId1, { title: 'C', body: 'c' });
    const templates = await templateService.listTemplates(userId1);
    expect(templates.length).toBe(3);
    expect(templates[0].position).toBeLessThanOrEqual(templates[1].position);
    expect(templates[1].position).toBeLessThanOrEqual(templates[2].position);
  });

  it('テンプレートが存在しないユーザーでは空配列を返す', async () => {
    const templates = await templateService.listTemplates(userId1);
    expect(templates).toEqual([]);
  });

  it('他のユーザーのテンプレートは含まれない', async () => {
    await templateService.createTemplate(userId1, { title: 'User1のテンプレート', body: '本文' });
    await templateService.createTemplate(userId2, { title: 'User2のテンプレート', body: '本文' });
    const templates = await templateService.listTemplates(userId1);
    expect(templates.length).toBe(1);
    expect(templates[0].title).toBe('User1のテンプレート');
  });
});

describe('updateTemplate', () => {
  it('タイトルを更新できる', async () => {
    const tpl = await templateService.createTemplate(userId1, {
      title: '旧タイトル',
      body: '本文',
    });
    const updated = await templateService.updateTemplate(userId1, tpl.id, { title: '新タイトル' });
    expect(updated.title).toBe('新タイトル');
    expect(updated.body).toBe('本文');
  });

  it('本文を更新できる', async () => {
    const tpl = await templateService.createTemplate(userId1, {
      title: 'タイトル',
      body: '旧本文',
    });
    const updated = await templateService.updateTemplate(userId1, tpl.id, { body: '新本文' });
    expect(updated.body).toBe('新本文');
    expect(updated.title).toBe('タイトル');
  });

  it('存在しないテンプレートIDの更新はエラーになる', async () => {
    await expect(
      templateService.updateTemplate(userId1, 99999, { title: '新タイトル' }),
    ).rejects.toThrow();
  });

  it('他のユーザーのテンプレートを更新しようとしても変更されない（404扱い）', async () => {
    const tpl = await templateService.createTemplate(userId2, {
      title: 'User2のテンプレート',
      body: '本文',
    });
    await expect(
      templateService.updateTemplate(userId1, tpl.id, { title: '乗っ取り' }),
    ).rejects.toThrow();
  });

  it('タイトルを空文字に更新しようとするとエラーになる', async () => {
    const tpl = await templateService.createTemplate(userId1, { title: 'タイトル', body: '本文' });
    await expect(templateService.updateTemplate(userId1, tpl.id, { title: '' })).rejects.toThrow();
  });
});

describe('removeTemplate', () => {
  it('テンプレートを削除できる', async () => {
    const tpl = await templateService.createTemplate(userId1, { title: 'タイトル', body: '本文' });
    await templateService.removeTemplate(userId1, tpl.id);
    const templates = await templateService.listTemplates(userId1);
    expect(templates.find((t) => t.id === tpl.id)).toBeUndefined();
  });

  it('存在しないテンプレートIDの削除はエラーになる', async () => {
    await expect(templateService.removeTemplate(userId1, 99999)).rejects.toThrow();
  });

  it('他のユーザーのテンプレートは削除できない（404扱い）', async () => {
    const tpl = await templateService.createTemplate(userId2, {
      title: 'User2のテンプレート',
      body: '本文',
    });
    await expect(templateService.removeTemplate(userId1, tpl.id)).rejects.toThrow();
  });
});

describe('reorderTemplates', () => {
  it('指定した順序で position が更新される', async () => {
    const tpl1 = await templateService.createTemplate(userId1, { title: 'A', body: 'a' });
    const tpl2 = await templateService.createTemplate(userId1, { title: 'B', body: 'b' });
    const tpl3 = await templateService.createTemplate(userId1, { title: 'C', body: 'c' });

    // 逆順に並び替え
    await templateService.reorderTemplates(userId1, [tpl3.id, tpl2.id, tpl1.id]);

    const templates = await templateService.listTemplates(userId1);
    expect(templates[0].title).toBe('C');
    expect(templates[1].title).toBe('B');
    expect(templates[2].title).toBe('A');
  });

  it('自分のテンプレートIDのみが含まれている場合に正常に処理される', async () => {
    const tpl1 = await templateService.createTemplate(userId1, { title: 'A', body: 'a' });
    const tpl2 = await templateService.createTemplate(userId1, { title: 'B', body: 'b' });
    await expect(
      templateService.reorderTemplates(userId1, [tpl2.id, tpl1.id]),
    ).resolves.not.toThrow();
  });

  it('他のユーザーのテンプレートIDが含まれていた場合はエラーになる', async () => {
    const tpl1 = await templateService.createTemplate(userId1, { title: 'A', body: 'a' });
    const tpl2 = await templateService.createTemplate(userId2, { title: 'B', body: 'b' });
    await expect(templateService.reorderTemplates(userId1, [tpl1.id, tpl2.id])).rejects.toThrow();
  });

  it('存在しない ID が含まれていた場合はエラーになる', async () => {
    const tpl1 = await templateService.createTemplate(userId1, { title: 'A', body: 'a' });
    await expect(templateService.reorderTemplates(userId1, [tpl1.id, 99999])).rejects.toThrow();
  });
});

// ─── REST API テスト ──────────────────────────────────────────────────────────

describe('REST API: GET /api/templates', () => {
  it('認証済みユーザーが自分のテンプレート一覧を 200 で取得できる', async () => {
    await templateService.createTemplate(userId1, { title: 'テスト', body: '本文' });
    const res = await request(app).get('/api/templates').set('Cookie', `token=${token1}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('templates');
    expect(Array.isArray(res.body.templates)).toBe(true);
  });

  it('認証なしで 401 を返す', async () => {
    const res = await request(app).get('/api/templates');
    expect(res.status).toBe(401);
  });
});

describe('REST API: POST /api/templates', () => {
  it('テンプレート作成成功で 201 を返す', async () => {
    const res = await request(app)
      .post('/api/templates')
      .set('Cookie', `token=${token1}`)
      .send({ title: 'テスト', body: '本文' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('template');
    expect(res.body.template.title).toBe('テスト');
  });

  it('認証なしで 401 を返す', async () => {
    const res = await request(app).post('/api/templates').send({ title: 'テスト', body: '本文' });
    expect(res.status).toBe(401);
  });

  it('タイトル未指定で 400 を返す', async () => {
    const res = await request(app)
      .post('/api/templates')
      .set('Cookie', `token=${token1}`)
      .send({ body: '本文' });
    expect(res.status).toBe(400);
  });

  it('本文未指定で 400 を返す', async () => {
    const res = await request(app)
      .post('/api/templates')
      .set('Cookie', `token=${token1}`)
      .send({ title: 'タイトル' });
    expect(res.status).toBe(400);
  });
});

describe('REST API: PATCH /api/templates/:id', () => {
  it('テンプレート更新成功で 200 を返す', async () => {
    const tpl = await templateService.createTemplate(userId1, { title: 'タイトル', body: '本文' });
    const res = await request(app)
      .patch(`/api/templates/${tpl.id}`)
      .set('Cookie', `token=${token1}`)
      .send({ title: '新タイトル' });
    expect(res.status).toBe(200);
    expect(res.body.template.title).toBe('新タイトル');
  });

  it('認証なしで 401 を返す', async () => {
    const res = await request(app).patch('/api/templates/1').send({ title: '新タイトル' });
    expect(res.status).toBe(401);
  });

  it('他のユーザーのテンプレートIDで 404 を返す', async () => {
    const tpl = await templateService.createTemplate(userId2, { title: 'タイトル', body: '本文' });
    const res = await request(app)
      .patch(`/api/templates/${tpl.id}`)
      .set('Cookie', `token=${token1}`)
      .send({ title: '新タイトル' });
    expect(res.status).toBe(404);
  });

  it('存在しない ID で 404 を返す', async () => {
    const res = await request(app)
      .patch('/api/templates/99999')
      .set('Cookie', `token=${token1}`)
      .send({ title: '新タイトル' });
    expect(res.status).toBe(404);
  });
});

describe('REST API: DELETE /api/templates/:id', () => {
  it('テンプレート削除成功で 204 を返す', async () => {
    const tpl = await templateService.createTemplate(userId1, { title: 'タイトル', body: '本文' });
    const res = await request(app)
      .delete(`/api/templates/${tpl.id}`)
      .set('Cookie', `token=${token1}`);
    expect(res.status).toBe(204);
  });

  it('認証なしで 401 を返す', async () => {
    const res = await request(app).delete('/api/templates/1');
    expect(res.status).toBe(401);
  });

  it('他のユーザーのテンプレートIDで 404 を返す', async () => {
    const tpl = await templateService.createTemplate(userId2, { title: 'タイトル', body: '本文' });
    const res = await request(app)
      .delete(`/api/templates/${tpl.id}`)
      .set('Cookie', `token=${token1}`);
    expect(res.status).toBe(404);
  });
});

describe('REST API: PUT /api/templates/reorder', () => {
  it('並び替え成功で 200 を返す', async () => {
    const tpl1 = await templateService.createTemplate(userId1, { title: 'A', body: 'a' });
    const tpl2 = await templateService.createTemplate(userId1, { title: 'B', body: 'b' });
    const res = await request(app)
      .put('/api/templates/reorder')
      .set('Cookie', `token=${token1}`)
      .send({ orderedIds: [tpl2.id, tpl1.id] });
    expect(res.status).toBe(200);
  });

  it('認証なしで 401 を返す', async () => {
    const res = await request(app)
      .put('/api/templates/reorder')
      .send({ orderedIds: [1, 2] });
    expect(res.status).toBe(401);
  });

  it('orderedIds が配列でない場合 400 を返す', async () => {
    const res = await request(app)
      .put('/api/templates/reorder')
      .set('Cookie', `token=${token1}`)
      .send({ orderedIds: 'invalid' });
    expect(res.status).toBe(400);
  });
});
