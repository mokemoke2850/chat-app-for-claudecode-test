import { use, useState, useMemo, Suspense } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  List,
  ListItemButton,
  ListItemText,
  InputAdornment,
  Typography,
  CircularProgress,
  Alert,
  Box,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import type { Channel } from '@chat-app/shared';
import { api } from '../../api/client';

interface Props {
  open: boolean;
  messageId: number;
  onClose: () => void;
  onForwarded?: () => void;
}

interface ChannelPickerProps {
  channelsPromise: Promise<{ channels: Channel[] }>;
  searchText: string;
  selectedChannelId: number | null;
  onSelect: (id: number) => void;
}

function ChannelPicker({
  channelsPromise,
  searchText,
  selectedChannelId,
  onSelect,
}: ChannelPickerProps) {
  const { channels } = use(channelsPromise);
  const filteredChannels = channels.filter((ch) =>
    ch.name.toLowerCase().includes(searchText.toLowerCase()),
  );

  return (
    <List
      dense
      sx={{
        maxHeight: 240,
        overflow: 'auto',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
      }}
    >
      {filteredChannels.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
          チャンネルが見つかりません
        </Typography>
      ) : (
        filteredChannels.map((ch) => (
          <ListItemButton
            key={ch.id}
            selected={selectedChannelId === ch.id}
            onClick={() => onSelect(ch.id)}
            data-testid={`channel-item-${ch.id}`}
          >
            <ListItemText primary={`#${ch.name}`} />
          </ListItemButton>
        ))
      )}
    </List>
  );
}

export default function ForwardMessageDialog({ open, messageId, onClose, onForwarded }: Props) {
  const [searchText, setSearchText] = useState('');
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ダイアログが開いているときだけ Promise を生成し、open=false のときは null にする。
  // useMemo で open が true になった瞬間に一度だけ生成して安定化させる。
  const channelsPromise = useMemo(
    () => (open ? api.channels.list() : null),

    [open],
  );

  const handleSubmit = async () => {
    if (selectedChannelId === null) return;
    setLoading(true);
    setError(null);
    try {
      await api.messages.forward(messageId, {
        targetChannelId: selectedChannelId,
        comment: comment || undefined,
      });
      onForwarded?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '転送に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setSearchText('');
    setSelectedChannelId(null);
    setComment('');
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>転送先を選択</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          size="small"
          placeholder="チャンネルを検索"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 1 }}
          inputProps={{ 'aria-label': 'チャンネルを検索' }}
        />

        <Suspense
          fallback={
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                py: 2,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
              }}
            >
              <CircularProgress size={24} />
            </Box>
          }
        >
          {channelsPromise && (
            <ChannelPicker
              channelsPromise={channelsPromise}
              searchText={searchText}
              selectedChannelId={selectedChannelId}
              onSelect={setSelectedChannelId}
            />
          )}
        </Suspense>

        <TextField
          fullWidth
          size="small"
          label="コメント（任意）"
          placeholder="コメントを追加..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          multiline
          rows={2}
          sx={{ mt: 2 }}
          inputProps={{ 'aria-label': 'コメント' }}
        />

        {error && (
          <Alert severity="error" sx={{ mt: 1 }} data-testid="forward-error">
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          キャンセル
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSubmit()}
          disabled={selectedChannelId === null || loading}
          data-testid="forward-submit"
        >
          {loading ? <CircularProgress size={20} /> : '転送'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
