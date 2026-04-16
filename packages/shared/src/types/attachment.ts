/**
 * チャンネル添付ファイル一覧の型定義
 */

export interface ChannelAttachment {
  id: number;
  messageId: number | null;
  url: string;
  originalName: string;
  size: number;
  mimeType: string;
  createdAt: string;
  /** アップロード者のユーザーID（メッセージ削除済みの場合はnull） */
  uploaderId: number | null;
  /** アップロード者のユーザー名（メッセージ削除済みの場合は'不明なユーザー'） */
  uploaderName: string;
}

export interface ChannelAttachmentsResponse {
  attachments: ChannelAttachment[];
}
