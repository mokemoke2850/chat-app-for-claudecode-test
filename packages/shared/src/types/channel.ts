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
