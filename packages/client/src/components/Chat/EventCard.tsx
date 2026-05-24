// #108 会話イベント投稿 — メッセージ内に表示するイベントカード
// タイトル / 日時 / RSVP ボタン / 集計を表示する。
// Socket 経由で `event:rsvp_updated` を購読して集計をリアルタイムに反映する。
// #179: event-summary クリックで参加者一覧パネル、作成者向け編集・削除メニューを追加。
// #324: 選択済みボタンの強調・未回答プロンプト・アバタープレビューを追加。

import { useEffect, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import EventIcon from '@mui/icons-material/Event';
import CheckIcon from '@mui/icons-material/Check';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import type { ChatEvent, RsvpCounts, RsvpStatus, RsvpUser } from '@chat-app/shared';
import { api } from '../../api/client';
import { useSocket } from '../../contexts/SocketContext';
import { useSnackbar } from '../../contexts/SnackbarContext';
import CreateEventDialog from './CreateEventDialog';

/** アバタープレビュー用の参加者情報 */
type GoingUser = Pick<RsvpUser, 'userId' | 'displayName' | 'avatarUrl'>;

interface Props {
  event: ChatEvent;
  /** 渡すと作成者判定に使用し、一致する場合のみ編集・削除メニューを表示する */
  currentUserId?: number;
  /** 削除完了後に呼ばれるコールバック */
  onDeleted?: (eventId: number) => void;
  /** 編集完了後に呼ばれるコールバック */
  onUpdated?: (event: ChatEvent) => void;
  /**
   * 参加者アバタープレビュー用のユーザー一覧（#324）
   * 親コンポーネントから渡す。カード内で追加 API 呼び出しはしない。
   */
  goingUsers?: GoingUser[];
}

const RSVP_LABELS: Record<RsvpStatus, string> = {
  going: '参加',
  not_going: '不参加',
  maybe: '未定',
};

const RSVP_SECTION_LABELS: Record<RsvpStatus, string> = {
  going: '参加する',
  not_going: '不参加',
  maybe: '未定',
};

function formatRange(startsAt: string, endsAt: string | null): string {
  const start = new Date(startsAt);
  const startStr = start.toLocaleString();
  if (!endsAt) return startStr;
  const end = new Date(endsAt);
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();
  return sameDay
    ? `${startStr} – ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : `${startStr} – ${end.toLocaleString()}`;
}

export default function EventCard({
  event,
  currentUserId,
  onDeleted,
  onUpdated,
  goingUsers,
}: Props) {
  const [counts, setCounts] = useState<RsvpCounts>(event.rsvpCounts);
  const [myRsvp, setMyRsvp] = useState<RsvpStatus | null>(event.myRsvp);
  const [busy, setBusy] = useState(false);
  const socket = useSocket();
  const { showError, showSuccess } = useSnackbar();

  // 参加者一覧パネル
  const [panelOpen, setPanelOpen] = useState(false);
  const [rsvpUsers, setRsvpUsers] = useState<RsvpUser[] | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // 作成者向け操作メニュー
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);

  // 編集ダイアログ
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // 削除確認ダイアログ
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isOwner = currentUserId !== undefined && event.createdBy === currentUserId;

  useEffect(() => {
    setCounts(event.rsvpCounts);
    setMyRsvp(event.myRsvp);
  }, [event.rsvpCounts, event.myRsvp]);

  useEffect(() => {
    if (!socket) return;
    // #107 転送先で表示している EventCard も RSVP 集計更新を受信できるよう、
    // event-id ベースのルームへ join する。元イベントが投稿された channel に
    // join していなくても集計を受信できる。
    socket.emit('event:join_room', event.id);

    const handler = (data: {
      eventId: number;
      messageId: number;
      channelId: number;
      rsvpCounts: RsvpCounts;
    }) => {
      if (data.eventId === event.id) {
        setCounts(data.rsvpCounts);
      }
    };
    socket.on('event:rsvp_updated', handler);
    return () => {
      socket.off('event:rsvp_updated', handler);
      socket.emit('event:leave_room', event.id);
    };
  }, [socket, event.id]);

  const handleSetRsvp = async (status: RsvpStatus) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await api.events.setRsvp(event.id, status);
      setCounts(res.event.rsvpCounts);
      setMyRsvp(res.event.myRsvp);
    } catch (err) {
      const msg = err instanceof Error && err.message ? err.message : 'RSVP の更新に失敗しました';
      showError(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleSummaryClick = async () => {
    if (panelOpen) {
      setPanelOpen(false);
      return;
    }
    setPanelOpen(true);
    if (rsvpUsers !== null) return; // キャッシュ済みなら再取得しない
    setLoadingUsers(true);
    try {
      const res = await api.events.getRsvps(event.id);
      setRsvpUsers(res.users);
    } catch (err) {
      const msg =
        err instanceof Error && err.message ? err.message : '参加者一覧の取得に失敗しました';
      showError(msg);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
  };
  const handleMenuClose = () => setAnchorEl(null);

  const handleEditClick = () => {
    handleMenuClose();
    setEditDialogOpen(true);
  };

  const handleDeleteClick = () => {
    handleMenuClose();
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    try {
      await api.events.delete(event.id);
      showSuccess('イベントを削除しました');
      setDeleteDialogOpen(false);
      onDeleted?.(event.id);
    } catch (err) {
      const msg =
        err instanceof Error && err.message ? err.message : 'イベントの削除に失敗しました';
      showError(msg);
    } finally {
      setDeleting(false);
    }
  };

  const handleUpdated = (updated: ChatEvent) => {
    setEditDialogOpen(false);
    onUpdated?.(updated);
  };

  // going / not_going / maybe の順でグループ化して表示
  const rsvpGroups: RsvpStatus[] = ['going', 'not_going', 'maybe'];

  return (
    <>
      <Card variant="outlined" sx={{ maxWidth: 480, mt: 0.5 }} data-testid="event-card">
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <EventIcon fontSize="small" color="primary" />
            <Typography variant="subtitle1" fontWeight="bold" sx={{ flexGrow: 1 }}>
              {event.title}
            </Typography>
            {isOwner && (
              <IconButton size="small" aria-label="event-actions-menu" onClick={handleMenuOpen}>
                <MoreVertIcon fontSize="small" />
              </IconButton>
            )}
          </Stack>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {formatRange(event.startsAt, event.endsAt)}
          </Typography>

          {event.description && (
            <Typography variant="body2" sx={{ mb: 1, whiteSpace: 'pre-wrap' }}>
              {event.description}
            </Typography>
          )}

          {/* #324: 未回答プロンプト */}
          {myRsvp === null && (
            <Typography
              variant="caption"
              color="primary"
              sx={{ display: 'block', mb: 0.5, fontWeight: 500 }}
              data-testid="rsvp-prompt"
            >
              あなたの回答は？
            </Typography>
          )}

          <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
            {(['going', 'not_going', 'maybe'] as const).map((s) => (
              <Button
                key={s}
                size="small"
                variant={myRsvp === s ? 'contained' : 'outlined'}
                disabled={busy}
                onClick={() => void handleSetRsvp(s)}
                aria-pressed={myRsvp === s}
                aria-label={`rsvp-${s}`}
                startIcon={
                  myRsvp === s ? (
                    <CheckIcon fontSize="small" data-testid="rsvp-selected-indicator" />
                  ) : undefined
                }
              >
                {RSVP_LABELS[s]} (
                {s === 'going' ? counts.going : s === 'not_going' ? counts.notGoing : counts.maybe})
              </Button>
            ))}
          </Stack>

          {/* event-summary: クリックで参加者一覧パネルを開閉 */}
          <Box
            sx={{ mt: 1.5, cursor: 'pointer', userSelect: 'none' }}
            data-testid="event-summary"
            onClick={() => void handleSummaryClick()}
            role="button"
            aria-expanded={panelOpen}
          >
            <Typography variant="caption" color="text.secondary">
              参加 {counts.going} ／ 不参加 {counts.notGoing} ／ 未定 {counts.maybe}
            </Typography>
          </Box>

          {/* #324: 参加者アバタープレビュー（goingUsers prop から表示、先頭3名 + 残数） */}
          {goingUsers && goingUsers.length > 0 && (
            <Stack
              direction="row"
              spacing={0.5}
              alignItems="center"
              sx={{ mt: 1 }}
              data-testid="rsvp-avatar-preview"
            >
              {goingUsers.slice(0, 3).map((u) => (
                <Tooltip key={u.userId} title={u.displayName ?? `User ${u.userId}`}>
                  <Avatar
                    src={u.avatarUrl ?? undefined}
                    alt={u.displayName ?? `User ${u.userId}`}
                    sx={{ width: 24, height: 24, fontSize: 11 }}
                    data-testid="rsvp-avatar"
                  >
                    {(u.displayName ?? `U`).charAt(0).toUpperCase()}
                  </Avatar>
                </Tooltip>
              ))}
              {goingUsers.length > 3 && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  data-testid="rsvp-avatar-overflow"
                >
                  +{goingUsers.length - 3}
                </Typography>
              )}
            </Stack>
          )}

          {/* 参加者一覧パネル */}
          {panelOpen && (
            <Box data-testid="rsvp-panel" sx={{ mt: 1 }}>
              {loadingUsers ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
                  <CircularProgress size={20} />
                </Box>
              ) : (
                rsvpGroups.map((status, idx) => {
                  const users = (rsvpUsers ?? []).filter((u) => u.status === status);
                  return (
                    <Box key={status}>
                      {idx > 0 && <Divider sx={{ my: 0.5 }} />}
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 0.5 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 48 }}>
                          {RSVP_SECTION_LABELS[status]}
                        </Typography>
                        <Chip label={users.length} size="small" />
                      </Stack>
                      {users.length > 0 && (
                        <List dense disablePadding>
                          {users.map((u) => (
                            <ListItem key={u.userId} disableGutters sx={{ py: 0 }}>
                              <ListItemAvatar sx={{ minWidth: 36 }}>
                                <Avatar
                                  src={u.avatarUrl ?? undefined}
                                  alt={u.displayName ?? u.username}
                                  sx={{ width: 24, height: 24, fontSize: 12 }}
                                >
                                  {(u.displayName ?? u.username).charAt(0).toUpperCase()}
                                </Avatar>
                              </ListItemAvatar>
                              <ListItemText
                                primary={u.displayName ?? u.username}
                                primaryTypographyProps={{ variant: 'body2' }}
                              />
                            </ListItem>
                          ))}
                        </List>
                      )}
                    </Box>
                  );
                })
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* 作成者向け操作メニュー */}
      <Menu anchorEl={anchorEl} open={menuOpen} onClose={handleMenuClose}>
        <MenuItem onClick={handleEditClick}>編集</MenuItem>
        <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main' }}>
          削除
        </MenuItem>
      </Menu>

      {/* 編集ダイアログ（channelId は編集時には使わないが型を満たすために渡す） */}
      <CreateEventDialog
        open={editDialogOpen}
        channelId={event.messageId}
        editEvent={event}
        onClose={() => setEditDialogOpen(false)}
        onUpdated={handleUpdated}
      />

      {/* 削除確認ダイアログ */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>イベントを削除しますか？</DialogTitle>
        <DialogContent>
          <DialogContentText>
            「{event.title}」を削除します。この操作は取り消せません。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
            キャンセル
          </Button>
          <Button
            onClick={() => void handleDeleteConfirm()}
            color="error"
            variant="contained"
            disabled={deleting}
          >
            削除
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
