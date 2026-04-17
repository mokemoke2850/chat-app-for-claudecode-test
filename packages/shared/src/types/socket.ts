import type { Message, Reaction } from './message';
import type { DmMessage } from './dm';

export interface ServerToClientEvents {
  new_message: (message: Message) => void;
  new_thread_reply: (data: {
    reply: Message;
    rootMessageId: number;
    channelId: number;
    replyCount: number;
  }) => void;
  message_edited: (message: Message) => void;
  message_deleted: (data: { messageId: number; channelId: number }) => void;
  message_restored: (message: Message) => void;
  user_typing: (data: { userId: number; username: string; channelId: number }) => void;
  user_stopped_typing: (data: { userId: number; channelId: number }) => void;
  error: (message: string) => void;
  reaction_updated: (data: { messageId: number; channelId: number; reactions: Reaction[] }) => void;
  message_pinned: (data: {
    messageId: number;
    channelId: number;
    pinnedBy: number;
    pinnedAt: string;
  }) => void;
  message_unpinned: (data: { messageId: number; channelId: number }) => void;
  pinned_messages_list: (data: {
    channelId: number;
    pinnedMessages: import('./message').PinnedMessage[];
  }) => void;
  mention_updated: (data: { channelId: number; mentionCount: number }) => void;
  new_dm_message: (message: DmMessage) => void;
  dm_notification: (data: { conversationId: number; unreadCount: number }) => void;
  dm_user_typing: (data: { conversationId: number; userId: number; username: string }) => void;
  dm_user_stopped_typing: (data: { conversationId: number; userId: number }) => void;
  notification: (data: {
    type: 'reminder';
    reminderId: number;
    messageId: number;
    messageContent: string;
    remindAt: string;
  }) => void;
}

export interface ClientToServerEvents {
  join_channel: (channelId: number) => void;
  leave_channel: (channelId: number) => void;
  send_message: (data: {
    channelId: number;
    content: string;
    mentionedUserIds?: number[];
    attachmentIds?: number[];
    quotedMessageId?: number;
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
  add_reaction: (data: { messageId: number; emoji: string }) => void;
  remove_reaction: (data: { messageId: number; emoji: string }) => void;
  send_thread_reply: (data: {
    parentMessageId: number;
    rootMessageId: number;
    content: string;
    mentionedUserIds?: number[];
    attachmentIds?: number[];
  }) => void;
  pin_message: (data: { messageId: number; channelId: number }) => void;
  unpin_message: (data: { messageId: number; channelId: number }) => void;
  send_dm: (data: { conversationId: number; content: string }) => void;
  dm_typing_start: (conversationId: number) => void;
  dm_typing_stop: (conversationId: number) => void;
}

export interface InterServerEvents {}

export interface SocketData {
  userId: number;
  username: string;
}
