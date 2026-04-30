/**
 * テスト対象: taskService のタスク管理機能
 * 戦略: pg-mem のインメモリ PostgreSQL 互換 DB を使いサービス層を直接テストする。
 * 外部キー制約を満たすため beforeAll でユーザー・チャンネル・メッセージを挿入する。
 * タスク作成・更新・削除・フィルタ・並べ替えのビジネスロジックを検証する。
 */

import { getSharedTestDatabase, resetTestData } from './__fixtures__/pgTestHelper';

const testDb = getSharedTestDatabase();

jest.mock('../db/database', () => testDb);

describe('タスク管理機能（taskService）', () => {
  describe('タスク作成', () => {
    it('タイトルと作成者を指定してタスクを作成できる', () => {
      // TODO
    });

    it('作成されたタスクのデフォルトステータスは "todo" である', () => {
      // TODO
    });

    it('source_message_id を指定するとメッセージと紐づいたタスクが作成される', () => {
      // TODO
    });

    it('source_message_id に存在しないメッセージIDを指定するとエラーになる', () => {
      // TODO
    });

    it('担当者（assignee_id）を指定してタスクを作成できる', () => {
      // TODO
    });

    it('担当者に存在しないユーザーIDを指定するとエラーになる', () => {
      // TODO
    });

    it('due_at（期限）を指定してタスクを作成できる', () => {
      // TODO
    });

    it('position のデフォルト値は 0 である', () => {
      // TODO
    });
  });

  describe('タスク取得・フィルタ', () => {
    it('全タスクを取得できる', () => {
      // TODO
    });

    it('status フィルタで todo のタスクのみ取得できる', () => {
      // TODO
    });

    it('status フィルタで in_progress のタスクのみ取得できる', () => {
      // TODO
    });

    it('status フィルタで done のタスクのみ取得できる', () => {
      // TODO
    });

    it('assignee_id フィルタで特定ユーザーのタスクのみ取得できる', () => {
      // TODO
    });

    it('channel フィルタで特定チャンネル発のタスクのみ取得できる', () => {
      // TODO
    });

    it('複数フィルタを組み合わせて絞り込みできる（status + channel）', () => {
      // TODO
    });

    it('source_message_id が null のタスクも取得できる（直接作成タスク）', () => {
      // TODO
    });

    it('削除されたメッセージの source_message_id を持つタスクも取得できる', () => {
      // TODO
    });

    it('assignee のユーザー情報（username）が結合されて取得できる', () => {
      // TODO
    });
  });

  describe('タスク更新', () => {
    it('タイトルを更新できる', () => {
      // TODO
    });

    it('description を更新できる', () => {
      // TODO
    });

    it('ステータスを todo から in_progress に変更できる', () => {
      // TODO
    });

    it('ステータスを in_progress から done に変更できる', () => {
      // TODO
    });

    it('ステータスに無効な値を指定するとエラーになる', () => {
      // TODO
    });

    it('担当者を変更できる', () => {
      // TODO
    });

    it('担当者を null に設定して割り当てを解除できる', () => {
      // TODO
    });

    it('due_at を更新できる', () => {
      // TODO
    });

    it('存在しないタスク ID を更新しようとするとエラーになる', () => {
      // TODO
    });

    it('更新後に updated_at が更新される', () => {
      // TODO
    });
  });

  describe('タスク削除', () => {
    it('タスクを削除できる', () => {
      // TODO
    });

    it('存在しないタスク ID を削除しようとしてもエラーにならない', () => {
      // TODO
    });
  });

  describe('タスク並べ替え（position 管理）', () => {
    it('同一ステータス内で position を更新して並べ替えできる', () => {
      // TODO
    });

    it('ステータスと position を同時に更新できる（列をまたぐドラッグ）', () => {
      // TODO
    });

    it('複数タスクの position を一括更新できる', () => {
      // TODO
    });

    it('position の更新はトランザクションで行われる（途中でエラーになると全ロールバック）', () => {
      // TODO
    });
  });
});
