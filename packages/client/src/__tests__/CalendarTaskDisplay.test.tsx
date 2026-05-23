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
 *   今回スコープ: MonthView の 8 項目のみ実装。
 *   WeekView/AgendaView/CalendarPage 統合は it.skip + Issue #342 参照で残課題として追跡する。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MonthView } from '../components/Calendar/MonthView';
import type { CalendarEvent, Task } from '@chat-app/shared';

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

const onEventClick = vi.fn();
const onDayClick = vi.fn();
const onTaskClick = vi.fn();

beforeEach(() => {
  onEventClick.mockClear();
  onDayClick.mockClear();
  onTaskClick.mockClear();
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
      it.skip('dueAt の日付・時刻に対応する位置に task-week-block-{id} が描画される', () => {
        /* see #342 */
      });
      it.skip('時刻指定なし（00:00 等）のタスクは終日エリアまたは固定位置に描画される', () => {
        /* see #342 */
      });
      it.skip('週外のタスクは描画されない', () => {
        /* see #342 */
      });
    });

    describe('色分け', () => {
      it.skip('タスクブロックはイベントとは異なる色で描画される', () => {
        /* see #342 */
      });
    });

    describe('クリック動作', () => {
      it.skip('タスクブロックをクリックすると onTaskClick が該当タスクで呼ばれる', () => {
        /* see #342 */
      });
    });
  });

  describe('AgendaView', () => {
    describe('期限付きタスクの描画', () => {
      it.skip('期限日のグループにタスク行（agenda-task-{id}）が混在表示される', () => {
        /* see #342 */
      });
      it.skip('日付グループはイベント＋タスクをまとめてソート（時刻昇順、時刻なしタスクは末尾）して並ぶ', () => {
        /* see #342 */
      });
      it.skip('cursor 月外の期限タスクはグルーピング対象外', () => {
        /* see #342 */
      });
    });

    describe('表示内容', () => {
      it.skip('タスク行にはタイトル・担当者・「タスク」種別ラベル（チップ等）が表示される', () => {
        /* see #342 */
      });
      it.skip('タスク行のサイドバー色はタスク用カラーで描画される', () => {
        /* see #342 */
      });
    });

    describe('クリック動作', () => {
      it.skip('タスク行をクリックすると onTaskClick が呼ばれる', () => {
        /* see #342 */
      });
    });
  });

  describe('CalendarPage 統合', () => {
    describe('タスクのフェッチ', () => {
      it.skip('カレンダー描画時に api.tasks.list が呼ばれて期限ありタスクが取得される', () => {
        /* see #342 */
      });
      it.skip('タスク取得失敗時もイベントは正常に表示される（エラーで全体クラッシュしない）', () => {
        /* see #342 */
      });
    });

    describe('チャンネルフィルタ連携', () => {
      it.skip('チャンネルフィルタ適用時、sourceChannelId が一致するタスクのみ表示される', () => {
        /* see #342 */
      });
      it.skip('未操作（全選択）時は sourceChannelId が null のタスクも表示される', () => {
        /* see #342 */
      });
    });

    describe('タスククリック時の挙動', () => {
      it.skip('カレンダー上のタスククリックで EditTaskDialog が開く', () => {
        /* see #342 */
      });
    });
  });
});
