import type { Channel, Message } from '@chat-app/shared';

/**
 * テスト共通フィクスチャ: Channel / Message ファクトリ（ChannelList テスト用）
 */
export function makeChannel(id: number, name: string, isPrivate = false, unreadCount = 0): Channel {
  return {
    id,
    name,
    description: null,
    createdBy: 1,
    createdAt: '2024-01-01T00:00:00Z',
    isPrivate,
    unreadCount,
  };
}

export function makeChannelMessage(id: number, channelId: number): Message {
  return {
    id,
    channelId,
    userId: 1,
    username: 'user',
    avatarUrl: null,
    content: 'test',
    isEdited: false,
    isDeleted: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    mentions: [],
    attachments: [],
    reactions: [],
    parentMessageId: null,
    rootMessageId: null,
    replyCount: 0,
    quotedMessageId: null,
    quotedMessage: null,
  };
}
