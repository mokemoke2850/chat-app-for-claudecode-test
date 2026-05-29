import type { Task } from '@chat-app/shared';

/**
 * テスト共通フィクスチャ: Task ファクトリ
 * 各テストで必要なフィールドだけ overrides で上書きして使う。
 */
export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 1,
    title: 'タスク',
    status: 'todo',
    description: null,
    assigneeId: null,
    assigneeUsername: null,
    dueAt: null,
    sourceMessageId: null,
    sourceChannelId: null,
    createdBy: 1,
    position: 0,
    isHidden: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}
