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

export interface QuotedMessage {
  id: number;
  content: string;
  username: string;
  createdAt: string;
  /**
   * #107 + #108 — 引用元 / 転送元メッセージがイベント投稿の場合の概要。
   * 転送ヘッダーや引用ヘッダー領域でイベントの概要を描画するために使用する。
   * イベントメッセージでない場合は null。
   */
  event?: import('./event').ChatEvent | null;
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
  quotedMessageId: number | null;
  quotedMessage: QuotedMessage | null;
  forwardedFromMessageId?: number | null;
  forwardedFromMessage?: QuotedMessage | null;
  tags?: import('./tag').Tag[];
  /** #108 会話イベント — イベント投稿メッセージのときのみ非 null */
  event?: import('./event').ChatEvent | null;
}

export interface MessageSearchResult extends Message {
  channelName: string;
  rootMessageContent: string | null;
}

export interface MessageSearchFilters {
  dateFrom?: string;
  dateTo?: string;
  userId?: number;
  hasAttachment?: boolean;
  tagIds?: number[];
}

export interface SendMessageInput {
  channelId: number;
  content: string;
  mentionedUserIds?: number[];
  attachmentIds?: number[];
  quotedMessageId?: number;
}

export interface EditMessageInput {
  content: string;
  mentionedUserIds?: number[];
}

export interface ForwardMessageInput {
  targetChannelId: number;
  comment?: string;
}

export interface PinnedMessage {
  id: number;
  messageId: number;
  channelId: number;
  pinnedBy: number;
  pinnedAt: string;
  message?: Message;
  pinnedByUser?: import('./user').User;
}
