// 保存ビュー型定義 (#150)

/** 保存ビューのクエリ条件 */
export interface SavedViewQuery {
  keyword?: string;
  dateFrom?: string;
  dateTo?: string;
  userId?: number;
  channelId?: number;
  hasAttachment?: boolean;
  tagIds?: number[];
}

/** 保存ビュー */
export interface SavedView {
  id: number;
  userId: number;
  name: string;
  query: SavedViewQuery;
  position: number;
  createdAt: string;
  updatedAt: string;
}

/** 保存ビュー作成リクエスト */
export interface CreateSavedViewInput {
  name: string;
  query: SavedViewQuery;
}

/** 保存ビュー更新リクエスト */
export interface UpdateSavedViewInput {
  name?: string;
  query?: SavedViewQuery;
}
