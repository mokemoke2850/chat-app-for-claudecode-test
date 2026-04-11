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
  ListItemButton,
  Alert,
  Typography,
} from '@mui/material';
import { api } from '../../api/client';
import type { User } from '@chat-app/shared';

interface Props {
  open: boolean;
  channelId: number;
  currentMemberIds: number[];
  onClose: () => void;
}

export default function ChannelMembersDialog({
  open,
  channelId,
  currentMemberIds,
  onClose,
}: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [addedIds, setAddedIds] = useState<number[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    api.auth
      .users()
      .then(({ users: all }) => setUsers(all))
      .catch(console.error);
  }, [open]);

  const excludedIds = [...currentMemberIds, ...addedIds];
  const candidates = users.filter((u) => !excludedIds.includes(u.id));

  const handleAdd = async () => {
    if (selectedUserId === null) return;
    setError('');
    setLoading(true);
    try {
      await api.channels.addMember(channelId, selectedUserId);
      setAddedIds((prev) => [...prev, selectedUserId]);
      setSelectedUserId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add member');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>メンバー追加</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 1 }}>
            {error}
          </Alert>
        )}
        {candidates.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            追加できるユーザーがいません
          </Typography>
        ) : (
          <List dense>
            {candidates.map((u) => (
              <ListItem key={u.id} disablePadding>
                <ListItemButton
                  selected={selectedUserId === u.id}
                  onClick={() => setSelectedUserId(u.id)}
                >
                  <ListItemText primary={u.username} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>閉じる</Button>
        <Button
          variant="contained"
          disabled={selectedUserId === null || loading}
          onClick={() => void handleAdd()}
        >
          追加
        </Button>
      </DialogActions>
    </Dialog>
  );
}
