import type { Tag } from './tag';

export interface WikiPage {
  id: number;
  channelId: number;
  title: string;
  content: string;
  createdBy: number | null;
  createdByUsername?: string | null;
  updatedBy: number | null;
  updatedByUsername?: string | null;
  createdAt: string;
  updatedAt: string;
  tags: Tag[];
}

export interface WikiPageSummary {
  id: number;
  channelId: number;
  title: string;
  createdBy: number | null;
  createdByUsername?: string | null;
  updatedBy: number | null;
  updatedByUsername?: string | null;
  createdAt: string;
  updatedAt: string;
  tags: Tag[];
}

export interface CreateWikiPageInput {
  title: string;
  content?: string;
  tagIds?: number[];
}

export interface UpdateWikiPageInput {
  title?: string;
  content?: string;
  tagIds?: number[];
  expectedUpdatedAt: string;
}

export interface WikiPageListResponse {
  pages: WikiPageSummary[];
}

export interface WikiPageResponse {
  page: WikiPage;
}
