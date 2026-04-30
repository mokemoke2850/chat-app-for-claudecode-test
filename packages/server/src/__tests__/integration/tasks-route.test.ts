/**
 * テスト対象: tasks APIルート（GET/POST/PATCH/DELETE /tasks, PUT /tasks/order）
 * 戦略: supertest で HTTP エンドポイントを検証する統合テスト。
 * pg-mem のインメモリ DB を使用し、JWT 認証をモックして各エンドポイントの
 * リクエスト/レスポンスとステータスコードを検証する。
 */

import { createTestDatabase } from '../__fixtures__/pgTestHelper';

const testDb = createTestDatabase();

jest.mock('../../db/database', () => testDb);

import request from 'supertest';
import { createApp } from '../../app';
import { registerUser, createChannelReq } from '../__fixtures__/testHelpers';

const app = createApp();

async function createMessage(token: string, channelId: number): Promise<number> {
  // socket.io 経由なので DB 直接挿入を使う
  const result = await testDb.queryOne<{ id: number }>(
    `INSERT INTO messages (channel_id, content) VALUES ($1, 'test msg') RETURNING id`,
    [channelId],
  );
  return result!.id;
}

describe('タスク管理 APIルート', () => {
  describe('GET /tasks', () => {
    it('認証なしでアクセスすると 401 を返す', async () => {
      const res = await request(app).get('/api/tasks');
      expect(res.status).toBe(401);
    });

    it('認証済みユーザーがタスク一覧を取得できる（200）', async () => {
      const { token } = await registerUser(app, 'task_get1', 'task_get1@test.com');
      const res = await request(app).get('/api/tasks').set('Cookie', `token=${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.tasks)).toBe(true);
    });

    it('?status=todo でフィルタしたタスクを返す', async () => {
      const { token, userId } = await registerUser(app, 'task_get2', 'task_get2@test.com');
      // todo タスクを作成
      await request(app)
        .post('/api/tasks')
        .set('Cookie', `token=${token}`)
        .send({ title: 'todo タスク' });
      // in_progress タスクを作成してステータス変更
      const r = await request(app)
        .post('/api/tasks')
        .set('Cookie', `token=${token}`)
        .send({ title: 'in_progress タスク' });
      const taskId = (r.body as { task: { id: number } }).task.id;
      await request(app)
        .patch(`/api/tasks/${taskId}`)
        .set('Cookie', `token=${token}`)
        .send({ status: 'in_progress' });

      const res = await request(app).get('/api/tasks?status=todo').set('Cookie', `token=${token}`);
      expect(res.status).toBe(200);
      expect(
        (res.body as { tasks: { status: string }[] }).tasks.every((t) => t.status === 'todo'),
      ).toBe(true);
      void userId;
    });

    it('?status=in_progress でフィルタしたタスクを返す', async () => {
      const { token } = await registerUser(app, 'task_get3', 'task_get3@test.com');
      const r = await request(app)
        .post('/api/tasks')
        .set('Cookie', `token=${token}`)
        .send({ title: 'inprog' });
      const taskId = (r.body as { task: { id: number } }).task.id;
      await request(app)
        .patch(`/api/tasks/${taskId}`)
        .set('Cookie', `token=${token}`)
        .send({ status: 'in_progress' });

      const res = await request(app)
        .get('/api/tasks?status=in_progress')
        .set('Cookie', `token=${token}`);
      expect(res.status).toBe(200);
      const tasks = (res.body as { tasks: { status: string }[] }).tasks;
      expect(tasks.some((t) => t.status === 'in_progress')).toBe(true);
    });

    it('?status=done でフィルタしたタスクを返す', async () => {
      const { token } = await registerUser(app, 'task_get4', 'task_get4@test.com');
      const r = await request(app)
        .post('/api/tasks')
        .set('Cookie', `token=${token}`)
        .send({ title: 'done task' });
      const taskId = (r.body as { task: { id: number } }).task.id;
      await request(app)
        .patch(`/api/tasks/${taskId}`)
        .set('Cookie', `token=${token}`)
        .send({ status: 'done' });

      const res = await request(app).get('/api/tasks?status=done').set('Cookie', `token=${token}`);
      expect(res.status).toBe(200);
      const tasks = (res.body as { tasks: { status: string }[] }).tasks;
      expect(tasks.some((t) => t.status === 'done')).toBe(true);
    });

    it('?assignee={userId} でフィルタしたタスクを返す', async () => {
      const { token, userId } = await registerUser(app, 'task_get5', 'task_get5@test.com');
      await request(app)
        .post('/api/tasks')
        .set('Cookie', `token=${token}`)
        .send({ title: '担当者タスク', assigneeId: userId });

      const res = await request(app)
        .get(`/api/tasks?assignee=${userId}`)
        .set('Cookie', `token=${token}`);
      expect(res.status).toBe(200);
      const tasks = (res.body as { tasks: { assigneeId: number }[] }).tasks;
      expect(tasks.every((t) => t.assigneeId === userId)).toBe(true);
    });

    it('?channel={channelId} でフィルタしたタスクを返す', async () => {
      const { token } = await registerUser(app, 'task_get6', 'task_get6@test.com');
      const channelId = await createChannelReq(app, token, 'task-ch-filter');
      const messageId = await createMessage(token, channelId);

      await request(app)
        .post('/api/tasks')
        .set('Cookie', `token=${token}`)
        .send({ title: 'チャンネルタスク', sourceMessageId: messageId });

      const res = await request(app)
        .get(`/api/tasks?channel=${channelId}`)
        .set('Cookie', `token=${token}`);
      expect(res.status).toBe(200);
      const tasks = (res.body as { tasks: { sourceChannelId: number }[] }).tasks;
      expect(tasks.some((t) => t.sourceChannelId === channelId)).toBe(true);
    });
  });

  describe('POST /tasks', () => {
    it('認証なしでアクセスすると 401 を返す', async () => {
      const res = await request(app).post('/api/tasks').send({ title: 'テスト' });
      expect(res.status).toBe(401);
    });

    it('必須フィールド（title）を含むリクエストでタスクを作成できる（201）', async () => {
      const { token } = await registerUser(app, 'task_post1', 'task_post1@test.com');
      const res = await request(app)
        .post('/api/tasks')
        .set('Cookie', `token=${token}`)
        .send({ title: '新しいタスク' });
      expect(res.status).toBe(201);
      expect((res.body as { task: { title: string } }).task.title).toBe('新しいタスク');
    });

    it('title が空のリクエストは 400 を返す', async () => {
      const { token } = await registerUser(app, 'task_post2', 'task_post2@test.com');
      const res = await request(app)
        .post('/api/tasks')
        .set('Cookie', `token=${token}`)
        .send({ title: '' });
      expect(res.status).toBe(400);
    });

    it('source_message_id を含むリクエストでタスクを作成できる', async () => {
      const { token } = await registerUser(app, 'task_post3', 'task_post3@test.com');
      const channelId = await createChannelReq(app, token, 'task-src-ch');
      const messageId = await createMessage(token, channelId);

      const res = await request(app)
        .post('/api/tasks')
        .set('Cookie', `token=${token}`)
        .send({ title: 'メッセージからのタスク', sourceMessageId: messageId });
      expect(res.status).toBe(201);
      expect((res.body as { task: { sourceMessageId: number } }).task.sourceMessageId).toBe(
        messageId,
      );
    });

    it('作成されたタスクのデフォルトステータスは todo である', async () => {
      const { token } = await registerUser(app, 'task_post4', 'task_post4@test.com');
      const res = await request(app)
        .post('/api/tasks')
        .set('Cookie', `token=${token}`)
        .send({ title: 'デフォルトステータス' });
      expect(res.status).toBe(201);
      expect((res.body as { task: { status: string } }).task.status).toBe('todo');
    });
  });

  describe('PATCH /tasks/:id', () => {
    it('認証なしでアクセスすると 401 を返す', async () => {
      const res = await request(app).patch('/api/tasks/1').send({ title: '更新' });
      expect(res.status).toBe(401);
    });

    it('タスクのフィールドを更新できる（200）', async () => {
      const { token } = await registerUser(app, 'task_patch1', 'task_patch1@test.com');
      const r = await request(app)
        .post('/api/tasks')
        .set('Cookie', `token=${token}`)
        .send({ title: '更新前' });
      const taskId = (r.body as { task: { id: number } }).task.id;

      const res = await request(app)
        .patch(`/api/tasks/${taskId}`)
        .set('Cookie', `token=${token}`)
        .send({ title: '更新後' });
      expect(res.status).toBe(200);
      expect((res.body as { task: { title: string } }).task.title).toBe('更新後');
    });

    it('存在しないタスク ID は 404 を返す', async () => {
      const { token } = await registerUser(app, 'task_patch2', 'task_patch2@test.com');
      const res = await request(app)
        .patch('/api/tasks/99999')
        .set('Cookie', `token=${token}`)
        .send({ title: '更新' });
      expect(res.status).toBe(404);
    });

    it('ステータスを変更できる', async () => {
      const { token } = await registerUser(app, 'task_patch3', 'task_patch3@test.com');
      const r = await request(app)
        .post('/api/tasks')
        .set('Cookie', `token=${token}`)
        .send({ title: 'ステータス変更' });
      const taskId = (r.body as { task: { id: number } }).task.id;

      const res = await request(app)
        .patch(`/api/tasks/${taskId}`)
        .set('Cookie', `token=${token}`)
        .send({ status: 'in_progress' });
      expect(res.status).toBe(200);
      expect((res.body as { task: { status: string } }).task.status).toBe('in_progress');
    });
  });

  describe('PATCH /tasks/:id — isHidden', () => {
    it('isHidden を true に更新できる（200）', async () => {
      const { token } = await registerUser(app, 'task_hidden1', 'task_hidden1@test.com');
      const r = await request(app)
        .post('/api/tasks')
        .set('Cookie', `token=${token}`)
        .send({ title: '非表示タスク' });
      const taskId = (r.body as { task: { id: number } }).task.id;

      const res = await request(app)
        .patch(`/api/tasks/${taskId}`)
        .set('Cookie', `token=${token}`)
        .send({ isHidden: true });
      expect(res.status).toBe(200);
      expect((res.body as { task: { isHidden: boolean } }).task.isHidden).toBe(true);
    });

    it('isHidden = true のタスクはデフォルト GET では返されない', async () => {
      const { token } = await registerUser(app, 'task_hidden2', 'task_hidden2@test.com');
      const r = await request(app)
        .post('/api/tasks')
        .set('Cookie', `token=${token}`)
        .send({ title: '非表示タスク2' });
      const taskId = (r.body as { task: { id: number } }).task.id;
      await request(app)
        .patch(`/api/tasks/${taskId}`)
        .set('Cookie', `token=${token}`)
        .send({ isHidden: true });

      const res = await request(app).get('/api/tasks').set('Cookie', `token=${token}`);
      const tasks = (res.body as { tasks: { id: number }[] }).tasks;
      expect(tasks.find((t) => t.id === taskId)).toBeUndefined();
    });

    it('?includeHidden=true を付けると非表示タスクも返される', async () => {
      const { token } = await registerUser(app, 'task_hidden3', 'task_hidden3@test.com');
      const r = await request(app)
        .post('/api/tasks')
        .set('Cookie', `token=${token}`)
        .send({ title: '非表示タスク3' });
      const taskId = (r.body as { task: { id: number } }).task.id;
      await request(app)
        .patch(`/api/tasks/${taskId}`)
        .set('Cookie', `token=${token}`)
        .send({ isHidden: true });

      const res = await request(app)
        .get('/api/tasks?includeHidden=true')
        .set('Cookie', `token=${token}`);
      const tasks = (res.body as { tasks: { id: number }[] }).tasks;
      expect(tasks.find((t) => t.id === taskId)).toBeDefined();
    });
  });

  describe('POST /tasks — sourceChannelId DB 保存', () => {
    it('sourceChannelId を指定してタスクを作成するとチャンネル紐付けが保存される', async () => {
      const { token } = await registerUser(app, 'task_sch1', 'task_sch1@test.com');
      const channelId = await createChannelReq(app, token, 'task-sch-ch1');

      const res = await request(app)
        .post('/api/tasks')
        .set('Cookie', `token=${token}`)
        .send({ title: 'チャンネル紐付けタスク', sourceChannelId: channelId });
      expect(res.status).toBe(201);
      expect((res.body as { task: { sourceChannelId: number } }).task.sourceChannelId).toBe(
        channelId,
      );
    });

    it('sourceChannelId で作成したタスクは ?channel= フィルタで返される', async () => {
      const { token } = await registerUser(app, 'task_sch2', 'task_sch2@test.com');
      const channelId = await createChannelReq(app, token, 'task-sch-ch2');

      await request(app)
        .post('/api/tasks')
        .set('Cookie', `token=${token}`)
        .send({ title: 'チャンネル直接紐付け', sourceChannelId: channelId });

      const res = await request(app)
        .get(`/api/tasks?channel=${channelId}`)
        .set('Cookie', `token=${token}`);
      expect(res.status).toBe(200);
      const tasks = (res.body as { tasks: { sourceChannelId: number }[] }).tasks;
      expect(tasks.some((t) => t.sourceChannelId === channelId)).toBe(true);
    });
  });

  describe('DELETE /tasks/:id', () => {
    it('認証なしでアクセスすると 401 を返す', async () => {
      const res = await request(app).delete('/api/tasks/1');
      expect(res.status).toBe(401);
    });

    it('タスクを削除できる（204）', async () => {
      const { token } = await registerUser(app, 'task_del1', 'task_del1@test.com');
      const r = await request(app)
        .post('/api/tasks')
        .set('Cookie', `token=${token}`)
        .send({ title: '削除対象' });
      const taskId = (r.body as { task: { id: number } }).task.id;

      const res = await request(app).delete(`/api/tasks/${taskId}`).set('Cookie', `token=${token}`);
      expect(res.status).toBe(204);
    });

    it('存在しないタスク ID は 404 を返す', async () => {
      const { token } = await registerUser(app, 'task_del2', 'task_del2@test.com');
      const res = await request(app).delete('/api/tasks/99999').set('Cookie', `token=${token}`);
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /tasks/order', () => {
    it('認証なしでアクセスすると 401 を返す', async () => {
      const res = await request(app).put('/api/tasks/order').send({ items: [] });
      expect(res.status).toBe(401);
    });

    it('タスクの並び順を更新できる（200）', async () => {
      const { token } = await registerUser(app, 'task_order1', 'task_order1@test.com');
      const r1 = await request(app)
        .post('/api/tasks')
        .set('Cookie', `token=${token}`)
        .send({ title: 'order A' });
      const r2 = await request(app)
        .post('/api/tasks')
        .set('Cookie', `token=${token}`)
        .send({ title: 'order B' });
      const id1 = (r1.body as { task: { id: number } }).task.id;
      const id2 = (r2.body as { task: { id: number } }).task.id;

      const res = await request(app)
        .put('/api/tasks/order')
        .set('Cookie', `token=${token}`)
        .send({
          items: [
            { id: id1, status: 'todo', position: 1 },
            { id: id2, status: 'todo', position: 0 },
          ],
        });
      expect(res.status).toBe(200);
    });

    it('ステータスと position を同時に更新できる（列またぎドラッグ）', async () => {
      const { token } = await registerUser(app, 'task_order2', 'task_order2@test.com');
      const r = await request(app)
        .post('/api/tasks')
        .set('Cookie', `token=${token}`)
        .send({ title: '列またぎ' });
      const taskId = (r.body as { task: { id: number } }).task.id;

      const res = await request(app)
        .put('/api/tasks/order')
        .set('Cookie', `token=${token}`)
        .send({ items: [{ id: taskId, status: 'in_progress', position: 0 }] });
      expect(res.status).toBe(200);

      // ステータスが変わっていることを確認
      const getRes = await request(app)
        .get('/api/tasks?status=in_progress')
        .set('Cookie', `token=${token}`);
      const tasks = (getRes.body as { tasks: { id: number }[] }).tasks;
      expect(tasks.some((t) => t.id === taskId)).toBe(true);
    });

    it('更新対象のタスク ID が不正な場合は 400 を返す', async () => {
      const { token } = await registerUser(app, 'task_order3', 'task_order3@test.com');
      const res = await request(app)
        .put('/api/tasks/order')
        .set('Cookie', `token=${token}`)
        .send({ items: 'not-an-array' });
      expect(res.status).toBe(400);
    });
  });
});
