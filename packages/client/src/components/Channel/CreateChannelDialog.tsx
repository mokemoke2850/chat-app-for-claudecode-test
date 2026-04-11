import { useState, FormEvent } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Alert,
  FormControlLabel,
  Switch,
} from '@mui/material';
import { api } from '../../api/client';
import type { Channel } from '@chat-app/shared';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (channel: Channel) => void;
}

export default function CreateChannelDialog({ open, onClose, onCreate }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { channel } = await api.channels.create({
        name,
        description: description || undefined,
        isPrivate,
      });
      onCreate(channel);
      setName('');
      setDescription('');
      setIsPrivate(false);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create channel');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <form onSubmit={(e) => void handleSubmit(e)}>
        <DialogTitle>Create Channel</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
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
