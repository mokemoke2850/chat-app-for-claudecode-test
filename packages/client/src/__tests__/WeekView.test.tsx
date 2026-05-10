/**
 * テスト対象: components/Calendar/WeekView.tsx — カレンダー週表示（#152）
 *
 * 戦略:
 *   - cursor が含まれる週（日曜起点）の 7 日 × 時刻軸でイベントブロックの絶対配置を検証
 *   - now-line の表示有無は「当日が週内に含まれるか」で判定
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { WeekView } from '../components/Calendar/WeekView';
import type { CalendarEvent } from '@chat-app/shared';

const HOUR_HEIGHT = 48;
const START_HOUR = 7;

// 2026-05-13 (水) を含む週 = 2026-05-10(日) 〜 2026-05-16(土)
const CURSOR = new Date(2026, 4, 13);
const TODAY_IN_WEEK = new Date(2026, 4, 13, 10, 30); // 週内 + 10:30
const TODAY_OUT_OF_WEEK = new Date(2026, 5, 1, 10, 30); // 週外

const channelColors = new Map<number, string>([
  [10, '#1976d2'],
  [11, '#d81b60'],
]);

function makeEvent(
  id: number,
  channelId: number | null,
  startsAt: string,
  endsAt: string,
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
    endsAt,
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

beforeEach(() => {
  onEventClick.mockClear();
});

describe('WeekView', () => {
  describe('週グリッド', () => {
    it('cursor を含む週（日曜起点）の 7 日分のカラムを描画する', () => {
      render(
        <WeekView
          cursor={CURSOR}
          today={TODAY_IN_WEEK}
          events={[]}
          channelColors={channelColors}
          onEventClick={onEventClick}
        />,
      );
      // 5/10(日)〜5/16(土)
      for (let date = 10; date <= 16; date++) {
        expect(screen.getByTestId(`week-column-2026-4-${date}`)).toBeInTheDocument();
      }
    });

    it('時刻ラベル列に 07:00〜22:00 が表示される', () => {
      render(
        <WeekView
          cursor={CURSOR}
          today={TODAY_IN_WEEK}
          events={[]}
          channelColors={channelColors}
          onEventClick={onEventClick}
        />,
      );
      expect(screen.getByText('7:00')).toBeInTheDocument();
      expect(screen.getByText('12:00')).toBeInTheDocument();
      expect(screen.getByText('22:00')).toBeInTheDocument();
    });

    it('当日のカラムに data 属性で識別可能な状態で描画される', () => {
      render(
        <WeekView
          cursor={CURSOR}
          today={TODAY_IN_WEEK}
          events={[]}
          channelColors={channelColors}
          onEventClick={onEventClick}
        />,
      );
      // 5/13(水)
      const todayCol = screen.getByTestId('week-column-2026-4-13');
      expect(todayCol).toBeInTheDocument();
      // now-line マーカーが当日列に存在する
      expect(within(todayCol).getByTestId('week-now-line-2026-4-13')).toBeInTheDocument();
    });
  });

  describe('イベント配置', () => {
    it('イベントの top は (starts_at の時刻 - 開始時刻) × HOUR_HEIGHT で計算される', () => {
      // 5/13 10:00 開始 → top = (10-7)*60 / 60 * HOUR_HEIGHT = 3 * 48 = 144
      const ev = makeEvent(
        1,
        10,
        new Date(2026, 4, 13, 10, 0).toISOString(),
        new Date(2026, 4, 13, 11, 0).toISOString(),
      );
      render(
        <WeekView
          cursor={CURSOR}
          today={TODAY_IN_WEEK}
          events={[ev]}
          channelColors={channelColors}
          onEventClick={onEventClick}
        />,
      );
      const block = screen.getByTestId('week-event-1');
      expect(Number(block.getAttribute('data-top'))).toBeCloseTo(
        (10 - START_HOUR) * HOUR_HEIGHT,
        0,
      );
    });

    it('イベントの height は (ends_at - starts_at) × HOUR_HEIGHT で計算される（最小 22px）', () => {
      // 1 時間イベント → height = 48
      const ev1h = makeEvent(
        1,
        10,
        new Date(2026, 4, 13, 10, 0).toISOString(),
        new Date(2026, 4, 13, 11, 0).toISOString(),
      );
      // 5 分イベント → height = 22 (最小)
      const ev5m = makeEvent(
        2,
        10,
        new Date(2026, 4, 13, 12, 0).toISOString(),
        new Date(2026, 4, 13, 12, 5).toISOString(),
      );
      render(
        <WeekView
          cursor={CURSOR}
          today={TODAY_IN_WEEK}
          events={[ev1h, ev5m]}
          channelColors={channelColors}
          onEventClick={onEventClick}
        />,
      );
      expect(Number(screen.getByTestId('week-event-1').getAttribute('data-height'))).toBe(
        HOUR_HEIGHT,
      );
      expect(Number(screen.getByTestId('week-event-2').getAttribute('data-height'))).toBe(22);
    });

    it('チャンネル色がブロック背景色として使われる', () => {
      const ev = makeEvent(
        1,
        11,
        new Date(2026, 4, 13, 10, 0).toISOString(),
        new Date(2026, 4, 13, 11, 0).toISOString(),
      );
      render(
        <WeekView
          cursor={CURSOR}
          today={TODAY_IN_WEEK}
          events={[ev]}
          channelColors={channelColors}
          onEventClick={onEventClick}
        />,
      );
      const block = screen.getByTestId('week-event-1');
      // #d81b60 → rgb(216, 27, 96)
      expect(window.getComputedStyle(block).backgroundColor).toBe('rgb(216, 27, 96)');
    });

    it('クリックで onEventClick が呼ばれる', async () => {
      const ev = makeEvent(
        1,
        10,
        new Date(2026, 4, 13, 10, 0).toISOString(),
        new Date(2026, 4, 13, 11, 0).toISOString(),
      );
      render(
        <WeekView
          cursor={CURSOR}
          today={TODAY_IN_WEEK}
          events={[ev]}
          channelColors={channelColors}
          onEventClick={onEventClick}
        />,
      );
      await userEvent.click(screen.getByTestId('week-event-1'));
      expect(onEventClick).toHaveBeenCalledTimes(1);
      expect((onEventClick.mock.calls[0][0] as CalendarEvent).id).toBe(1);
    });
  });

  describe('now-line', () => {
    it('当日が表示中の週に含まれるとき、当日カラムに now-line が描画される', () => {
      render(
        <WeekView
          cursor={CURSOR}
          today={TODAY_IN_WEEK}
          events={[]}
          channelColors={channelColors}
          onEventClick={onEventClick}
        />,
      );
      expect(screen.getByTestId('week-now-line-2026-4-13')).toBeInTheDocument();
    });

    it('当日が表示中の週外なら now-line は描画されない', () => {
      render(
        <WeekView
          cursor={CURSOR}
          today={TODAY_OUT_OF_WEEK}
          events={[]}
          channelColors={channelColors}
          onEventClick={onEventClick}
        />,
      );
      // 週内のどの日付にも now-line マーカーが存在しないこと
      expect(screen.queryByTestId(/^week-now-line-/)).toBeNull();
    });
  });
});
