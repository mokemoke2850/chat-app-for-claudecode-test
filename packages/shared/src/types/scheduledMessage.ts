// #110 予約送信
import type { Attachment } from './message';

export type ScheduledMessageStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'canceled';

export interface ScheduledMessage {
  id: number;
  userId: number;
  channelId: number;
  content: string;
  scheduledAt: string;
  status: ScheduledMessageStatus;
  error: string | null;
  sentMessageId: number | null;
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateScheduledMessageInput {
  channelId: number;
  content: string;
  scheduledAt: string;
  attachmentIds?: number[];
}

export interface UpdateScheduledMessageInput {
  content?: string;
  scheduledAt?: string;
  attachmentIds?: number[];
}
