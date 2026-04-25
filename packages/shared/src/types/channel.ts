// #113 投稿権限制御チャンネル
// - everyone: 全員投稿可能（既定）
// - admins:   管理者のみ投稿可能（users.role = 'admin'）
// - readonly: 閲覧専用（管理者を含め全員投稿不可）
export type ChannelPostingPermission = 'everyone' | 'admins' | 'readonly';

export interface Channel {
  id: number;
  name: string;
  description: string | null;
  topic: string | null;
  createdBy: number | null;
  createdAt: string;
  isPrivate: boolean;
  postingPermission: ChannelPostingPermission;
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
  postingPermission?: ChannelPostingPermission;
}

export interface UpdateChannelPostingPermissionInput {
  postingPermission: ChannelPostingPermission;
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
