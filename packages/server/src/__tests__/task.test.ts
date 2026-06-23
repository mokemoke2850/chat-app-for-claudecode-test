/**
 * テスト対象: taskService のタスク管理機能
 * 戦略: pg-mem のインメモリ PostgreSQL 互換 DB を使いサービス層を直接テストする。
 * 外部キー制約を満たすため beforeAll でユーザー・チャンネル・メッセージを挿入する。
 * タスク作成・更新・削除・フィルタ・並べ替えのビジネスロジックを検証する。
 * Issue #396 テスト観点:
 *   対象仕様:
 *   - 親子追加、依存設定、子の完了状況による親進捗、依存と期限による簡易ガント、循環防止。
 *   - 影響範囲は共有Task型、DBスキーマ、taskService、tasks API、編集ダイアログ、タスクボード。
 *   Keep:
 *   - ビジネスロジック: 親子・依存グラフの循環検出、直下の子による進捗計算。
 *   - データ整合性: 不正参照と自己参照の拒否、複合更新の原子性、削除時の参照処理。
 *   - 正常系: 関係の作成・更新・解除・取得、進捗表示、ガント表示。
 *   - 境界条件: 子なし、一部/全件完了、同日期限、期限なし、複数依存。
 *   - エラーケース: 直接/間接循環、存在しない参照、自己参照。
 *   - 連携: HTTP入出力、編集UIからAPI、一覧再取得後のカードとガント反映。
 *   - 回帰: 既存の作成・更新・削除・絞り込み・並べ替えを維持する。
 *   Prune:
 *   - 微細な見た目、MUI自体の動作、既存テストとの重複。
 *   テスト配置と分担:
 *   - サービス層でグラフ整合性、統合テストでHTTP境界、Vitestで入力・表示連携を検証する。
 *   - Playwrightで親・子2件・先行2件へ関係と異なる期限を設定し、再表示後の保持を確認する。
 *   - 子を1件、次に全件完了し、親カードの完了数と進捗率が50%、100%へ更新されることを確認する。
 *   - ガントで期限に応じた位置と長さ、依存先ごとの先行タスク表示を確認する。
 *   - 循環保存のエラーと既存関係維持、コンソールエラーと失敗通信がないことを確認する。
 */

import { createTestDatabase, resetTestData } from './__fixtures__/pgTestHelper';

const testDb = createTestDatabase();

jest.mock('../db/database', () => testDb);

import * as taskService from '../services/taskService';

let userId1: number;
let userId2: number;
let channelId1: number;
let channelId2: number;
let messageId1: number;
let messageId2: number;

beforeAll(async () => {
  // ユーザー作成
  const u1 = await testDb.queryOne<{ id: number }>(
    `INSERT INTO users (username, email, password_hash) VALUES ('user1', 'u1@test.com', 'hash') RETURNING id`,
    [],
  );
  const u2 = await testDb.queryOne<{ id: number }>(
    `INSERT INTO users (username, email, password_hash) VALUES ('user2', 'u2@test.com', 'hash') RETURNING id`,
    [],
  );
  userId1 = u1!.id;
  userId2 = u2!.id;

  // チャンネル作成
  const ch1 = await testDb.queryOne<{ id: number }>(
    `INSERT INTO channels (name) VALUES ('channel1') RETURNING id`,
    [],
  );
  const ch2 = await testDb.queryOne<{ id: number }>(
    `INSERT INTO channels (name) VALUES ('channel2') RETURNING id`,
    [],
  );
  channelId1 = ch1!.id;
  channelId2 = ch2!.id;

  // メッセージ作成
  const m1 = await testDb.queryOne<{ id: number }>(
    `INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, 'msg1') RETURNING id`,
    [channelId1, userId1],
  );
  const m2 = await testDb.queryOne<{ id: number }>(
    `INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, 'msg2') RETURNING id`,
    [channelId2, userId2],
  );
  messageId1 = m1!.id;
  messageId2 = m2!.id;
});

beforeEach(async () => {
  await testDb.execute('DELETE FROM tasks', []);
});

describe('タスク管理機能（taskService）', () => {
  describe('親子関係と進捗', () => {
    it('親タスクを指定してサブタスクを作成できる', async () => {
      const parent = await taskService.createTask(userId1, { title: '親' });
      const child = await taskService.createTask(userId1, { title: '子', parentTaskId: parent.id });
      expect(child.parentTaskId).toBe(parent.id);
    });

    it('存在しない親タスクは指定できない', async () => {
      await expect(
        taskService.createTask(userId1, { title: '子', parentTaskId: 99999 }),
      ).rejects.toThrow('Parent task not found');
    });

    it('親タスクを未設定に更新すると親子関係を解除できる', async () => {
      const parent = await taskService.createTask(userId1, { title: '親' });
      const child = await taskService.createTask(userId1, { title: '子', parentTaskId: parent.id });
      expect(
        (await taskService.updateTask(child.id, { parentTaskId: null })).parentTaskId,
      ).toBeNull();
    });

    it('親子関係を更新して循環する場合は拒否する', async () => {
      const parent = await taskService.createTask(userId1, { title: '親' });
      const child = await taskService.createTask(userId1, { title: '子', parentTaskId: parent.id });
      await expect(taskService.updateTask(parent.id, { parentTaskId: child.id })).rejects.toThrow(
        'Task relationship cycle detected',
      );
    });

    it('DB制約が親タスクの自己参照を拒否する', async () => {
      const task = await taskService.createTask(userId1, { title: '対象' });
      await expect(
        testDb.execute('UPDATE tasks SET parent_task_id = $1 WHERE id = $1', [task.id]),
      ).rejects.toThrow();
    });

    it('親タスクの進捗を一部完了した直下のサブタスク件数から算出する', async () => {
      const parent = await taskService.createTask(userId1, { title: '親' });
      await taskService.createTask(userId1, { title: '子1', parentTaskId: parent.id });
      const child2 = await taskService.createTask(userId1, {
        title: '子2',
        parentTaskId: parent.id,
      });
      await taskService.updateTask(child2.id, { status: 'done' });
      const updated = (await taskService.getTasks()).find((task) => task.id === parent.id)!;
      expect(updated).toMatchObject({ subtaskCount: 2, completedSubtaskCount: 1, progress: 50 });
    });

    it('直下のサブタスクがすべて完了すると親タスクの進捗を100%にする', async () => {
      const parent = await taskService.createTask(userId1, { title: '親' });
      const child = await taskService.createTask(userId1, { title: '子', parentTaskId: parent.id });
      await taskService.updateTask(child.id, { status: 'done' });
      expect((await taskService.getTasks()).find((task) => task.id === parent.id)?.progress).toBe(
        100,
      );
    });

    it('サブタスクがないタスクの進捗は自身のステータスから算出する', async () => {
      const task = await taskService.createTask(userId1, { title: '単独' });
      expect(task.progress).toBe(0);
      expect((await taskService.updateTask(task.id, { status: 'done' })).progress).toBe(100);
    });

    it('親タスクを削除するとサブタスクの親参照が解除される', async () => {
      const parent = await taskService.createTask(userId1, { title: '親' });
      const child = await taskService.createTask(userId1, { title: '子', parentTaskId: parent.id });
      await taskService.deleteTask(parent.id);
      expect(
        (await taskService.getTasks()).find((task) => task.id === child.id)?.parentTaskId,
      ).toBeNull();
    });
  });

  describe('依存関係', () => {
    it('先行タスクを指定して依存関係を保存・取得できる', async () => {
      const first = await taskService.createTask(userId1, { title: '先行' });
      const task = await taskService.createTask(userId1, {
        title: '後続',
        dependencyIds: [first.id],
      });
      expect(task.dependencyIds).toEqual([first.id]);
      expect(
        (await taskService.getTasks()).find((item) => item.id === task.id)?.dependencyIds,
      ).toEqual([first.id]);
    });

    it('存在しないタスクは先行タスクに指定できない', async () => {
      await expect(
        taskService.createTask(userId1, { title: '後続', dependencyIds: [99999] }),
      ).rejects.toThrow('Dependency task not found');
    });

    it('自分自身は先行タスクに指定できない', async () => {
      const task = await taskService.createTask(userId1, { title: '対象' });
      await expect(taskService.updateTask(task.id, { dependencyIds: [task.id] })).rejects.toThrow(
        'Task dependency cycle detected',
      );
    });

    it('間接的な循環依存を検出して拒否する', async () => {
      const a = await taskService.createTask(userId1, { title: 'A' });
      const b = await taskService.createTask(userId1, { title: 'B', dependencyIds: [a.id] });
      const c = await taskService.createTask(userId1, { title: 'C', dependencyIds: [b.id] });
      await expect(taskService.updateTask(a.id, { dependencyIds: [c.id] })).rejects.toThrow(
        'Task dependency cycle detected',
      );
    });

    it('依存関係を空配列で更新すると既存の依存関係を解除できる', async () => {
      const first = await taskService.createTask(userId1, { title: '先行' });
      const task = await taskService.createTask(userId1, {
        title: '後続',
        dependencyIds: [first.id],
      });
      expect((await taskService.updateTask(task.id, { dependencyIds: [] })).dependencyIds).toEqual(
        [],
      );
    });

    it('依存先タスクを削除すると依存関係も削除される', async () => {
      const first = await taskService.createTask(userId1, { title: '先行' });
      const task = await taskService.createTask(userId1, {
        title: '後続',
        dependencyIds: [first.id],
      });
      await taskService.deleteTask(first.id);
      expect(
        (await taskService.getTasks()).find((item) => item.id === task.id)?.dependencyIds,
      ).toEqual([]);
    });

    it('親と依存関係の複合更新が循環エラーになると既存の関係を保持する', async () => {
      const oldParent = await taskService.createTask(userId1, { title: '旧親' });
      const newParent = await taskService.createTask(userId1, { title: '新親' });
      const oldDependency = await taskService.createTask(userId1, { title: '旧先行' });
      const task = await taskService.createTask(userId1, {
        title: '対象',
        parentTaskId: oldParent.id,
        dependencyIds: [oldDependency.id],
      });
      const downstream = await taskService.createTask(userId1, {
        title: '後続',
        dependencyIds: [task.id],
      });
      await expect(
        taskService.updateTask(task.id, {
          parentTaskId: newParent.id,
          dependencyIds: [downstream.id],
        }),
      ).rejects.toThrow('Task dependency cycle detected');
      const unchanged = (await taskService.getTasks()).find((item) => item.id === task.id)!;
      expect(unchanged.parentTaskId).toBe(oldParent.id);
      expect(unchanged.dependencyIds).toEqual([oldDependency.id]);
    });

    it('依存関係の置換途中でDBエラーになると親と依存関係をロールバックする', async () => {
      const oldParent = await taskService.createTask(userId1, { title: '旧親' });
      const newParent = await taskService.createTask(userId1, { title: '新親' });
      const oldDependency = await taskService.createTask(userId1, { title: '旧先行' });
      const firstDependency = await taskService.createTask(userId1, { title: '新先行1' });
      const secondDependency = await taskService.createTask(userId1, { title: '新先行2' });
      const task = await taskService.createTask(userId1, {
        title: '対象',
        parentTaskId: oldParent.id,
        dependencyIds: [oldDependency.id],
      });
      const originalConnect = testDb.pool.connect.bind(testDb.pool);
      const connectSpy = jest.spyOn(testDb.pool, 'connect').mockImplementation(async () => {
        const client = await originalConnect();
        const originalQuery = client.query.bind(client);
        client.query = ((text: unknown, params?: unknown[]) => {
          if (
            typeof text === 'string' &&
            text.startsWith('INSERT INTO task_dependencies') &&
            params?.[1] === secondDependency.id
          ) {
            throw new Error('injected dependency insert failure');
          }
          return originalQuery(text as string, params);
        }) as typeof client.query;
        return client;
      });

      try {
        await expect(
          taskService.updateTask(task.id, {
            parentTaskId: newParent.id,
            dependencyIds: [firstDependency.id, secondDependency.id],
          }),
        ).rejects.toThrow('injected dependency insert failure');
      } finally {
        connectSpy.mockRestore();
      }

      const unchanged = (await taskService.getTasks()).find((item) => item.id === task.id)!;
      expect(unchanged.parentTaskId).toBe(oldParent.id);
      expect(unchanged.dependencyIds).toEqual([oldDependency.id]);
    });
  });

  describe('タスク作成', () => {
    it('タイトルと作成者を指定してタスクを作成できる', async () => {
      const task = await taskService.createTask(userId1, { title: 'テストタスク' });
      expect(task.id).toBeDefined();
      expect(task.title).toBe('テストタスク');
      expect(task.createdBy).toBe(userId1);
    });

    it('作成されたタスクのデフォルトステータスは "todo" である', async () => {
      const task = await taskService.createTask(userId1, { title: 'ステータステスト' });
      expect(task.status).toBe('todo');
    });

    it('source_message_id を指定するとメッセージと紐づいたタスクが作成される', async () => {
      const task = await taskService.createTask(userId1, {
        title: 'メッセージからのタスク',
        sourceMessageId: messageId1,
      });
      expect(task.sourceMessageId).toBe(messageId1);
      expect(task.sourceChannelId).toBe(channelId1);
    });

    it('source_message_id に存在しないメッセージIDを指定するとエラーになる', async () => {
      await expect(
        taskService.createTask(userId1, { title: 'タスク', sourceMessageId: 9999 }),
      ).rejects.toThrow('Source message not found');
    });

    it('担当者（assignee_id）を指定してタスクを作成できる', async () => {
      const task = await taskService.createTask(userId1, {
        title: '担当者ありタスク',
        assigneeId: userId2,
      });
      expect(task.assigneeId).toBe(userId2);
      expect(task.assigneeUsername).toBe('user2');
    });

    it('担当者に存在しないユーザーIDを指定するとエラーになる', async () => {
      await expect(
        taskService.createTask(userId1, { title: 'タスク', assigneeId: 9999 }),
      ).rejects.toThrow('Assignee not found');
    });

    it('due_at（期限）を指定してタスクを作成できる', async () => {
      const dueAt = '2026-12-31T00:00:00Z';
      const task = await taskService.createTask(userId1, { title: '期限ありタスク', dueAt });
      expect(task.dueAt).toBeTruthy();
    });

    it('position のデフォルト値は 0 である', async () => {
      const task = await taskService.createTask(userId1, { title: 'positionテスト' });
      expect(task.position).toBe(0);
    });
  });

  describe('タスク取得・フィルタ', () => {
    beforeEach(async () => {
      await taskService.createTask(userId1, { title: 'todo1' });
      await taskService.createTask(userId1, { title: 'todo2', assigneeId: userId2 });
      const task3 = await taskService.createTask(userId1, {
        title: 'inprogress1',
        sourceMessageId: messageId1,
      });
      await taskService.updateTask(task3.id, { status: 'in_progress' });
      const task4 = await taskService.createTask(userId1, {
        title: 'done1',
        sourceMessageId: messageId2,
      });
      await taskService.updateTask(task4.id, { status: 'done' });
    });

    it('全タスクを取得できる', async () => {
      const tasks = await taskService.getTasks();
      expect(tasks.length).toBe(4);
    });

    it('status フィルタで todo のタスクのみ取得できる', async () => {
      const tasks = await taskService.getTasks({ status: 'todo' });
      expect(tasks.every((t) => t.status === 'todo')).toBe(true);
      expect(tasks.length).toBe(2);
    });

    it('status フィルタで in_progress のタスクのみ取得できる', async () => {
      const tasks = await taskService.getTasks({ status: 'in_progress' });
      expect(tasks.length).toBe(1);
      expect(tasks[0].title).toBe('inprogress1');
    });

    it('status フィルタで done のタスクのみ取得できる', async () => {
      const tasks = await taskService.getTasks({ status: 'done' });
      expect(tasks.length).toBe(1);
      expect(tasks[0].title).toBe('done1');
    });

    it('assignee_id フィルタで特定ユーザーのタスクのみ取得できる', async () => {
      const tasks = await taskService.getTasks({ assigneeId: userId2 });
      expect(tasks.length).toBe(1);
      expect(tasks[0].title).toBe('todo2');
    });

    it('channel フィルタで特定チャンネル発のタスクのみ取得できる', async () => {
      const tasks = await taskService.getTasks({ channelId: channelId1 });
      expect(tasks.length).toBe(1);
      expect(tasks[0].title).toBe('inprogress1');
    });

    it('複数フィルタを組み合わせて絞り込みできる（status + channel）', async () => {
      const tasks = await taskService.getTasks({ status: 'done', channelId: channelId2 });
      expect(tasks.length).toBe(1);
      expect(tasks[0].title).toBe('done1');
    });

    it('source_message_id が null のタスクも取得できる（直接作成タスク）', async () => {
      const tasks = await taskService.getTasks();
      const directTasks = tasks.filter((t) => t.sourceMessageId === null);
      expect(directTasks.length).toBeGreaterThan(0);
    });

    it('削除されたメッセージの source_message_id を持つタスクも取得できる', async () => {
      // メッセージを削除フラグ立てで更新（FKは残る）
      await testDb.execute('UPDATE messages SET is_deleted = true WHERE id = $1', [messageId1]);
      const tasks = await taskService.getTasks();
      const taskWithMsg = tasks.find((t) => t.sourceMessageId === messageId1);
      expect(taskWithMsg).toBeDefined();
      // リセット
      await testDb.execute('UPDATE messages SET is_deleted = false WHERE id = $1', [messageId1]);
    });

    it('assignee のユーザー情報（username）が結合されて取得できる', async () => {
      const tasks = await taskService.getTasks({ assigneeId: userId2 });
      expect(tasks[0].assigneeUsername).toBe('user2');
    });
  });

  describe('非表示フラグ（isHidden）', () => {
    it('作成されたタスクのデフォルトは isHidden = false である', async () => {
      const task = await taskService.createTask(userId1, { title: '非表示テスト' });
      expect(task.isHidden).toBe(false);
    });

    it('isHidden を true に更新すると非表示タスクになる', async () => {
      const task = await taskService.createTask(userId1, { title: '非表示にするタスク' });
      const updated = await taskService.updateTask(task.id, { isHidden: true });
      expect(updated.isHidden).toBe(true);
    });

    it('isHidden = false のときデフォルト（includeHidden 未指定）で取得できる', async () => {
      await taskService.createTask(userId1, { title: '表示タスク' });
      const tasks = await taskService.getTasks();
      expect(tasks.some((t) => t.title === '表示タスク')).toBe(true);
    });

    it('isHidden = true のタスクはデフォルトの getTasks で取得されない', async () => {
      const task = await taskService.createTask(userId1, { title: '非表示タスク' });
      await taskService.updateTask(task.id, { isHidden: true });
      const tasks = await taskService.getTasks();
      expect(tasks.find((t) => t.id === task.id)).toBeUndefined();
    });

    it('includeHidden = true を指定すると非表示タスクも取得できる', async () => {
      const task = await taskService.createTask(userId1, { title: '非表示タスク2' });
      await taskService.updateTask(task.id, { isHidden: true });
      const tasks = await taskService.getTasks({ includeHidden: true });
      expect(tasks.find((t) => t.id === task.id)).toBeDefined();
    });
  });

  describe('sourceChannelId DB 保存', () => {
    it('sourceChannelId を指定してタスクを作成するとチャンネル紐付けが保存される', async () => {
      const task = await taskService.createTask(userId1, {
        title: 'チャンネル紐付けタスク',
        sourceChannelId: channelId1,
      });
      expect(task.sourceChannelId).toBe(channelId1);
    });

    it('sourceChannelId で作成したタスクは channelId フィルタで取得できる', async () => {
      await taskService.createTask(userId1, {
        title: 'チャンネル直接紐付け',
        sourceChannelId: channelId1,
      });
      const tasks = await taskService.getTasks({ channelId: channelId1 });
      expect(tasks.some((t) => t.title === 'チャンネル直接紐付け')).toBe(true);
    });

    it('存在しないチャンネルIDを sourceChannelId に指定するとエラーになる', async () => {
      await expect(
        taskService.createTask(userId1, { title: 'タスク', sourceChannelId: 9999 }),
      ).rejects.toThrow('Source channel not found');
    });
  });

  describe('タスク更新', () => {
    let taskId: number;

    beforeEach(async () => {
      const task = await taskService.createTask(userId1, {
        title: '更新テスト',
        assigneeId: userId1,
      });
      taskId = task.id;
    });

    it('タイトルを更新できる', async () => {
      const updated = await taskService.updateTask(taskId, { title: '新しいタイトル' });
      expect(updated.title).toBe('新しいタイトル');
    });

    it('description を更新できる', async () => {
      const updated = await taskService.updateTask(taskId, { description: '説明文' });
      expect(updated.description).toBe('説明文');
    });

    it('ステータスを todo から in_progress に変更できる', async () => {
      const updated = await taskService.updateTask(taskId, { status: 'in_progress' });
      expect(updated.status).toBe('in_progress');
    });

    it('ステータスを in_progress から done に変更できる', async () => {
      await taskService.updateTask(taskId, { status: 'in_progress' });
      const updated = await taskService.updateTask(taskId, { status: 'done' });
      expect(updated.status).toBe('done');
    });

    it('ステータスに無効な値を指定するとエラーになる', async () => {
      await expect(taskService.updateTask(taskId, { status: 'invalid' as never })).rejects.toThrow(
        'Invalid status',
      );
    });

    it('担当者を変更できる', async () => {
      const updated = await taskService.updateTask(taskId, { assigneeId: userId2 });
      expect(updated.assigneeId).toBe(userId2);
    });

    it('担当者を null に設定して割り当てを解除できる', async () => {
      const updated = await taskService.updateTask(taskId, { assigneeId: null });
      expect(updated.assigneeId).toBeNull();
    });

    it('due_at を更新できる', async () => {
      const updated = await taskService.updateTask(taskId, { dueAt: '2027-01-01T00:00:00Z' });
      expect(updated.dueAt).toBeTruthy();
    });

    it('存在しないタスク ID を更新しようとするとエラーになる', async () => {
      await expect(taskService.updateTask(9999, { title: '更新' })).rejects.toThrow(
        'Task not found',
      );
    });

    it('更新後に updated_at が更新される', async () => {
      const before = await taskService.createTask(userId1, { title: '時刻テスト' });
      await new Promise((r) => setTimeout(r, 10));
      const after = await taskService.updateTask(before.id, { title: '更新後' });
      expect(new Date(after.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(before.updatedAt).getTime(),
      );
    });
  });

  describe('タスク削除', () => {
    it('タスクを削除できる', async () => {
      const task = await taskService.createTask(userId1, { title: '削除対象' });
      await taskService.deleteTask(task.id);
      const tasks = await taskService.getTasks();
      expect(tasks.find((t) => t.id === task.id)).toBeUndefined();
    });

    it('存在しないタスク ID を削除しようとしてもエラーにならない', async () => {
      await expect(taskService.deleteTask(9999)).resolves.toBeUndefined();
    });
  });

  describe('タスク並べ替え（position 管理）', () => {
    it('同一ステータス内で position を更新して並べ替えできる', async () => {
      const t1 = await taskService.createTask(userId1, { title: 'タスク1' });
      const t2 = await taskService.createTask(userId1, { title: 'タスク2' });

      await taskService.updateTaskOrder([
        { id: t1.id, status: 'todo', position: 1 },
        { id: t2.id, status: 'todo', position: 0 },
      ]);

      const tasks = await taskService.getTasks({ status: 'todo' });
      const updated1 = tasks.find((t) => t.id === t1.id)!;
      const updated2 = tasks.find((t) => t.id === t2.id)!;
      expect(updated1.position).toBe(1);
      expect(updated2.position).toBe(0);
    });

    it('ステータスと position を同時に更新できる（列をまたぐドラッグ）', async () => {
      const task = await taskService.createTask(userId1, { title: '列またぎ' });
      expect(task.status).toBe('todo');

      await taskService.updateTaskOrder([{ id: task.id, status: 'in_progress', position: 0 }]);

      const tasks = await taskService.getTasks({ status: 'in_progress' });
      const updated = tasks.find((t) => t.id === task.id)!;
      expect(updated.status).toBe('in_progress');
      expect(updated.position).toBe(0);
    });

    it('複数タスクの position を一括更新できる', async () => {
      const tasks = await Promise.all(
        ['A', 'B', 'C'].map((name) => taskService.createTask(userId1, { title: name })),
      );

      await taskService.updateTaskOrder(
        tasks.map((t, i) => ({
          id: t.id,
          status: 'todo' as const,
          position: tasks.length - 1 - i,
        })),
      );

      const updated = await taskService.getTasks({ status: 'todo' });
      // position が逆順になっていること
      const positions = tasks.map((t) => updated.find((u) => u.id === t.id)!.position);
      expect(positions[0]).toBe(tasks.length - 1);
      expect(positions[tasks.length - 1]).toBe(0);
    });

    it('position の更新はトランザクションで行われる（途中でエラーになると全ロールバック）', async () => {
      const task = await taskService.createTask(userId1, { title: 'ロールバックテスト' });

      await expect(
        taskService.updateTaskOrder([
          { id: task.id, status: 'todo', position: 1 },
          { id: task.id, status: 'invalid' as never, position: 2 },
        ]),
      ).rejects.toThrow('Invalid status');
    });
  });
});
