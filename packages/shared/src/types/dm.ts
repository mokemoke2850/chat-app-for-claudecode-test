export interface DmMessage {
  id: number;
  conversationId: number;
  senderId: number;
  senderUsername: string;
  senderAvatarUrl: string | null;
  content: string;
  isRead: boolean;
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DmMessageEditHistory {
  id: number;
  messageId: number;
  content: string;
  editorId: number | null;
  editorUsername: string;
  editedAt: string;
}

export interface DmConversation {
  id: number;
  userAId: number;
  userBId: number;
  createdAt: string;
  updatedAt: string;
}

export interface DmConversationWithDetails extends DmConversation {
  /** 自分から見た相手ユーザー */
  otherUser: {
    id: number;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  unreadCount: number;
  lastMessage: {
    content: string;
    createdAt: string;
    senderId: number;
  } | null;
}
