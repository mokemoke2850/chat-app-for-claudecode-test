import { use, useState, useMemo, Suspense } from 'react';
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

type MembersData = [{ users: User[] }, { members: User[] }];

interface MembersContentProps {
  membersPromise: Promise<MembersData>;
  channelId: number;
}

function MembersContent({ membersPromise, channelId }: MembersContentProps) {
  const [{ users: allUsers }, { members }] = use(membersPromise);
  const [memberIds, setMemberIds] = useState<Set<number>>(() => new Set(members.map((m) => m.id)));
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [error, setError] = useState('');

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
    <>
      {error && (
        <Alert severity="error" sx={{ mb: 1 }}>
          {error}
        </Alert>
      )}
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
    </>
  );
}

export default function ChannelMembersDialog({ open, channelId, onClose }: Props) {
  // open と channelId が変わるたびに新しい Promise を生成する
  const membersPromise = useMemo<Promise<MembersData> | null>(() => {
    if (!open) return null;
    return Promise.all([api.auth.users(), api.channels.getMembers(channelId)]);
  }, [open, channelId]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" scroll="paper">
      <DialogTitle>メンバー管理</DialogTitle>
      <DialogContent dividers>
        {open && membersPromise && (
          <Suspense fallback={<CircularProgress size={24} />}>
            <MembersContent membersPromise={membersPromise} channelId={channelId} />
          </Suspense>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>閉じる</Button>
      </DialogActions>
    </Dialog>
  );
}
