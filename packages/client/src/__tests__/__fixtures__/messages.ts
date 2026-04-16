import type { Message } from '@chat-app/shared';

/**
 * テスト共通フィクスチャ: Message オブジェクトファクトリ
 * 各テストで必要なフィールドだけ overrides で上書きして使う
 */
export function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 1,
    channelId: 1,
    userId: 1,
    username: 'alice',
    avatarUrl: null,
    content: JSON.stringify({ ops: [{ insert: 'Hello world\n' }] }),
    isEdited: false,
    isDeleted: false,
    createdAt: '2024-06-01T12:00:00Z',
    updatedAt: '2024-06-01T12:00:00Z',
    mentions: [],
    reactions: [],
    parentMessageId: null,
    rootMessageId: null,
    replyCount: 0,
    quotedMessageId: null,
    quotedMessage: null,
    ...overrides,
  };
}
