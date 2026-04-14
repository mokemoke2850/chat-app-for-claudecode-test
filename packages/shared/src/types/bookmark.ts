export interface Bookmark {
  id: number;
  userId: number;
  messageId: number;
  bookmarkedAt: string;
  message?: import('./message').Message;
  channelName?: string;
}

export interface BookmarkListResponse {
  bookmarks: Bookmark[];
}
