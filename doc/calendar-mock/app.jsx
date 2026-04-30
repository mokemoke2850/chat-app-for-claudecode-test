/* global React, ReactDOM, MaterialUI, window */
(function () {
const { useState, useMemo, useEffect } = React;
const {
  Box,
  Toolbar,
  Drawer,
  CssBaseline,
  Typography,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
  Button,
  ButtonGroup,
  ToggleButton,
  ToggleButtonGroup,
  Stack,
  Chip,
  Checkbox,
  FormControlLabel,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Divider,
  Paper,
  Snackbar,
  Alert,
} = MaterialUI;
const { createTheme, ThemeProvider } = MaterialUI.styles || MaterialUI;

const { Sidebar, TopBar, Icon, DRAWER_WIDTH } = window.CalendarShell;

function App() {
  const { EVENTS, CHANNELS, POLLS, TODAY, CURRENT_USER } = window.__MOCK_DATA__;

  const [themeMode, setThemeMode] = useState(() =>
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light',
  );
  const [tweaks, setTweaks] = useState(window.__TWEAK_DEFAULTS__);
  const [tweaksOpen, setTweaksOpen] = useState(false);
  const [tweaksEnabled, setTweaksEnabled] = useState(false);

  const [view, setView] = useState(tweaks.defaultView); // month/week/agenda
  const [cursor, setCursor] = useState(new Date(TODAY));
  const [activeView, setActiveView] = useState('calendar-global'); // calendar-global | channel
  const [activeChannelId, setActiveChannelId] = useState(11);
  const [channelTab, setChannelTab] = useState('messages'); // messages | files | events

  const [events, setEvents] = useState(EVENTS);
  const [polls, setPolls] = useState(POLLS);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogDate, setDialogDate] = useState(null);
  const [snackbar, setSnackbar] = useState(null);

  // チャンネル絞り込み
  const [channelFilter, setChannelFilter] = useState(new Set(CHANNELS.map((c) => c.id)));

  // Tweaks host integration
  useEffect(() => {
    function onMessage(ev) {
      if (!ev.data || typeof ev.data !== 'object') return;
      if (ev.data.type === '__activate_edit_mode') setTweaksEnabled(true);
      if (ev.data.type === '__deactivate_edit_mode') setTweaksEnabled(false);
    }
    window.addEventListener('message', onMessage);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    if (tweaks.defaultView) setView(tweaks.defaultView);
  }, [tweaks.defaultView]);

  const theme = useMemo(() => {
    const hue = tweaks.accentHue || 210;
    return createTheme({
      palette: {
        mode: themeMode,
        primary: { main: `hsl(${hue}, 70%, ${themeMode === 'dark' ? 55 : 45}%)` },
      },
      typography: {
        fontFamily: '"Roboto","Noto Sans JP",system-ui,sans-serif',
      },
    });
  }, [themeMode, tweaks.accentHue]);

  const handleRsvp = (eventId, status) => {
    setEvents((prev) =>
      prev.map((ev) => {
        if (ev.id !== eventId) return ev;
        const attendees = ev.attendees.some((a) => a.userId === CURRENT_USER.id)
          ? ev.attendees.map((a) =>
              a.userId === CURRENT_USER.id ? { ...a, status } : a,
            )
          : [...ev.attendees, { userId: CURRENT_USER.id, status }];
        return { ...ev, attendees };
      }),
    );
    setSelectedEvent((prev) => {
      if (!prev || prev.id !== eventId) return prev;
      const attendees = prev.attendees.some((a) => a.userId === CURRENT_USER.id)
        ? prev.attendees.map((a) =>
            a.userId === CURRENT_USER.id ? { ...a, status } : a,
          )
        : [...prev.attendees, { userId: CURRENT_USER.id, status }];
      return { ...prev, attendees };
    });
    setSnackbar({
      message:
        status === 'accepted'
          ? '参加を記録しました'
          : status === 'maybe'
          ? '未定として回答しました'
          : '不参加として回答しました',
      severity:
        status === 'accepted' ? 'success' : status === 'maybe' ? 'warning' : 'info',
    });
  };

  const handleVote = (pollId, candidateId, value) => {
    setPolls((prev) =>
      prev.map((p) => {
        if (p.id !== pollId) return p;
        const next = { ...(p.votes[CURRENT_USER.id] || {}) };
        if (value === null) delete next[candidateId];
        else next[candidateId] = value;
        return { ...p, votes: { ...p.votes, [CURRENT_USER.id]: next } };
      }),
    );
  };

  const handleNewEvent = (dateHint) => {
    setDialogDate(dateHint || null);
    setDialogOpen(true);
  };

  const navigateCursor = (delta) => {
    const d = new Date(cursor);
    if (view === 'month' || view === 'agenda') {
      d.setMonth(d.getMonth() + delta);
    } else {
      d.setDate(d.getDate() + delta * 7);
    }
    setCursor(d);
  };

  const label = useMemo(() => {
    if (view === 'week') {
      const start = new Date(cursor);
      start.setDate(cursor.getDate() - cursor.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `${start.getFullYear()}年${start.getMonth() + 1}月${start.getDate()}日 – ${end.getMonth() + 1}月${end.getDate()}日`;
    }
    return `${cursor.getFullYear()}年 ${cursor.getMonth() + 1}月`;
  }, [cursor, view]);

  const activeChannel = CHANNELS.find((c) => c.id === activeChannelId);

  const toggleChannelFilter = (id) => {
    setChannelFilter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', height: '100vh' }}>
        <TopBar
          onToggleTheme={() => setThemeMode((m) => (m === 'dark' ? 'light' : 'dark'))}
          themeMode={themeMode}
          onToggleTweaks={() => setTweaksOpen((o) => !o)}
          tweaksOn={tweaksOpen}
          onNewEvent={() => handleNewEvent(null)}
        />

        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
          }}
        >
          <Toolbar />
          <Sidebar
            activeChannelId={activeChannelId}
            onSelectChannel={(id) => {
              setActiveChannelId(id);
              setActiveView('channel');
              setChannelTab('events');
            }}
            activeView={activeView}
            onSelectView={setActiveView}
          />
        </Drawer>

        <Box
          component="main"
          sx={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            bgcolor: 'background.default',
          }}
        >
          <Toolbar />

          {activeView === 'calendar-global' && (
            <>
              {/* カレンダーヘッダー */}
              <Box
                sx={{
                  px: 3,
                  py: 1.5,
                  borderBottom: 1,
                  borderColor: 'divider',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setCursor(new Date(TODAY))}
                  sx={{ textTransform: 'none' }}
                >
                  今日
                </Button>
                <IconButton size="small" onClick={() => navigateCursor(-1)}>
                  <Icon name="chevron_left" size={22} />
                </IconButton>
                <IconButton size="small" onClick={() => navigateCursor(1)}>
                  <Icon name="chevron_right" size={22} />
                </IconButton>
                <Typography sx={{ fontSize: 18, fontWeight: 500, minWidth: 220 }}>
                  {label}
                </Typography>

                <Box sx={{ flexGrow: 1 }} />

                <ToggleButtonGroup
                  value={view}
                  exclusive
                  size="small"
                  onChange={(_, v) => v && setView(v)}
                >
                  <ToggleButton value="month" sx={{ textTransform: 'none', px: 2 }}>
                    <Icon name="calendar_view_month" size={18} />
                    <Box component="span" sx={{ ml: 0.75 }}>月</Box>
                  </ToggleButton>
                  <ToggleButton value="week" sx={{ textTransform: 'none', px: 2 }}>
                    <Icon name="calendar_view_week" size={18} />
                    <Box component="span" sx={{ ml: 0.75 }}>週</Box>
                  </ToggleButton>
                  <ToggleButton value="agenda" sx={{ textTransform: 'none', px: 2 }}>
                    <Icon name="view_agenda" size={18} />
                    <Box component="span" sx={{ ml: 0.75 }}>アジェンダ</Box>
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>

              <Box sx={{ flexGrow: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
                {/* チャンネル絞り込みサイドバー */}
                <Box
                  sx={{
                    width: 220,
                    flexShrink: 0,
                    borderRight: 1,
                    borderColor: 'divider',
                    p: 2,
                    overflow: 'auto',
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'block',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      fontSize: 10,
                      color: 'text.secondary',
                      mb: 1,
                    }}
                  >
                    チャンネル絞り込み
                  </Typography>
                  <Stack spacing={0.25}>
                    {CHANNELS.map((c) => (
                      <FormControlLabel
                        key={c.id}
                        control={
                          <Checkbox
                            size="small"
                            checked={channelFilter.has(c.id)}
                            onChange={() => toggleChannelFilter(c.id)}
                            sx={{
                              color: c.color,
                              '&.Mui-checked': { color: c.color },
                              p: 0.5,
                            }}
                          />
                        }
                        label={
                          <Typography sx={{ fontSize: 13 }}># {c.name}</Typography>
                        }
                      />
                    ))}
                  </Stack>

                  <Divider sx={{ my: 2 }} />

                  <Typography
                    variant="caption"
                    sx={{
                      display: 'block',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      fontSize: 10,
                      color: 'text.secondary',
                      mb: 1,
                    }}
                  >
                    今日の予定
                  </Typography>
                  <Stack spacing={0.75}>
                    {events
                      .filter(
                        (e) =>
                          e.start.getFullYear() === TODAY.getFullYear() &&
                          e.start.getMonth() === TODAY.getMonth() &&
                          e.start.getDate() === TODAY.getDate(),
                      )
                      .map((e) => (
                        <Box
                          key={e.id}
                          onClick={() => setSelectedEvent(e)}
                          sx={{
                            p: 0.75,
                            borderLeft: `3px solid ${e.color}`,
                            cursor: 'pointer',
                            borderRadius: 0.5,
                            '&:hover': {
                              bgcolor: (t) =>
                                t.palette.mode === 'dark'
                                  ? 'rgba(255,255,255,0.04)'
                                  : 'rgba(0,0,0,0.03)',
                            },
                          }}
                        >
                          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                            {e.start.getHours()}:
                            {e.start.getMinutes().toString().padStart(2, '0')}
                          </Typography>
                          <Typography sx={{ fontSize: 12, fontWeight: 500 }} noWrap>
                            {e.title}
                          </Typography>
                        </Box>
                      ))}
                  </Stack>
                </Box>

                {/* メイン */}
                <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  {view === 'month' && (
                    <window.MonthView
                      cursor={cursor}
                      events={events}
                      channels={CHANNELS}
                      channelFilter={channelFilter}
                      onEventClick={setSelectedEvent}
                      onDayClick={(d) => handleNewEvent(d)}
                    />
                  )}
                  {view === 'week' && (
                    <window.WeekView
                      cursor={cursor}
                      events={events}
                      channelFilter={channelFilter}
                      onEventClick={setSelectedEvent}
                    />
                  )}
                  {view === 'agenda' && (
                    <window.AgendaView
                      cursor={cursor}
                      events={events}
                      channels={CHANNELS}
                      channelFilter={channelFilter}
                      onEventClick={setSelectedEvent}
                    />
                  )}
                </Box>
              </Box>
            </>
          )}

          {activeView === 'channel' && activeChannel && (
            <>
              <Box sx={{ px: 3, pt: 1.5, borderBottom: 1, borderColor: 'divider' }}>
                <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                  # {activeChannel.name}
                </Typography>
                <Typography sx={{ fontSize: 13, color: 'text.secondary', pb: 1 }}>
                  デザインチームの議論とレビュー。
                </Typography>
                <Tabs
                  value={channelTab}
                  onChange={(_, v) => setChannelTab(v)}
                  sx={{ minHeight: 36 }}
                >
                  <Tab label="メッセージ" value="messages" sx={{ minHeight: 36, py: 0, textTransform: 'none' }} />
                  <Tab label="ファイル" value="files" sx={{ minHeight: 36, py: 0, textTransform: 'none' }} />
                  <Tab
                    icon={<Icon name="event" size={16} />}
                    iconPosition="start"
                    label={
                      <Box component="span">
                        予定
                        <Chip
                          size="small"
                          label={
                            events.filter(
                              (e) => e.channelId === activeChannel.id && e.start >= TODAY,
                            ).length
                          }
                          sx={{ ml: 0.75, height: 16, fontSize: 10 }}
                        />
                      </Box>
                    }
                    value="events"
                    sx={{ minHeight: 36, py: 0, textTransform: 'none' }}
                  />
                </Tabs>
              </Box>

              {channelTab === 'events' && (
                <window.ChannelCalendarPanel
                  channel={activeChannel}
                  onEventClick={setSelectedEvent}
                  onNewEvent={() => handleNewEvent(null)}
                  onVote={handleVote}
                />
              )}
              {channelTab === 'messages' && (
                <Box sx={{ p: 3, flexGrow: 1, overflow: 'auto' }}>
                  <Paper
                    variant="outlined"
                    sx={{ p: 2, maxWidth: 720, mx: 'auto', mb: 2 }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                      <Icon name="event" size={18} />
                      <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                        チャンネルにイベントカードが投稿されました
                      </Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      「予定」タブで詳細を確認できます。メッセージ欄は既存UIの雰囲気を示すプレースホルダーです。
                    </Typography>
                  </Paper>

                  <Box sx={{ textAlign: 'center', color: 'text.secondary', py: 8 }}>
                    <Icon name="forum" size={48} />
                    <Typography sx={{ mt: 1 }}>
                      メッセージ表示は既存コンポーネントが入ります
                    </Typography>
                  </Box>
                </Box>
              )}
              {channelTab === 'files' && (
                <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
                  <Icon name="folder" size={48} />
                  <Typography sx={{ mt: 1 }}>ファイルタブ（既存機能）</Typography>
                </Box>
              )}
            </>
          )}
        </Box>

        <window.EventDetail
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onRsvp={handleRsvp}
        />

        <window.EventDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          initialDate={dialogDate}
          onCreate={(ev) => {
            setSnackbar({
              message: `「${ev.title}」を作成しました（モック）`,
              severity: 'success',
            });
          }}
        />

        <window.TweaksPanel
          open={tweaksOpen || tweaksEnabled}
          onClose={() => {
            setTweaksOpen(false);
            setTweaksEnabled(false);
          }}
          tweaks={tweaks}
          onChange={(patch) => {
            const next = { ...tweaks, ...patch };
            setTweaks(next);
            window.parent.postMessage(
              { type: '__edit_mode_set_keys', edits: patch },
              '*',
            );
          }}
        />

        <Snackbar
          open={!!snackbar}
          autoHideDuration={3000}
          onClose={() => setSnackbar(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          {snackbar && (
            <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar(null)}>
              {snackbar.message}
            </Alert>
          )}
        </Snackbar>
      </Box>
    </ThemeProvider>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
})();
