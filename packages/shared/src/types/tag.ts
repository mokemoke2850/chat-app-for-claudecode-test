// #115 タグ機能

export interface Tag {
  id: number;
  name: string;
  useCount: number;
  createdAt: string;
}

export interface TagSuggestion {
  id: number;
  name: string;
  useCount: number;
}

export interface SetTagsInput {
  names: string[];
}
