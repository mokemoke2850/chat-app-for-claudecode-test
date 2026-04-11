import { useState, useEffect } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
} from '@mui/material';
import { api } from '../../api/client';
import type { User } from '@chat-app/shared';

interface Props {
  open: boolean;
  channelId: number;
  onClose: () => void;
}

export default function ChannelMembersDialog({ open, channelId, onClose }: Props) {
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [memberIds, setMemberIds] = useState<Set<number>>(new Set());
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [initializing, setInitializing] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    setInitializing(true);
    Promise.all([api.auth.users(), api.channels.getMembers(channelId)])
      .then(([{ users }, { members }]) => {
        setAllUsers(users);
        setMemberIds(new Set(members.map((m) => m.id)));
      })
      .catch(() => setError('ユーザー情報の取得に失敗しました'))
      .finally(() => setInitializing(false));
  }, [open, channelId]);

  const handleToggle = async (userId: number) => {
    setError('');
    setLoadingId(userId);
    try {
      if (memberIds.has(userId)) {
        await api.channels.removeMember(channelId, userId);
        setMemberIds((prev) => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
      } else {
        await api.channels.addMember(channelId, userId);
        setMemberIds((prev) => new Set([...prev, userId]));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作に失敗しました');
    } finally {
      setLoadingId(null);
    }
  };

  const displayName = (u: User) => u.displayName ?? u.username;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" scroll="paper">
      <DialogTitle>メンバー管理</DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 1 }}>
            {error}
          </Alert>
        )}
        {initializing ? (
          <CircularProgress size={24} />
        ) : (
          <List dense disablePadding>
            {allUsers.map((u) => {
              const isMember = memberIds.has(u.id);
              const isLoading = loadingId === u.id;
              return (
                <ListItem key={u.id} disablePadding>
                  <ListItemButton onClick={() => void handleToggle(u.id)} disabled={isLoading}>
                    <Checkbox edge="start" checked={isMember} tabIndex={-1} disableRipple />
                    <ListItemText
                      primary={displayName(u)}
                      secondary={isMember ? 'メンバー' : undefined}
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>閉じる</Button>
      </DialogActions>
    </Dialog>
  );
}
