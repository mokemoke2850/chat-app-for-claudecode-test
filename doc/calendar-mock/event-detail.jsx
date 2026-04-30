/* global React, MaterialUI, window */
const EventDetail = (function () {
  const { useState } = React;
  const {
    Drawer,
    Box,
    Typography,
    IconButton,
    Avatar,
    AvatarGroup,
    Chip,
    Button,
    ButtonGroup,
    Divider,
    Stack,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    Tooltip,
  } = MaterialUI;
  const { Icon } = window.CalendarShell;

  function fmt(d) {
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 (${weekdays[d.getDay()]})`;
  }
  function fmtTime(d) {
    return `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
  }

  return function EventDetail({ event, onClose, onRsvp }) {
    const { USERS, CHANNELS, CURRENT_USER } = window.__MOCK_DATA__;
    if (!event) return null;
    const channel = CHANNELS.find((c) => c.id === event.channelId);
    const organizer = USERS.find((u) => u.id === event.organizerId);
    const myAttendee = event.attendees.find((a) => a.userId === CURRENT_USER.id);
    const myStatus = myAttendee?.status || 'pending';

    const accepted = event.attendees.filter((a) => a.status === 'accepted');
    const maybe = event.attendees.filter((a) => a.status === 'maybe');
    const declined = event.attendees.filter((a) => a.status === 'declined');
    const pending = event.attendees.filter((a) => a.status === 'pending');

    return (
      <Drawer
        anchor="right"
        open={!!event}
        onClose={onClose}
        PaperProps={{ sx: { width: 420, maxWidth: '100%' } }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', p: 2, gap: 1 }}>
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: event.color }} />
          <Typography sx={{ flexGrow: 1, fontSize: 12, color: 'text.secondary' }}>
            {channel ? `# ${channel.name}` : ''}
          </Typography>
          <Tooltip title="編集">
            <IconButton size="small">
              <Icon name="edit" size={18} />
            </IconButton>
          </Tooltip>
          <Tooltip title="共有">
            <IconButton size="small">
              <Icon name="share" size={18} />
            </IconButton>
          </Tooltip>
          <Tooltip title="削除">
            <IconButton size="small">
              <Icon name="delete" size={18} />
            </IconButton>
          </Tooltip>
          <IconButton size="small" onClick={onClose}>
            <Icon name="close" size={18} />
          </IconButton>
        </Box>
        <Divider />

        <Box sx={{ p: 3, overflow: 'auto', flexGrow: 1 }}>
          <Typography sx={{ fontSize: 20, fontWeight: 600, mb: 2, lineHeight: 1.3 }}>
            {event.title}
          </Typography>

          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <Box sx={{ color: 'text.secondary', pt: 0.25 }}>
                <Icon name="schedule" size={20} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 14, fontWeight: 500 }}>
                  {fmt(event.start)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {fmtTime(event.start)} – {fmtTime(event.end)}
                </Typography>
              </Box>
            </Stack>

            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box sx={{ color: 'text.secondary' }}>
                <Icon name="place" size={20} />
              </Box>
              <Typography sx={{ fontSize: 14 }}>{event.location}</Typography>
            </Stack>

            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box sx={{ color: 'text.secondary' }}>
                <Icon name="person" size={20} />
              </Box>
              <Avatar sx={{ width: 22, height: 22, fontSize: 11, bgcolor: organizer?.color }}>
                {organizer?.displayName[0]}
              </Avatar>
              <Typography sx={{ fontSize: 14 }}>
                {organizer?.displayName}
                <Typography component="span" color="text.secondary" sx={{ ml: 1, fontSize: 12 }}>
                  主催者
                </Typography>
              </Typography>
            </Stack>

            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <Box sx={{ color: 'text.secondary', pt: 0.25 }}>
                <Icon name="notes" size={20} />
              </Box>
              <Typography sx={{ fontSize: 14, whiteSpace: 'pre-wrap', color: 'text.secondary' }}>
                {event.description}
              </Typography>
            </Stack>
          </Stack>

          <Divider sx={{ my: 2.5 }} />

          {/* RSVP */}
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 1 }}>参加しますか？</Typography>
            <ButtonGroup fullWidth size="small" variant="outlined">
              <Button
                variant={myStatus === 'accepted' ? 'contained' : 'outlined'}
                color="success"
                onClick={() => onRsvp(event.id, 'accepted')}
                startIcon={<Icon name="check" size={16} />}
                sx={{ textTransform: 'none' }}
              >
                参加
              </Button>
              <Button
                variant={myStatus === 'maybe' ? 'contained' : 'outlined'}
                color="warning"
                onClick={() => onRsvp(event.id, 'maybe')}
                startIcon={<Icon name="help" size={16} />}
                sx={{ textTransform: 'none' }}
              >
                未定
              </Button>
              <Button
                variant={myStatus === 'declined' ? 'contained' : 'outlined'}
                color="error"
                onClick={() => onRsvp(event.id, 'declined')}
                startIcon={<Icon name="close" size={16} />}
                sx={{ textTransform: 'none' }}
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
              const u = USERS.find((x) => x.id === a.userId);
              if (!u) return null;
              const statusIcon = {
                accepted: { name: 'check_circle', color: 'success.main' },
                maybe: { name: 'help', color: 'warning.main' },
                declined: { name: 'cancel', color: 'error.main' },
                pending: { name: 'schedule', color: 'text.disabled' },
              }[a.status];
              return (
                <ListItem key={a.userId} disableGutters sx={{ py: 0.5 }}>
                  <ListItemAvatar sx={{ minWidth: 40 }}>
                    <Avatar sx={{ width: 28, height: 28, fontSize: 12, bgcolor: u.color }}>
                      {u.displayName[0]}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={u.displayName}
                    primaryTypographyProps={{ fontSize: 13 }}
                    secondary={u.id === organizer?.id ? '主催者' : null}
                    secondaryTypographyProps={{ fontSize: 11 }}
                  />
                  <Box sx={{ color: statusIcon.color, display: 'flex' }}>
                    <Icon name={statusIcon.name} size={18} />
                  </Box>
                </ListItem>
              );
            })}
          </List>

          <Divider sx={{ my: 2.5 }} />

          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Icon name="chat_bubble" size={16} />}
              sx={{ textTransform: 'none' }}
            >
              チャンネルで議論
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Icon name="notifications" size={16} />}
              sx={{ textTransform: 'none' }}
            >
              リマインダー
            </Button>
          </Stack>
        </Box>
      </Drawer>
    );
  };
})();

window.EventDetail = EventDetail;
