import { useState, useEffect } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import type { ChannelCategory } from '@chat-app/shared';

interface ChannelCategoryDialogProps {
  open: boolean;
  /** 編集モード時に指定。null なら作成モード */
  editingCategory: ChannelCategory | null;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
  onUpdate: (id: number, name: string) => Promise<void>;
}

export default function ChannelCategoryDialog({
  open,
  editingCategory,
  onClose,
  onCreate,
  onUpdate,
}: ChannelCategoryDialogProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setName(editingCategory?.name ?? '');
    }
  }, [open, editingCategory]);

  const isEdit = editingCategory !== null;

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    setLoading(true);
    try {
      if (isEdit && editingCategory) {
        await onUpdate(editingCategory.id, trimmed);
      } else {
        await onCreate(trimmed);
      }
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{isEdit ? 'カテゴリを編集' : 'カテゴリを作成'}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          label="カテゴリ名"
          fullWidth
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleSubmit();
          }}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button
          onClick={() => void handleSubmit()}
          variant="contained"
          disabled={!name.trim() || loading}
          aria-label={isEdit ? '保存' : '作成'}
        >
          {isEdit ? '保存' : '作成'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
