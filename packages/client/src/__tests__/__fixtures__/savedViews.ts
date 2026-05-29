import type { SavedView } from '@chat-app/shared';

/**
 * テスト共通フィクスチャ: SavedView ファクトリ
 * 各テストで必要なフィールドだけ overrides で上書きして使う。
 */
export function makeSavedView(overrides: Partial<SavedView> = {}): SavedView {
  return {
    id: 1,
    userId: 1,
    name: 'view1',
    query: { keyword: 'hello' },
    position: 0,
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-05-01T00:00:00Z',
    ...overrides,
  };
}
