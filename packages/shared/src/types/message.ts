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
  /**
   * Quill Delta JSON string (RichEditor が JSON.stringify(quill.getContents()) で保存する形式)。
   * 旧データ互換のため TipTap JSON / プレーンテキストが混在する場合は
   * `utils/extractMessageText.ts` で吸収する。
   */
  content: string;
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

export interface MessageEditHistory {
  id: number;
  messageId: number;
  content: string;
  editorId: number | null;
  editorUsername: string;
  editedAt: string;
}

export interface MessageSearchResult extends Message {
  channelName: string;
  rootMessageContent: string | null;
  /** 検索結果の会話種別。既存レスポンス互換のためチャンネルは省略可能。 */
  resultType?: 'channel' | 'dm';
  /** DM検索結果の場合の会話ID。 */
  conversationId?: number | null;
}

export interface MessageSearchFilters {
  dateFrom?: string;
  dateTo?: string;
  userId?: number;
  hasAttachment?: boolean;
  tagIds?: number[];
  /** 現在のユーザー (AuthenticatedRequest.user.id) にメンションされたメッセージのみに絞る */
  mentionedToMe?: boolean;
  /** mentionedToMe と組み合わせて is_read = false のメンションのみに絞る */
  unreadOnly?: boolean;
  /** in:channel チップ構文で指定するチャンネル ID */
  channelId?: number;
  /** ページング: 1 ページあたりの件数（#375。未指定時はサービス側既定値） */
  limit?: number;
  /** ページング: 先頭からのスキップ件数（#375。未指定時は 0） */
  offset?: number;
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
  categoryId: number | null;
  category: PinCategory | null;
  message?: Message;
  pinnedByUser?: import('./user').User;
}

export interface PinCategory {
  id: number;
  channelId: number;
  name: string;
  isDefault: boolean;
  position: number;
}
