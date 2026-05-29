import type { WikiPage, WikiPageSummary } from '@chat-app/shared';

/**
 * テスト共通フィクスチャ: Wiki ページ / 一覧サマリーファクトリ
 * 各テストで必要なフィールドだけ overrides で上書きして使う。
 */
export function makeWikiPage(overrides: Partial<WikiPage> = {}): WikiPage {
  return {
    id: 1,
    channelId: 100,
    title: 'タイトル',
    content: '# 見出し\n本文',
    createdBy: 1,
    createdByUsername: 'alice',
    updatedBy: 1,
    updatedByUsername: 'alice',
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-05-01T00:00:00Z',
    tags: [],
    ...overrides,
  };
}

export function makeWikiPageSummary(overrides: Partial<WikiPageSummary> = {}): WikiPageSummary {
  return {
    id: 1,
    channelId: 100,
    title: 'タイトル',
    createdBy: 1,
    createdByUsername: 'alice',
    updatedBy: 1,
    updatedByUsername: 'alice',
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-05-01T00:00:00Z',
    tags: [],
    ...overrides,
  };
}
