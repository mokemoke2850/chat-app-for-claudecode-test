/* global React, MaterialUI, window */
const AgendaView = (function () {
  const { useMemo } = React;
  const { Box, Typography, Avatar, AvatarGroup, Chip, Stack, Divider } = MaterialUI;
  const { Icon } = window.CalendarShell;

  function fmtTime(d) {
    const h = d.getHours();
    const m = d.getMinutes();
    return `${h}:${m.toString().padStart(2, '0')}`;
  }

  function fmtDate(d) {
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    return `${d.getMonth() + 1}月${d.getDate()}日 (${weekdays[d.getDay()]})`;
  }

  function sameDay(a, b) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  return function AgendaView({ cursor, events, channels, channelFilter, onEventClick }) {
    const { TODAY, USERS } = window.__MOCK_DATA__;

    const filtered = useMemo(() => {
      const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59);
      let list = events.filter((e) => e.start >= start && e.start <= end);
      if (channelFilter && channelFilter.size > 0) {
        list = list.filter((e) => channelFilter.has(e.channelId));
      }
      return list.sort((a, b) => a.start - b.start);
    }, [events, cursor, channelFilter]);

    // 日付ごとにグルーピング
    const groups = useMemo(() => {
      const map = new Map();
      for (const e of filtered) {
        const k = `${e.start.getFullYear()}-${e.start.getMonth()}-${e.start.getDate()}`;
        if (!map.has(k)) map.set(k, { date: e.start, events: [] });
        map.get(k).events.push(e);
      }
      return Array.from(map.values());
    }, [filtered]);

    return (
      <Box sx={{ flexGrow: 1, overflow: 'auto', px: { xs: 2, md: 4 }, py: 2 }}>
        <Box sx={{ maxWidth: 760, mx: 'auto' }}>
          {groups.length === 0 && (
            <Box sx={{ py: 8, textAlign: 'center', color: 'text.secondary' }}>
              <Icon name="event_busy" size={48} />
              <Typography sx={{ mt: 1 }}>この月には予定がありません</Typography>
            </Box>
          )}

          {groups.map((group) => {
            const isToday = sameDay(group.date, TODAY);
            return (
              <Box key={group.date.toISOString()} sx={{ mb: 3 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 1,
                    mb: 1,
                    position: 'sticky',
                    top: 0,
                    py: 1,
                    bgcolor: 'background.default',
                    zIndex: 1,
                  }}
                >
                  <Typography variant="h6" sx={{ fontSize: 16, fontWeight: 600 }}>
                    {fmtDate(group.date)}
                  </Typography>
                  {isToday && (
                    <Chip
                      label="今日"
                      size="small"
                      color="primary"
                      sx={{ height: 20, fontSize: 11 }}
                    />
                  )}
                  <Typography variant="caption" color="text.secondary">
                    {group.events.length} 件
                  </Typography>
                </Box>

                <Stack spacing={1}>
                  {group.events.map((ev) => {
                    const myStatus = ev.attendees.find(
                      (a) => a.userId === window.__MOCK_DATA__.CURRENT_USER.id,
                    )?.status;
                    const channel = channels.find((c) => c.id === ev.channelId);
                    return (
                      <Box
                        key={ev.id}
                        onClick={() => onEventClick(ev)}
                        sx={{
                          display: 'flex',
                          gap: 2,
                          p: 1.5,
                          borderRadius: 1.5,
                          border: 1,
                          borderColor: 'divider',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          '&:hover': {
                            borderColor: 'primary.main',
                            bgcolor: (t) =>
                              t.palette.mode === 'dark'
                                ? 'rgba(255,255,255,0.03)'
                                : 'rgba(0,0,0,0.02)',
                          },
                        }}
                      >
                        <Box
                          sx={{
                            width: 4,
                            alignSelf: 'stretch',
                            bgcolor: ev.color,
                            borderRadius: 2,
                          }}
                        />
                        <Box sx={{ minWidth: 80 }}>
                          <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                            {fmtTime(ev.start)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {fmtTime(ev.end)}
                          </Typography>
                        </Box>
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                          <Typography sx={{ fontSize: 14, fontWeight: 600, mb: 0.5 }}>
                            {ev.title}
                          </Typography>
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                            {channel && (
                              <Chip
                                label={`# ${channel.name}`}
                                size="small"
                                sx={{
                                  height: 20,
                                  fontSize: 11,
                                  bgcolor: channel.color,
                                  color: '#fff',
                                }}
                              />
                            )}
                            <Stack direction="row" spacing={0.5} alignItems="center">
                              <Icon name="place" size={14} />
                              <Typography variant="caption" color="text.secondary">
                                {ev.location}
                              </Typography>
                            </Stack>
                          </Stack>
                        </Box>
                        <Box
                          sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-end',
                            gap: 0.5,
                          }}
                        >
                          <AvatarGroup
                            max={4}
                            sx={{ '& .MuiAvatar-root': { width: 22, height: 22, fontSize: 10 } }}
                          >
                            {ev.attendees.map((a) => {
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
                              sx={{ height: 20, fontSize: 10 }}
                            />
                          )}
                        </Box>
                      </Box>
                    );
                  })}
                </Stack>
              </Box>
            );
          })}
        </Box>
      </Box>
    );
  };
})();

window.AgendaView = AgendaView;
