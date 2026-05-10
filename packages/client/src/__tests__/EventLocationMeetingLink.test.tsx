/**
 * テスト対象: イベント詳細のロケーション／会議リンク機能 (#303)
 *
 * 対象コンポーネント:
 *   - components/Calendar/EventDialog.tsx — 場所・会議リンクフィールドの入力
 *   - components/Calendar/EventDetailDrawer.tsx — 場所・会議リンクの詳細表示
 *
 * 戦略:
 *   - api.calendar.events.create / events.update を vi.mock
 *   - 場所（location）は既存フィールド、会議リンク（meeting_url）は新規追加フィールド
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { EventDialog } from '../components/Calendar/EventDialog';
import { EventDetailDrawer } from '../components/Calendar/EventDetailDrawer';
import type { CalendarEvent, Channel, User } from '@chat-app/shared';

const eventCreateMock = vi.fn();
const eventUpdateMock = vi.fn();

vi.mock('../api/client', () => ({
  api: {
    calendar: {
      events: {
        create: (...args: unknown[]) => eventCreateMock(...args),
        update: (...args: unknown[]) => eventUpdateMock(...args),
        rsvp: vi
          .fn()
          .mockResolvedValue({ attendee: { userId: 1, status: 'accepted', respondedAt: '' } }),
        delete: vi.fn().mockResolvedValue(undefined),
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

const users: User[] = [makeUser(1, 'alice'), makeUser(2, 'bob')];

const channelColors = new Map<number, string>([[10, '#1976d2']]);

const dialogHandlers = {
  onClose: vi.fn(),
  onCreated: vi.fn(),
  onUpdated: vi.fn(),
  onPollCreated: vi.fn(),
};

const drawerHandlers = {
  onClose: vi.fn(),
  onEdit: vi.fn(),
  onRsvpUpdated: vi.fn(),
  onDeleted: vi.fn(),
};

function makeEvent(opts: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 100,
    channelId: 10,
    title: '定例会議',
    description: null,
    location: null,
    meetingUrl: null,
    startsAt: '2026-05-15T10:00:00Z',
    endsAt: '2026-05-15T11:00:00Z',
    organizerId: 1,
    createdAt: '2026-04-30T00:00:00Z',
    updatedAt: '2026-04-30T00:00:00Z',
    attendees: [],
    reminderOffsetMinutes: null,
    ...opts,
  };
}

const baseReturnEvent: CalendarEvent = {
  id: 1,
  channelId: 10,
  title: 'X',
  description: null,
  location: null,
  meetingUrl: null,
  startsAt: '2030-01-01T10:00:00.000Z',
  endsAt: '2030-01-01T11:00:00.000Z',
  organizerId: 1,
  createdAt: '2026-04-30T00:00:00Z',
  updatedAt: '2026-04-30T00:00:00Z',
  attendees: [],
  reminderOffsetMinutes: null,
};

beforeEach(() => {
  eventCreateMock.mockReset();
  eventUpdateMock.mockReset();
  Object.values(dialogHandlers).forEach((h) => h.mockClear());
  Object.values(drawerHandlers).forEach((h) => h.mockClear());
  eventCreateMock.mockResolvedValue({ event: baseReturnEvent });
  eventUpdateMock.mockResolvedValue({ event: baseReturnEvent });
});

const renderDialog = (event: CalendarEvent | null = null) =>
  render(
    <EventDialog
      open={true}
      channels={channels}
      users={users}
      initialDate={null}
      event={event}
      onClose={dialogHandlers.onClose}
      onCreated={dialogHandlers.onCreated}
      onUpdated={dialogHandlers.onUpdated}
      onPollCreated={dialogHandlers.onPollCreated}
    />,
  );

const renderDrawer = (event: CalendarEvent | null) =>
  render(
    <EventDetailDrawer
      event={event}
      channels={channels}
      channelColors={channelColors}
      users={users}
      currentUserId={1}
      onClose={drawerHandlers.onClose}
      onEdit={drawerHandlers.onEdit}
      onRsvpUpdated={drawerHandlers.onRsvpUpdated}
      onDeleted={drawerHandlers.onDeleted}
    />,
  );

describe('EventDialog — 場所・会議リンクフィールド', () => {
  describe('新規作成モード', () => {
    it('「場所」テキストフィールドが表示される', () => {
      renderDialog();
      expect(screen.getByLabelText('event-location')).toBeInTheDocument();
    });

    it('「会議リンク」URLフィールドが表示される', () => {
      renderDialog();
      expect(screen.getByLabelText('event-meeting-url')).toBeInTheDocument();
    });

    it('場所・会議リンクともに未入力でもイベントを作成できる', async () => {
      renderDialog();
      await userEvent.type(screen.getByLabelText('event-title'), 'テスト');
      await userEvent.click(screen.getByLabelText('event-dialog-submit'));
      await waitFor(() => expect(eventCreateMock).toHaveBeenCalledTimes(1));
      const body = eventCreateMock.mock.calls[0][0] as Record<string, unknown>;
      expect(body.location).toBeNull();
      expect(body.meetingUrl).toBeNull();
    });

    it('場所を入力してイベントを作成すると location が API に送信される', async () => {
      renderDialog();
      await userEvent.type(screen.getByLabelText('event-title'), 'テスト');
      await userEvent.type(screen.getByLabelText('event-location'), '会議室B');
      await userEvent.click(screen.getByLabelText('event-dialog-submit'));
      await waitFor(() => expect(eventCreateMock).toHaveBeenCalledTimes(1));
      const body = eventCreateMock.mock.calls[0][0] as Record<string, unknown>;
      expect(body.location).toBe('会議室B');
    });

    it('会議リンクを入力してイベントを作成すると meetingUrl が API に送信される', async () => {
      renderDialog();
      await userEvent.type(screen.getByLabelText('event-title'), 'テスト');
      await userEvent.type(screen.getByLabelText('event-meeting-url'), 'https://zoom.us/j/123');
      await userEvent.click(screen.getByLabelText('event-dialog-submit'));
      await waitFor(() => expect(eventCreateMock).toHaveBeenCalledTimes(1));
      const body = eventCreateMock.mock.calls[0][0] as Record<string, unknown>;
      expect(body.meetingUrl).toBe('https://zoom.us/j/123');
    });

    it('場所と会議リンクの両方を入力してイベントを作成できる', async () => {
      renderDialog();
      await userEvent.type(screen.getByLabelText('event-title'), 'テスト');
      await userEvent.type(screen.getByLabelText('event-location'), '会議室A');
      await userEvent.type(
        screen.getByLabelText('event-meeting-url'),
        'https://meet.google.com/abc',
      );
      await userEvent.click(screen.getByLabelText('event-dialog-submit'));
      await waitFor(() => expect(eventCreateMock).toHaveBeenCalledTimes(1));
      const body = eventCreateMock.mock.calls[0][0] as Record<string, unknown>;
      expect(body.location).toBe('会議室A');
      expect(body.meetingUrl).toBe('https://meet.google.com/abc');
    });

    it('不正な形式のURLを会議リンクに入力しても送信はブロックされない（任意入力）', async () => {
      renderDialog();
      await userEvent.type(screen.getByLabelText('event-title'), 'テスト');
      await userEvent.type(screen.getByLabelText('event-meeting-url'), 'not-a-valid-url');
      await userEvent.click(screen.getByLabelText('event-dialog-submit'));
      await waitFor(() => expect(eventCreateMock).toHaveBeenCalledTimes(1));
    });
  });

  describe('編集モード', () => {
    it('既存イベントの location が「場所」フィールドに初期値として表示される', () => {
      renderDialog(makeEvent({ location: '既存会議室' }));
      expect((screen.getByLabelText('event-location') as HTMLInputElement).value).toBe(
        '既存会議室',
      );
    });

    it('既存イベントの meetingUrl が「会議リンク」フィールドに初期値として表示される', () => {
      renderDialog(makeEvent({ meetingUrl: 'https://zoom.us/j/existing' }));
      expect((screen.getByLabelText('event-meeting-url') as HTMLInputElement).value).toBe(
        'https://zoom.us/j/existing',
      );
    });

    it('場所を変更して保存すると更新後の location が API に送信される', async () => {
      renderDialog(makeEvent({ location: '旧会議室' }));
      const locationInput = screen.getByLabelText('event-location') as HTMLInputElement;
      await userEvent.clear(locationInput);
      await userEvent.type(locationInput, '新会議室');
      await userEvent.click(screen.getByLabelText('event-dialog-submit'));
      await waitFor(() => expect(eventUpdateMock).toHaveBeenCalledTimes(1));
      const body = eventUpdateMock.mock.calls[0][1] as Record<string, unknown>;
      expect(body.location).toBe('新会議室');
    });

    it('会議リンクを変更して保存すると更新後の meetingUrl が API に送信される', async () => {
      renderDialog(makeEvent({ meetingUrl: 'https://zoom.us/j/old' }));
      const urlInput = screen.getByLabelText('event-meeting-url') as HTMLInputElement;
      await userEvent.clear(urlInput);
      await userEvent.type(urlInput, 'https://zoom.us/j/new');
      await userEvent.click(screen.getByLabelText('event-dialog-submit'));
      await waitFor(() => expect(eventUpdateMock).toHaveBeenCalledTimes(1));
      const body = eventUpdateMock.mock.calls[0][1] as Record<string, unknown>;
      expect(body.meetingUrl).toBe('https://zoom.us/j/new');
    });

    it('場所・会議リンクをクリアして保存すると null が API に送信される', async () => {
      renderDialog(makeEvent({ location: '会議室A', meetingUrl: 'https://zoom.us/j/123' }));
      const locationInput = screen.getByLabelText('event-location') as HTMLInputElement;
      const urlInput = screen.getByLabelText('event-meeting-url') as HTMLInputElement;
      await userEvent.clear(locationInput);
      await userEvent.clear(urlInput);
      await userEvent.click(screen.getByLabelText('event-dialog-submit'));
      await waitFor(() => expect(eventUpdateMock).toHaveBeenCalledTimes(1));
      const body = eventUpdateMock.mock.calls[0][1] as Record<string, unknown>;
      expect(body.location).toBeNull();
      expect(body.meetingUrl).toBeNull();
    });
  });
});

describe('EventDetailDrawer — 場所・会議リンクの表示', () => {
  describe('場所（location）の表示', () => {
    it('location が設定されているイベントでは場所が表示される', () => {
      renderDrawer(makeEvent({ location: '会議室A' }));
      expect(screen.getByText('会議室A')).toBeInTheDocument();
    });

    it('location が null のイベントでは場所フィールドが表示されない', () => {
      renderDrawer(makeEvent({ location: null }));
      expect(screen.queryByText('会議室A')).toBeNull();
    });

    it('場所のテキストが正しく表示される', () => {
      renderDrawer(makeEvent({ location: '東京都渋谷区1-1-1' }));
      expect(screen.getByText('東京都渋谷区1-1-1')).toBeInTheDocument();
    });
  });

  describe('会議リンク（meeting_url）の表示', () => {
    it('meeting_url が設定されているイベントでは会議リンクが表示される', () => {
      renderDrawer(makeEvent({ meetingUrl: 'https://zoom.us/j/123456' }));
      expect(screen.getByTestId('event-meeting-url-link')).toBeInTheDocument();
    });

    it('meeting_url が null のイベントでは会議リンクフィールドが表示されない', () => {
      renderDrawer(makeEvent({ meetingUrl: null }));
      expect(screen.queryByTestId('event-meeting-url-link')).toBeNull();
    });

    it('会議リンクがクリッカブルなリンク（<a>タグ）として表示される', () => {
      renderDrawer(makeEvent({ meetingUrl: 'https://zoom.us/j/123456' }));
      const link = screen.getByTestId('event-meeting-url-link');
      expect(link.tagName.toLowerCase()).toBe('a');
      expect(link.getAttribute('href')).toBe('https://zoom.us/j/123456');
    });

    it('会議リンクをクリックすると外部タブ（target="_blank"）で開く', () => {
      renderDrawer(makeEvent({ meetingUrl: 'https://zoom.us/j/123456' }));
      const link = screen.getByTestId('event-meeting-url-link');
      expect(link.getAttribute('target')).toBe('_blank');
    });

    it('会議リンクに rel="noopener noreferrer" が設定されている', () => {
      renderDrawer(makeEvent({ meetingUrl: 'https://zoom.us/j/123456' }));
      const link = screen.getByTestId('event-meeting-url-link');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    });
  });

  describe('場所と会議リンクの組み合わせ', () => {
    it('location と meeting_url の両方が設定されているとき両方表示される', () => {
      renderDrawer(makeEvent({ location: '会議室A', meetingUrl: 'https://zoom.us/j/123456' }));
      expect(screen.getByText('会議室A')).toBeInTheDocument();
      expect(screen.getByTestId('event-meeting-url-link')).toBeInTheDocument();
    });

    it('location のみ設定されているとき会議リンクは表示されない', () => {
      renderDrawer(makeEvent({ location: '会議室A', meetingUrl: null }));
      expect(screen.getByText('会議室A')).toBeInTheDocument();
      expect(screen.queryByTestId('event-meeting-url-link')).toBeNull();
    });

    it('meeting_url のみ設定されているとき場所は表示されない', () => {
      renderDrawer(makeEvent({ location: null, meetingUrl: 'https://zoom.us/j/123456' }));
      expect(screen.queryByText('会議室A')).toBeNull();
      expect(screen.getByTestId('event-meeting-url-link')).toBeInTheDocument();
    });
  });
});
