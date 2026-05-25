import { use } from 'react';
import { Box, Typography } from '@mui/material';
import type { SavedView } from '@chat-app/shared';
import SavedViewPills from './SavedViewPills';

interface Props {
  promise: Promise<{ savedViews: SavedView[] }>;
  onSelect: (view: SavedView) => void;
  onDelete: (id: number) => void;
}

/**
 * 保存ビューピル一覧の Suspense ラッパー。
 * 親 (SearchPage) の Suspense 内で `use(promise)` を解決し、純粋コンポーネント
 * SavedViewPills に配列を渡す責務分離パターン。
 *
 * このラッパーを別ファイルに切り出すことで、SearchPage のテスト時に
 * `vi.mock('../components/Search/SavedViewsSection')` で丸ごとスタブ化でき、
 * jsdom + vitest 環境で Suspense 解決を経由せずにテストできる。
 *
 * Issue #325: 保存ビューが 0 件のときは追加方法の案内 (プレースホルダ) を表示する。
 */
export default function SavedViewsSection({ promise, onSelect, onDelete }: Props) {
  const { savedViews } = use(promise);
  if (savedViews.length === 0) {
    return (
      <Box
        data-testid="saved-views-empty-placeholder"
        sx={{
          px: 1,
          py: 0.5,
          color: 'text.secondary',
        }}
      >
        <Typography variant="caption">
          保存ビューはまだありません。フィルタを設定して「保存」ボタンからビューを追加できます。
        </Typography>
      </Box>
    );
  }
  return <SavedViewPills views={savedViews} onSelect={onSelect} onDelete={onDelete} />;
}
