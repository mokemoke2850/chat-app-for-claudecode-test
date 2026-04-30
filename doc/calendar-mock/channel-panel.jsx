/* global React, MaterialUI, window */
const ChannelCalendarPanel = (function () {
  const { useState, useMemo } = React;
  const {
    Box,
    Typography,
    Stack,
    Avatar,
    AvatarGroup,
    Chip,
    Button,
    ButtonGroup,
    Divider,
    IconButton,
    Paper,
    Tabs,
    Tab,
    Tooltip,
  } = MaterialUI;
  const { Icon } = window.CalendarShell;

  function fmtDate(d) {
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    return `${d.getMonth() + 1}/${d.getDate()} (${weekdays[d.getDay()]})`;
  }
  function fmtTime(d) {
    return `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
  }

  function EventCardInline({ event, onClick }) {
    const { USERS, CURRENT_USER } = window.__MOCK_DATA__;
    const myStatus = event.attendees.find((a) => a.userId === CURRENT_USER.id)?.status;
    return (
      <Paper
        variant="outlined"
        onClick={onClick}
        sx={{
          p: 1.5,
          cursor: 'pointer',
          borderLeft: `4px solid ${event.color}`,
          '&:hover': {
            bgcolor: (t) =>
              t.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
          },
        }}
      >
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <Box
            sx={{
              minWidth: 56,
              textAlign: 'center',
              bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'),
              borderRadius: 1,
              py: 0.5,
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
              {fmtDate(event.start)}
            </Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
              {fmtTime(event.start)}
            </Typography>
          </Box>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 0.5 }}>
              {event.title}
            </Typography>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <Icon name="place" size={12} />
              <Typography variant="caption" color="text.secondary" noWrap>
                {event.location}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.75 }}>
              <AvatarGroup
                max={4}
                sx={{ '& .MuiAvatar-root': { width: 20, height: 20, fontSize: 9 } }}
              >
                {event.attendees.map((a) => {
                  const u = USERS.find((x) => x.id === a.userId);
                  if (!u) return null;
                  return (
                    <Avatar key={a.userId} sx={{ bgcolor: u.color }}>
                      {u.displayName[0]}
                    </Avatar>
                  );
                })}
              </AvatarGroup>
              {myStatus && (
                <Chip
                  size="small"
                  label={
                    myStatus === 'accepted'
                      ? '参加'
                      : myStatus === 'maybe'
                      ? '未定'
                      : myStatus === 'declined'
                      ? '不参加'
                      : '未回答'
                  }
                  color={
                    myStatus === 'accepted'
                      ? 'success'
                      : myStatus === 'maybe'
                      ? 'warning'
                      : myStatus === 'declined'
                      ? 'error'
                      : 'default'
                  }
                  variant={myStatus === 'pending' ? 'outlined' : 'filled'}
                  sx={{ height: 18, fontSize: 10 }}
                />
              )}
            </Stack>
          </Box>
        </Stack>
      </Paper>
    );
  }

  // 参加可能時間帯の塗りつぶし型（ヒートマップ）投票UI
  function PollHeatmap({ poll, onVote }) {
    const { USERS, CURRENT_USER } = window.__MOCK_DATA__;
    const organizer = USERS.find((u) => u.id === poll.organizerId);

    // 候補ごとの yes/maybe カウント
    const counts = poll.candidates.map((c) => {
      let yes = 0,
        maybe = 0,
        no = 0;
      for (const uid of Object.keys(poll.votes)) {
        const v = poll.votes[uid][c.id];
        if (v === 'yes') yes++;
        else if (v === 'maybe') maybe++;
        else if (v === 'no') no++;
      }
      return { id: c.id, yes, maybe, no };
    });
    const maxYes = Math.max(...counts.map((c) => c.yes), 1);
    const bestId = counts.reduce((best, c) => (c.yes > (best?.yes || -1) ? c : best), null)?.id;
    const myVotes = poll.votes[CURRENT_USER.id] || {};

    const voters = Object.keys(poll.votes).map((id) => USERS.find((u) => u.id === Number(id))).filter(Boolean);

    return (
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <Icon name="how_to_vote" size={18} />
          <Typography sx={{ fontSize: 14, fontWeight: 600, flexGrow: 1 }}>
            {poll.title}
          </Typography>
          <Chip
            size="small"
            label={`締切 ${fmtDate(poll.deadline)}`}
            sx={{ height: 20, fontSize: 10 }}
          />
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
          <Avatar sx={{ width: 18, height: 18, fontSize: 9, bgcolor: organizer?.color }}>
            {organizer?.displayName[0]}
          </Avatar>
          <Typography variant="caption" color="text.secondary">
            {organizer?.displayName} が作成 · {voters.length} 人が回答済み
          </Typography>
        </Stack>

        {/* ヒートマップ（塗りつぶし型） */}
        <Box sx={{ overflowX: 'auto' }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: `120px repeat(${poll.candidates.length}, 1fr)`,
              gap: 0.5,
              minWidth: poll.candidates.length * 90 + 120,
            }}
          >
            {/* ヘッダー行: 候補日時 */}
            <Box />
            {poll.candidates.map((c, i) => {
              const cnt = counts[i];
              const isBest = c.id === bestId;
              return (
                <Box
                  key={c.id}
                  sx={{
                    textAlign: 'center',
                    p: 0.5,
                    borderRadius: 0.5,
                    bgcolor: isBest ? 'success.main' : 'transparent',
                    color: isBest ? 'success.contrastText' : 'text.primary',
                  }}
                >
                  <Typography sx={{ fontSize: 10, fontWeight: 500 }}>
                    {fmtDate(c.start)}
                  </Typography>
                  <Typography sx={{ fontSize: 11, fontWeight: 700 }}>
                    {fmtTime(c.start)}–{fmtTime(c.end)}
                  </Typography>
                  <Typography sx={{ fontSize: 10, opacity: 0.9, mt: 0.25 }}>
                    ◯ {cnt.yes} / △ {cnt.maybe}
                  </Typography>
                </Box>
              );
            })}

            {/* 投票者の各行 */}
            {voters.map((u) => (
              <React.Fragment key={u.id}>
                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ pl: 0.5 }}>
                  <Avatar sx={{ width: 20, height: 20, fontSize: 10, bgcolor: u.color }}>
                    {u.displayName[0]}
                  </Avatar>
                  <Typography sx={{ fontSize: 11 }}>
                    {u.displayName}
                    {u.id === CURRENT_USER.id && (
                      <Typography component="span" color="primary" sx={{ ml: 0.5, fontSize: 10 }}>
                        (あなた)
                      </Typography>
                    )}
                  </Typography>
                </Stack>
                {poll.candidates.map((c) => {
                  const v = poll.votes[u.id][c.id];
                  const isMe = u.id === CURRENT_USER.id;
                  const myVote = myVotes[c.id];
                  const bg =
                    v === 'yes'
                      ? 'rgba(56,142,60,0.75)'
                      : v === 'maybe'
                      ? 'rgba(245,124,0,0.55)'
                      : v === 'no'
                      ? 'rgba(211,47,47,0.35)'
                      : 'rgba(127,127,127,0.15)';
                  const label = v === 'yes' ? '◯' : v === 'maybe' ? '△' : v === 'no' ? '×' : '';
                  return (
                    <Tooltip
                      key={c.id}
                      title={isMe ? 'クリックで切替: ◯→△→×→未回答' : ''}
                      arrow
                    >
                      <Box
                        onClick={() => {
                          if (!isMe || !onVote) return;
                          const next =
                            myVote === 'yes'
                              ? 'maybe'
                              : myVote === 'maybe'
                              ? 'no'
                              : myVote === 'no'
                              ? null
                              : 'yes';
                          onVote(poll.id, c.id, next);
                        }}
                        sx={{
                          height: 28,
                          borderRadius: 0.5,
                          bgcolor: bg,
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 14,
                          fontWeight: 700,
                          cursor: isMe ? 'pointer' : 'default',
                          outline: isMe ? '1px dashed rgba(25,118,210,0.5)' : 'none',
                          '&:hover': isMe ? { opacity: 0.85 } : {},
                        }}
                      >
                        {label}
                      </Box>
                    </Tooltip>
                  );
                })}
              </React.Fragment>
            ))}

            {/* 集計行（ヒートバー） */}
            <Typography sx={{ fontSize: 10, color: 'text.secondary', pl: 0.5, pt: 0.5 }}>
              参加可能率
            </Typography>
            {counts.map((c, i) => {
              const pct = c.yes / maxYes;
              return (
                <Box
                  key={i}
                  sx={{
                    mt: 0.5,
                    height: 18,
                    borderRadius: 0.5,
                    position: 'relative',
                    bgcolor: (t) =>
                      t.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      width: `${pct * 100}%`,
                      bgcolor: c.id === bestId ? 'success.main' : 'primary.main',
                      opacity: 0.8,
                    }}
                  />
                </Box>
              );
            })}
          </Box>
        </Box>

        <Stack direction="row" spacing={1} sx={{ mt: 2 }} justifyContent="flex-end">
          <Button size="small" sx={{ textTransform: 'none' }}>
            共有
          </Button>
          <Button
            variant="contained"
            size="small"
            sx={{ textTransform: 'none' }}
            startIcon={<Icon name="event_available" size={16} />}
          >
            最多回答で確定
          </Button>
        </Stack>
      </Paper>
    );
  }

  return function ChannelCalendarPanel({ channel, onEventClick, onNewEvent, onVote }) {
    const { EVENTS, POLLS, TODAY } = window.__MOCK_DATA__;
    const [tab, setTab] = useState('upcoming');

    const channelEvents = useMemo(
      () =>
        EVENTS.filter((e) => e.channelId === channel.id).sort((a, b) => a.start - b.start),
      [channel],
    );
    const upcoming = channelEvents.filter((e) => e.start >= TODAY);
    const past = channelEvents.filter((e) => e.start < TODAY);
    const channelPolls = POLLS.filter((p) => p.channelId === channel.id);

    return (
      <Box
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* ヘッダー */}
        <Box sx={{ px: 3, py: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box>
              <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                # {channel.name}
              </Typography>
              <Typography sx={{ fontSize: 20, fontWeight: 600 }}>予定</Typography>
            </Box>
            <Box sx={{ flexGrow: 1 }} />
            <Button
              variant="outlined"
              startIcon={<Icon name="how_to_vote" size={18} />}
              sx={{ textTransform: 'none' }}
            >
              日程調整
            </Button>
            <Button
              variant="contained"
              startIcon={<Icon name="add" size={18} />}
              onClick={onNewEvent}
              sx={{ textTransform: 'none' }}
            >
              新しい予定
            </Button>
          </Stack>
        </Box>

        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ px: 3, borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label={`今後の予定 (${upcoming.length})`} value="upcoming" sx={{ textTransform: 'none' }} />
          <Tab label={`日程調整 (${channelPolls.length})`} value="polls" sx={{ textTransform: 'none' }} />
          <Tab label={`過去 (${past.length})`} value="past" sx={{ textTransform: 'none' }} />
        </Tabs>

        <Box sx={{ flexGrow: 1, overflow: 'auto', p: 3 }}>
          <Box sx={{ maxWidth: 760, mx: 'auto' }}>
            {tab === 'upcoming' && (
              <Stack spacing={1.25}>
                {upcoming.length === 0 && (
                  <Typography color="text.secondary">予定はありません</Typography>
                )}
                {upcoming.map((ev) => (
                  <EventCardInline
                    key={ev.id}
                    event={ev}
                    onClick={() => onEventClick(ev)}
                  />
                ))}
              </Stack>
            )}
            {tab === 'polls' && (
              <Stack spacing={2}>
                {channelPolls.length === 0 && (
                  <Typography color="text.secondary">日程調整はありません</Typography>
                )}
                {channelPolls.map((p) => (
                  <PollHeatmap key={p.id} poll={p} onVote={onVote} />
                ))}
              </Stack>
            )}
            {tab === 'past' && (
              <Stack spacing={1.25}>
                {past.map((ev) => (
                  <EventCardInline
                    key={ev.id}
                    event={ev}
                    onClick={() => onEventClick(ev)}
                  />
                ))}
              </Stack>
            )}
          </Box>
        </Box>
      </Box>
    );
  };
})();

window.ChannelCalendarPanel = ChannelCalendarPanel;
