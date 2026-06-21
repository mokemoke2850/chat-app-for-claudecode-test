import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Radio,
  RadioGroup,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import PushPinIcon from '@mui/icons-material/PushPin';
import type { PinCategory, PinnedMessage } from '@chat-app/shared';
import { api } from '../../api/client';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { extractMessageText } from '../../utils/extractMessageText';

interface PinnedMessagesProps {
  channelId: number;
  currentUserId: number;
  refreshKey?: number;
  onUnpin: (messageId: number) => void;
}

type SelectedTab = 'all' | 'unclassified' | number;

export default function PinnedMessages({
  channelId,
  currentUserId,
  refreshKey = 0,
  onUnpin,
}: PinnedMessagesProps) {
  const [pins, setPins] = useState<PinnedMessage[]>([]);
  const [categories, setCategories] = useState<PinCategory[]>([]);
  const [selectedTab, setSelectedTab] = useState<SelectedTab>('all');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [editingPin, setEditingPin] = useState<PinnedMessage | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('unclassified');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const loadRequestId = useRef(0);
  const currentChannelId = useRef(channelId);
  currentChannelId.current = channelId;
  const { showError } = useSnackbar();

  const load = useCallback(async () => {
    const requestId = ++loadRequestId.current;
    setLoading(true);
    setLoadError(false);
    try {
      const [pinsResponse, categoriesResponse] = await Promise.all([
        api.pins.list(channelId),
        api.pins.listCategories(channelId),
      ]);
      if (loadRequestId.current === requestId) {
        setPins(pinsResponse.pinnedMessages);
        setCategories(categoriesResponse.categories);
      }
    } catch {
      if (loadRequestId.current === requestId) setLoadError(true);
    } finally {
      if (loadRequestId.current === requestId) setLoading(false);
    }
  }, [channelId]);

  useEffect(() => {
    setSelectedTab('all');
    setEditingPin(null);
    setSelectedCategory('unclassified');
    setAddDialogOpen(false);
    setNewCategoryName('');
    void load();
    return () => {
      loadRequestId.current += 1;
    };
  }, [load, refreshKey]);

  const visiblePins = pins.filter((pin) => {
    if (selectedTab === 'all') return true;
    if (selectedTab === 'unclassified') return pin.categoryId === null;
    return pin.categoryId === selectedTab;
  });

  const openCategoryEditor = (pin: PinnedMessage) => {
    setEditingPin(pin);
    setSelectedCategory(pin.categoryId === null ? 'unclassified' : String(pin.categoryId));
  };

  const updateCategory = async () => {
    if (!editingPin) return;
    const operationChannelId = channelId;
    const categoryId = selectedCategory === 'unclassified' ? null : Number(selectedCategory);
    try {
      await api.pins.updateCategory(operationChannelId, editingPin.messageId, categoryId);
      if (currentChannelId.current !== operationChannelId) return;
      setEditingPin(null);
      await load();
    } catch {
      if (currentChannelId.current !== operationChannelId) return;
      showError('カテゴリの変更に失敗しました');
      setEditingPin(null);
    }
  };

  const createCategory = async () => {
    const operationChannelId = channelId;
    try {
      const { category } = await api.pins.createCategory(operationChannelId, newCategoryName);
      if (currentChannelId.current !== operationChannelId) return;
      setCategories((current) => [...current, category]);
      setNewCategoryName('');
      setAddDialogOpen(false);
    } catch {
      if (currentChannelId.current !== operationChannelId) return;
      showError('カテゴリの追加に失敗しました');
    }
  };

  if (loading) {
    return <CircularProgress size={20} aria-label="ピン留めを読み込み中" />;
  }
  if (loadError) {
    return <Typography color="error">ピン留めの読み込みに失敗しました</Typography>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <PushPinIcon fontSize="small" color="primary" />
        <Typography variant="subtitle2">ピン留め ({pins.length})</Typography>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setAddDialogOpen(true)}
          sx={{ ml: 'auto' }}
        >
          カテゴリを追加
        </Button>
      </Box>

      <Tabs
        value={selectedTab}
        onChange={(_, value: SelectedTab) => setSelectedTab(value)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 1, minHeight: 34, '& .MuiTab-root': { minHeight: 34, px: 1 } }}
      >
        <Tab value="all" label="すべて" />
        <Tab value="unclassified" label="未分類" />
        {categories.map((category) => (
          <Tab key={category.id} value={category.id} label={category.name} />
        ))}
      </Tabs>

      {visiblePins.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          このカテゴリにピンはありません
        </Typography>
      ) : (
        visiblePins.map((pin) => (
          <Box
            key={pin.id}
            data-pin-id={pin.id}
            sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, py: 0.75 }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="caption" color="text.secondary">
                {pin.category?.name ?? '未分類'}
              </Typography>
              <Typography variant="body2" noWrap>
                {pin.message
                  ? extractMessageText(pin.message.content)
                  : '(メッセージが見つかりません)'}
              </Typography>
            </Box>
            <Tooltip title="カテゴリを変更">
              <IconButton
                size="small"
                aria-label="カテゴリを変更"
                onClick={() => openCategoryEditor(pin)}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {pin.pinnedBy === currentUserId && (
              <Tooltip title="ピン留めを解除">
                <IconButton
                  size="small"
                  aria-label="ピン留めを解除"
                  onClick={() => onUnpin(pin.messageId)}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        ))
      )}

      <Dialog open={editingPin !== null} onClose={() => setEditingPin(null)}>
        <DialogTitle>カテゴリを変更</DialogTitle>
        <DialogContent>
          <RadioGroup
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value)}
          >
            <FormControlLabel value="unclassified" control={<Radio />} label="未分類" />
            {categories.map((category) => (
              <FormControlLabel
                key={category.id}
                value={String(category.id)}
                control={<Radio />}
                label={category.name}
              />
            ))}
          </RadioGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingPin(null)}>キャンセル</Button>
          <Button variant="contained" onClick={() => void updateCategory()}>
            変更する
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)}>
        <DialogTitle>カテゴリを追加</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="カテゴリ名"
            value={newCategoryName}
            onChange={(event) => setNewCategoryName(event.target.value)}
            inputProps={{ maxLength: 50 }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>キャンセル</Button>
          <Button
            variant="contained"
            disabled={newCategoryName.trim().length === 0}
            onClick={() => void createCategory()}
          >
            追加する
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
