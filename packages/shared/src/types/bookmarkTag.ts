// #304 ブックマーク検索＋タグ付け

export interface BookmarkTag {
  id: number;
  userId: number;
  name: string;
  color?: string | null;
  bookmarkCount?: number;
  createdAt: string;
}

export interface CreateBookmarkTagInput {
  name: string;
  color?: string | null;
}

export interface UpdateBookmarkTagInput {
  name?: string;
  color?: string | null;
}

/** ブックマーク取得時のフィルタ条件 */
export interface BookmarkListFilters {
  search?: string;
  tagIds?: number[];
  /** 'and' は全タグ保有、'or' はいずれか保有。未指定時は 'or' */
  tagMode?: 'and' | 'or';
  /** true でタグ無しブックマークのみ */
  untagged?: boolean;
}
