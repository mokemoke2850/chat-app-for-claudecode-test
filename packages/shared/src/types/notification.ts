import type { OffsetPaged } from './pagination';

export type AppNotificationType = 'mention' | 'dm' | 'reminder' | 'scheduled_message_failed';

export interface AppNotification {
  id: number;
  type: AppNotificationType;
  sourceId: number;
  title: string;
  body: string;
  channelId: number | null;
  messageId: number | null;
  conversationId: number | null;
  isRead: boolean;
  createdAt: string;
}

export type AppNotificationPage = OffsetPaged<AppNotification> & { unreadCount: number };
