// Issue #152 — カレンダーイベント詳細ドロワー（右側 420px）
// RSVP 操作 + 編集/削除アイコン + 削除確認 MUI Dialog

import { useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  ButtonGroup,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import HelpIcon from '@mui/icons-material/Help';
import ScheduleIcon from '@mui/icons-material/Schedule';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PlaceIcon from '@mui/icons-material/Place';
import PersonIcon from '@mui/icons-material/Person';
import NotesIcon from '@mui/icons-material/Notes';
import VideoCallIcon from '@mui/icons-material/VideoCall';
import DownloadIcon from '@mui/icons-material/Download';

import { fmtDateLong, fmtTime } from '../../utils/calendar';
import { getAvatarColor } from '../../utils/avatarColor';
import { api } from '../../api/client';
import type {
  CalendarEvent,
  CalendarRsvpStatus,
  Channel,
  RecurrenceEditScope,
  User,
} from '@chat-app/shared';
import RepeatIcon from '@mui/icons-material/Repeat';
import { ToggleButton, ToggleButtonGroup } from '@mui/material';

interface Props {
  event: CalendarEvent | null;
  channels: Channel[];
  channelColors: Map<number, string>;
  users: User[];
  currentUserId: number;
  onClose: () => void;
  /** 編集ボタンが押されたときに呼ばれる。第二引数で繰り返し編集スコープ（単発時は undefined） */
  onEdit: (event: CalendarEvent, scope?: RecurrenceEditScope) => void;
  /** RSVP 更新成功時に呼ばれる。親側でカレンダーを再フェッチする責務 */
  onRsvpUpdated: () => void;
  /** 削除成功時に呼ばれる */
  onDeleted: () => void;
}

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

/** 繰り返しルールを人間可読な要約に変換する */
function summarizeRecurrence(event: CalendarEvent): string | null {
  if (!event.recurrenceRule && !event.recurrenceMasterId) return null;
  const rule = event.recurrenceRule;
  if (!rule) return '繰り返し';
  const interval = event.recurrenceInterval ?? 1;
  let base = '';
  if (rule === 'DAILY') base = interval === 1 ? '毎日' : `${interval}日ごと`;
  else if (rule === 'WEEKLY') base = interval === 1 ? '毎週' : `${interval}週ごと`;
  else if (rule === 'MONTHLY') base = interval === 1 ? '毎月' : `${interval}か月ごと`;
  else if (rule === 'YEARLY') base = interval === 1 ? '毎年' : `${interval}年ごと`;
  if (rule === 'WEEKLY' && event.recurrenceDaysOfWeek && event.recurrenceDaysOfWeek.length > 0) {
    const days = [...event.recurrenceDaysOfWeek]
      .sort()
      .map((d) => WEEKDAY_LABELS[d])
      .join('・');
    base += ` ${days}`;
  }
  return base;
}

const STATUS_ICONS: Record<CalendarRsvpStatus, { node: typeof CheckCircleIcon; color: string }> = {
  accepted: { node: CheckCircleIcon, color: 'success.main' },
  maybe: { node: HelpIcon, color: 'warning.main' },
  declined: { node: CancelIcon, color: 'error.main' },
  pending: { node: ScheduleIcon, color: 'text.disabled' },
};

export function EventDetailDrawer({
  event,
  channels,
  channelColors,
  users,
  currentUserId,
  onClose,
  onEdit,
  onRsvpUpdated,
  onDeleted,
}: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [rsvpInFlight, setRsvpInFlight] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  // #302 編集/削除のスコープ選択
  const [editScopeOpen, setEditScopeOpen] = useState(false);
  const [editScope, setEditScope] = useState<RecurrenceEditScope>('one');
  const [deleteScope, setDeleteScope] = useState<RecurrenceEditScope>('one');

  if (!event) return null;

  const isRecurring = event.recurrenceRule !== null || event.recurrenceMasterId !== null;
  const recurrenceLabel = summarizeRecurrence(event);

  const channel = event.channelId !== null ? channels.find((c) => c.id === event.channelId) : null;
  const organizer = users.find((u) => u.id === event.organizerId);
  const myAttendee = event.attendees.find((a) => a.userId === currentUserId);
  const myStatus = myAttendee?.status ?? 'pending';
  const color =
    event.channelId !== null ? (channelColors.get(event.channelId) ?? '#1976d2') : '#1976d2';

  const accepted = event.attendees.filter((a) => a.status === 'accepted');
  const maybe = event.attendees.filter((a) => a.status === 'maybe');
  const declined = event.attendees.filter((a) => a.status === 'declined');
  const pending = event.attendees.filter((a) => a.status === 'pending');

  const handleRsvp = async (status: CalendarRsvpStatus) => {
    if (rsvpInFlight) return;
    setRsvpInFlight(true);
    try {
      await api.calendar.events.rsvp(event.id, status);
      onRsvpUpdated();
    } finally {
      setRsvpInFlight(false);
    }
  };

  const handleConfirmDelete = async () => {
    setDeleteError(null);
    setDeleting(true);
    try {
      await api.calendar.events.delete(event.id, isRecurring ? deleteScope : undefined);
      setConfirmOpen(false);
      onDeleted();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '削除に失敗しました';
      setDeleteError(msg);
    } finally {
      setDeleting(false);
    }
  };

  /**
   * 編集ボタンクリック: 単発なら直接 onEdit。
   * 繰り返しイベントなら、編集スコープ選択ダイアログを開く。
   */
  const handleEditClick = () => {
    if (isRecurring) {
      setEditScope('one');
      setEditScopeOpen(true);
    } else {
      onEdit(event);
    }
  };

  const handleEditScopeConfirm = () => {
    setEditScopeOpen(false);
    onEdit(event, editScope);
  };

  /** 削除ボタンクリック: 繰り返しの場合はデフォルトスコープを 'one' に戻して開く */
  const handleDeleteClick = () => {
    setDeleteScope('one');
    setConfirmOpen(true);
  };

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    setExportError(null);
    try {
      const blob = await api.calendar.events.exportOne(event.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `calendar-event-${event.id}.ics`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError('予定をエクスポートできませんでした');
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <Drawer
        anchor="right"
        open={!!event}
        onClose={onClose}
        PaperProps={{
          sx: {
            width: 420,
            maxWidth: '100%',
            top: 64, // AppBar の高さ分オフセット
            height: 'calc(100% - 64px)',
          },
        }}
        data-testid="event-detail-drawer"
      >
        <Box sx={{ display: 'flex', alignItems: 'center', p: 2, gap: 1 }}>
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: color }} />
          <Typography sx={{ flexGrow: 1, fontSize: 12, color: 'text.secondary' }}>
            {channel ? `# ${channel.name}` : ''}
          </Typography>
          <Tooltip title="編集">
            <IconButton size="small" onClick={handleEditClick} aria-label="event-edit">
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="削除">
            <IconButton size="small" onClick={handleDeleteClick} aria-label="event-delete">
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="iCalendar エクスポート">
            <IconButton size="small" onClick={() => void handleExport()} disabled={exporting} aria-label="event-export">
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <IconButton size="small" onClick={onClose} aria-label="event-close">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        <Divider />

        {exportError && <Typography color="error" sx={{ px: 3, pt: 2 }}>{exportError}</Typography>}

        <Box sx={{ p: 3, overflow: 'auto', flexGrow: 1 }}>
          <Typography sx={{ fontSize: 20, fontWeight: 600, mb: 1, lineHeight: 1.3 }}>
            {event.title}
          </Typography>

          {isRecurring && (
            <Chip
              size="small"
              icon={<RepeatIcon fontSize="small" />}
              label={recurrenceLabel ?? '繰り返し'}
              color="primary"
              variant="outlined"
              sx={{ mb: 2 }}
              data-testid="event-recurrence-badge"
            />
          )}

          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <Box sx={{ color: 'text.secondary', pt: 0.25 }}>
                <ScheduleIcon fontSize="small" />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 14, fontWeight: 500 }}>
                  {fmtDateLong(new Date(event.startsAt))}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {fmtTime(new Date(event.startsAt))} – {fmtTime(new Date(event.endsAt))}
                </Typography>
              </Box>
            </Stack>

            {event.location && (
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box sx={{ color: 'text.secondary' }}>
                  <PlaceIcon fontSize="small" />
                </Box>
                <Typography sx={{ fontSize: 14 }}>{event.location}</Typography>
              </Stack>
            )}

            {event.meetingUrl && (
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box sx={{ color: 'text.secondary' }}>
                  <VideoCallIcon fontSize="small" />
                </Box>
                <Typography
                  component="a"
                  href={event.meetingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ fontSize: 14, color: 'primary.main', wordBreak: 'break-all' }}
                  data-testid="event-meeting-url-link"
                >
                  {event.meetingUrl}
                </Typography>
              </Stack>
            )}

            {organizer && (
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box sx={{ color: 'text.secondary' }}>
                  <PersonIcon fontSize="small" />
                </Box>
                <Avatar
                  sx={{
                    width: 22,
                    height: 22,
                    fontSize: 11,
                    bgcolor: getAvatarColor(organizer.email),
                  }}
                >
                  {organizer.displayName?.[0] ?? organizer.username[0]}
                </Avatar>
                <Typography sx={{ fontSize: 14 }}>
                  {organizer.displayName ?? organizer.username}
                  <Typography component="span" color="text.secondary" sx={{ ml: 1, fontSize: 12 }}>
                    主催者
                  </Typography>
                </Typography>
              </Stack>
            )}

            {event.description && (
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <Box sx={{ color: 'text.secondary', pt: 0.25 }}>
                  <NotesIcon fontSize="small" />
                </Box>
                <Typography sx={{ fontSize: 14, whiteSpace: 'pre-wrap', color: 'text.secondary' }}>
                  {event.description}
                </Typography>
              </Stack>
            )}
          </Stack>

          <Divider sx={{ my: 2.5 }} />

          {/* RSVP */}
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 1 }}>参加しますか？</Typography>
            <ButtonGroup fullWidth size="small" variant="outlined">
              <Button
                variant={myStatus === 'accepted' ? 'contained' : 'outlined'}
                color="success"
                onClick={() => handleRsvp('accepted')}
                startIcon={<CheckIcon fontSize="small" />}
                aria-label="rsvp-accepted"
                sx={{ textTransform: 'none' }}
                disabled={rsvpInFlight}
              >
                参加
              </Button>
              <Button
                variant={myStatus === 'maybe' ? 'contained' : 'outlined'}
                color="warning"
                onClick={() => handleRsvp('maybe')}
                startIcon={<HelpIcon fontSize="small" />}
                aria-label="rsvp-maybe"
                sx={{ textTransform: 'none' }}
                disabled={rsvpInFlight}
              >
                未定
              </Button>
              <Button
                variant={myStatus === 'declined' ? 'contained' : 'outlined'}
                color="error"
                onClick={() => handleRsvp('declined')}
                startIcon={<CloseIcon fontSize="small" />}
                aria-label="rsvp-declined"
                sx={{ textTransform: 'none' }}
                disabled={rsvpInFlight}
              >
                不参加
              </Button>
            </ButtonGroup>
          </Box>

          <Divider sx={{ my: 2.5 }} />

          {/* 参加者一覧 */}
          <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 1 }}>
            参加者（{event.attendees.length}名）
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mb: 1.5, flexWrap: 'wrap', gap: 0.5 }}>
            <Chip
              size="small"
              label={`参加 ${accepted.length}`}
              color="success"
              sx={{ height: 22, fontSize: 11 }}
            />
            <Chip
              size="small"
              label={`未定 ${maybe.length}`}
              color="warning"
              sx={{ height: 22, fontSize: 11 }}
            />
            <Chip
              size="small"
              label={`不参加 ${declined.length}`}
              color="error"
              sx={{ height: 22, fontSize: 11 }}
            />
            <Chip
              size="small"
              label={`未回答 ${pending.length}`}
              variant="outlined"
              sx={{ height: 22, fontSize: 11 }}
            />
          </Stack>

          <List dense disablePadding>
            {event.attendees.map((a) => {
              const u = users.find((x) => x.id === a.userId);
              if (!u) return null;
              const StatusIcon = STATUS_ICONS[a.status].node;
              const statusColor = STATUS_ICONS[a.status].color;
              return (
                <ListItem
                  key={a.userId}
                  data-testid={`attendee-row-${a.userId}`}
                  disableGutters
                  sx={{ py: 0.5 }}
                >
                  <ListItemAvatar sx={{ minWidth: 40 }}>
                    <Avatar
                      sx={{
                        width: 28,
                        height: 28,
                        fontSize: 12,
                        bgcolor: getAvatarColor(u.email),
                      }}
                    >
                      {u.displayName?.[0] ?? u.username[0]}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={u.displayName ?? u.username}
                    primaryTypographyProps={{ fontSize: 13 }}
                    secondary={u.id === event.organizerId ? '主催者' : null}
                    secondaryTypographyProps={{ fontSize: 11 }}
                  />
                  <Box
                    data-testid={`attendee-status-${a.userId}`}
                    data-status={a.status}
                    sx={{ color: statusColor, display: 'flex' }}
                  >
                    <StatusIcon fontSize="small" />
                  </Box>
                </ListItem>
              );
            })}
          </List>
        </Box>
      </Drawer>

      {/* 削除確認 MUI Dialog */}
      <Dialog
        open={confirmOpen}
        onClose={() => !deleting && setConfirmOpen(false)}
        aria-labelledby="delete-confirm-title"
        data-testid="event-delete-confirm-dialog"
      >
        <DialogTitle id="delete-confirm-title">イベントを削除しますか？</DialogTitle>
        <DialogContent>
          <DialogContentText>
            「{event.title}」を削除します。この操作は元に戻せません。
          </DialogContentText>
          {isRecurring && (
            <Box sx={{ mt: 2 }} data-testid="delete-scope-section">
              <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 1 }}>
                削除する範囲を選択してください
              </Typography>
              <ToggleButtonGroup
                exclusive
                value={deleteScope}
                onChange={(_, v) => {
                  if (v) setDeleteScope(v as RecurrenceEditScope);
                }}
                size="small"
                aria-label="delete-scope-group"
              >
                <ToggleButton value="one" aria-label="delete-scope-one">
                  1件のみ
                </ToggleButton>
                <ToggleButton value="following" aria-label="delete-scope-following">
                  以降すべて
                </ToggleButton>
                <ToggleButton value="all" aria-label="delete-scope-all">
                  すべて
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
          )}
          {deleteError && (
            <DialogContentText data-testid="delete-error-message" color="error" sx={{ mt: 2 }}>
              {deleteError}
            </DialogContentText>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setConfirmOpen(false)}
            disabled={deleting}
            sx={{ textTransform: 'none' }}
          >
            キャンセル
          </Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            disabled={deleting}
            sx={{ textTransform: 'none' }}
          >
            削除
          </Button>
        </DialogActions>
      </Dialog>

      {/* #302 編集スコープ選択ダイアログ（繰り返しイベントのみ） */}
      <Dialog
        open={editScopeOpen}
        onClose={() => setEditScopeOpen(false)}
        aria-labelledby="edit-scope-title"
        data-testid="event-edit-scope-dialog"
      >
        <DialogTitle id="edit-scope-title">編集する範囲を選択してください</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>「{event.title}」を編集します。</DialogContentText>
          <ToggleButtonGroup
            exclusive
            value={editScope}
            onChange={(_, v) => {
              if (v) setEditScope(v as RecurrenceEditScope);
            }}
            size="small"
            aria-label="edit-scope-group"
            orientation="vertical"
            fullWidth
          >
            <ToggleButton value="one" aria-label="edit-scope-one">
              1件のみ編集
            </ToggleButton>
            <ToggleButton value="following" aria-label="edit-scope-following">
              以降すべて編集
            </ToggleButton>
            <ToggleButton value="all" aria-label="edit-scope-all">
              すべて編集
            </ToggleButton>
          </ToggleButtonGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditScopeOpen(false)} sx={{ textTransform: 'none' }}>
            キャンセル
          </Button>
          <Button
            onClick={handleEditScopeConfirm}
            variant="contained"
            sx={{ textTransform: 'none' }}
            aria-label="edit-scope-confirm"
          >
            続行
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
