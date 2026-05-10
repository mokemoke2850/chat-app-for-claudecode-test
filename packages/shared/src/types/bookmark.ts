export interface Bookmark {
  id: number;
  userId: number;
  messageId: number;
  bookmarkedAt: string;
  message?: import('./message').Message;
  channelName?: string;
  /** #304 付与されたタグ（取得時のみ。空配列または undefined はタグなし） */
  tags?: import('./bookmarkTag').BookmarkTag[];
}

export interface BookmarkListResponse {
  bookmarks: Bookmark[];
}
