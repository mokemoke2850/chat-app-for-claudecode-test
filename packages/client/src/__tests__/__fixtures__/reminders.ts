import type { Reminder } from '@chat-app/shared';
import { makeMessage } from './messages';

/**
 * テスト共通フィクスチャ: Reminder ファクトリ
 * message は makeMessage を再利用し、各テストで overrides で上書きして使う。
 */
export function makeReminder(overrides: Partial<Reminder> = {}): Reminder {
  return {
    id: 1,
    userId: 1,
    messageId: 10,
    remindAt: '2026-05-10T09:00:00Z',
    isSent: false,
    createdAt: '2026-05-01T00:00:00Z',
    message: makeMessage({
      id: 10,
      content: JSON.stringify({ ops: [{ insert: 'スプリントレビュー\n' }] }),
      createdAt: '2026-05-01T00:00:00Z',
      updatedAt: '2026-05-01T00:00:00Z',
    }),
    ...overrides,
  };
}
