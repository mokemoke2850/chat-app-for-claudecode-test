/**
 * テスト対象: カレンダー上のタスクをドラッグして期限日を変更する（Issue #267）
 *
 * 戦略:
 *   - @dnd-kit を `vi.mock` でスタブ化し、DndContext の onDragEnd ハンドラを直接呼び出して
 *     楽観更新と PATCH /tasks/:id の dueAt 送信を検証する
 *   - 月表示では「日付セル」が DroppableContainer になっている前提で、
 *     useDroppable モックの呼び出し引数（id: 'day-YYYY-M-D' など）から登録を確認する
 *   - 楽観更新：UI 上のタスクがドロップ先日付セルに即座に移動すること
 *   - 失敗時ロールバック：API が reject されたら元の日付セルに戻ること
 *   - 成功時：api.tasks.update が { dueAt: <ISO of dropped day> } で呼ばれること
 *
 *   今回スコープ: MonthView の 8 項目 + PATCH 連携 4 項目を実装。
 *   WeekView は it.skip + Issue #338 参照で残課題として追跡する。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import type { CalendarEvent, Channel, Task } from '@chat-app/shared';

// DndContext から渡される onDragEnd を捕まえてテスト側から発火するためのフック
let capturedOnDragEnd:
  | ((event: { active: { id: string }; over: { id: string } | null }) => void)
  | null = null;
const droppableRegistrations: string[] = [];
const draggableRegistrations: string[] = [];

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({
    children,
    onDragEnd,
  }: {
    children: ReactNode;
    onDragEnd?: (event: { active: { id: string }; over: { id: string } | null }) => void;
  }) => {
    capturedOnDragEnd = onDragEnd ?? null;
    return <>{children}</>;
  },
  closestCorners: vi.fn(),
  PointerSensor: class {},
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn(() => []),
  useDroppable: ({ id }: { id: string }) => {
    droppableRegistrations.push(id);
    return { setNodeRef: vi.fn(), isOver: false };
  },
  useDraggable: ({ id }: { id: string }) => {
    draggableRegistrations.push(id);
    return {
      setNodeRef: vi.fn(),
      attributes: {},
      listeners: {},
      transform: null,
      isDragging: false,
    };
  },
}));

const eventsListMock = vi.fn();
const tasksListMock = vi.fn();
const tasksUpdateMock = vi.fn();
const channelsListMock = vi.fn();
const usersListMock = vi.fn();
const pollsListMock = vi.fn();

vi.mock('../api/client', () => ({
  api: {
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
    tasks: {
      list: tasksListMock,
      update: tasksUpdateMock,
      create: vi.fn(),
      delete: vi.fn(),
      updateOrder: vi.fn(),
    },
    channels: { list: channelsListMock },
    auth: { users: usersListMock },
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

const showError = vi.fn();
const showSuccess = vi.fn();
vi.mock('../contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showError, showSuccess, showInfo: vi.fn() }),
  SnackbarProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
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

void ({} as CalendarEvent); // 型インポートのみ使用

async function importPage() {
  const mod = await import('../pages/CalendarPage');
  return mod.default;
}

const renderPage = async (initialDate?: string) => {
  const CalendarPage = await importPage();
  const url = initialDate ? `/calendar?date=${initialDate}` : '/calendar';
  await act(async () => {
    render(
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/calendar" element={<CalendarPage />} />
        </Routes>
      </MemoryRouter>,
    );
  });
};

beforeEach(() => {
  vi.resetModules();
  capturedOnDragEnd = null;
  droppableRegistrations.length = 0;
  draggableRegistrations.length = 0;
  eventsListMock.mockReset();
  tasksListMock.mockReset();
  tasksUpdateMock.mockReset();
  channelsListMock.mockReset();
  usersListMock.mockReset();
  pollsListMock.mockReset();
  showError.mockReset();
  showSuccess.mockReset();
  eventsListMock.mockResolvedValue({ events: [] });
  channelsListMock.mockResolvedValue({ channels: [makeChannel(10, 'general')] });
  usersListMock.mockResolvedValue({ users: [] });
  pollsListMock.mockResolvedValue({ polls: [] });
  tasksListMock.mockResolvedValue({ tasks: [] });
});

describe('カレンダー上でのタスクドラッグによる期限変更（Issue #267）', () => {
  describe('MonthView 上のドラッグ', () => {
    describe('Droppable 登録', () => {
      it('各日付セルが useDroppable の id として登録される（day-YYYY-M-D 形式）', async () => {
        // 2026/5 の月固定で表示
        await renderPage('2026-05-15');
        // day-2026-3-* (前月) や day-2026-4-* (当月) が含まれる
        const dayIds = droppableRegistrations.filter((id) => id.startsWith('day-'));
        expect(dayIds.length).toBe(42);
        expect(dayIds).toContain('day-2026-4-15');
      });

      it('タスクブロックが useDraggable の id として登録される（task-{id} 形式）', async () => {
        tasksListMock.mockResolvedValue({
          tasks: [makeTask(101, '2026-05-15T10:00:00Z')],
        });
        await renderPage('2026-05-15');
        expect(draggableRegistrations).toContain('task-101');
      });
    });

    describe('ドラッグ完了時の挙動', () => {
      it('別日にドロップすると api.tasks.update が { dueAt: <ISO> } で呼ばれる', async () => {
        const task = makeTask(101, '2026-05-15T10:00:00Z');
        tasksListMock.mockResolvedValue({ tasks: [task] });
        tasksUpdateMock.mockResolvedValue({ task: { ...task, dueAt: '2026-05-20T10:00:00Z' } });
        await renderPage('2026-05-15');
        expect(capturedOnDragEnd).toBeTruthy();

        await act(async () => {
          capturedOnDragEnd?.({
            active: { id: 'task-101' },
            over: { id: 'day-2026-4-20' },
          });
        });

        expect(tasksUpdateMock).toHaveBeenCalledTimes(1);
        const args = tasksUpdateMock.mock.calls[0];
        expect(args[0]).toBe(101);
        const payload = args[1] as { dueAt: string };
        const newDate = new Date(payload.dueAt);
        // 日付が 2026-05-20 (ローカル) に移動している
        expect(newDate.getFullYear()).toBe(2026);
        expect(newDate.getMonth()).toBe(4);
        expect(newDate.getDate()).toBe(20);
      });

      it('同日（dueAt 変化なし）にドロップした場合は API を呼ばない', async () => {
        const task = makeTask(102, '2026-05-15T10:00:00Z');
        tasksListMock.mockResolvedValue({ tasks: [task] });
        await renderPage('2026-05-15');

        // 元の dueAt と同じ日付（ローカル時刻）
        const due = new Date(task.dueAt!);
        const sameKey = `day-${due.getFullYear()}-${due.getMonth()}-${due.getDate()}`;
        await act(async () => {
          capturedOnDragEnd?.({
            active: { id: 'task-102' },
            over: { id: sameKey },
          });
        });

        expect(tasksUpdateMock).not.toHaveBeenCalled();
      });

      it('ドロップ先が空（over=null）の場合は API を呼ばない', async () => {
        const task = makeTask(103, '2026-05-15T10:00:00Z');
        tasksListMock.mockResolvedValue({ tasks: [task] });
        await renderPage('2026-05-15');

        await act(async () => {
          capturedOnDragEnd?.({ active: { id: 'task-103' }, over: null });
        });

        expect(tasksUpdateMock).not.toHaveBeenCalled();
      });
    });

    describe('楽観更新', () => {
      it('ドロップ直後にタスクがドロップ先日付セルへ即座に移動する', async () => {
        const task = makeTask(104, '2026-05-15T10:00:00Z');
        tasksListMock.mockResolvedValue({ tasks: [task] });
        // 解決を遅延させる
        let resolveUpdate!: (v: unknown) => void;
        tasksUpdateMock.mockReturnValue(
          new Promise((res) => {
            resolveUpdate = res;
          }),
        );
        await renderPage('2026-05-15');

        await act(async () => {
          capturedOnDragEnd?.({
            active: { id: 'task-104' },
            over: { id: 'day-2026-4-22' },
          });
        });

        // 楽観更新で 5/22 のセルにタスクが入る
        const cell = screen.getByTestId('day-cell-2026-4-22');
        expect(cell.querySelector('[data-testid="task-block-104"]')).not.toBeNull();
        // 元の 5/15 のセルにはもうない
        const orig = screen.getByTestId('day-cell-2026-4-15');
        expect(orig.querySelector('[data-testid="task-block-104"]')).toBeNull();

        // クリーンアップ: pending Promise を解決
        await act(async () => {
          resolveUpdate({ task: { ...task, dueAt: '2026-05-22T10:00:00Z' } });
        });
      });

      it('API 成功時は楽観更新がそのまま維持される', async () => {
        const task = makeTask(105, '2026-05-15T10:00:00Z');
        tasksListMock.mockResolvedValue({ tasks: [task] });
        tasksUpdateMock.mockResolvedValue({
          task: { ...task, dueAt: '2026-05-22T10:00:00Z' },
        });
        await renderPage('2026-05-15');

        await act(async () => {
          capturedOnDragEnd?.({
            active: { id: 'task-105' },
            over: { id: 'day-2026-4-22' },
          });
        });

        const cell = screen.getByTestId('day-cell-2026-4-22');
        expect(cell.querySelector('[data-testid="task-block-105"]')).not.toBeNull();
      });
    });

    describe('失敗時ロールバック', () => {
      it('API が reject されたらタスクが元の日付セルに戻る', async () => {
        const task = makeTask(106, '2026-05-15T10:00:00Z');
        tasksListMock.mockResolvedValue({ tasks: [task] });
        tasksUpdateMock.mockRejectedValue(new Error('500'));
        await renderPage('2026-05-15');

        await act(async () => {
          capturedOnDragEnd?.({
            active: { id: 'task-106' },
            over: { id: 'day-2026-4-22' },
          });
        });

        // ロールバック後、タスクは 5/15 に戻る
        const orig = screen.getByTestId('day-cell-2026-4-15');
        expect(orig.querySelector('[data-testid="task-block-106"]')).not.toBeNull();
        const moved = screen.getByTestId('day-cell-2026-4-22');
        expect(moved.querySelector('[data-testid="task-block-106"]')).toBeNull();
      });

      it('API エラー時はスナックバーで失敗を通知する', async () => {
        const task = makeTask(107, '2026-05-15T10:00:00Z');
        tasksListMock.mockResolvedValue({ tasks: [task] });
        tasksUpdateMock.mockRejectedValue(new Error('500'));
        await renderPage('2026-05-15');

        await act(async () => {
          capturedOnDragEnd?.({
            active: { id: 'task-107' },
            over: { id: 'day-2026-4-22' },
          });
        });

        expect(showError).toHaveBeenCalled();
      });
    });
  });

  describe('WeekView 上のドラッグ', () => {
    describe('Droppable 登録', () => {
      it.skip('各日付カラムが useDroppable の id として登録される（week-day-YYYY-M-D 形式）', () => {
        /* see #338 */
      });
    });

    describe('ドラッグ完了時の挙動', () => {
      it.skip('別日カラムへドロップすると dueAt が更新される', () => {
        /* see #338 */
      });
      it.skip('同日カラムへドロップしても時刻は変更しない（日付のみ更新する仕様）', () => {
        /* see #338 */
      });
    });
  });

  describe('PATCH /tasks/:id 連携', () => {
    describe('dueAt の送信形式', () => {
      it('dueAt は ISO 8601 文字列で送信される', async () => {
        const task = makeTask(201, '2026-05-15T10:30:00Z');
        tasksListMock.mockResolvedValue({ tasks: [task] });
        tasksUpdateMock.mockResolvedValue({ task });
        await renderPage('2026-05-15');

        await act(async () => {
          capturedOnDragEnd?.({
            active: { id: 'task-201' },
            over: { id: 'day-2026-4-20' },
          });
        });

        const payload = tasksUpdateMock.mock.calls[0][1] as { dueAt: string };
        // ISO 8601 形式 (...Z または ...±HH:MM)
        expect(payload.dueAt).toMatch(/T\d{2}:\d{2}:\d{2}/);
        // Date でパース可能であること
        expect(Number.isNaN(Date.parse(payload.dueAt))).toBe(false);
      });

      it('元のタスクの時刻部分は維持される（時刻指定なしなら 00:00 のまま）', async () => {
        // 元の dueAt の時刻は 10:30 (UTC) → ローカル時刻として保持される
        const original = new Date('2026-05-15T10:30:00Z');
        const task = makeTask(202, original.toISOString());
        tasksListMock.mockResolvedValue({ tasks: [task] });
        tasksUpdateMock.mockResolvedValue({ task });
        await renderPage('2026-05-15');

        await act(async () => {
          capturedOnDragEnd?.({
            active: { id: 'task-202' },
            over: { id: 'day-2026-4-20' },
          });
        });

        const payload = tasksUpdateMock.mock.calls[0][1] as { dueAt: string };
        const newDate = new Date(payload.dueAt);
        // 時・分・秒が元と同じ（ローカル時刻ベースで）
        expect(newDate.getHours()).toBe(original.getHours());
        expect(newDate.getMinutes()).toBe(original.getMinutes());
        expect(newDate.getSeconds()).toBe(original.getSeconds());
      });
    });

    describe('権限・エラーハンドリング', () => {
      it('404（タスクなし）のときは「タスクが見つかりません」と通知する', async () => {
        const task = makeTask(203, '2026-05-15T10:00:00Z');
        tasksListMock.mockResolvedValue({ tasks: [task] });
        tasksUpdateMock.mockRejectedValue(Object.assign(new Error('404'), { status: 404 }));
        await renderPage('2026-05-15');

        await act(async () => {
          capturedOnDragEnd?.({
            active: { id: 'task-203' },
            over: { id: 'day-2026-4-20' },
          });
        });

        expect(showError).toHaveBeenCalled();
        const message = showError.mock.calls[0]?.[0] as string;
        expect(message).toMatch(/見つかりません|タスク/);
      });

      it('500（サーバエラー）のときは汎用エラー通知を出す', async () => {
        const task = makeTask(204, '2026-05-15T10:00:00Z');
        tasksListMock.mockResolvedValue({ tasks: [task] });
        tasksUpdateMock.mockRejectedValue(Object.assign(new Error('500'), { status: 500 }));
        await renderPage('2026-05-15');

        await act(async () => {
          capturedOnDragEnd?.({
            active: { id: 'task-204' },
            over: { id: 'day-2026-4-20' },
          });
        });

        expect(showError).toHaveBeenCalled();
      });
    });
  });
});
