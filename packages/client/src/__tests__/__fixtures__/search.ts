import type { MessageSearchResult } from '@chat-app/shared';

/**
 * テスト共通フィクスチャ: 検索結果（MessageSearchResult）ファクトリ
 * 各テストで必要なフィールドだけ overrides で上書きして使う。
 */
export function makeSearchResult(
  overrides: Partial<MessageSearchResult> = {},
): MessageSearchResult {
  return {
    id: 1,
    channelId: 10,
    channelName: 'general',
    userId: 1,
    username: 'alice',
    avatarUrl: null,
    content: JSON.stringify({ ops: [{ insert: 'テスト投稿\n' }] }),
    isEdited: false,
    isDeleted: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    mentions: [],
    reactions: [],
    parentMessageId: null,
    rootMessageId: null,
    replyCount: 0,
    rootMessageContent: null,
    quotedMessageId: null,
    quotedMessage: null,
    ...overrides,
  };
}
