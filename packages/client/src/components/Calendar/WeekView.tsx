// Issue #152 — カレンダー週表示（時刻軸 × 7 日）

import { useEffect, useMemo, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import RepeatIcon from '@mui/icons-material/Repeat';

import { fmtTime, sameDay, startOfWeek, WEEKDAYS_JA } from '../../utils/calendar';
import type { CalendarEvent } from '@chat-app/shared';

const HOUR_HEIGHT = 48;
const START_HOUR = 7;
const END_HOUR = 22;

interface Props {
  cursor: Date;
  today: Date;
  events: CalendarEvent[];
  channelColors: Map<number, string>;
  onEventClick: (event: CalendarEvent) => void;
}

export function WeekView({ cursor, today, events, channelColors, onEventClick }: Props) {
  const weekStart = useMemo(() => startOfWeek(cursor), [cursor]);
  const days = useMemo(() => {
    const out: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      out.push(d);
    }
    return out;
  }, [weekStart]);

  const hours = useMemo(() => {
    const out: number[] = [];
    for (let h = START_HOUR; h <= END_HOUR; h++) out.push(h);
    return out;
  }, []);

  const todayInWeek = useMemo(() => days.some((d) => sameDay(d, today)), [days, today]);

  const nowTop = useMemo(() => {
    if (today.getHours() < START_HOUR || today.getHours() >= END_HOUR) return null;
    return (today.getHours() - START_HOUR) * HOUR_HEIGHT + (today.getMinutes() / 60) * HOUR_HEIGHT;
  }, [today]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = Math.max(0, (8 - START_HOUR) * HOUR_HEIGHT - 20);
    }
  }, [weekStart]);

  return (
    <Box
      sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      data-testid="calendar-week-view"
    >
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
          const isToday = sameDay(d, today);
          return (
            <Box
              key={i}
              data-testid={`week-day-${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`}
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
                {WEEKDAYS_JA[d.getDay()]}
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
            const dayEvents = events.filter((e) => sameDay(new Date(e.startsAt), day));
            const isToday = sameDay(day, today);
            return (
              <Box
                key={dayIdx}
                data-testid={`week-column-${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`}
                sx={{
                  position: 'relative',
                  borderLeft: 1,
                  borderColor: 'divider',
                  bgcolor: isToday
                    ? (t) =>
                        t.palette.mode === 'dark'
                          ? 'rgba(25,118,210,0.08)'
                          : 'rgba(25,118,210,0.04)'
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
                  const start = new Date(ev.startsAt);
                  const end = new Date(ev.endsAt);
                  const startMin = (start.getHours() - START_HOUR) * 60 + start.getMinutes();
                  const endMin = (end.getHours() - START_HOUR) * 60 + end.getMinutes();
                  const top = (startMin / 60) * HOUR_HEIGHT;
                  const height = Math.max(22, ((endMin - startMin) / 60) * HOUR_HEIGHT);
                  const color =
                    ev.channelId !== null
                      ? (channelColors.get(ev.channelId) ?? '#1976d2')
                      : '#1976d2';
                  return (
                    <Box
                      key={ev.id}
                      data-testid={`week-event-${ev.id}`}
                      data-top={top}
                      data-height={height}
                      onClick={() => onEventClick(ev)}
                      sx={{
                        position: 'absolute',
                        left: 4,
                        right: 4,
                        top,
                        height,
                        bgcolor: color,
                        color: '#fff',
                        borderRadius: 0.75,
                        px: 0.75,
                        py: 0.25,
                        cursor: 'pointer',
                        overflow: 'hidden',
                        boxShadow: 1,
                        borderLeft: `3px solid ${color}`,
                        '&:hover': { opacity: 0.9 },
                      }}
                    >
                      <Typography sx={{ fontSize: 11, opacity: 0.9, lineHeight: 1.2 }}>
                        {fmtTime(start)}–{fmtTime(end)}
                      </Typography>
                      <Typography sx={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3, mt: 0.25 }}>
                        {(ev.recurrenceRule !== null || ev.recurrenceMasterId !== null) && (
                          <RepeatIcon
                            data-testid={`week-event-recurrence-icon-${ev.id}`}
                            sx={{ fontSize: 11, mr: 0.25, verticalAlign: 'text-bottom' }}
                          />
                        )}
                        {ev.title}
                      </Typography>
                    </Box>
                  );
                })}

                {/* now line */}
                {isToday && nowTop !== null && (
                  <Box
                    data-testid={`week-now-line-${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`}
                    sx={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: nowTop,
                      height: 2,
                      bgcolor: 'error.main',
                      zIndex: 5,
                    }}
                  />
                )}
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* now-line がフラグとして取得しやすいよう不可視マーカー（テスト用） */}
      {todayInWeek && <Box data-testid="week-today-marker" sx={{ display: 'none' }} aria-hidden />}
    </Box>
  );
}
