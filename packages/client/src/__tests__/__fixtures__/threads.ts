import type { ThreadSummary } from '@chat-app/shared';
import { makeMessage } from './messages';

/**
 * テスト共通フィクスチャ: ThreadSummary ファクトリ
 * rootMessage は makeMessage を再利用し、各テストで overrides で上書きして使う。
 */
export function makeThread(overrides: Partial<ThreadSummary> = {}): ThreadSummary {
  return {
    rootMessage: makeMessage(),
    channelName: 'general',
    replyCount: 1,
    lastReplyAt: '2026-05-02T12:30:00Z',
    unreadCount: 0,
    ...overrides,
  };
}
