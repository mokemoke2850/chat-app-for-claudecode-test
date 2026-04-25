import { Chip } from '@mui/material';
import type { Tag } from '@chat-app/shared';

interface Props {
  tag: Tag;
  /** クリック時に呼ばれるコールバック（検索フィルタへのセット用） */
  onClick?: (name: string) => void;
  /** false のとき × ボタンを表示して onDelete を有効にする */
  readOnly?: boolean;
  onDelete?: (tagId: number) => void;
}

/** タグを "#name" 形式で表示する小さなチップ。 */
export default function TagChip({ tag, onClick, readOnly = true, onDelete }: Props) {
  const handleClick = onClick ? () => onClick(tag.name) : undefined;
  const handleDelete =
    !readOnly && onDelete
      ? (e: React.MouseEvent) => {
          e.stopPropagation();
          onDelete(tag.id);
        }
      : undefined;

  return (
    <Chip
      label={`#${tag.name}`}
      size="small"
      variant="outlined"
      color="primary"
      onClick={handleClick}
      onDelete={handleDelete}
      sx={{ fontSize: '0.7rem', height: 20, cursor: onClick ? 'pointer' : 'default' }}
    />
  );
}
