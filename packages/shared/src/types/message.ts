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
}

export interface SendMessageInput {
  channelId: number;
  content: string;
  mentionedUserIds?: number[];
}

export interface EditMessageInput {
  content: string;
  mentionedUserIds?: number[];
}
