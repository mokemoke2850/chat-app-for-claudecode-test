// Issue #152 — グローバルカレンダー画面 (/calendar)
// React 19 use() + Suspense パターン（CLAUDE.md フロントエンド開発ルール）

import { Suspense, use, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, CircularProgress, Drawer, IconButton, Tooltip, useMediaQuery } from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import CloseIcon from '@mui/icons-material/Close';

import AppLayout from '../components/Layout/AppLayout';
import ChannelList from '../components/Channel/ChannelList';
import SidebarDmList from '../components/Layout/SidebarDmList';
import { CalendarHeader, type CalendarViewMode } from '../components/Calendar/CalendarHeader';
import { ChannelFilterPanel } from '../components/Calendar/ChannelFilterPanel';
import { MonthView } from '../components/Calendar/MonthView';
import { WeekView } from '../components/Calendar/WeekView';
import { AgendaView } from '../components/Calendar/AgendaView';
import { EventDetailDrawer } from '../components/Calendar/EventDetailDrawer';
import { EventDialog } from '../components/Calendar/EventDialog';
import { PollListDrawer } from '../components/Calendar/PollListDrawer';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/client';
import { channelColorFromName, endOfMonth, startOfMonth } from '../utils/calendar';
import type { CalendarEvent, Channel, User } from '@chat-app/shared';

const eventsCache = new Map<string, Promise<{ events: CalendarEvent[] }>>();
let channelsPromiseCache: Promise<{ channels: Channel[] }> | null = null;
let usersPromiseCache: Promise<{ users: User[] }> | null = null;

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

function getOrCreateUsersPromise(): Promise<{ users: User[] }> {
  if (!usersPromiseCache) {
    usersPromiseCache = api.auth.users();
  }
  return usersPromiseCache;
}

interface ContentProps {
  cursor: Date;
  view: CalendarViewMode;
  channelsPromise: Promise<{ channels: Channel[] }>;
  eventsPromise: Promise<{ events: CalendarEvent[] }>;
  usersPromise: Promise<{ users: User[] }>;
  currentUserId: number;
  refresh: () => void;
}

function CalendarContent({
  cursor,
  view,
  channelsPromise,
  eventsPromise,
  usersPromise,
  currentUserId,
  refresh,
}: ContentProps) {
  const { channels } = use(channelsPromise);
  const { events } = use(eventsPromise);
  const { users } = use(usersPromise);

  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogDate, setDialogDate] = useState<Date | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 767px)');

  const channelColors = useMemo(() => {
    const m = new Map<number, string>();
    for (const c of channels) m.set(c.id, channelColorFromName(c.name));
    return m;
  }, [channels]);

  // null = 未操作（全チャンネル選択 + ワークスペース全体イベント表示）。初回操作で Set 化する
  const [localFilter, setLocalFilter] = useState<Set<number> | null>(null);
  const effectiveFilter: Set<number> = useMemo(
    () => localFilter ?? new Set(channels.map((c) => c.id)),
    [localFilter, channels],
  );

  // ワークスペース全体イベント (channel_id IS NULL) は「未操作時のみ」表示する。
  // ユーザーが明示的にチャンネルを絞り込んだ場合 (localFilter !== null) は除外。
  // → サーバ側 listEventsInRange の channelIds 指定時挙動と整合させる。
  const filteredEvents = useMemo(
    () =>
      events.filter((e) => {
        if (e.channelId === null) return localFilter === null;
        return effectiveFilter.has(e.channelId);
      }),
    [events, effectiveFilter, localFilter],
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

  const handleEventClick = (e: CalendarEvent) => setSelectedEvent(e);
  const handleDayClick = (d: Date) => {
    setEditingEvent(null);
    setDialogDate(d);
    setDialogOpen(true);
  };

  const handleEdit = (ev: CalendarEvent) => {
    setSelectedEvent(null);
    setEditingEvent(ev);
    setDialogDate(null);
    setDialogOpen(true);
  };

  return (
    <>
      <Box sx={{ flexGrow: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
        {/* デスクトップ: 左ペインとして常時表示 / モバイル: Drawer 経由 */}
        {!isMobile && (
          <ChannelFilterPanel
            channels={channels}
            channelColors={channelColors}
            channelFilter={effectiveFilter}
            onToggleChannel={handleToggleChannel}
            events={filteredEvents}
            today={today}
            onEventClick={handleEventClick}
          />
        )}

        {/* モバイル: フィルター Drawer */}
        {isMobile && (
          <Drawer
            anchor="left"
            open={filterDrawerOpen}
            onClose={() => setFilterDrawerOpen(false)}
            PaperProps={{ sx: { width: 280 } }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                px: 1,
                py: 0.5,
                borderBottom: '1px solid var(--border)',
              }}
            >
              <IconButton
                size="small"
                aria-label="閉じる"
                onClick={() => setFilterDrawerOpen(false)}
              >
                <CloseIcon />
              </IconButton>
            </Box>
            <ChannelFilterPanel
              channels={channels}
              channelColors={channelColors}
              channelFilter={effectiveFilter}
              onToggleChannel={handleToggleChannel}
              events={filteredEvents}
              today={today}
              onEventClick={(e) => {
                handleEventClick(e);
                setFilterDrawerOpen(false);
              }}
              isDrawer={true}
            />
          </Drawer>
        )}

        {/* カレンダーメインエリア */}
        <Box
          data-testid="calendar-main-area"
          sx={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            width: isMobile ? '100%' : undefined,
          }}
        >
          {/* モバイル: フィルターボタン */}
          {isMobile && (
            <Box sx={{ px: 1, py: 0.5, flexShrink: 0 }}>
              <Tooltip title="フィルター">
                <IconButton
                  size="small"
                  aria-label="フィルターを開く"
                  onClick={() => setFilterDrawerOpen(true)}
                >
                  <FilterListIcon />
                </IconButton>
              </Tooltip>
            </Box>
          )}

          {view === 'month' && (
            <MonthView
              cursor={cursor}
              today={today}
              events={filteredEvents}
              channelColors={channelColors}
              onEventClick={handleEventClick}
              onDayClick={handleDayClick}
            />
          )}
          {view === 'week' && (
            <WeekView
              cursor={cursor}
              today={today}
              events={filteredEvents}
              channelColors={channelColors}
              onEventClick={handleEventClick}
            />
          )}
          {view === 'agenda' && (
            <AgendaView
              cursor={cursor}
              today={today}
              events={filteredEvents}
              channels={channels}
              channelColors={channelColors}
              users={users}
              currentUserId={currentUserId}
              onEventClick={handleEventClick}
            />
          )}
        </Box>
      </Box>

      <EventDetailDrawer
        event={selectedEvent}
        channels={channels}
        channelColors={channelColors}
        users={users}
        currentUserId={currentUserId}
        onClose={() => setSelectedEvent(null)}
        onEdit={handleEdit}
        onRsvpUpdated={() => {
          // 自分の RSVP 反映後は当月キャッシュをクリアして再フェッチ
          refresh();
          setSelectedEvent(null);
        }}
        onDeleted={() => {
          refresh();
          setSelectedEvent(null);
        }}
      />

      <EventDialog
        open={dialogOpen}
        channels={channels}
        users={users}
        initialDate={dialogDate}
        event={editingEvent}
        onClose={() => {
          setDialogOpen(false);
          setEditingEvent(null);
          setDialogDate(null);
        }}
        onCreated={() => {
          refresh();
          setDialogOpen(false);
        }}
        onUpdated={() => {
          refresh();
          setDialogOpen(false);
          setEditingEvent(null);
        }}
        onPollCreated={() => {
          // poll 作成は events と無関係なので refresh しない（PollHeatmap 側で別途扱う）
          setDialogOpen(false);
        }}
      />
    </>
  );
}

export default function CalendarPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [cursor, setCursor] = useState(() => new Date());
  const [view, setView] = useState<CalendarViewMode>('month');
  const [pollsDrawerOpen, setPollsDrawerOpen] = useState(false);

  // ?date=today: カーソルを今日にリセットする
  useEffect(() => {
    if (searchParams.get('date') === 'today') {
      setCursor(new Date());
    }
  }, [searchParams]);

  const eventsPromise = useMemo(
    () => getOrCreateEventsPromise(cursor.getFullYear(), cursor.getMonth()),
    [cursor],
  );
  const [channelsPromise] = useState(() => getOrCreateChannelsPromise());
  const [usersPromise] = useState(() => getOrCreateUsersPromise());

  const goByDelta = (delta: number) => {
    setCursor((prev) => {
      const d = new Date(prev);
      if (view === 'week') d.setDate(d.getDate() + delta * 7);
      else d.setMonth(d.getMonth() + delta);
      return d;
    });
  };

  const refresh = () => {
    const key = `${cursor.getFullYear()}-${cursor.getMonth()}`;
    eventsCache.delete(key);
    setCursor((prev) => new Date(prev.getTime()));
  };

  const routerNavigate = useNavigate();

  return (
    <AppLayout
      defaultSidebarOpen={false}
      sidebar={
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
          <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
            <ChannelList
              activeChannelId={null}
              onSelect={(id) => routerNavigate(`/chat?channel=${id}`)}
            />
          </Box>
          <SidebarDmList />
        </Box>
      }
    >
      <CalendarHeader
        cursor={cursor}
        view={view}
        onChangeView={setView}
        onPrev={() => goByDelta(-1)}
        onNext={() => goByDelta(1)}
        onToday={() => setCursor(new Date())}
        onOpenPolls={() => setPollsDrawerOpen(true)}
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
          usersPromise={usersPromise}
          currentUserId={user?.id ?? 0}
          refresh={refresh}
        />
      </Suspense>
      <PollListDrawer
        open={pollsDrawerOpen}
        channelsPromise={channelsPromise}
        usersPromise={usersPromise}
        currentUserId={user?.id ?? 0}
        onClose={() => setPollsDrawerOpen(false)}
        onConfirmed={() => {
          refresh();
        }}
      />
    </AppLayout>
  );
}
