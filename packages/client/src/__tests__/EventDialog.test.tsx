/**
 * テスト対象: components/Calendar/EventDialog.tsx — カレンダー用イベント作成・編集ダイアログ（#152）
 *
 * 注意: 既存 components/Chat/CreateEventDialog.tsx (#108 用) とは別ファイル。
 *
 * 戦略:
 *   - api.calendar.events.create / polls.create / events.update を vi.mock
 *   - 「予定」「日程調整」のタブ切替でフォーム内容が変わる
 *   - バリデーション（タイトル空・時刻順序・候補日 0 件）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { EventDialog } from '../components/Calendar/EventDialog';
import type { CalendarEvent, Channel, User } from '@chat-app/shared';

const eventCreateMock = vi.fn();
const eventUpdateMock = vi.fn();
const pollCreateMock = vi.fn();

vi.mock('../api/client', () => ({
  api: {
    calendar: {
      events: {
        create: (...args: unknown[]) => eventCreateMock(...args),
        update: (...args: unknown[]) => eventUpdateMock(...args),
      },
      polls: {
        create: (...args: unknown[]) => pollCreateMock(...args),
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
  {
    id: 11,
    name: 'design',
    description: null,
    topic: null,
    createdBy: 1,
    createdAt: '2026-04-30T00:00:00Z',
    isPrivate: false,
    postingPermission: 'everyone',
    unreadCount: 0,
  },
];

const users: User[] = [makeUser(1, 'alice'), makeUser(2, 'bob')];

const handlers = {
  onClose: vi.fn(),
  onCreated: vi.fn(),
  onUpdated: vi.fn(),
  onPollCreated: vi.fn(),
};

beforeEach(() => {
  eventCreateMock.mockReset();
  eventUpdateMock.mockReset();
  pollCreateMock.mockReset();
  Object.values(handlers).forEach((h) => h.mockClear());
});

const renderDialog = (
  overrides: Partial<{
    initialDate: Date | null;
    event: CalendarEvent | null;
    open: boolean;
  }> = {},
) =>
  render(
    <EventDialog
      open={overrides.open ?? true}
      channels={channels}
      users={users}
      initialDate={overrides.initialDate ?? null}
      event={overrides.event ?? null}
      onClose={handlers.onClose}
      onCreated={handlers.onCreated}
      onUpdated={handlers.onUpdated}
      onPollCreated={handlers.onPollCreated}
    />,
  );

describe('EventDialog', () => {
  describe('タブ切替', () => {
    it('初期は「予定」タブ', () => {
      renderDialog();
      // 開始/終了の datetime-local が表示されている = 予定タブ
      expect(screen.getByLabelText('event-starts-at')).toBeInTheDocument();
      expect(screen.queryByLabelText('poll-deadline')).toBeNull();
    });

    it('「日程調整」タブに切り替えると候補日リストと締切が表示される', async () => {
      renderDialog();
      await userEvent.click(screen.getByLabelText('poll-tab'));
      expect(screen.getByLabelText('poll-deadline')).toBeInTheDocument();
      expect(screen.getByLabelText('poll-candidate-date-0')).toBeInTheDocument();
    });

    it('「予定」タブでは startsAt / endsAt / location が表示される', () => {
      renderDialog();
      expect(screen.getByLabelText('event-starts-at')).toBeInTheDocument();
      expect(screen.getByLabelText('event-ends-at')).toBeInTheDocument();
      expect(screen.getByLabelText('event-location')).toBeInTheDocument();
    });
  });

  describe('予定モードのバリデーション', () => {
    it('タイトル空のまま送信するとエラーが出て api.calendar.events.create が呼ばれない', async () => {
      renderDialog();
      // initialDate=null だと startsAt は現在時刻に基づく初期化、endsAt は +1 時間
      await userEvent.click(screen.getByLabelText('event-dialog-submit'));
      expect(await screen.findByTestId('event-dialog-error')).toHaveTextContent('タイトル');
      expect(eventCreateMock).not.toHaveBeenCalled();
    });

    it('startsAt >= endsAt で送信するとエラーが出る', async () => {
      renderDialog();
      // タイトル入力
      await userEvent.type(screen.getByLabelText('event-title'), 'Test');
      // 終了 < 開始 にする
      const start = screen.getByLabelText('event-starts-at') as HTMLInputElement;
      const end = screen.getByLabelText('event-ends-at') as HTMLInputElement;
      await userEvent.clear(start);
      await userEvent.type(start, '2030-01-01T11:00');
      await userEvent.clear(end);
      await userEvent.type(end, '2030-01-01T10:00');
      await userEvent.click(screen.getByLabelText('event-dialog-submit'));
      expect(await screen.findByTestId('event-dialog-error')).toHaveTextContent('終了日時');
      expect(eventCreateMock).not.toHaveBeenCalled();
    });

    it('正常入力で api.calendar.events.create が呼ばれ、onCreated と onClose が呼ばれる', async () => {
      eventCreateMock.mockResolvedValue({
        event: {
          id: 100,
          channelId: 10,
          title: 'X',
          description: null,
          location: null,
          startsAt: '2030-01-01T10:00:00.000Z',
          endsAt: '2030-01-01T11:00:00.000Z',
          organizerId: 1,
          createdAt: '2026-04-30T00:00:00Z',
          updatedAt: '2026-04-30T00:00:00Z',
          attendees: [],
          reminderOffsetMinutes: 15,
        } satisfies CalendarEvent,
      });
      renderDialog();
      await userEvent.type(screen.getByLabelText('event-title'), 'Sprint');
      await userEvent.click(screen.getByLabelText('event-dialog-submit'));
      await waitFor(() => expect(eventCreateMock).toHaveBeenCalledTimes(1));
      expect(handlers.onCreated).toHaveBeenCalledTimes(1);
      expect(handlers.onClose).toHaveBeenCalled();
    });
  });

  describe('予定モードのオプション', () => {
    it('リマインダー offset を選択して送信するとリクエスト body に reminderOffsetMinutes が乗る', async () => {
      eventCreateMock.mockResolvedValue({
        event: {
          id: 1,
          channelId: 10,
          title: 'X',
          description: null,
          location: null,
          startsAt: '2030-01-01T10:00:00.000Z',
          endsAt: '2030-01-01T11:00:00.000Z',
          organizerId: 1,
          createdAt: '2026-04-30T00:00:00Z',
          updatedAt: '2026-04-30T00:00:00Z',
          attendees: [],
          reminderOffsetMinutes: 60,
        } satisfies CalendarEvent,
      });
      renderDialog();
      await userEvent.type(screen.getByLabelText('event-title'), 'X');
      // リマインダーは Select。MUI Select は role="combobox" になる
      const reminderTrigger = screen.getByLabelText('event-reminder');
      await userEvent.click(reminderTrigger);
      const opt = await screen.findByRole('option', { name: '1時間前' });
      await userEvent.click(opt);
      await userEvent.click(screen.getByLabelText('event-dialog-submit'));
      await waitFor(() => expect(eventCreateMock).toHaveBeenCalledTimes(1));
      const body = eventCreateMock.mock.calls[0][0] as { reminderOffsetMinutes: number };
      expect(body.reminderOffsetMinutes).toBe(60);
    });

    it('参加者 Autocomplete で選んだユーザーが attendeeUserIds として送信される', async () => {
      eventCreateMock.mockResolvedValue({
        event: {
          id: 1,
          channelId: 10,
          title: 'X',
          description: null,
          location: null,
          startsAt: '2030-01-01T10:00:00.000Z',
          endsAt: '2030-01-01T11:00:00.000Z',
          organizerId: 1,
          createdAt: '2026-04-30T00:00:00Z',
          updatedAt: '2026-04-30T00:00:00Z',
          attendees: [],
          reminderOffsetMinutes: null,
        } satisfies CalendarEvent,
      });
      renderDialog();
      await userEvent.type(screen.getByLabelText('event-title'), 'X');
      // Autocomplete: input にフォーカスして候補を出す → 候補 "Bob"（userId=2）をクリック
      const attendeesInput = screen.getByLabelText('event-attendees');
      await userEvent.click(attendeesInput);
      const bobOption = await screen.findByRole('option', { name: 'Bob' });
      await userEvent.click(bobOption);
      await userEvent.click(screen.getByLabelText('event-dialog-submit'));
      await waitFor(() => expect(eventCreateMock).toHaveBeenCalledTimes(1));
      const body = eventCreateMock.mock.calls[0][0] as { attendeeUserIds: number[] };
      expect(body.attendeeUserIds).toEqual([2]);
    });

    it('initialDate を渡すと startsAt の初期値がその日付の 00 分にセットされる', () => {
      const d = new Date(2030, 5, 15, 14, 30);
      renderDialog({ initialDate: d });
      const start = screen.getByLabelText('event-starts-at') as HTMLInputElement;
      expect(start.value).toBe('2030-06-15T14:00');
    });
  });

  describe('日程調整モードのバリデーション', () => {
    it('タイトル空のまま送信するとエラー', async () => {
      renderDialog();
      await userEvent.click(screen.getByLabelText('poll-tab'));
      await userEvent.click(screen.getByLabelText('event-dialog-submit'));
      expect(await screen.findByTestId('event-dialog-error')).toHaveTextContent('タイトル');
      expect(pollCreateMock).not.toHaveBeenCalled();
    });

    it('候補日が 0 件のまま送信するとエラー', async () => {
      renderDialog();
      await userEvent.click(screen.getByLabelText('poll-tab'));
      await userEvent.type(screen.getByLabelText('event-title'), 'P');
      // 既定で 2 件あるので両方の date が空のまま → 0 件入力 として扱われる
      await userEvent.click(screen.getByLabelText('event-dialog-submit'));
      expect(await screen.findByTestId('event-dialog-error')).toHaveTextContent('候補日');
      expect(pollCreateMock).not.toHaveBeenCalled();
    });

    it('候補日の date / from / to がすべて入力済みなら api.calendar.polls.create が呼ばれる', async () => {
      pollCreateMock.mockResolvedValue({
        poll: {
          id: 1,
          channelId: 10,
          title: 'P',
          organizerId: 1,
          deadline: null,
          confirmedEventId: null,
          createdAt: '2026-04-30T00:00:00Z',
          candidates: [],
          votes: [],
        },
      });
      renderDialog();
      await userEvent.click(screen.getByLabelText('poll-tab'));
      await userEvent.type(screen.getByLabelText('event-title'), 'P');
      // 1 件の候補日に date を入力（from / to は既定値あり）
      const dateInput = screen.getByLabelText('poll-candidate-date-0') as HTMLInputElement;
      await userEvent.type(dateInput, '2030-06-01');
      await userEvent.click(screen.getByLabelText('event-dialog-submit'));
      await waitFor(() => expect(pollCreateMock).toHaveBeenCalledTimes(1));
      expect(handlers.onPollCreated).toHaveBeenCalled();
    });
  });

  describe('編集モード', () => {
    it('既存 event を渡すと初期値がフォームに展開される', () => {
      const ev: CalendarEvent = {
        id: 100,
        channelId: 10,
        title: '旧タイトル',
        description: '旧説明',
        location: '旧場所',
        startsAt: new Date(2030, 5, 1, 10, 0).toISOString(),
        endsAt: new Date(2030, 5, 1, 11, 0).toISOString(),
        organizerId: 1,
        createdAt: '2026-04-30T00:00:00Z',
        updatedAt: '2026-04-30T00:00:00Z',
        attendees: [],
        reminderOffsetMinutes: 30,
      };
      renderDialog({ event: ev });
      expect((screen.getByLabelText('event-title') as HTMLInputElement).value).toBe('旧タイトル');
      expect((screen.getByLabelText('event-location') as HTMLInputElement).value).toBe('旧場所');
      expect((screen.getByLabelText('event-description') as HTMLInputElement).value).toBe('旧説明');
    });

    it('保存で api.calendar.events.update が呼ばれる', async () => {
      eventUpdateMock.mockResolvedValue({
        event: {
          id: 100,
          channelId: 10,
          title: '新タイトル',
          description: null,
          location: null,
          startsAt: '2030-06-01T10:00:00.000Z',
          endsAt: '2030-06-01T11:00:00.000Z',
          organizerId: 1,
          createdAt: '2026-04-30T00:00:00Z',
          updatedAt: '2026-04-30T00:00:00Z',
          attendees: [],
          reminderOffsetMinutes: null,
        } satisfies CalendarEvent,
      });
      const ev: CalendarEvent = {
        id: 100,
        channelId: 10,
        title: '旧タイトル',
        description: null,
        location: null,
        startsAt: new Date(2030, 5, 1, 10, 0).toISOString(),
        endsAt: new Date(2030, 5, 1, 11, 0).toISOString(),
        organizerId: 1,
        createdAt: '2026-04-30T00:00:00Z',
        updatedAt: '2026-04-30T00:00:00Z',
        attendees: [],
        reminderOffsetMinutes: null,
      };
      renderDialog({ event: ev });
      const titleInput = screen.getByLabelText('event-title') as HTMLInputElement;
      await userEvent.clear(titleInput);
      await userEvent.type(titleInput, '新タイトル');
      await userEvent.click(screen.getByLabelText('event-dialog-submit'));
      await waitFor(() => expect(eventUpdateMock).toHaveBeenCalledTimes(1));
      expect(eventUpdateMock.mock.calls[0][0]).toBe(100);
      expect(handlers.onUpdated).toHaveBeenCalled();
    });
  });
});
