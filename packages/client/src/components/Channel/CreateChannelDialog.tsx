import { useState, useEffect, FormEvent } from 'react';
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Switch,
  TextField,
  Alert,
  Typography,
} from '@mui/material';
import { api } from '../../api/client';
import type { Channel, User } from '@chat-app/shared';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (channel: Channel) => void;
}

export default function CreateChannelDialog({ open, onClose, onCreate }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isPrivate) {
      api.auth
        .users()
        .then(({ users }) => setAllUsers(users))
        .catch(console.error);
    } else {
      setSelectedIds([]);
    }
  }, [isPrivate]);

  const toggleMember = (userId: number) => {
    setSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { channel } = await api.channels.create({
        name,
        description: description || undefined,
        isPrivate,
        memberIds: isPrivate ? selectedIds : [],
      });
      onCreate(channel);
      setName('');
      setDescription('');
      setIsPrivate(false);
      setSelectedIds([]);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create channel');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" scroll="paper">
      <form onSubmit={(e) => void handleSubmit(e)}>
        <DialogTitle>Create Channel</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }} dividers>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Channel name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
            fullWidth
          />
          <TextField
            label="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            rows={2}
          />
          <FormControlLabel
            control={
              <Switch
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                inputProps={{ 'aria-label': 'Private channel' }}
              />
            }
            label="Private"
          />
          {isPrivate && (
            <>
              <Typography variant="caption" color="text.secondary">
                Members
              </Typography>
              <List
                dense
                disablePadding
                aria-label="Members"
                sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}
              >
                {allUsers.map((u) => (
                  <ListItem key={u.id} disablePadding>
                    <ListItemButton onClick={() => toggleMember(u.id)}>
                      <Checkbox
                        edge="start"
                        checked={selectedIds.includes(u.id)}
                        tabIndex={-1}
                        disableRipple
                      />
                      <ListItemText primary={u.username} />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={loading || !name}>
            Create
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
