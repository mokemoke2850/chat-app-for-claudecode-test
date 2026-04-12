export interface Reaction {
  emoji: string;
  count: number;
  userIds: number[];
}

export interface Attachment {
  id: number;
  url: string;
  originalName: string;
  size: number;
  mimeType: string;
}

export interface Message {
  id: number;
  channelId: number;
  userId: number | null;
  username: string;
  avatarUrl: string | null;
  content: string; // TipTap JSON string
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  mentions: number[];
  attachments?: Attachment[];
  reactions: Reaction[];
  parentMessageId: number | null;
  rootMessageId: number | null;
  replyCount: number;
}

export interface MessageSearchResult extends Message {
  channelName: string;
  rootMessageContent: string | null;
}

export interface SendMessageInput {
  channelId: number;
  content: string;
  mentionedUserIds?: number[];
  attachmentIds?: number[];
}

export interface EditMessageInput {
  content: string;
  mentionedUserIds?: number[];
}
