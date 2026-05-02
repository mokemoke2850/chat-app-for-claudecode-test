import { use } from 'react';
import type { SavedView } from '@chat-app/shared';
import SavedViewPills from './SavedViewPills';

interface Props {
  promise: Promise<{ savedViews: SavedView[] }>;
  onSelect: (view: SavedView) => void;
  onDelete: (id: number) => void;
}

/**
 * Step 7b: SearchPage 上部の保存ビューピル一覧の Suspense ラッパー。
 *
 * 親 (SearchPage) の Suspense 内で `use(promise)` を解決し、純粋コンポーネント
 * SavedViewPills に配列を渡す責務分離パターン。
 *
 * ラッパーをこの別ファイルに切り出すことで、 SearchPage のテスト時に
 * `vi.mock('../components/Search/SavedViewsSection')` で丸ごとスタブ化でき、
 * jsdom + vitest 環境で Suspense 解決を経由せずにテスト可能にする。
 */
export default function SavedViewsSection({ promise, onSelect, onDelete }: Props) {
  const { savedViews } = use(promise);
  return <SavedViewPills views={savedViews} onSelect={onSelect} onDelete={onDelete} />;
}
