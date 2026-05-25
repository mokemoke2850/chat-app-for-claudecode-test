import { Box, Chip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import type { SavedView } from '@chat-app/shared';

interface Props {
  views: SavedView[];
  /** ピルクリック時に該当 view を渡す。SearchPage 側で query → state にロードする */
  onSelect: (view: SavedView) => void;
  /** 削除アイコン押下時に該当 id を渡す。未指定の場合は削除アイコンを表示しない */
  onDelete?: (id: number) => void;
}

/**
 * SearchPage 上部に配置する保存ビューのピル一覧 (純粋コンポーネント)。
 * Promise の解決は親の Suspense 側で行い、ここは配列を描画するだけ。
 * 並び順は親が `api.savedViews.list()` で取得した順 (= position 順) をそのまま使う。
 */
export default function SavedViewPills({ views, onSelect, onDelete }: Props) {
  if (views.length === 0) return null;
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'nowrap',
        gap: 1,
        overflowX: 'auto',
        // 横スクロール時に縦方向のはみ出しを許容しない
        overflowY: 'hidden',
        // スクロールバーを薄く見せる
        scrollbarWidth: 'thin',
        py: 0.5,
      }}
      data-testid="saved-view-pills"
      role="list"
    >
      {views.map((view) => (
        <Chip
          key={view.id}
          label={view.name}
          onClick={() => onSelect(view)}
          onDelete={onDelete ? () => onDelete(view.id) : undefined}
          deleteIcon={onDelete ? <CloseIcon fontSize="small" /> : undefined}
          size="small"
          variant="outlined"
          data-testid={`saved-view-pill-${view.id}`}
          role="listitem"
        />
      ))}
    </Box>
  );
}
