import type { Message } from './message';

export interface ServerToClientEvents {
  new_message: (message: Message) => void;
  message_edited: (message: Message) => void;
  message_deleted: (data: { messageId: number; channelId: number }) => void;
  message_restored: (message: Message) => void;
  user_typing: (data: { userId: number; username: string; channelId: number }) => void;
  user_stopped_typing: (data: { userId: number; channelId: number }) => void;
  error: (message: string) => void;
}

export interface ClientToServerEvents {
  join_channel: (channelId: number) => void;
  leave_channel: (channelId: number) => void;
  send_message: (data: {
    channelId: number;
    content: string;
    mentionedUserIds?: number[];
    attachmentIds?: number[];
  }) => void;
  edit_message: (data: {
    messageId: number;
    content: string;
    mentionedUserIds?: number[];
    attachmentIds?: number[];
  }) => void;
  delete_message: (messageId: number) => void;
  restore_message: (messageId: number) => void;
  typing_start: (channelId: number) => void;
  typing_stop: (channelId: number) => void;
}

export interface InterServerEvents {}

export interface SocketData {
  userId: number;
  username: string;
}
