/**
 * テスト対象: カレンダー（月/週/アジェンダ）における期限付きタスクの表示（Issue #267）
 *
 * 戦略:
 *   - MonthView / WeekView / AgendaView に新しい props として `tasks` を渡し、
 *     期限ありタスクをイベントとは別色のブロック・行として描画することを検証する
 *   - タスクのキー（data-testid）はイベントと衝突しないように `task-block-{id}` 等で表現する
 *   - ホバー時のタイトル/担当/期限の詳細テキスト、クリック時のコールバック、
 *     dueAt が null のタスクは表示されないこと、を中心に検証する
 *   - スタイル（色値）はイベントブロックとは別の固定色（タスク用）であることを style から確認する
 *
 *   Issue #342: WeekView/AgendaView/CalendarPage 統合のタスク表示も実装対象に含める。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { MonthView } from '../components/Calendar/MonthView';
import { WeekView } from '../components/Calendar/WeekView';
import { AgendaView } from '../components/Calendar/AgendaView';
import type { CalendarEvent, Channel, Task, User } from '@chat-app/shared';

const apiMocks = vi.hoisted(() => ({
  eventsList: vi.fn(),
  tasksList: vi.fn(),
  tasksUpdate: vi.fn(),
  channelsList: vi.fn(),
  usersList: vi.fn(),
  pollsList: vi.fn(),
}));

vi.mock('../api/client', () => ({
  api: {
    calendar: {
      events: {
        list: apiMocks.eventsList,
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        rsvp: vi.fn(),
      },
      polls: {
        list: apiMocks.pollsList,
        castVote: vi.fn(),
        confirm: vi.fn(),
      },
    },
    tasks: {
      list: apiMocks.tasksList,
      update: apiMocks.tasksUpdate,
      create: vi.fn(),
      delete: vi.fn(),
      updateOrder: vi.fn(),
    },
    channels: { list: apiMocks.channelsList },
    auth: { users: apiMocks.usersList },
  },
}));

vi.mock('../components/Layout/AppLayout', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('../components/Channel/ChannelList', () => ({ default: () => <div /> }));
vi.mock('../components/Layout/SidebarDmList', () => ({ default: () => <div /> }));
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, username: 'me', email: 'me@example.com' } }),
}));
vi.mock('../contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showError: vi.fn(), showSuccess: vi.fn(), showInfo: vi.fn() }),
}));

const TODAY = new Date(2026, 4, 15);
const CURSOR = new Date(2026, 4, 15);

const channelColors = new Map<number, string>([
  [10, '#1976d2'],
  [11, '#d81b60'],
]);

function makeEvent(
  id: number,
  channelId: number | null,
  startsAt: string,
  title = `Ev${id}`,
): CalendarEvent {
  return {
    id,
    channelId,
    title,
    description: null,
    location: null,
    meetingUrl: null,
    startsAt,
    endsAt: new Date(new Date(startsAt).getTime() + 60 * 60 * 1000).toISOString(),
    organizerId: 1,
    createdAt: '2026-04-30T00:00:00Z',
    updatedAt: '2026-04-30T00:00:00Z',
    attendees: [],
    reminderOffsetMinutes: null,
    recurrenceRule: null,
    recurrenceInterval: 1,
    recurrenceDaysOfWeek: null,
    recurrenceEndDate: null,
    recurrenceCount: null,
    recurrenceMasterId: null,
  };
}

function makeTask(id: number, dueAt: string | null, overrides: Partial<Task> = {}): Task {
  return {
    id,
    title: `Task ${id}`,
    description: null,
    status: 'todo',
    assigneeId: null,
    assigneeUsername: null,
    dueAt,
    sourceMessageId: null,
    sourceChannelId: null,
    createdBy: 1,
    position: 0,
    isHidden: false,
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-05-01T00:00:00Z',
    ...overrides,
  };
}

function makeChannel(id: number, name: string): Channel {
  return {
    id,
    name,
    description: null,
    topic: null,
    createdBy: 1,
    createdAt: '2026-04-30T00:00:00Z',
    isPrivate: false,
    postingPermission: 'everyone',
    unreadCount: 0,
  };
}

const users: User[] = [
  {
    id: 1,
    username: 'me',
    email: 'me@example.com',
    avatarUrl: null,
    displayName: 'Me',
    location: null,
    createdAt: '2026-04-30T00:00:00Z',
    role: 'user',
    isActive: true,
    onboardingCompletedAt: '2026-04-30T00:00:00Z',
  },
  {
    id: 2,
    username: 'alice',
    email: 'alice@example.com',
    avatarUrl: null,
    displayName: 'Alice',
    location: null,
    createdAt: '2026-04-30T00:00:00Z',
    role: 'user',
    isActive: true,
    onboardingCompletedAt: '2026-04-30T00:00:00Z',
  },
];

async function renderCalendarPage(initialDate = '2026-05-15') {
  vi.resetModules();
  const mod = await import('../pages/CalendarPage');
  const CalendarPage = mod.default;
  await act(async () => {
    render(
      <MemoryRouter initialEntries={[`/calendar?date=${initialDate}`]}>
        <Routes>
          <Route path="/calendar" element={<CalendarPage />} />
        </Routes>
      </MemoryRouter>,
    );
  });
}

const onEventClick = vi.fn();
const onDayClick = vi.fn();
const onTaskClick = vi.fn();

beforeEach(() => {
  onEventClick.mockClear();
  onDayClick.mockClear();
  onTaskClick.mockClear();
  apiMocks.eventsList.mockReset();
  apiMocks.tasksList.mockReset();
  apiMocks.tasksUpdate.mockReset();
  apiMocks.channelsList.mockReset();
  apiMocks.usersList.mockReset();
  apiMocks.pollsList.mockReset();
  apiMocks.eventsList.mockResolvedValue({ events: [] });
  apiMocks.tasksList.mockResolvedValue({ tasks: [] });
  apiMocks.channelsList.mockResolvedValue({
    channels: [makeChannel(10, 'general'), makeChannel(11, 'random')],
  });
  apiMocks.usersList.mockResolvedValue({ users });
  apiMocks.pollsList.mockResolvedValue({ polls: [] });
});

describe('カレンダーへのタスク表示（Issue #267）', () => {
  describe('MonthView', () => {
    describe('期限付きタスクの描画', () => {
      it('dueAt がある日付セルに task-block-{id} としてタスクが描画される', () => {
        const task = makeTask(101, '2026-05-10T15:00:00Z', { title: 'Ship release' });
        render(
          <MonthView
            cursor={CURSOR}
            today={TODAY}
            events={[]}
            tasks={[task]}
            channelColors={channelColors}
            onEventClick={onEventClick}
            onDayClick={onDayClick}
            onTaskClick={onTaskClick}
          />,
        );
        const due = new Date('2026-05-10T15:00:00Z');
        const cell = screen.getByTestId(
          `day-cell-${due.getFullYear()}-${due.getMonth()}-${due.getDate()}`,
        );
        expect(within(cell).getByTestId('task-block-101')).toBeInTheDocument();
        expect(within(cell).getByText(/Ship release/)).toBeInTheDocument();
      });

      it('dueAt が null のタスクはどのセルにも描画されない', () => {
        const task = makeTask(102, null);
        render(
          <MonthView
            cursor={CURSOR}
            today={TODAY}
            events={[]}
            tasks={[task]}
            channelColors={channelColors}
            onEventClick={onEventClick}
            onDayClick={onDayClick}
            onTaskClick={onTaskClick}
          />,
        );
        expect(screen.queryByTestId('task-block-102')).toBeNull();
      });

      it('同日にイベントとタスクが両方ある場合、両方とも描画される', () => {
        // ローカル時刻 2026/5/10 12:00 で同日に固定
        const localDay = new Date(2026, 4, 10, 12, 0, 0);
        const sameDayLater = new Date(2026, 4, 10, 15, 0, 0);
        const ev = makeEvent(1, 10, localDay.toISOString(), 'Sprint Planning');
        const task = makeTask(103, sameDayLater.toISOString(), { title: 'Ship release' });
        render(
          <MonthView
            cursor={CURSOR}
            today={TODAY}
            events={[ev]}
            tasks={[task]}
            channelColors={channelColors}
            onEventClick={onEventClick}
            onDayClick={onDayClick}
            onTaskClick={onTaskClick}
          />,
        );
        const cell = screen.getByTestId('day-cell-2026-4-10');
        expect(within(cell).getByTestId('event-block-1')).toBeInTheDocument();
        expect(within(cell).getByTestId('task-block-103')).toBeInTheDocument();
      });

      it('同日に上限超過（イベント+タスク合計が表示上限を超える）の場合、+N 件表示が更新される', () => {
        const day = '2026-05-10';
        const events = [
          makeEvent(1, 10, `${day}T09:00:00Z`, 'A'),
          makeEvent(2, 10, `${day}T10:00:00Z`, 'B'),
          makeEvent(3, 10, `${day}T11:00:00Z`, 'C'),
        ];
        const tasks = [makeTask(201, `${day}T13:00:00Z`), makeTask(202, `${day}T14:00:00Z`)];
        render(
          <MonthView
            cursor={CURSOR}
            today={TODAY}
            events={events}
            tasks={tasks}
            channelColors={channelColors}
            onEventClick={onEventClick}
            onDayClick={onDayClick}
            onTaskClick={onTaskClick}
          />,
        );
        const start = new Date(`${day}T09:00:00Z`);
        const cell = screen.getByTestId(
          `day-cell-${start.getFullYear()}-${start.getMonth()}-${start.getDate()}`,
        );
        // 表示上限 3、合計 5 → +2 件 表示
        expect(within(cell).getByText('+2 件')).toBeInTheDocument();
      });
    });

    describe('色分け', () => {
      it('タスクブロックの背景色がイベントとは異なるタスク用カラーで描画される', () => {
        const ev = makeEvent(1, 11, '2026-05-10T10:00:00Z'); // channel 11 → #d81b60
        const task = makeTask(301, '2026-05-10T15:00:00Z');
        render(
          <MonthView
            cursor={CURSOR}
            today={TODAY}
            events={[ev]}
            tasks={[task]}
            channelColors={channelColors}
            onEventClick={onEventClick}
            onDayClick={onDayClick}
            onTaskClick={onTaskClick}
          />,
        );
        const evBlock = screen.getByTestId('event-block-1');
        const taskBlock = screen.getByTestId('task-block-301');
        const evBg = window.getComputedStyle(evBlock).backgroundColor;
        const taskBg = window.getComputedStyle(taskBlock).backgroundColor;
        expect(taskBg).not.toBe('');
        expect(taskBg).not.toBe(evBg);
      });

      it('タスクブロックは status に応じてアイコンまたは装飾差を持つ（todo / in_progress / done）', () => {
        const tasks = [
          makeTask(401, '2026-05-10T15:00:00Z', { status: 'todo' }),
          makeTask(402, '2026-05-11T15:00:00Z', { status: 'in_progress' }),
          makeTask(403, '2026-05-12T15:00:00Z', { status: 'done' }),
        ];
        render(
          <MonthView
            cursor={CURSOR}
            today={TODAY}
            events={[]}
            tasks={tasks}
            channelColors={channelColors}
            onEventClick={onEventClick}
            onDayClick={onDayClick}
            onTaskClick={onTaskClick}
          />,
        );
        const todo = screen.getByTestId('task-block-401');
        const inProgress = screen.getByTestId('task-block-402');
        const done = screen.getByTestId('task-block-403');
        // status 属性で識別
        expect(todo.getAttribute('data-task-status')).toBe('todo');
        expect(inProgress.getAttribute('data-task-status')).toBe('in_progress');
        expect(done.getAttribute('data-task-status')).toBe('done');
      });
    });

    describe('ホバー詳細', () => {
      it('タスクブロックの title 属性に「タイトル / 担当者 / 期限」が含まれる', () => {
        const task = makeTask(501, '2026-05-10T15:00:00Z', {
          title: 'Ship release',
          assigneeUsername: 'alice',
        });
        render(
          <MonthView
            cursor={CURSOR}
            today={TODAY}
            events={[]}
            tasks={[task]}
            channelColors={channelColors}
            onEventClick={onEventClick}
            onDayClick={onDayClick}
            onTaskClick={onTaskClick}
          />,
        );
        const block = screen.getByTestId('task-block-501');
        const title = block.getAttribute('title') ?? '';
        expect(title).toContain('Ship release');
        expect(title).toContain('alice');
        // 期限の日付（2026/5/10 形式 or 5月10日 のどちらか）
        expect(title).toMatch(/2026/);
      });
    });

    describe('クリック動作', () => {
      it('タスクブロックをクリックすると onTaskClick が該当タスクで呼ばれる', async () => {
        const task = makeTask(601, '2026-05-10T15:00:00Z');
        render(
          <MonthView
            cursor={CURSOR}
            today={TODAY}
            events={[]}
            tasks={[task]}
            channelColors={channelColors}
            onEventClick={onEventClick}
            onDayClick={onDayClick}
            onTaskClick={onTaskClick}
          />,
        );
        const block = screen.getByTestId('task-block-601');
        await userEvent.click(block);
        expect(onTaskClick).toHaveBeenCalledTimes(1);
        expect(onTaskClick.mock.calls[0][0]).toMatchObject({ id: 601 });
      });

      it('タスクブロックのクリックでは onDayClick が呼ばれない（stopPropagation）', async () => {
        const task = makeTask(602, '2026-05-10T15:00:00Z');
        render(
          <MonthView
            cursor={CURSOR}
            today={TODAY}
            events={[]}
            tasks={[task]}
            channelColors={channelColors}
            onEventClick={onEventClick}
            onDayClick={onDayClick}
            onTaskClick={onTaskClick}
          />,
        );
        const block = screen.getByTestId('task-block-602');
        await userEvent.click(block);
        expect(onDayClick).not.toHaveBeenCalled();
      });
    });
  });

  describe('WeekView', () => {
    describe('期限付きタスクの描画', () => {
      it('dueAt の日付・時刻に対応する位置に task-week-block-{id} が描画される', () => {
        const task = makeTask(701, '2026-05-14T10:30:00Z', { title: 'Week task' });
        render(
          <WeekView
            cursor={CURSOR}
            today={TODAY}
            events={[]}
            tasks={[task]}
            channelColors={channelColors}
            onEventClick={onEventClick}
            onTaskClick={onTaskClick}
          />,
        );
        const due = new Date(task.dueAt!);
        const column = screen.getByTestId(
          `week-column-${due.getFullYear()}-${due.getMonth()}-${due.getDate()}`,
        );
        const block = within(column).getByTestId('task-week-block-701');
        expect(block).toHaveTextContent('Week task');
        expect(Number(block.getAttribute('data-top'))).toBeGreaterThan(0);
      });
      it('時刻指定なし（00:00 等）のタスクは終日エリアまたは固定位置に描画される', () => {
        const task = makeTask(702, new Date(2026, 4, 14, 0, 0, 0).toISOString(), {
          title: 'All day task',
        });
        render(
          <WeekView
            cursor={CURSOR}
            today={TODAY}
            events={[]}
            tasks={[task]}
            channelColors={channelColors}
            onEventClick={onEventClick}
            onTaskClick={onTaskClick}
          />,
        );
        const block = screen.getByTestId('task-week-block-702');
        expect(block).toHaveTextContent('All day task');
        expect(Number(block.getAttribute('data-top'))).toBe(0);
      });
      it('週外のタスクは描画されない', () => {
        const task = makeTask(703, '2026-05-30T10:00:00Z');
        render(
          <WeekView
            cursor={CURSOR}
            today={TODAY}
            events={[]}
            tasks={[task]}
            channelColors={channelColors}
            onEventClick={onEventClick}
            onTaskClick={onTaskClick}
          />,
        );
        expect(screen.queryByTestId('task-week-block-703')).toBeNull();
      });
    });

    describe('色分け', () => {
      it('タスクブロックはイベントとは異なる色で描画される', () => {
        const ev = makeEvent(71, 10, '2026-05-14T10:00:00Z');
        const task = makeTask(704, '2026-05-14T10:30:00Z');
        render(
          <WeekView
            cursor={CURSOR}
            today={TODAY}
            events={[ev]}
            tasks={[task]}
            channelColors={channelColors}
            onEventClick={onEventClick}
            onTaskClick={onTaskClick}
          />,
        );
        expect(window.getComputedStyle(screen.getByTestId('task-week-block-704')).backgroundColor)
          .not.toBe(window.getComputedStyle(screen.getByTestId('week-event-71')).backgroundColor);
      });
    });

    describe('クリック動作', () => {
      it('タスクブロックをクリックすると onTaskClick が該当タスクで呼ばれる', async () => {
        const task = makeTask(705, '2026-05-14T10:30:00Z');
        render(
          <WeekView
            cursor={CURSOR}
            today={TODAY}
            events={[]}
            tasks={[task]}
            channelColors={channelColors}
            onEventClick={onEventClick}
            onTaskClick={onTaskClick}
          />,
        );
        await userEvent.click(screen.getByTestId('task-week-block-705'));
        expect(onTaskClick).toHaveBeenCalledWith(expect.objectContaining({ id: 705 }));
      });
    });
  });

  describe('AgendaView', () => {
    describe('期限付きタスクの描画', () => {
      it('期限日のグループにタスク行（agenda-task-{id}）が混在表示される', () => {
        const task = makeTask(801, new Date(2026, 4, 10, 15, 0, 0).toISOString(), {
          title: 'Agenda task',
        });
        render(
          <AgendaView
            cursor={CURSOR}
            today={TODAY}
            events={[]}
            tasks={[task]}
            channels={[makeChannel(10, 'general')]}
            channelColors={channelColors}
            users={users}
            currentUserId={1}
            onEventClick={onEventClick}
            onTaskClick={onTaskClick}
          />,
        );
        const group = screen.getByTestId('agenda-group-2026-4-10');
        expect(within(group).getByTestId('agenda-task-801')).toHaveTextContent('Agenda task');
      });
      it('日付グループはイベント＋タスクをまとめてソート（時刻昇順、時刻なしタスクは末尾）して並ぶ', () => {
        const ev = makeEvent(81, 10, new Date(2026, 4, 10, 9, 0, 0).toISOString(), 'Morning event');
        const task = makeTask(802, new Date(2026, 4, 10, 11, 0, 0).toISOString(), {
          title: 'Mid task',
        });
        const allDayTask = makeTask(803, new Date(2026, 4, 10, 0, 0, 0).toISOString(), {
          title: 'All day task',
        });
        render(
          <AgendaView
            cursor={CURSOR}
            today={TODAY}
            events={[ev]}
            tasks={[allDayTask, task]}
            channels={[makeChannel(10, 'general')]}
            channelColors={channelColors}
            users={users}
            currentUserId={1}
            onEventClick={onEventClick}
            onTaskClick={onTaskClick}
          />,
        );
        const group = screen.getByTestId('agenda-group-2026-4-10');
        const rows = within(group)
          .getAllByTestId(/agenda-(event|task)-/)
          .map((row) => row.getAttribute('data-testid'))
          .filter((id) => id && !id.startsWith('agenda-task-color-'));
        expect(rows).toEqual([
          'agenda-event-81',
          'agenda-task-802',
          'agenda-task-803',
        ]);
      });
      it('cursor 月外の期限タスクはグルーピング対象外', () => {
        const task = makeTask(804, '2026-06-01T10:00:00Z');
        render(
          <AgendaView
            cursor={CURSOR}
            today={TODAY}
            events={[]}
            tasks={[task]}
            channels={[]}
            channelColors={channelColors}
            users={users}
            currentUserId={1}
            onEventClick={onEventClick}
            onTaskClick={onTaskClick}
          />,
        );
        expect(screen.queryByTestId('agenda-task-804')).toBeNull();
      });
    });

    describe('表示内容', () => {
      it('タスク行にはタイトル・担当者・「タスク」種別ラベル（チップ等）が表示される', () => {
        const task = makeTask(805, new Date(2026, 4, 10, 15, 0, 0).toISOString(), {
          title: 'Review task',
          assigneeUsername: 'alice',
        });
        render(
          <AgendaView
            cursor={CURSOR}
            today={TODAY}
            events={[]}
            tasks={[task]}
            channels={[]}
            channelColors={channelColors}
            users={users}
            currentUserId={1}
            onEventClick={onEventClick}
            onTaskClick={onTaskClick}
          />,
        );
        const row = screen.getByTestId('agenda-task-805');
        expect(row).toHaveTextContent('Review task');
        expect(row).toHaveTextContent('alice');
        expect(row).toHaveTextContent('タスク');
      });
      it('タスク行のサイドバー色はタスク用カラーで描画される', () => {
        const task = makeTask(806, new Date(2026, 4, 10, 15, 0, 0).toISOString());
        render(
          <AgendaView
            cursor={CURSOR}
            today={TODAY}
            events={[]}
            tasks={[task]}
            channels={[]}
            channelColors={channelColors}
            users={users}
            currentUserId={1}
            onEventClick={onEventClick}
            onTaskClick={onTaskClick}
          />,
        );
        expect(window.getComputedStyle(screen.getByTestId('agenda-task-color-806')).backgroundColor)
          .not.toBe('');
      });
    });

    describe('クリック動作', () => {
      it('タスク行をクリックすると onTaskClick が呼ばれる', async () => {
        const task = makeTask(807, new Date(2026, 4, 10, 15, 0, 0).toISOString());
        render(
          <AgendaView
            cursor={CURSOR}
            today={TODAY}
            events={[]}
            tasks={[task]}
            channels={[]}
            channelColors={channelColors}
            users={users}
            currentUserId={1}
            onEventClick={onEventClick}
            onTaskClick={onTaskClick}
          />,
        );
        await userEvent.click(screen.getByTestId('agenda-task-807'));
        expect(onTaskClick).toHaveBeenCalledWith(expect.objectContaining({ id: 807 }));
      });
    });
  });

  describe('CalendarPage 統合', () => {
    describe('タスクのフェッチ', () => {
      it('カレンダー描画時に api.tasks.list が呼ばれて期限ありタスクが取得される', async () => {
        apiMocks.tasksList.mockResolvedValue({
          tasks: [makeTask(901, '2026-05-15T10:00:00Z', { title: 'Fetched task' })],
        });
        await renderCalendarPage();
        expect(apiMocks.tasksList).toHaveBeenCalledTimes(1);
        expect(await screen.findByTestId('task-block-901')).toHaveTextContent('Fetched task');
      });
      it('タスク取得失敗時もイベントは正常に表示される（エラーで全体クラッシュしない）', async () => {
        apiMocks.eventsList.mockResolvedValue({
          events: [makeEvent(91, 10, '2026-05-15T10:00:00Z', 'Visible event')],
        });
        apiMocks.tasksList.mockRejectedValue(new Error('500'));
        await renderCalendarPage();
        expect(await screen.findByTestId('event-block-91')).toHaveTextContent('Visible event');
      });
    });

    describe('チャンネルフィルタ連携', () => {
      it('チャンネルフィルタ適用時、sourceChannelId が一致するタスクのみ表示される', async () => {
        apiMocks.tasksList.mockResolvedValue({
          tasks: [
            makeTask(902, '2026-05-15T10:00:00Z', { title: 'General', sourceChannelId: 10 }),
            makeTask(903, '2026-05-15T11:00:00Z', { title: 'Random', sourceChannelId: 11 }),
          ],
        });
        await renderCalendarPage();
        await screen.findByTestId('task-block-902');
        await userEvent.click(screen.getByLabelText('channel-filter-random'));
        await waitFor(() => expect(screen.queryByTestId('task-block-903')).toBeNull());
        expect(screen.getByTestId('task-block-902')).toBeInTheDocument();
      });
      it('未操作（全選択）時は sourceChannelId が null のタスクも表示される', async () => {
        apiMocks.tasksList.mockResolvedValue({
          tasks: [makeTask(904, '2026-05-15T10:00:00Z', { sourceChannelId: null })],
        });
        await renderCalendarPage();
        expect(await screen.findByTestId('task-block-904')).toBeInTheDocument();
      });
    });

    describe('タスククリック時の挙動', () => {
      it('カレンダー上のタスククリックで EditTaskDialog が開く', async () => {
        apiMocks.tasksList.mockResolvedValue({
          tasks: [makeTask(905, '2026-05-15T10:00:00Z', { title: 'Open dialog' })],
        });
        await renderCalendarPage();
        fireEvent.click(await screen.findByTestId('task-block-905'));
        expect(await screen.findByText('タスクを編集')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Open dialog')).toBeInTheDocument();
      });
    });
  });
});
