export interface Channel {
  id: number;
  name: string;
  description: string | null;
  topic: string | null;
  createdBy: number | null;
  createdAt: string;
  isPrivate: boolean;
  unreadCount: number;
  mentionCount?: number;
  isArchived?: boolean;
  isRecommended?: boolean;
  tags?: import('./tag').Tag[];
}

export interface UpdateChannelTopicInput {
  topic?: string | null;
  description?: string | null;
}

export interface CreateChannelInput {
  name: string;
  description?: string;
  isPrivate?: boolean;
}

export interface PinnedChannel {
  id: number;
  userId: number;
  channelId: number;
  createdAt: string;
}

// #109 通知設定のカスタマイズ
export type ChannelNotificationLevel = 'all' | 'mentions' | 'muted';

export interface ChannelNotificationSetting {
  channelId: number;
  level: ChannelNotificationLevel;
  updatedAt: string;
}
