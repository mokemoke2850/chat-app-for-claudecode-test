import type { DmConversationWithDetails, DmMessage } from '@chat-app/shared';

/**
 * テスト共通フィクスチャ: DM 会話 / DM メッセージファクトリ
 * 各テストで必要なフィールドだけ overrides で上書きして使う。
 */
export function makeConversation(
  overrides: Partial<DmConversationWithDetails> = {},
): DmConversationWithDetails {
  return {
    id: 1,
    userAId: 1,
    userBId: 2,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    otherUser: { id: 2, username: 'bob', displayName: null, avatarUrl: null },
    unreadCount: 0,
    lastMessage: null,
    ...overrides,
  };
}

export function makeDmMessage(overrides: Partial<DmMessage> = {}): DmMessage {
  return {
    id: 1,
    conversationId: 1,
    senderId: 2,
    senderUsername: 'bob',
    senderAvatarUrl: null,
    content: 'こんにちは',
    isRead: false,
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}
