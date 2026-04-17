import type { Message } from './message';

export interface Reminder {
  id: number;
  userId: number;
  messageId: number;
  remindAt: string;
  isSent: boolean;
  createdAt: string;
  message?: Message;
}

export interface ReminderCreateRequest {
  messageId: number;
  remindAt: string;
}

export interface ReminderListResponse {
  reminders: Reminder[];
}

export interface ReminderCreateResponse {
  reminder: Reminder;
}
