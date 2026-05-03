import { use, useState, useMemo, Suspense } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Tooltip,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import type { User } from '@chat-app/shared';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { usePresence } from '../../hooks/usePresence';
import PresenceIndicator from '../Chat/PresenceIndicator';

interface Props {
  open: boolean;
  channelId: number;
  onClose: () => void;
}

export type MembersData = [{ users: User[] }, { members: User[] }];

interface MembersContentProps {
  membersPromise: Promise<MembersData>;
  channelId: number;
  /** Step 8e-2: 自分自身を識別して DM ボタンを抑止するために使用 */
  currentUserId: number;
}

// Step 5a: ContextRail のメンバータブから再利用するため named export を追加
export function MembersContent({ membersPromise, channelId, currentUserId }: MembersContentProps) {
  const [{ users: allUsers }, { members }] = use(membersPromise);
  const [memberIds, setMemberIds] = useState<Set<number>>(() => new Set(members.map((m) => m.id)));
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const socket = useSocket();
  const presence = usePresence(socket);
  const navigate = useNavigate();
  const { showError } = useSnackbar();

  // Step 8e-2: メンバー行から DM を開始する
  const handleStartDm = async (targetUserId: number) => {
    try {
      const { conversation } = await api.dm.createConversation(targetUserId);
      navigate(`/dm?conv=${conversation.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'DM の開始に失敗しました';
      showError(msg);
    }
  };

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
          const userState = presence.get(u.id) ?? u.presenceState;
          return (
            <ListItem key={u.id} disablePadding>
              <ListItemButton onClick={() => void handleToggle(u.id)} disabled={isLoading}>
                <Checkbox edge="start" checked={isMember} tabIndex={-1} disableRipple />
                <ListItemAvatar sx={{ minWidth: 40 }}>
                  <Box sx={{ position: 'relative', width: 32, height: 32 }}>
                    <Avatar src={u.avatarUrl ?? undefined} sx={{ width: 32, height: 32 }}>
                      {displayName(u)[0]?.toUpperCase()}
                    </Avatar>
                    <PresenceIndicator state={userState} size={9} />
                  </Box>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <span>{displayName(u)}</span>
                      {u.status && (
                        <Box
                          data-testid="user-status"
                          component="span"
                          sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}
                        >
                          {u.status.emoji && (
                            <span style={{ fontSize: '0.9rem', lineHeight: 1 }}>
                              {u.status.emoji}
                            </span>
                          )}
                          {u.status.text && (
                            <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                              {u.status.text}
                            </span>
                          )}
                        </Box>
                      )}
                    </Box>
                  }
                  secondary={isMember ? 'メンバー' : undefined}
                />
                {/* Step 8e-2: 自分以外のメンバー行に DM 開始ボタンを表示 */}
                {u.id !== currentUserId && (
                  <Tooltip title="DM を開始">
                    <IconButton
                      size="small"
                      aria-label="DM を開始"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleStartDm(u.id);
                      }}
                    >
                      <SendIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </>
  );
}

export default function ChannelMembersDialog({ open, channelId, onClose }: Props) {
  const { user } = useAuth();
  // open と channelId が変わるたびに新しい Promise を生成する
  const membersPromise = useMemo<Promise<MembersData> | null>(() => {
    if (!open) return null;
    return Promise.all([api.auth.users(), api.channels.getMembers(channelId)]);
  }, [open, channelId]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" scroll="paper">
      <DialogTitle>メンバー管理</DialogTitle>
      <DialogContent dividers>
        {open && membersPromise && user && (
          <Suspense fallback={<CircularProgress size={24} />}>
            <MembersContent
              membersPromise={membersPromise}
              channelId={channelId}
              currentUserId={user.id}
            />
          </Suspense>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>閉じる</Button>
      </DialogActions>
    </Dialog>
  );
}
