import { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import type { SavedView, SavedViewQuery } from '@chat-app/shared';
import { api } from '../../api/client';
import { useSnackbar } from '../../contexts/SnackbarContext';

interface SavedViewSectionProps {
  savedViews: SavedView[];
  onSelectView: (query: SavedViewQuery) => void;
}

interface EditDialogProps {
  open: boolean;
  view: SavedView | null;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
}

function SavedViewEditDialog({ open, view, onClose, onSave }: EditDialogProps) {
  const [name, setName] = useState(view?.name ?? '');
  const [loading, setLoading] = useState(false);

  // ダイアログが開くたびに名前をリセット
  const handleOpen = () => {
    setName(view?.name ?? '');
  };

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      await onSave(trimmed);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      TransitionProps={{ onEnter: handleOpen }}
    >
      <DialogTitle>保存ビューを編集</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          label="ビュー名"
          fullWidth
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleSubmit();
          }}
          sx={{ mt: 1 }}
          inputProps={{ 'aria-label': 'ビュー名' }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} aria-label="キャンセル">
          キャンセル
        </Button>
        <Button
          onClick={() => void handleSubmit()}
          variant="contained"
          disabled={!name.trim() || loading}
          aria-label="保存"
        >
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function SavedViewSection({
  savedViews: initialViews,
  onSelectView,
}: SavedViewSectionProps) {
  const [views, setViews] = useState<SavedView[]>(initialViews);
  const [editingView, setEditingView] = useState<SavedView | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const { showError } = useSnackbar();

  const handleSelect = (view: SavedView) => {
    onSelectView(view.query);
  };

  const handleEdit = (view: SavedView) => {
    setEditingView(view);
    setEditDialogOpen(true);
  };

  const handleEditSave = async (name: string) => {
    if (!editingView) return;
    const updated = await api.savedViews.update(editingView.id, { name });
    setViews((prev) => prev.map((v) => (v.id === editingView.id ? updated.savedView : v)));
  };

  const handleDelete = async (view: SavedView) => {
    try {
      await api.savedViews.delete(view.id);
      setViews((prev) => prev.filter((v) => v.id !== view.id));
    } catch (err) {
      showError(err instanceof Error ? err.message : '削除に失敗しました');
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const newViews = [...views];
    [newViews[index - 1], newViews[index]] = [newViews[index], newViews[index - 1]];
    setViews(newViews);
    try {
      await api.savedViews.reorder(newViews.map((v) => v.id));
    } catch (err) {
      // 失敗時は元に戻す
      setViews(views);
      showError(err instanceof Error ? err.message : '並べ替えに失敗しました');
    }
  };

  const handleMoveDown = async (index: number) => {
    if (index === views.length - 1) return;
    const newViews = [...views];
    [newViews[index], newViews[index + 1]] = [newViews[index + 1], newViews[index]];
    setViews(newViews);
    try {
      await api.savedViews.reorder(newViews.map((v) => v.id));
    } catch (err) {
      setViews(views);
      showError(err instanceof Error ? err.message : '並べ替えに失敗しました');
    }
  };

  return (
    <Box>
      <Typography
        variant="caption"
        sx={{
          px: 2,
          pt: 1,
          pb: 0.5,
          display: 'block',
          color: 'text.secondary',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          fontSize: 10,
        }}
      >
        保存ビュー
      </Typography>
      <List dense disablePadding>
        {views.map((view, index) => (
          <ListItem
            key={view.id}
            disablePadding
            secondaryAction={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                <Tooltip title="上に移動">
                  <span>
                    <IconButton
                      size="small"
                      aria-label="上に移動"
                      onClick={() => void handleMoveUp(index)}
                      disabled={index === 0}
                    >
                      <KeyboardArrowUpIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="下に移動">
                  <span>
                    <IconButton
                      size="small"
                      aria-label="下に移動"
                      onClick={() => void handleMoveDown(index)}
                      disabled={index === views.length - 1}
                    >
                      <KeyboardArrowDownIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="編集">
                  <IconButton size="small" aria-label="編集" onClick={() => handleEdit(view)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="削除">
                  <IconButton
                    size="small"
                    aria-label="削除"
                    onClick={() => void handleDelete(view)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            }
          >
            <ListItemButton onClick={() => handleSelect(view)} sx={{ pr: 16 }}>
              <ListItemText primary={view.name} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <SavedViewEditDialog
        open={editDialogOpen}
        view={editingView}
        onClose={() => setEditDialogOpen(false)}
        onSave={handleEditSave}
      />
    </Box>
  );
}
