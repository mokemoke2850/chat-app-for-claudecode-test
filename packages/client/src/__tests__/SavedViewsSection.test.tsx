/**
 * components/Search/SavedViewsSection.tsx のユニットテスト
 *
 * テスト対象:
 *   - 親 (SearchPage) から受け取った Promise を use() で解決し、
 *     保存ビュー有り → SavedViewPills、保存ビュー無し → プレースホルダ
 *     の出し分けを行うこと (Issue #325)
 *
 * 戦略:
 *   - Promise を直接生成して渡し、<Suspense> で包んで描画する
 *   - 初期レンダリング時に use() がサスペンドするため act(async) で render を包む
 *     （react19-suspense-guide.md「Vitest パターン」に従う）
 */

import { Suspense } from 'react';
import { act, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { SavedView } from '@chat-app/shared';
import SavedViewsSection from '../components/Search/SavedViewsSection';

function makeView(overrides: Partial<SavedView> = {}): SavedView {
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

describe('SavedViewsSection (Issue #325)', () => {
  describe('保存ビュー未作成時のプレースホルダ', () => {
    it('保存ビューが 0 件のとき、追加方法の案内テキストが表示される', async () => {
      const promise = Promise.resolve({ savedViews: [] });
      await act(async () => {
        render(
          <Suspense fallback={<div data-testid="suspense-fallback">loading</div>}>
            <SavedViewsSection promise={promise} onSelect={vi.fn()} onDelete={vi.fn()} />
          </Suspense>,
        );
      });
      const placeholder = screen.getByTestId('saved-views-empty-placeholder');
      expect(placeholder).toBeInTheDocument();
      // 案内文として「保存」「ビュー」が含まれる
      expect(placeholder.textContent).toMatch(/保存/);
      expect(placeholder.textContent).toMatch(/ビュー/);
    });

    it('保存ビューが 1 件以上あるとき、プレースホルダは表示されず、SavedViewPills が描画される', async () => {
      const promise = Promise.resolve({
        savedViews: [makeView({ id: 1, name: '営業チーム' })],
      });
      await act(async () => {
        render(
          <Suspense fallback={<div data-testid="suspense-fallback">loading</div>}>
            <SavedViewsSection promise={promise} onSelect={vi.fn()} onDelete={vi.fn()} />
          </Suspense>,
        );
      });
      expect(screen.getByTestId('saved-view-pills')).toBeInTheDocument();
      expect(screen.queryByTestId('saved-views-empty-placeholder')).not.toBeInTheDocument();
      expect(screen.getByText('営業チーム')).toBeInTheDocument();
    });
  });
});
