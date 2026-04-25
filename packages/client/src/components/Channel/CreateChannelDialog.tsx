import { use, useState, useMemo, Suspense, FormEvent } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Radio,
  RadioGroup,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { api } from '../../api/client';
import type { Channel, ChannelPostingPermission, User } from '@chat-app/shared';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (channel: Channel) => void;
}

interface UsersListProps {
  usersPromise: Promise<{ users: User[] }>;
  selectedIds: number[];
  onToggle: (userId: number) => void;
}

function UsersList({ usersPromise, selectedIds, onToggle }: UsersListProps) {
  const { users } = use(usersPromise);
  return (
    <List
      dense
      disablePadding
      aria-label="Members"
      sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}
    >
      {users.map((u) => (
        <ListItem key={u.id} disablePadding>
          <ListItemButton onClick={() => onToggle(u.id)}>
            <Checkbox
              edge="start"
              checked={selectedIds.includes(u.id)}
              tabIndex={-1}
              disableRipple
            />
            <ListItemText primary={u.displayName ?? u.username} />
          </ListItemButton>
        </ListItem>
      ))}
    </List>
  );
}

export default function CreateChannelDialog({ open, onClose, onCreate }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [postingPermission, setPostingPermission] = useState<ChannelPostingPermission>('everyone');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // isPrivate が true のときだけ users を取得する Promise を生成する
  const usersPromise = useMemo<Promise<{ users: User[] }> | null>(() => {
    if (!isPrivate) return null;
    return api.auth.users();
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
        postingPermission,
      });
      onCreate(channel);
      setName('');
      setDescription('');
      setIsPrivate(false);
      setSelectedIds([]);
      setPostingPermission('everyone');
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
          {isPrivate && usersPromise && (
            <>
              <Typography variant="caption" color="text.secondary">
                Members
              </Typography>
              <Suspense fallback={<CircularProgress size={24} />}>
                <UsersList
                  usersPromise={usersPromise}
                  selectedIds={selectedIds}
                  onToggle={toggleMember}
                />
              </Suspense>
            </>
          )}
          <FormControl>
            <FormLabel id="posting-permission-label">投稿権限</FormLabel>
            <RadioGroup
              aria-labelledby="posting-permission-label"
              value={postingPermission}
              onChange={(e) => setPostingPermission(e.target.value as ChannelPostingPermission)}
              name="posting-permission"
            >
              <FormControlLabel value="everyone" control={<Radio />} label="全員（既定）" />
              <FormControlLabel value="admins" control={<Radio />} label="管理者のみ" />
              <FormControlLabel value="readonly" control={<Radio />} label="閲覧専用" />
            </RadioGroup>
          </FormControl>
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
