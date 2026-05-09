/**
 * テスト対象: TaskBoardPage からカレンダーへのジャンプ動線（Issue #267）
 *
 * 戦略:
 *   - タスクカードに新しく追加するカレンダーアイコンボタンが表示されることを確認
 *   - クリックで `/calendar?date=YYYY-MM-DD` (タスクの dueAt の日付) に navigate されることを検証
 *   - dueAt が null のタスクではアイコンが表示されない（または無効化される）ことを確認
 *   - CalendarPage 側で ?date クエリを受け取って cursor が該当日に設定されることを検証
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { Task, Channel } from '@chat-app/shared';

// DnD Kit モック（jsdom 非対応のため）
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: ReactNode }) => <>{children}</>,
  closestCorners: vi.fn(),
  PointerSensor: class {},
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn(() => []),
  useDroppable: vi.fn(() => ({ setNodeRef: vi.fn(), isOver: false })),
  useDraggable: vi.fn(() => ({
    setNodeRef: vi.fn(),
    attributes: {},
    listeners: {},
    transform: null,
    isDragging: false,
  })),
}));
vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: ReactNode }) => <>{children}</>,
  verticalListSortingStrategy: vi.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
  arrayMove: vi.fn((arr: unknown[]) => arr),
}));
vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: vi.fn(() => '') } },
}));

const tasksListMock = vi.fn();
const channelsListMock = vi.fn();
const usersListMock = vi.fn();
const eventsListMock = vi.fn();
const pollsListMock = vi.fn();

vi.mock('../api/client', () => ({
  api: {
    tasks: {
      list: tasksListMock,
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      updateOrder: vi.fn(),
    },
    channels: { list: channelsListMock },
    auth: { users: usersListMock },
    calendar: {
      events: {
        list: eventsListMock,
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        rsvp: vi.fn(),
      },
      polls: {
        list: pollsListMock,
        castVote: vi.fn(),
        confirm: vi.fn(),
      },
    },
  },
}));

vi.mock('../components/Layout/AppLayout', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('../components/Channel/ChannelList', () => ({ default: () => <div /> }));
vi.mock('../components/Layout/SidebarDmList', () => ({ default: () => <div /> }));
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, username: 'me', email: 'me@t.com' } }),
}));

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

async function importTaskBoard() {
  const mod = await import('../pages/TaskBoardPage');
  return mod.default;
}

async function importCalendar() {
  const mod = await import('../pages/CalendarPage');
  return mod.default;
}

const renderTaskBoard = async () => {
  const TaskBoardPage = await importTaskBoard();
  let result: ReturnType<typeof render> | undefined;
  await act(async () => {
    result = render(
      <MemoryRouter initialEntries={['/tasks']}>
        <Routes>
          <Route path="/tasks" element={<TaskBoardPage />} />
          <Route
            path="/calendar"
            element={<div data-testid="calendar-page-stub">{/* search のキャプチャ用 */}</div>}
          />
        </Routes>
      </MemoryRouter>,
    );
  });
  return result!;
};

const renderCalendarWithDate = async (dateParam: string) => {
  const CalendarPage = await importCalendar();
  await act(async () => {
    render(
      <MemoryRouter initialEntries={[`/calendar?date=${dateParam}`]}>
        <Routes>
          <Route path="/calendar" element={<CalendarPage />} />
        </Routes>
      </MemoryRouter>,
    );
  });
};

beforeEach(() => {
  vi.resetModules();
  tasksListMock.mockReset();
  channelsListMock.mockReset();
  usersListMock.mockReset();
  eventsListMock.mockReset();
  pollsListMock.mockReset();
  tasksListMock.mockResolvedValue({ tasks: [] });
  channelsListMock.mockResolvedValue({ channels: [makeChannel(10, 'general')] });
  usersListMock.mockResolvedValue({ users: [] });
  eventsListMock.mockResolvedValue({ events: [] });
  pollsListMock.mockResolvedValue({ polls: [] });
});

describe('タスクボード→カレンダーのジャンプ機能（Issue #267）', () => {
  describe('カレンダーアイコンの表示', () => {
    it('dueAt が設定されているタスクカードにカレンダーアイコンが表示される', async () => {
      tasksListMock.mockResolvedValue({
        tasks: [makeTask(101, '2026-05-15T10:00:00Z')],
      });
      await renderTaskBoard();
      const card = screen.getByTestId('task-card-101');
      expect(within(card).getByLabelText('カレンダーで表示')).toBeInTheDocument();
    });

    it('dueAt が null のタスクカードにはカレンダーアイコンが表示されない', async () => {
      tasksListMock.mockResolvedValue({ tasks: [makeTask(102, null)] });
      await renderTaskBoard();
      const card = screen.getByTestId('task-card-102');
      expect(within(card).queryByLabelText('カレンダーで表示')).toBeNull();
    });

    it('カレンダーアイコンは「カレンダーで表示」aria-label を持つ', async () => {
      tasksListMock.mockResolvedValue({
        tasks: [makeTask(103, '2026-05-15T10:00:00Z')],
      });
      await renderTaskBoard();
      expect(screen.getByLabelText('カレンダーで表示')).toBeInTheDocument();
    });
  });

  describe('ジャンプ動作', () => {
    it('カレンダーアイコンをクリックすると /calendar?date=YYYY-MM-DD に navigate される', async () => {
      // ローカル時刻 5/15 になる ISO を作る（タイムゾーンに依らないようローカル基準で）
      const due = new Date(2026, 4, 15, 10, 0, 0);
      tasksListMock.mockResolvedValue({
        tasks: [makeTask(104, due.toISOString())],
      });
      await renderTaskBoard();
      const btn = screen.getByLabelText('カレンダーで表示');
      await userEvent.click(btn);
      // ルーティング後のスタブが表示される
      expect(screen.getByTestId('calendar-page-stub')).toBeInTheDocument();
    });

    it('ジャンプ時の date クエリは dueAt のローカル日付（YYYY-MM-DD）でフォーマットされる', async () => {
      const due = new Date(2026, 4, 15, 10, 0, 0);
      tasksListMock.mockResolvedValue({
        tasks: [makeTask(105, due.toISOString())],
      });
      // navigate を捕捉するために react-router-dom の useNavigate をモックではなく
      // ルーティング先で URL を確認するパターンを取る
      const TaskBoardPage = await importTaskBoard();
      let capturedSearch = '';
      await act(async () => {
        render(
          <MemoryRouter initialEntries={['/tasks']}>
            <Routes>
              <Route path="/tasks" element={<TaskBoardPage />} />
              <Route
                path="/calendar"
                element={<LocationCapture onCapture={(s) => (capturedSearch = s)} />}
              />
            </Routes>
          </MemoryRouter>,
        );
      });
      const btn = screen.getByLabelText('カレンダーで表示');
      await userEvent.click(btn);
      expect(capturedSearch).toContain('date=2026-05-15');
    });

    it('カレンダーアイコンクリックで他の親イベントが発火しない（stopPropagation）', async () => {
      // カレンダーアイコンクリック後に EditTaskDialog が開かないことを確認
      const due = new Date(2026, 4, 15, 10, 0, 0);
      tasksListMock.mockResolvedValue({
        tasks: [makeTask(106, due.toISOString())],
      });
      await renderTaskBoard();
      const btn = screen.getByLabelText('カレンダーで表示');
      await userEvent.click(btn);
      // 編集ダイアログ（タイトル「タスクを編集」など）が出ていない
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  describe('CalendarPage 側の受け取り', () => {
    it('?date=YYYY-MM-DD があるとカーソルがその日付の月にセットされる', async () => {
      // 2026-05-15 → 5月のグリッド (day-cell-2026-4-15 が当月セル)
      await renderCalendarWithDate('2026-05-15');
      const cell = screen.getByTestId('day-cell-2026-4-15');
      expect(cell.getAttribute('data-in-month')).toBe('true');
    });

    it('?date=today（既存仕様）は引き続き今日にカーソルがセットされる', async () => {
      await renderCalendarWithDate('today');
      const today = new Date();
      const cell = screen.getByTestId(
        `day-cell-${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`,
      );
      expect(cell.getAttribute('data-today')).toBe('true');
    });

    it('?date=invalid のような不正な値は無視され、デフォルトの今日に設定される', async () => {
      await renderCalendarWithDate('invalid');
      const today = new Date();
      // クラッシュせずに描画され、当日のセルが存在する（カーソルは今日のまま）
      const cell = screen.getByTestId(
        `day-cell-${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`,
      );
      expect(cell.getAttribute('data-today')).toBe('true');
    });
  });
});

// 現在のロケーションの search を上位に伝えるユーティリティ
import { useLocation } from 'react-router-dom';
import { useEffect } from 'react';
function LocationCapture({ onCapture }: { onCapture: (search: string) => void }) {
  const loc = useLocation();
  useEffect(() => {
    onCapture(loc.search);
  }, [loc.search, onCapture]);
  return <div data-testid="calendar-page-stub" />;
}
