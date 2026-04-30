// Issue #152 — グローバルカレンダー画面 (/calendar)
// React 19 use() + Suspense パターン（CLAUDE.md フロントエンド開発ルール）

import { Suspense, use, useMemo, useState } from 'react';
import { Box, CircularProgress } from '@mui/material';

import AppLayout from '../components/Layout/AppLayout';
import { CalendarHeader, type CalendarViewMode } from '../components/Calendar/CalendarHeader';
import { ChannelFilterPanel } from '../components/Calendar/ChannelFilterPanel';
import { MonthView } from '../components/Calendar/MonthView';
import { api } from '../api/client';
import { channelColorFromName, endOfMonth, startOfMonth } from '../utils/calendar';
import type { CalendarEvent, Channel } from '@chat-app/shared';

const eventsCache = new Map<string, Promise<{ events: CalendarEvent[] }>>();
let channelsPromiseCache: Promise<{ channels: Channel[] }> | null = null;

function getOrCreateEventsPromise(
  year: number,
  month: number,
): Promise<{ events: CalendarEvent[] }> {
  const key = `${year}-${month}`;
  let cached = eventsCache.get(key);
  if (!cached) {
    const from = startOfMonth(new Date(year, month, 1)).toISOString();
    const to = endOfMonth(new Date(year, month, 1)).toISOString();
    cached = api.calendar.events.list({ from, to });
    eventsCache.set(key, cached);
  }
  return cached;
}

function getOrCreateChannelsPromise(): Promise<{ channels: Channel[] }> {
  if (!channelsPromiseCache) {
    channelsPromiseCache = api.channels.list();
  }
  return channelsPromiseCache;
}

interface ContentProps {
  cursor: Date;
  view: CalendarViewMode;
  channelsPromise: Promise<{ channels: Channel[] }>;
  eventsPromise: Promise<{ events: CalendarEvent[] }>;
  onEventClick: (event: CalendarEvent) => void;
  onDayClick: (date: Date) => void;
}

function CalendarContent({
  cursor,
  view,
  channelsPromise,
  eventsPromise,
  onEventClick,
  onDayClick,
}: ContentProps) {
  const { channels } = use(channelsPromise);
  const { events } = use(eventsPromise);

  const channelColors = useMemo(() => {
    const m = new Map<number, string>();
    for (const c of channels) m.set(c.id, channelColorFromName(c.name));
    return m;
  }, [channels]);

  // null = 未操作（全チャンネル選択）。初回操作で Set 化する
  const [localFilter, setLocalFilter] = useState<Set<number> | null>(null);
  const effectiveFilter: Set<number> = useMemo(
    () => localFilter ?? new Set(channels.map((c) => c.id)),
    [localFilter, channels],
  );

  const filteredEvents = useMemo(
    () => events.filter((e) => e.channelId === null || effectiveFilter.has(e.channelId)),
    [events, effectiveFilter],
  );

  const today = useMemo(() => new Date(), []);

  const handleToggleChannel = (id: number) => {
    setLocalFilter((prev) => {
      const base = prev ?? new Set(channels.map((c) => c.id));
      const next = new Set(base);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Box sx={{ flexGrow: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
      <ChannelFilterPanel
        channels={channels}
        channelColors={channelColors}
        channelFilter={effectiveFilter}
        onToggleChannel={handleToggleChannel}
        events={filteredEvents}
        today={today}
        onEventClick={onEventClick}
      />
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {view === 'month' && (
          <MonthView
            cursor={cursor}
            today={today}
            events={filteredEvents}
            channelColors={channelColors}
            onEventClick={onEventClick}
            onDayClick={onDayClick}
          />
        )}
        {view !== 'month' && (
          <Box sx={{ p: 4, color: 'text.secondary' }} data-testid="calendar-view-placeholder">
            （Phase F〜G で実装予定: {view}）
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default function CalendarPage() {
  const [cursor, setCursor] = useState(() => new Date());
  const [view, setView] = useState<CalendarViewMode>('month');

  const eventsPromise = useMemo(
    () => getOrCreateEventsPromise(cursor.getFullYear(), cursor.getMonth()),
    [cursor],
  );
  const [channelsPromise] = useState(() => getOrCreateChannelsPromise());

  const navigate = (delta: number) => {
    setCursor((prev) => {
      const d = new Date(prev);
      if (view === 'week') d.setDate(d.getDate() + delta * 7);
      else d.setMonth(d.getMonth() + delta);
      return d;
    });
  };

  return (
    <AppLayout sidebar={<div />}>
      <CalendarHeader
        cursor={cursor}
        view={view}
        onChangeView={setView}
        onPrev={() => navigate(-1)}
        onNext={() => navigate(1)}
        onToday={() => setCursor(new Date())}
      />
      <Suspense
        fallback={
          <Box
            sx={{
              flexGrow: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CircularProgress />
          </Box>
        }
      >
        <CalendarContent
          cursor={cursor}
          view={view}
          channelsPromise={channelsPromise}
          eventsPromise={eventsPromise}
          onEventClick={(e) => {
            // Phase G で EventDetailDrawer を開く
            void e;
          }}
          onDayClick={(d) => {
            // Phase G で EventDialog を開く
            void d;
          }}
        />
      </Suspense>
    </AppLayout>
  );
}
