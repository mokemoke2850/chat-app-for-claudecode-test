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
  userId: number;
  username: string;
  avatarUrl: string | null;
  content: string; // TipTap JSON string
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  mentions: number[];
  attachments?: Attachment[];
}

export interface MessageSearchResult extends Message {
  channelName: string;
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
