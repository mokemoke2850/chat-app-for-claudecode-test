// Issue #152 — グローバルカレンダー画面 (/calendar)
// Issue #267 — タスク表示・DnD による期限変更・タスク編集ダイアログ統合
// React 19 use() + Suspense パターン（CLAUDE.md フロントエンド開発ルール）

import { Suspense, use, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, CircularProgress, Drawer, IconButton, Tooltip, useMediaQuery } from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import CloseIcon from '@mui/icons-material/Close';
import { DndContext, type DragEndEvent } from '@dnd-kit/core';

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
import EditTaskDialog from '../components/Task/EditTaskDialog';
import { useAuth } from '../contexts/AuthContext';
import { useSnackbar } from '../contexts/SnackbarContext';
import { api } from '../api/client';
import { channelColorFromName, endOfMonth, startOfMonth } from '../utils/calendar';
import type { CalendarEvent, Channel, Task, User } from '@chat-app/shared';

const eventsCache = new Map<string, Promise<{ events: CalendarEvent[] }>>();
let channelsPromiseCache: Promise<{ channels: Channel[] }> | null = null;
let usersPromiseCache: Promise<{ users: User[] }> | null = null;
let tasksPromiseCache: Promise<{ tasks: Task[] }> | null = null;

// Issue #331: チャンネル絞り込み状態を localStorage に永続化
const CHANNEL_FILTER_STORAGE_KEY = 'calendar.channelFilter';

function loadStoredFilter(): Set<number> | null {
  try {
    const raw = localStorage.getItem(CHANNEL_FILTER_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return new Set(parsed.filter((v): v is number => typeof v === 'number'));
  } catch {
    return null;
  }
}

function saveStoredFilter(filter: Set<number>): void {
  try {
    localStorage.setItem(CHANNEL_FILTER_STORAGE_KEY, JSON.stringify(Array.from(filter)));
  } catch {
    // localStorage が使えない環境ではサイレントに無視
  }
}

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

function getOrCreateTasksPromise(): Promise<{ tasks: Task[] }> {
  if (!tasksPromiseCache) {
    // タスク取得失敗時もカレンダー全体を壊さない
    tasksPromiseCache = api.tasks.list().catch(() => ({ tasks: [] }));
  }
  return tasksPromiseCache;
}

interface ContentProps {
  cursor: Date;
  view: CalendarViewMode;
  channelsPromise: Promise<{ channels: Channel[] }>;
  eventsPromise: Promise<{ events: CalendarEvent[] }>;
  usersPromise: Promise<{ users: User[] }>;
  tasksPromise: Promise<{ tasks: Task[] }>;
  currentUserId: number;
  refresh: () => void;
}

function CalendarContent({
  cursor,
  view,
  channelsPromise,
  eventsPromise,
  usersPromise,
  tasksPromise,
  currentUserId,
  refresh,
}: ContentProps) {
  const { channels } = use(channelsPromise);
  const { events } = use(eventsPromise);
  const { users } = use(usersPromise);
  const { tasks: initialTasks } = use(tasksPromise);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const { showError } = useSnackbar();

  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogDate, setDialogDate] = useState<Date | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [editingScope, setEditingScope] = useState<'one' | 'following' | 'all' | undefined>(
    undefined,
  );
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 767px)');

  const channelColors = useMemo(() => {
    const m = new Map<number, string>();
    for (const c of channels) m.set(c.id, channelColorFromName(c.name));
    return m;
  }, [channels]);

  // null = 未操作（全チャンネル選択 + ワークスペース全体イベント表示）。初回操作で Set 化する。
  // Issue #331: localStorage に永続化する
  const [localFilter, setLocalFilter] = useState<Set<number> | null>(() => loadStoredFilter());

  // Issue #331: 一括操作プリセットを含む変更を localStorage と同期
  const handleChannelFilterChange = useCallback((next: Set<number>) => {
    setLocalFilter(next);
    saveStoredFilter(next);
  }, []);
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

  // タスクのフィルタ：sourceChannelId が null のものは「未操作時のみ」表示
  const filteredTasks = useMemo(
    () =>
      tasks.filter((t) => {
        if (t.sourceChannelId === null) return localFilter === null;
        return effectiveFilter.has(t.sourceChannelId);
      }),
    [tasks, effectiveFilter, localFilter],
  );

  const today = useMemo(() => new Date(), []);

  // ドラッグで期限変更
  const handleTaskDragEnd = async (event: DragEndEvent) => {
    const activeId = event.active.id;
    const overId = event.over?.id;
    if (!overId) return;
    const activeStr = String(activeId);
    const overStr = String(overId);
    if (!activeStr.startsWith('task-')) return;
    if (!overStr.startsWith('day-') && !overStr.startsWith('week-day-')) return;

    const taskId = Number(activeStr.replace('task-', ''));
    const target = tasks.find((t) => t.id === taskId);
    if (!target || !target.dueAt) return;

    // day-YYYY-M-D / week-day-YYYY-M-D を分解（M は 0-based、D は 1-based）
    const m = overStr.match(/^(?:week-)?day-(\d+)-(\d+)-(\d+)$/);
    if (!m) return;
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);

    const original = new Date(target.dueAt);
    // 同日（dueAt 変化なし）なら何もしない
    if (
      original.getFullYear() === year &&
      original.getMonth() === month &&
      original.getDate() === day
    ) {
      return;
    }

    // 時刻部分を維持しつつ日付のみ変更
    const newDate = new Date(
      year,
      month,
      day,
      original.getHours(),
      original.getMinutes(),
      original.getSeconds(),
      original.getMilliseconds(),
    );
    const newDueAt = newDate.toISOString();

    const prevTasks = tasks;
    // 楽観更新
    setTasks((cur) => cur.map((t) => (t.id === taskId ? { ...t, dueAt: newDueAt } : t)));
    try {
      await api.tasks.update(taskId, { dueAt: newDueAt });
    } catch (err) {
      // ロールバック
      setTasks(prevTasks);
      const status = (err as { status?: number } | null)?.status;
      if (status === 404) {
        showError('タスクが見つかりません');
      } else {
        showError('タスクの期限を更新できませんでした');
      }
    }
  };

  const handleToggleChannel = (id: number) => {
    setLocalFilter((prev) => {
      const base = prev ?? new Set(channels.map((c) => c.id));
      const next = new Set(base);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      // Issue #331: 個別トグルも永続化対象
      saveStoredFilter(next);
      return next;
    });
  };

  const handleEventClick = (e: CalendarEvent) => setSelectedEvent(e);
  const handleDayClick = (d: Date) => {
    setEditingEvent(null);
    setDialogDate(d);
    setDialogOpen(true);
  };

  const handleEdit = (ev: CalendarEvent, scope?: 'one' | 'following' | 'all') => {
    setSelectedEvent(null);
    setEditingEvent(ev);
    setEditingScope(scope);
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
            onChannelFilterChange={handleChannelFilterChange}
            events={filteredEvents}
            today={today}
            currentUserId={currentUserId}
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
              onChannelFilterChange={handleChannelFilterChange}
              events={filteredEvents}
              today={today}
              currentUserId={currentUserId}
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
            <DndContext onDragEnd={(e) => void handleTaskDragEnd(e)}>
              <MonthView
                cursor={cursor}
                today={today}
                events={filteredEvents}
                tasks={filteredTasks}
                channels={channels}
                channelColors={channelColors}
                onEventClick={handleEventClick}
                onDayClick={handleDayClick}
                onTaskClick={(t) => setEditingTask(t)}
              />
            </DndContext>
          )}
          {view === 'week' && (
            <DndContext onDragEnd={(e) => void handleTaskDragEnd(e)}>
              <WeekView
                cursor={cursor}
                today={today}
                events={filteredEvents}
                tasks={filteredTasks}
                channelColors={channelColors}
                onEventClick={handleEventClick}
                onTaskClick={(t) => setEditingTask(t)}
              />
            </DndContext>
          )}
          {view === 'agenda' && (
            <AgendaView
              cursor={cursor}
              today={today}
              events={filteredEvents}
              tasks={filteredTasks}
              channels={channels}
              channelColors={channelColors}
              users={users}
              currentUserId={currentUserId}
              onEventClick={handleEventClick}
              onTaskClick={(t) => setEditingTask(t)}
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
        editScope={editingScope}
        onClose={() => {
          setDialogOpen(false);
          setEditingEvent(null);
          setEditingScope(undefined);
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
          setEditingScope(undefined);
        }}
        onPollCreated={() => {
          // poll 作成は events と無関係なので refresh しない（PollHeatmap 側で別途扱う）
          setDialogOpen(false);
        }}
      />

      {editingTask && (
        <EditTaskDialog
          open={editingTask !== null}
          task={editingTask}
          users={users}
          onClose={() => setEditingTask(null)}
          onUpdated={async () => {
            // タスク再取得（dueAt の最新化）
            try {
              const { tasks: fresh } = await api.tasks.list();
              setTasks(fresh);
            } catch {
              // 失敗時は何もしない
            }
            setEditingTask(null);
          }}
        />
      )}
    </>
  );
}

export default function CalendarPage() {
  const { user } = useAuth();
  const { showError } = useSnackbar();
  const [searchParams] = useSearchParams();
  const [cursor, setCursor] = useState(() => new Date());
  const [view, setView] = useState<CalendarViewMode>('month');
  const [pollsDrawerOpen, setPollsDrawerOpen] = useState(false);

  // ?date=today: カーソルを今日にリセットする
  // ?date=YYYY-MM-DD: その日付の月にカーソルを移動する
  // 不正な値は無視する
  useEffect(() => {
    const dateParam = searchParams.get('date');
    if (!dateParam) return;
    if (dateParam === 'today') {
      setCursor(new Date());
      return;
    }
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateParam);
    if (!m) return;
    const year = Number(m[1]);
    const month = Number(m[2]) - 1; // 0-based
    const day = Number(m[3]);
    const parsed = new Date(year, month, day);
    if (parsed.getFullYear() !== year || parsed.getMonth() !== month || parsed.getDate() !== day) {
      return; // 月日が範囲外（例: 2026-13-40）→ 無視
    }
    setCursor(parsed);
  }, [searchParams]);

  const eventsPromise = useMemo(
    () => getOrCreateEventsPromise(cursor.getFullYear(), cursor.getMonth()),
    [cursor],
  );
  const [channelsPromise] = useState(() => getOrCreateChannelsPromise());
  const [usersPromise] = useState(() => getOrCreateUsersPromise());
  const [tasksPromise] = useState(() => getOrCreateTasksPromise());

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

  const handleExport = async () => {
    try {
      const stored = loadStoredFilter();
      await channelsPromise;
      const channelIds = stored ? Array.from(stored) : undefined;
      const from = startOfMonth(new Date(cursor.getFullYear(), cursor.getMonth(), 1)).toISOString();
      const to = endOfMonth(new Date(cursor.getFullYear(), cursor.getMonth(), 1)).toISOString();
      const blob = await api.calendar.events.exportRange({ from, to, channelIds });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `calendar-${from.slice(0, 10)}.ics`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      showError('予定をエクスポートできませんでした');
    }
  };

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
        onExport={() => void handleExport()}
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
          tasksPromise={tasksPromise}
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
