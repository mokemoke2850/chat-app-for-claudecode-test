/* global React, MaterialUI, window */
const WeekView = (function () {
  const { useMemo, useRef, useEffect } = React;
  const { Box, Typography } = MaterialUI;

  const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
  const HOUR_HEIGHT = 48;
  const START_HOUR = 7;
  const END_HOUR = 22;

  function sameDay(a, b) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  function startOfWeek(d) {
    const r = new Date(d);
    r.setDate(d.getDate() - d.getDay());
    r.setHours(0, 0, 0, 0);
    return r;
  }

  function fmtTime(d) {
    const h = d.getHours();
    const m = d.getMinutes();
    return `${h}:${m.toString().padStart(2, '0')}`;
  }

  return function WeekView({ cursor, events, channelFilter, onEventClick }) {
    const { TODAY } = window.__MOCK_DATA__;
    const weekStart = useMemo(() => startOfWeek(cursor), [cursor]);
    const days = useMemo(() => {
      const out = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        out.push(d);
      }
      return out;
    }, [weekStart]);
    const hours = useMemo(() => {
      const out = [];
      for (let h = START_HOUR; h <= END_HOUR; h++) out.push(h);
      return out;
    }, []);

    const filteredEvents = useMemo(() => {
      if (!channelFilter || channelFilter.size === 0) return events;
      return events.filter((e) => channelFilter.has(e.channelId));
    }, [events, channelFilter]);

    // now-line
    const nowTop =
      TODAY.getHours() >= START_HOUR && TODAY.getHours() < END_HOUR
        ? (TODAY.getHours() - START_HOUR) * HOUR_HEIGHT + (TODAY.getMinutes() / 60) * HOUR_HEIGHT
        : null;

    const containerRef = useRef(null);
    useEffect(() => {
      if (containerRef.current) {
        containerRef.current.scrollTop = Math.max(0, (8 - START_HOUR) * HOUR_HEIGHT - 20);
      }
    }, [weekStart]);

    return (
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* 曜日ヘッダー */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '64px repeat(7, 1fr)',
            borderBottom: 1,
            borderColor: 'divider',
            flexShrink: 0,
          }}
        >
          <Box />
          {days.map((d, i) => {
            const isToday = sameDay(d, TODAY);
            return (
              <Box
                key={i}
                sx={{
                  textAlign: 'center',
                  py: 1,
                  borderLeft: 1,
                  borderColor: 'divider',
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    color: i === 0 ? 'error.main' : i === 6 ? 'primary.main' : 'text.secondary',
                    display: 'block',
                    fontSize: 11,
                  }}
                >
                  {WEEKDAYS[d.getDay()]}
                </Typography>
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    fontWeight: isToday ? 700 : 500,
                    color: isToday ? 'primary.contrastText' : 'text.primary',
                    bgcolor: isToday ? 'primary.main' : 'transparent',
                    mt: 0.25,
                  }}
                >
                  {d.getDate()}
                </Box>
              </Box>
            );
          })}
        </Box>

        {/* 時間グリッド */}
        <Box ref={containerRef} sx={{ flexGrow: 1, overflow: 'auto', position: 'relative' }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '64px repeat(7, 1fr)',
              position: 'relative',
            }}
          >
            {/* 時刻ラベル列 */}
            <Box>
              {hours.map((h) => (
                <Box
                  key={h}
                  sx={{
                    height: HOUR_HEIGHT,
                    borderBottom: 1,
                    borderColor: 'divider',
                    pr: 1,
                    textAlign: 'right',
                    position: 'relative',
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      position: 'absolute',
                      right: 6,
                      top: -8,
                      fontSize: 11,
                      color: 'text.secondary',
                    }}
                  >
                    {h}:00
                  </Typography>
                </Box>
              ))}
            </Box>

            {/* 各日のカラム */}
            {days.map((day, dayIdx) => {
              const dayEvents = filteredEvents.filter((e) => sameDay(e.start, day));
              const isToday = sameDay(day, TODAY);
              return (
                <Box
                  key={dayIdx}
                  sx={{
                    position: 'relative',
                    borderLeft: 1,
                    borderColor: 'divider',
                    bgcolor: isToday
                      ? (t) => (t.palette.mode === 'dark' ? 'rgba(25,118,210,0.08)' : 'rgba(25,118,210,0.04)')
                      : 'transparent',
                  }}
                >
                  {hours.map((h) => (
                    <Box
                      key={h}
                      sx={{
                        height: HOUR_HEIGHT,
                        borderBottom: 1,
                        borderColor: 'divider',
                      }}
                    />
                  ))}

                  {/* イベントブロック */}
                  {dayEvents.map((ev) => {
                    const startMin =
                      (ev.start.getHours() - START_HOUR) * 60 + ev.start.getMinutes();
                    const endMin = (ev.end.getHours() - START_HOUR) * 60 + ev.end.getMinutes();
                    const top = (startMin / 60) * HOUR_HEIGHT;
                    const height = Math.max(22, ((endMin - startMin) / 60) * HOUR_HEIGHT);
                    return (
                      <Box
                        key={ev.id}
                        onClick={() => onEventClick(ev)}
                        sx={{
                          position: 'absolute',
                          left: 4,
                          right: 4,
                          top,
                          height,
                          bgcolor: ev.color,
                          color: '#fff',
                          borderRadius: 0.75,
                          px: 0.75,
                          py: 0.25,
                          cursor: 'pointer',
                          overflow: 'hidden',
                          boxShadow: 1,
                          borderLeft: `3px solid ${ev.color}`,
                          '&:hover': { opacity: 0.9 },
                        }}
                      >
                        <Typography sx={{ fontSize: 11, opacity: 0.9, lineHeight: 1.2 }}>
                          {fmtTime(ev.start)}–{fmtTime(ev.end)}
                        </Typography>
                        <Typography
                          sx={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3, mt: 0.25 }}
                        >
                          {ev.title}
                        </Typography>
                      </Box>
                    );
                  })}

                  {/* now line */}
                  {isToday && nowTop !== null && (
                    <Box
                      sx={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: nowTop,
                        height: 2,
                        bgcolor: 'error.main',
                        zIndex: 5,
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          left: -5,
                          top: -4,
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          bgcolor: 'error.main',
                        },
                      }}
                    />
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>
    );
  };
})();

window.WeekView = WeekView;
