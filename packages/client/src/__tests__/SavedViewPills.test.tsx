/**
 * components/Search/SavedViewPills.tsx のユニットテスト (Step 7b)
 *
 * テスト対象:
 *   - SearchPage 上部に配置する保存ビューのピル一覧
 *   - ピルクリックで onSelect、削除アイコンで onDelete を呼ぶ純粋コンポーネント
 *
 * 戦略:
 *   - SavedView 配列を props で直接渡す（ネットワーク呼び出しなし）
 *   - 親 (SearchPage) の Suspense で `use(promise)` を解決して配列を渡す責務分離パターンを踏襲
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import type { SavedView } from '@chat-app/shared';
import SavedViewPills from '../components/Search/SavedViewPills';

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

describe('SavedViewPills (Step 7b)', () => {
  it('views が空のとき何も描画しない (null)', () => {
    const { container } = render(<SavedViewPills views={[]} onSelect={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('views が渡されたとき、各ピルに保存ビュー名が表示される', () => {
    const views = [
      makeView({ id: 1, name: '営業チーム' }),
      makeView({ id: 2, name: '今週のリリース' }),
    ];
    render(<SavedViewPills views={views} onSelect={vi.fn()} />);
    expect(screen.getByText('営業チーム')).toBeInTheDocument();
    expect(screen.getByText('今週のリリース')).toBeInTheDocument();
  });

  it('ピルクリックで onSelect が該当 view で呼ばれる', async () => {
    const onSelect = vi.fn();
    const view = makeView({ id: 42, name: 'pick-me' });
    render(<SavedViewPills views={[view]} onSelect={onSelect} />);
    await userEvent.click(screen.getByText('pick-me'));
    expect(onSelect).toHaveBeenCalledWith(view);
  });

  it('削除ボタンクリックで onDelete が該当 id で呼ばれる', async () => {
    const onDelete = vi.fn();
    const view = makeView({ id: 99, name: 'delete-me' });
    render(<SavedViewPills views={[view]} onSelect={vi.fn()} onDelete={onDelete} />);
    // MUI Chip の削除ボタンは aria-label 'delete' のスパン内に CloseIcon を含む
    // CloseIcon は data-testid="CloseIcon" でアクセス可能
    const deleteButton = screen.getByTestId('CloseIcon');
    await userEvent.click(deleteButton);
    expect(onDelete).toHaveBeenCalledWith(99);
  });

  it('onDelete が未指定の場合、削除ボタンは表示されない', () => {
    const view = makeView({ id: 1, name: 'no-delete' });
    render(<SavedViewPills views={[view]} onSelect={vi.fn()} />);
    expect(screen.queryByTestId('CloseIcon')).toBeNull();
  });
});
