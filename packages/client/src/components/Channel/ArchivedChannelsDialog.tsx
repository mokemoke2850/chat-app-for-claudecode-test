import { useState, useEffect } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  Typography,
  CircularProgress,
  Box,
} from '@mui/material';
import type { Channel } from '@chat-app/shared';
import { api } from '../../api/client';
import { useSnackbar } from '../../contexts/SnackbarContext';

interface Props {
  open: boolean;
  onClose: () => void;
  currentUserId: number;
  userRole: string;
}

export default function ArchivedChannelsDialog({ open, onClose, currentUserId, userRole }: Props) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(false);
  const { showSuccess, showError } = useSnackbar();

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.channels
      .listArchived()
      .then(({ channels: list }) => setChannels(list))
      .catch(() => showError('アーカイブ済みチャンネルの取得に失敗しました'))
      .finally(() => setLoading(false));
  }, [open, showError]);

  const canUnarchive = (channel: Channel) => {
    return userRole === 'admin' || channel.createdBy === currentUserId;
  };

  const handleUnarchive = async (channel: Channel) => {
    try {
      await api.channels.unarchive(channel.id);
      setChannels((prev) => prev.filter((ch) => ch.id !== channel.id));
      showSuccess(`#${channel.name} のアーカイブを解除しました`);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'アーカイブ解除に失敗しました');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>アーカイブ済みチャンネル</DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : channels.length === 0 ? (
          <Typography color="text.secondary">アーカイブ済みチャンネルはありません</Typography>
        ) : (
          <List>
            {channels.map((channel) => (
              <ListItem
                key={channel.id}
                secondaryAction={
                  canUnarchive(channel) ? (
                    <Button
                      size="small"
                      variant="outlined"
                      aria-label="アーカイブ解除"
                      onClick={() => void handleUnarchive(channel)}
                    >
                      アーカイブ解除
                    </Button>
                  ) : null
                }
              >
                <ListItemText
                  primary={channel.name}
                  secondary={channel.description}
                />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>閉じる</Button>
      </DialogActions>
    </Dialog>
  );
}
