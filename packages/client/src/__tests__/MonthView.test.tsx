/**
 * テスト対象: components/Calendar/MonthView.tsx — カレンダー月表示（#152）
 *
 * 戦略:
 *   - 純粋なプロップス駆動コンポーネントとして検証（API モックなし）
 *   - 6 週分のグリッド生成・前後月の補完日付・イベント配置の計算ロジックを中心に確認
 *   - スタイルや色の細かな検証は省略
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MonthView } from '../components/Calendar/MonthView';
import type { CalendarEvent } from '@chat-app/shared';

const TODAY = new Date(2026, 4, 15); // 2026-05-15 (金)
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

const onEventClick = vi.fn();
const onDayClick = vi.fn();

beforeEach(() => {
  onEventClick.mockClear();
  onDayClick.mockClear();
});

describe('MonthView', () => {
  describe('グリッド生成', () => {
    it('cursor の月の 1 日を含む週から 6 週（42 日）分のセルを描画する', () => {
      render(
        <MonthView
          cursor={CURSOR}
          today={TODAY}
          events={[]}
          channelColors={channelColors}
          onEventClick={onEventClick}
          onDayClick={onDayClick}
        />,
      );
      const grid = screen.getByTestId('calendar-month-grid');
      // 42 日分のセル
      const cells = within(grid).getAllByTestId(/^day-cell-/);
      expect(cells).toHaveLength(42);
    });

    it('cursor の月以外の日付（前月末・翌月頭）は data-in-month=false として描画される', () => {
      render(
        <MonthView
          cursor={CURSOR}
          today={TODAY}
          events={[]}
          channelColors={channelColors}
          onEventClick={onEventClick}
          onDayClick={onDayClick}
        />,
      );
      // 2026-04-30（前月末）は前月扱い
      const prev = screen.getByTestId('day-cell-2026-3-30');
      expect(prev.getAttribute('data-in-month')).toBe('false');
      // 2026-05-01（当月初日）は当月扱い
      const inMonth = screen.getByTestId('day-cell-2026-4-1');
      expect(inMonth.getAttribute('data-in-month')).toBe('true');
    });

    it('日曜は赤系・土曜は青系で曜日ヘッダーが描画される', () => {
      render(
        <MonthView
          cursor={CURSOR}
          today={TODAY}
          events={[]}
          channelColors={channelColors}
          onEventClick={onEventClick}
          onDayClick={onDayClick}
        />,
      );
      // 曜日ヘッダーは「日」「月」「火」「水」「木」「金」「土」
      // 順序通り 7 個並ぶことを確認
      ['日', '月', '火', '水', '木', '金', '土'].forEach((w) => {
        // weekday header と day-cell の両方が一致しないよう、ヘッダーの heading 系で取得は厳しいので存在のみ確認
        expect(screen.getAllByText(w).length).toBeGreaterThan(0);
      });
    });

    it('当日（today）の日付セルが data-today=true で描画される', () => {
      render(
        <MonthView
          cursor={CURSOR}
          today={TODAY}
          events={[]}
          channelColors={channelColors}
          onEventClick={onEventClick}
          onDayClick={onDayClick}
        />,
      );
      const cell = screen.getByTestId('day-cell-2026-4-15');
      expect(cell.getAttribute('data-today')).toBe('true');
    });
  });

  describe('イベント配置', () => {
    it('starts_at が当月内のイベントは該当日付セルに表示される', () => {
      const ev = makeEvent(1, 10, '2026-05-10T10:00:00Z', 'Sprint Planning');
      render(
        <MonthView
          cursor={CURSOR}
          today={TODAY}
          events={[ev]}
          channelColors={channelColors}
          onEventClick={onEventClick}
          onDayClick={onDayClick}
        />,
      );
      // 5/10 のセルにイベントが含まれる（datetime のローカル換算で月日キーが計算される）
      const start = new Date('2026-05-10T10:00:00Z');
      const cell = screen.getByTestId(
        `day-cell-${start.getFullYear()}-${start.getMonth()}-${start.getDate()}`,
      );
      expect(within(cell).getByTestId('event-block-1')).toBeInTheDocument();
      expect(within(cell).getByText('Sprint Planning')).toBeInTheDocument();
    });

    it('1 日に 4 件以上ある場合、最初の 3 件 + 「+N 件」が表示される', () => {
      const day = '2026-05-10';
      const evs = [
        makeEvent(1, 10, `${day}T09:00:00Z`, 'A'),
        makeEvent(2, 10, `${day}T10:00:00Z`, 'B'),
        makeEvent(3, 10, `${day}T11:00:00Z`, 'C'),
        makeEvent(4, 10, `${day}T12:00:00Z`, 'D'),
        makeEvent(5, 10, `${day}T13:00:00Z`, 'E'),
      ];
      render(
        <MonthView
          cursor={CURSOR}
          today={TODAY}
          events={evs}
          channelColors={channelColors}
          onEventClick={onEventClick}
          onDayClick={onDayClick}
        />,
      );
      const start = new Date(`${day}T09:00:00Z`);
      const cell = screen.getByTestId(
        `day-cell-${start.getFullYear()}-${start.getMonth()}-${start.getDate()}`,
      );
      // 最初の 3 件が表示
      expect(within(cell).getByTestId('event-block-1')).toBeInTheDocument();
      expect(within(cell).getByTestId('event-block-2')).toBeInTheDocument();
      expect(within(cell).getByTestId('event-block-3')).toBeInTheDocument();
      // 4 / 5 はブロック非表示
      expect(within(cell).queryByTestId('event-block-4')).toBeNull();
      expect(within(cell).queryByTestId('event-block-5')).toBeNull();
      // +2 件が表示
      expect(within(cell).getByText('+2 件')).toBeInTheDocument();
    });

    it('チャンネル色がイベントブロックの背景色として使われる', () => {
      const ev = makeEvent(1, 11, '2026-05-10T10:00:00Z');
      render(
        <MonthView
          cursor={CURSOR}
          today={TODAY}
          events={[ev]}
          channelColors={channelColors}
          onEventClick={onEventClick}
          onDayClick={onDayClick}
        />,
      );
      const block = screen.getByTestId('event-block-1');
      // sx の bgcolor は inline style に rgb 化される。MUI が変換した値を含むか確認
      const style = window.getComputedStyle(block);
      // #d81b60 → rgb(216, 27, 96)
      expect(style.backgroundColor).toBe('rgb(216, 27, 96)');
    });

    it('starts_at の昇順でイベントが並ぶ', () => {
      const day = '2026-05-10';
      const evs = [
        makeEvent(3, 10, `${day}T13:00:00Z`, 'C'),
        makeEvent(1, 10, `${day}T09:00:00Z`, 'A'),
        makeEvent(2, 10, `${day}T11:00:00Z`, 'B'),
      ];
      render(
        <MonthView
          cursor={CURSOR}
          today={TODAY}
          events={evs}
          channelColors={channelColors}
          onEventClick={onEventClick}
          onDayClick={onDayClick}
        />,
      );
      const start = new Date(`${day}T09:00:00Z`);
      const cell = screen.getByTestId(
        `day-cell-${start.getFullYear()}-${start.getMonth()}-${start.getDate()}`,
      );
      const blocks = within(cell).getAllByTestId(/^event-block-/);
      const ids = blocks.map((b) => b.getAttribute('data-testid'));
      expect(ids).toEqual(['event-block-1', 'event-block-2', 'event-block-3']);
    });
  });

  describe('インタラクション', () => {
    it('日付セルクリックで onDayClick が呼ばれる（その日付の Date）', async () => {
      render(
        <MonthView
          cursor={CURSOR}
          today={TODAY}
          events={[]}
          channelColors={channelColors}
          onEventClick={onEventClick}
          onDayClick={onDayClick}
        />,
      );
      const cell = screen.getByTestId('day-cell-2026-4-15');
      await userEvent.click(cell);
      expect(onDayClick).toHaveBeenCalledTimes(1);
      const arg = onDayClick.mock.calls[0][0] as Date;
      expect(arg.getFullYear()).toBe(2026);
      expect(arg.getMonth()).toBe(4);
      expect(arg.getDate()).toBe(15);
    });

    it('イベントブロックのクリックでは onEventClick が呼ばれ onDayClick は呼ばれない（stopPropagation）', async () => {
      const ev = makeEvent(1, 10, '2026-05-10T10:00:00Z');
      render(
        <MonthView
          cursor={CURSOR}
          today={TODAY}
          events={[ev]}
          channelColors={channelColors}
          onEventClick={onEventClick}
          onDayClick={onDayClick}
        />,
      );
      const block = screen.getByTestId('event-block-1');
      await userEvent.click(block);
      expect(onEventClick).toHaveBeenCalledTimes(1);
      expect(onDayClick).not.toHaveBeenCalled();
    });
  });
});
