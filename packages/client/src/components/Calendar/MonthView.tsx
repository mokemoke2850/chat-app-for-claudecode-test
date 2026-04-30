// Issue #152 — カレンダー月表示（7×6 グリッド）

import { useMemo } from 'react';
import { Box, Typography } from '@mui/material';

import { WEEKDAYS_JA, fmtTime, sameDay, startOfMonthGrid } from '../../utils/calendar';
import type { CalendarEvent } from '@chat-app/shared';

interface Props {
  cursor: Date;
  today: Date;
  events: CalendarEvent[];
  channelColors: Map<number, string>;
  onEventClick: (event: CalendarEvent) => void;
  onDayClick: (date: Date) => void;
}

const GRID_DAYS = 42;

export function MonthView({
  cursor,
  today,
  events,
  channelColors,
  onEventClick,
  onDayClick,
}: Props) {
  const gridStart = useMemo(() => startOfMonthGrid(cursor), [cursor]);

  const days = useMemo(() => {
    const out: Date[] = [];
    for (let i = 0; i < GRID_DAYS; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      out.push(d);
    }
    return out;
  }, [gridStart]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const start = new Date(e.startsAt);
      const key = `${start.getFullYear()}-${start.getMonth()}-${start.getDate()}`;
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    }
    return map;
  }, [events]);

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
        {WEEKDAYS_JA.map((w, i) => (
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

      <Box
        sx={{
          flexGrow: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gridTemplateRows: 'repeat(6, 1fr)',
          minHeight: 0,
        }}
        data-testid="calendar-month-grid"
      >
        {days.map((d, idx) => {
          const inMonth = d.getMonth() === cursor.getMonth();
          const isToday = sameDay(d, today);
          const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
          const dayEvents = eventsByDay.get(key) ?? [];
          const isSunday = d.getDay() === 0;
          const isSaturday = d.getDay() === 6;
          return (
            <Box
              key={idx}
              data-testid={`day-cell-${key}`}
              data-in-month={inMonth ? 'true' : 'false'}
              data-today={isToday ? 'true' : 'false'}
              onClick={() => onDayClick(d)}
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
                  : (t) =>
                      t.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                '&:hover': {
                  bgcolor: (t) =>
                    t.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                },
              }}
            >
              <Box sx={{ display: 'flex' }}>
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
                {dayEvents.slice(0, 3).map((ev) => {
                  const color =
                    ev.channelId !== null
                      ? (channelColors.get(ev.channelId) ?? '#1976d2')
                      : '#1976d2';
                  const startDate = new Date(ev.startsAt);
                  return (
                    <Box
                      key={ev.id}
                      data-testid={`event-block-${ev.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(ev);
                      }}
                      sx={{
                        bgcolor: color,
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
                      title={`${fmtTime(startDate)} ${ev.title}`}
                    >
                      <Box component="span" sx={{ opacity: 0.85, fontWeight: 500, mr: 0.5 }}>
                        {fmtTime(startDate)}
                      </Box>
                      {ev.title}
                    </Box>
                  );
                })}
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
}
