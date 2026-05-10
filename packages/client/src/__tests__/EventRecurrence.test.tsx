// Issue #302 — イベントの繰り返し設定（フロントエンド）
// 実装方針: マスター + 子イベント展開方式 / 編集スコープ one|following|all。
// EventDialog / EventDetailDrawer / MonthView の繰り返しUI を検証する。

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { EventDialog } from '../components/Calendar/EventDialog';
import { EventDetailDrawer } from '../components/Calendar/EventDetailDrawer';
import { MonthView } from '../components/Calendar/MonthView';
import type { CalendarEvent, Channel, RecurrenceEditScope, User } from '@chat-app/shared';

const eventCreateMock = vi.fn();
const eventUpdateMock = vi.fn();
const eventDeleteMock = vi.fn();
const eventRsvpMock = vi.fn();

vi.mock('../api/client', () => ({
  api: {
    calendar: {
      events: {
        create: (...args: unknown[]) => eventCreateMock(...args),
        update: (...args: unknown[]) => eventUpdateMock(...args),
        delete: (...args: unknown[]) => eventDeleteMock(...args),
        rsvp: (...args: unknown[]) => eventRsvpMock(...args),
      },
      polls: {
        create: vi.fn(),
      },
    },
  },
}));

function makeUser(id: number, name: string): User {
  return {
    id,
    username: name,
    email: `${name}@t.com`,
    displayName: name[0].toUpperCase() + name.slice(1),
    avatarUrl: null,
    location: null,
    createdAt: '2026-04-30T00:00:00Z',
    role: 'user',
    isActive: true,
    onboardingCompletedAt: null,
  };
}

const channels: Channel[] = [
  {
    id: 10,
    name: 'general',
    description: null,
    topic: null,
    createdBy: 1,
    createdAt: '2026-04-30T00:00:00Z',
    isPrivate: false,
    postingPermission: 'everyone',
    unreadCount: 0,
  },
];

const users: User[] = [makeUser(1, 'alice')];

function makeRecurringEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 100,
    channelId: 10,
    title: 'Weekly Sync',
    description: null,
    location: null,
    meetingUrl: null,
    startsAt: '2030-01-06T09:00:00.000Z', // 2030-01-06 は日曜
    endsAt: '2030-01-06T10:00:00.000Z',
    organizerId: 1,
    createdAt: '2026-04-30T00:00:00Z',
    updatedAt: '2026-04-30T00:00:00Z',
    attendees: [],
    reminderOffsetMinutes: null,
    recurrenceRule: 'WEEKLY',
    recurrenceInterval: 1,
    recurrenceDaysOfWeek: [1, 3, 5],
    recurrenceEndDate: null,
    recurrenceCount: null,
    recurrenceMasterId: null,
    ...overrides,
  };
}

const dialogHandlers = {
  onClose: vi.fn(),
  onCreated: vi.fn(),
  onUpdated: vi.fn(),
  onPollCreated: vi.fn(),
};

beforeEach(() => {
  eventCreateMock.mockReset();
  eventUpdateMock.mockReset();
  eventDeleteMock.mockReset();
  eventRsvpMock.mockReset();
  Object.values(dialogHandlers).forEach((h) => h.mockClear());
});

const renderDialog = (
  overrides: { event?: CalendarEvent | null; editScope?: RecurrenceEditScope } = {},
) =>
  render(
    <EventDialog
      open={true}
      channels={channels}
      users={users}
      initialDate={new Date('2030-01-06T09:00:00')}
      event={overrides.event ?? null}
      editScope={overrides.editScope}
      onClose={dialogHandlers.onClose}
      onCreated={dialogHandlers.onCreated}
      onUpdated={dialogHandlers.onUpdated}
      onPollCreated={dialogHandlers.onPollCreated}
    />,
  );

describe('イベントの繰り返し設定（クライアント）', () => {
  describe('EventDialog: 繰り返し設定フォーム', () => {
    /** MUI Select のトリガー要素を取得する（aria-label が付いた combobox） */
    const getRuleTrigger = () => screen.getByLabelText('event-recurrence-rule');

    /** 内部の隠し input から現在値を読む */
    const getRuleValue = (container: HTMLElement): string => {
      const hidden = container.querySelector(
        'input[type="hidden"][name]',
      ) as HTMLInputElement | null;
      // 隠し input がない場合は trigger 要素のテキストから推定
      return hidden?.value ?? '';
    };

    it('繰り返しオプションのセレクトが描画される', () => {
      renderDialog();
      expect(getRuleTrigger()).toBeInTheDocument();
    });

    it('デフォルトでは「なし」が選択されている（トリガー表示テキストが「なし」）', () => {
      renderDialog();
      expect(getRuleTrigger()).toHaveTextContent('なし');
    });

    it('「なし」選択時は曜日チップ・終了条件フォームが非表示', () => {
      renderDialog();
      expect(screen.queryByTestId('event-recurrence-weekdays')).toBeNull();
      expect(screen.queryByLabelText('event-recurrence-end-type')).toBeNull();
    });

    it('「毎週」を選んだ場合に曜日チップと終了条件が表示される', async () => {
      renderDialog();
      await userEvent.click(getRuleTrigger());
      await userEvent.click(screen.getByRole('option', { name: '毎週' }));
      expect(screen.getByTestId('event-recurrence-weekdays')).toBeInTheDocument();
      expect(screen.getByLabelText('event-recurrence-end-type')).toBeInTheDocument();
    });

    it('「毎週」選択時、開始日に該当する曜日が初期値で選択されている', async () => {
      renderDialog(); // initialDate は 2030-01-06 = 日曜（getDay=0）
      await userEvent.click(getRuleTrigger());
      await userEvent.click(screen.getByRole('option', { name: '毎週' }));
      const sunday = screen.getByLabelText('weekday-0');
      expect(sunday).toHaveAttribute('aria-pressed', 'true');
    });

    it('保存時に api.calendar.events.create に recurrence ルールが渡される', async () => {
      eventCreateMock.mockResolvedValue({ event: makeRecurringEvent() });
      renderDialog();
      await userEvent.type(screen.getByLabelText('event-title'), '会議');
      // 毎日に設定
      await userEvent.click(getRuleTrigger());
      await userEvent.click(screen.getByRole('option', { name: '毎日' }));
      await userEvent.click(screen.getByLabelText('event-dialog-submit'));
      expect(eventCreateMock).toHaveBeenCalledTimes(1);
      const arg = eventCreateMock.mock.calls[0][0];
      expect(arg.recurrence).toMatchObject({ rule: 'DAILY', interval: 1 });
    });

    it('編集モードで繰り返し設定が初期値として読み込まれる', () => {
      renderDialog({ event: makeRecurringEvent(), editScope: 'all' });
      // トリガーの表示テキストが「毎週」になる
      expect(getRuleTrigger()).toHaveTextContent('毎週');
      // 月・水・金（1, 3, 5）が選択されている
      expect(screen.getByLabelText('weekday-1')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByLabelText('weekday-3')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByLabelText('weekday-5')).toHaveAttribute('aria-pressed', 'true');
    });

    it('編集時に api.calendar.events.update に scope が渡される', async () => {
      eventUpdateMock.mockResolvedValue({ event: makeRecurringEvent() });
      renderDialog({ event: makeRecurringEvent(), editScope: 'following' });
      await userEvent.click(screen.getByLabelText('event-dialog-submit'));
      expect(eventUpdateMock).toHaveBeenCalledTimes(1);
      const arg = eventUpdateMock.mock.calls[0][1];
      expect(arg.scope).toBe('following');
    });

    it('「毎週」で全曜日チェックを外して保存しようとするとバリデーションエラー', async () => {
      renderDialog();
      await userEvent.type(screen.getByLabelText('event-title'), 'X');
      await userEvent.click(getRuleTrigger());
      await userEvent.click(screen.getByRole('option', { name: '毎週' }));
      // 初期選択（日曜）を外す
      await userEvent.click(screen.getByLabelText('weekday-0'));
      await userEvent.click(screen.getByLabelText('event-dialog-submit'));
      expect(await screen.findByTestId('event-dialog-error')).toHaveTextContent('曜日');
      expect(eventCreateMock).not.toHaveBeenCalled();
    });

    // 未使用のため削除しないがリント抑止
    void getRuleValue;
  });

  describe('EventDetailDrawer: 繰り返しイベント表示', () => {
    const drawerHandlers = {
      onClose: vi.fn(),
      onEdit: vi.fn(),
      onRsvpUpdated: vi.fn(),
      onDeleted: vi.fn(),
    };

    beforeEach(() => {
      Object.values(drawerHandlers).forEach((h) => h.mockClear());
    });

    const renderDrawer = (event: CalendarEvent) =>
      render(
        <EventDetailDrawer
          event={event}
          channels={channels}
          channelColors={new Map([[10, '#1976d2']])}
          users={users}
          currentUserId={1}
          onClose={drawerHandlers.onClose}
          onEdit={drawerHandlers.onEdit}
          onRsvpUpdated={drawerHandlers.onRsvpUpdated}
          onDeleted={drawerHandlers.onDeleted}
        />,
      );

    it('繰り返しイベントには「繰り返し」バッジが表示される', () => {
      renderDrawer(makeRecurringEvent());
      expect(screen.getByTestId('event-recurrence-badge')).toBeInTheDocument();
    });

    it('単発イベントには繰り返しバッジが表示されない', () => {
      const single = makeRecurringEvent({
        recurrenceRule: null,
        recurrenceMasterId: null,
        recurrenceDaysOfWeek: null,
      });
      renderDrawer(single);
      expect(screen.queryByTestId('event-recurrence-badge')).toBeNull();
    });

    it('繰り返しイベントの編集ボタン押下時に編集スコープダイアログが表示される', async () => {
      renderDrawer(makeRecurringEvent());
      await userEvent.click(screen.getByLabelText('event-edit'));
      expect(screen.getByTestId('event-edit-scope-dialog')).toBeInTheDocument();
      expect(drawerHandlers.onEdit).not.toHaveBeenCalled();
    });

    it('単発イベントの編集ボタン押下では直接 onEdit が呼ばれる', async () => {
      const single = makeRecurringEvent({
        recurrenceRule: null,
        recurrenceMasterId: null,
        recurrenceDaysOfWeek: null,
      });
      renderDrawer(single);
      await userEvent.click(screen.getByLabelText('event-edit'));
      expect(drawerHandlers.onEdit).toHaveBeenCalledTimes(1);
      expect(drawerHandlers.onEdit.mock.calls[0][1]).toBeUndefined();
    });

    it('スコープ選択ダイアログで「以降すべて」を選んで続行すると onEdit に scope=following が渡る', async () => {
      renderDrawer(makeRecurringEvent());
      await userEvent.click(screen.getByLabelText('event-edit'));
      await userEvent.click(screen.getByLabelText('edit-scope-following'));
      await userEvent.click(screen.getByLabelText('edit-scope-confirm'));
      expect(drawerHandlers.onEdit).toHaveBeenCalledTimes(1);
      expect(drawerHandlers.onEdit.mock.calls[0][1]).toBe('following');
    });

    it('繰り返しイベントの削除確認ダイアログにスコープ選択が表示される', async () => {
      renderDrawer(makeRecurringEvent());
      await userEvent.click(screen.getByLabelText('event-delete'));
      expect(screen.getByTestId('delete-scope-section')).toBeInTheDocument();
    });

    it('単発イベントの削除確認ダイアログにはスコープ選択が表示されない', async () => {
      const single = makeRecurringEvent({
        recurrenceRule: null,
        recurrenceMasterId: null,
        recurrenceDaysOfWeek: null,
      });
      renderDrawer(single);
      await userEvent.click(screen.getByLabelText('event-delete'));
      expect(screen.queryByTestId('delete-scope-section')).toBeNull();
    });

    it('スコープ「すべて」で削除すると api.calendar.events.delete に scope=all が渡る', async () => {
      eventDeleteMock.mockResolvedValue(undefined);
      renderDrawer(makeRecurringEvent());
      await userEvent.click(screen.getByLabelText('event-delete'));
      await userEvent.click(screen.getByLabelText('delete-scope-all'));
      // 削除確認ダイアログ内の「削除」ボタン
      const buttons = screen.getAllByRole('button', { name: '削除' });
      // ダイアログ内の最後に表示される確定ボタンを使う
      await userEvent.click(buttons[buttons.length - 1]);
      expect(eventDeleteMock).toHaveBeenCalledWith(100, 'all');
    });
  });

  describe('MonthView: 繰り返しアイコンの表示', () => {
    it('繰り返しイベント（マスター）の event-block 内に繰り返しアイコンが描画される', () => {
      const ev = makeRecurringEvent();
      render(
        <MonthView
          cursor={new Date(ev.startsAt)}
          today={new Date(ev.startsAt)}
          events={[ev]}
          channelColors={new Map([[10, '#1976d2']])}
          onEventClick={() => {}}
          onDayClick={() => {}}
        />,
      );
      expect(screen.getByTestId('event-recurrence-icon-100')).toBeInTheDocument();
    });

    it('単発イベントには繰り返しアイコンが描画されない', () => {
      const single = makeRecurringEvent({
        id: 200,
        recurrenceRule: null,
        recurrenceMasterId: null,
        recurrenceDaysOfWeek: null,
      });
      render(
        <MonthView
          cursor={new Date(single.startsAt)}
          today={new Date(single.startsAt)}
          events={[single]}
          channelColors={new Map([[10, '#1976d2']])}
          onEventClick={() => {}}
          onDayClick={() => {}}
        />,
      );
      expect(screen.queryByTestId('event-recurrence-icon-200')).toBeNull();
    });

    it('子イベント（recurrenceMasterId が立っている）にも繰り返しアイコンが描画される', () => {
      const child = makeRecurringEvent({
        id: 101,
        recurrenceRule: null,
        recurrenceMasterId: 100,
        recurrenceDaysOfWeek: null,
      });
      render(
        <MonthView
          cursor={new Date(child.startsAt)}
          today={new Date(child.startsAt)}
          events={[child]}
          channelColors={new Map([[10, '#1976d2']])}
          onEventClick={() => {}}
          onDayClick={() => {}}
        />,
      );
      expect(screen.getByTestId('event-recurrence-icon-101')).toBeInTheDocument();
    });
  });
});
