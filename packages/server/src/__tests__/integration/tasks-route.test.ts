/**
 * テスト対象: tasks APIルート（GET/POST/PATCH/DELETE /tasks, PUT /tasks/order）
 * 戦略: supertest で HTTP エンドポイントを検証する統合テスト。
 * pg-mem のインメモリ DB を使用し、JWT 認証をモックして各エンドポイントの
 * リクエスト/レスポンスとステータスコードを検証する。
 */

import { getSharedTestDatabase, resetTestData } from '../__fixtures__/pgTestHelper';

const testDb = getSharedTestDatabase();

jest.mock('../../db/database', () => testDb);

describe('タスク管理 APIルート', () => {
  describe('GET /tasks', () => {
    it('認証なしでアクセスすると 401 を返す', () => {
      // TODO
    });

    it('認証済みユーザーがタスク一覧を取得できる（200）', () => {
      // TODO
    });

    it('?status=todo でフィルタしたタスクを返す', () => {
      // TODO
    });

    it('?status=in_progress でフィルタしたタスクを返す', () => {
      // TODO
    });

    it('?status=done でフィルタしたタスクを返す', () => {
      // TODO
    });

    it('?assignee={userId} でフィルタしたタスクを返す', () => {
      // TODO
    });

    it('?channel={channelId} でフィルタしたタスクを返す', () => {
      // TODO
    });
  });

  describe('POST /tasks', () => {
    it('認証なしでアクセスすると 401 を返す', () => {
      // TODO
    });

    it('必須フィールド（title）を含むリクエストでタスクを作成できる（201）', () => {
      // TODO
    });

    it('title が空のリクエストは 400 を返す', () => {
      // TODO
    });

    it('source_message_id を含むリクエストでタスクを作成できる', () => {
      // TODO
    });

    it('作成されたタスクのデフォルトステータスは todo である', () => {
      // TODO
    });
  });

  describe('PATCH /tasks/:id', () => {
    it('認証なしでアクセスすると 401 を返す', () => {
      // TODO
    });

    it('タスクのフィールドを更新できる（200）', () => {
      // TODO
    });

    it('存在しないタスク ID は 404 を返す', () => {
      // TODO
    });

    it('ステータスを変更できる', () => {
      // TODO
    });
  });

  describe('DELETE /tasks/:id', () => {
    it('認証なしでアクセスすると 401 を返す', () => {
      // TODO
    });

    it('タスクを削除できる（204）', () => {
      // TODO
    });

    it('存在しないタスク ID は 404 を返す', () => {
      // TODO
    });
  });

  describe('PUT /tasks/order', () => {
    it('認証なしでアクセスすると 401 を返す', () => {
      // TODO
    });

    it('タスクの並び順を更新できる（200）', () => {
      // TODO
    });

    it('ステータスと position を同時に更新できる（列またぎドラッグ）', () => {
      // TODO
    });

    it('更新対象のタスク ID が不正な場合は 400 を返す', () => {
      // TODO
    });
  });
});
