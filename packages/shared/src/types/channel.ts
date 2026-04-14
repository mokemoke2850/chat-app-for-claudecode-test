export interface Channel {
  id: number;
  name: string;
  description: string | null;
  createdBy: number | null;
  createdAt: string;
  isPrivate: boolean;
  unreadCount: number;
  mentionCount?: number;
}

export interface CreateChannelInput {
  name: string;
  description?: string;
  isPrivate?: boolean;
}
