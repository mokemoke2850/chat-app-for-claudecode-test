/* global React, MaterialUI, window */
const MonthView = (function () {
  const { useMemo } = React;
  const { Box, Typography, Stack, Chip, IconButton, Tooltip } = MaterialUI;
  const { Icon } = window.CalendarShell;

  const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

  function startOfMonthGrid(date) {
    const first = new Date(date.getFullYear(), date.getMonth(), 1);
    const offset = first.getDay();
    const start = new Date(first);
    start.setDate(first.getDate() - offset);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  function sameDay(a, b) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  function fmtTime(d) {
    const h = d.getHours();
    const m = d.getMinutes();
    return `${h}:${m.toString().padStart(2, '0')}`;
  }

  return function MonthView({ cursor, events, channels, channelFilter, onEventClick, onDayClick }) {
    const { TODAY } = window.__MOCK_DATA__;
    const gridStart = useMemo(() => startOfMonthGrid(cursor), [cursor]);
    const days = useMemo(() => {
      const out = [];
      for (let i = 0; i < 42; i++) {
        const d = new Date(gridStart);
        d.setDate(gridStart.getDate() + i);
        out.push(d);
      }
      return out;
    }, [gridStart]);

    const filteredEvents = useMemo(() => {
      if (!channelFilter || channelFilter.size === 0) return events;
      return events.filter((e) => channelFilter.has(e.channelId));
    }, [events, channelFilter]);

    const eventsByDay = useMemo(() => {
      const map = new Map();
      for (const e of filteredEvents) {
        const key = `${e.start.getFullYear()}-${e.start.getMonth()}-${e.start.getDate()}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(e);
      }
      for (const arr of map.values()) arr.sort((a, b) => a.start - b.start);
      return map;
    }, [filteredEvents]);

    return (
      <Box
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {/* 曜日ヘッダー */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          {WEEKDAYS.map((w, i) => (
            <Box
              key={w}
              sx={{
                px: 1,
                py: 0.75,
                textAlign: 'center',
                fontSize: 12,
                fontWeight: 500,
                color: i === 0 ? 'error.main' : i === 6 ? 'primary.main' : 'text.secondary',
              }}
            >
              {w}
            </Box>
          ))}
        </Box>

        {/* 6週グリッド */}
        <Box
          sx={{
            flexGrow: 1,
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gridTemplateRows: 'repeat(6, 1fr)',
            minHeight: 0,
          }}
        >
          {days.map((d, idx) => {
            const inMonth = d.getMonth() === cursor.getMonth();
            const isToday = sameDay(d, TODAY);
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            const dayEvents = eventsByDay.get(key) || [];
            const isSunday = d.getDay() === 0;
            const isSaturday = d.getDay() === 6;

            return (
              <Box
                key={idx}
                onClick={() => onDayClick && onDayClick(d)}
                sx={{
                  borderRight: (idx + 1) % 7 === 0 ? 0 : 1,
                  borderBottom: idx < 35 ? 1 : 0,
                  borderColor: 'divider',
                  p: 0.5,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.25,
                  minWidth: 0,
                  minHeight: 0,
                  cursor: 'pointer',
                  bgcolor: inMonth
                    ? 'transparent'
                    : (t) => (t.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'),
                  '&:hover': {
                    bgcolor: (t) =>
                      t.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                  },
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 0.25 }}>
                  <Box
                    sx={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: isToday ? 700 : 500,
                      color: isToday
                        ? 'primary.contrastText'
                        : !inMonth
                        ? 'text.disabled'
                        : isSunday
                        ? 'error.main'
                        : isSaturday
                        ? 'primary.main'
                        : 'text.primary',
                      bgcolor: isToday ? 'primary.main' : 'transparent',
                    }}
                  >
                    {d.getDate()}
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, overflow: 'hidden' }}>
                  {dayEvents.slice(0, 3).map((ev) => (
                    <Box
                      key={ev.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(ev);
                      }}
                      sx={{
                        bgcolor: ev.color,
                        color: '#fff',
                        px: 0.75,
                        py: 0.25,
                        borderRadius: 0.5,
                        fontSize: 11,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        cursor: 'pointer',
                        '&:hover': { opacity: 0.85 },
                      }}
                      title={`${fmtTime(ev.start)} ${ev.title}`}
                    >
                      <Box component="span" sx={{ opacity: 0.85, fontWeight: 500, mr: 0.5 }}>
                        {fmtTime(ev.start)}
                      </Box>
                      {ev.title}
                    </Box>
                  ))}
                  {dayEvents.length > 3 && (
                    <Typography
                      variant="caption"
                      sx={{ color: 'text.secondary', fontSize: 10, pl: 0.5 }}
                    >
                      +{dayEvents.length - 3} 件
                    </Typography>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    );
  };
})();

window.MonthView = MonthView;
