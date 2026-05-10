/**
 * テスト対象: components/Calendar/AgendaView.tsx — カレンダーアジェンダ表示（#152）
 *
 * 戦略:
 *   - cursor の月内のイベントを日付別にグルーピングして表示する計算ロジックを検証
 *   - 各イベント行の参加者アバター・自分の RSVP チップ・チャンネルチップの表示有無
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AgendaView } from '../components/Calendar/AgendaView';
import type {
  CalendarEvent,
  CalendarEventAttendee,
  CalendarRsvpStatus,
  Channel,
  User,
} from '@chat-app/shared';

const CURSOR = new Date(2026, 4, 15); // 5月
const TODAY = new Date(2026, 4, 15);

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

const channelColors = new Map<number, string>([
  [10, '#1976d2'],
  [11, '#d81b60'],
]);

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

const users: User[] = [makeUser(1, 'alice'), makeUser(2, 'bob')];

function makeAttendee(userId: number, status: CalendarRsvpStatus): CalendarEventAttendee {
  return { userId, status, respondedAt: '2026-04-30T00:00:00Z' };
}

function makeEvent(
  id: number,
  channelId: number | null,
  startsAt: string,
  endsAt: string,
  opts: Partial<CalendarEvent> = {},
): CalendarEvent {
  return {
    id,
    channelId,
    title: opts.title ?? `Ev${id}`,
    description: opts.description ?? null,
    location: opts.location ?? null,
    meetingUrl: opts.meetingUrl ?? null,
    startsAt,
    endsAt,
    organizerId: opts.organizerId ?? 1,
    createdAt: '2026-04-30T00:00:00Z',
    updatedAt: '2026-04-30T00:00:00Z',
    attendees: opts.attendees ?? [],
    reminderOffsetMinutes: opts.reminderOffsetMinutes ?? null,
  };
}

const onEventClick = vi.fn();

beforeEach(() => {
  onEventClick.mockClear();
});

describe('AgendaView', () => {
  describe('日付グルーピング', () => {
    it('cursor の月内のイベントを日付別にまとめ、日付昇順で表示する', () => {
      const evs = [
        makeEvent(
          2,
          10,
          new Date(2026, 4, 20, 10, 0).toISOString(),
          new Date(2026, 4, 20, 11, 0).toISOString(),
        ),
        makeEvent(
          1,
          10,
          new Date(2026, 4, 5, 10, 0).toISOString(),
          new Date(2026, 4, 5, 11, 0).toISOString(),
        ),
        makeEvent(
          3,
          10,
          new Date(2026, 4, 5, 14, 0).toISOString(),
          new Date(2026, 4, 5, 15, 0).toISOString(),
        ),
      ];
      render(
        <AgendaView
          cursor={CURSOR}
          today={TODAY}
          events={evs}
          channels={channels}
          channelColors={channelColors}
          users={users}
          currentUserId={1}
          onEventClick={onEventClick}
        />,
      );
      const groups = screen.getAllByTestId(/^agenda-group-/);
      // 5/5 と 5/20 の 2 グループ
      expect(groups).toHaveLength(2);
      // 順序確認
      expect(groups[0].getAttribute('data-testid')).toBe('agenda-group-2026-4-5');
      expect(groups[1].getAttribute('data-testid')).toBe('agenda-group-2026-4-20');
      // 5/5 グループには 2 件のイベント
      const firstGroup = groups[0];
      expect(within(firstGroup).getAllByTestId(/^agenda-event-/)).toHaveLength(2);
    });

    it('月外のイベントは表示されない', () => {
      const evs = [
        makeEvent(
          1,
          10,
          new Date(2026, 4, 5, 10, 0).toISOString(),
          new Date(2026, 4, 5, 11, 0).toISOString(),
        ),
        // 4 月のイベント
        makeEvent(
          2,
          10,
          new Date(2026, 3, 15, 10, 0).toISOString(),
          new Date(2026, 3, 15, 11, 0).toISOString(),
        ),
        // 6 月のイベント
        makeEvent(
          3,
          10,
          new Date(2026, 5, 1, 10, 0).toISOString(),
          new Date(2026, 5, 1, 11, 0).toISOString(),
        ),
      ];
      render(
        <AgendaView
          cursor={CURSOR}
          today={TODAY}
          events={evs}
          channels={channels}
          channelColors={channelColors}
          users={users}
          currentUserId={1}
          onEventClick={onEventClick}
        />,
      );
      expect(screen.getByTestId('agenda-event-1')).toBeInTheDocument();
      expect(screen.queryByTestId('agenda-event-2')).toBeNull();
      expect(screen.queryByTestId('agenda-event-3')).toBeNull();
    });

    it('イベントが 0 件のとき「この月には予定がありません」プレースホルダーを表示する', () => {
      render(
        <AgendaView
          cursor={CURSOR}
          today={TODAY}
          events={[]}
          channels={channels}
          channelColors={channelColors}
          users={users}
          currentUserId={1}
          onEventClick={onEventClick}
        />,
      );
      expect(screen.getByText('この月には予定がありません')).toBeInTheDocument();
    });

    it('当日のグループ見出しに「今日」チップが表示される', () => {
      const ev = makeEvent(
        1,
        10,
        new Date(2026, 4, 15, 10, 0).toISOString(),
        new Date(2026, 4, 15, 11, 0).toISOString(),
      );
      render(
        <AgendaView
          cursor={CURSOR}
          today={TODAY}
          events={[ev]}
          channels={channels}
          channelColors={channelColors}
          users={users}
          currentUserId={1}
          onEventClick={onEventClick}
        />,
      );
      const todayGroup = screen.getByTestId('agenda-group-2026-4-15');
      expect(within(todayGroup).getByText('今日')).toBeInTheDocument();
    });
  });

  describe('イベント行', () => {
    it('starts_at / ends_at の時刻が左サイドに表示される', () => {
      const ev = makeEvent(
        1,
        10,
        new Date(2026, 4, 5, 10, 0).toISOString(),
        new Date(2026, 4, 5, 11, 30).toISOString(),
      );
      render(
        <AgendaView
          cursor={CURSOR}
          today={TODAY}
          events={[ev]}
          channels={channels}
          channelColors={channelColors}
          users={users}
          currentUserId={1}
          onEventClick={onEventClick}
        />,
      );
      const row = screen.getByTestId('agenda-event-1');
      expect(within(row).getByText('10:00')).toBeInTheDocument();
      expect(within(row).getByText('11:30')).toBeInTheDocument();
    });

    it('参加者アバターは AvatarGroup で 4 件まで表示、超過は +N', () => {
      // 6 人参加者
      const attendees = [
        makeAttendee(1, 'accepted'),
        makeAttendee(2, 'accepted'),
        makeAttendee(3, 'accepted'),
        makeAttendee(4, 'accepted'),
        makeAttendee(5, 'accepted'),
        makeAttendee(6, 'accepted'),
      ];
      const moreUsers: User[] = [3, 4, 5, 6].map((id) => ({
        ...users[0],
        id,
        username: `u${id}`,
        email: `u${id}@t.com`,
        displayName: `U${id}`,
      }));
      const ev = makeEvent(
        1,
        10,
        new Date(2026, 4, 5, 10, 0).toISOString(),
        new Date(2026, 4, 5, 11, 0).toISOString(),
        { attendees },
      );
      render(
        <AgendaView
          cursor={CURSOR}
          today={TODAY}
          events={[ev]}
          channels={channels}
          channelColors={channelColors}
          users={[...users, ...moreUsers]}
          currentUserId={1}
          onEventClick={onEventClick}
        />,
      );
      const row = screen.getByTestId('agenda-event-1');
      // AvatarGroup の +N 表示（max=4 で 6 人 → +3 がデフォルト挙動）
      expect(within(row).getByText('+3')).toBeInTheDocument();
    });

    it('自分の RSVP が accepted のとき「参加」チップが表示される', () => {
      const ev = makeEvent(
        1,
        10,
        new Date(2026, 4, 5, 10, 0).toISOString(),
        new Date(2026, 4, 5, 11, 0).toISOString(),
        { attendees: [makeAttendee(1, 'accepted')] },
      );
      render(
        <AgendaView
          cursor={CURSOR}
          today={TODAY}
          events={[ev]}
          channels={channels}
          channelColors={channelColors}
          users={users}
          currentUserId={1}
          onEventClick={onEventClick}
        />,
      );
      expect(screen.getByTestId('agenda-rsvp-1')).toHaveTextContent('参加');
    });

    it('クリックで onEventClick が呼ばれる', async () => {
      const ev = makeEvent(
        1,
        10,
        new Date(2026, 4, 5, 10, 0).toISOString(),
        new Date(2026, 4, 5, 11, 0).toISOString(),
      );
      render(
        <AgendaView
          cursor={CURSOR}
          today={TODAY}
          events={[ev]}
          channels={channels}
          channelColors={channelColors}
          users={users}
          currentUserId={1}
          onEventClick={onEventClick}
        />,
      );
      await userEvent.click(screen.getByTestId('agenda-event-1'));
      expect(onEventClick).toHaveBeenCalledTimes(1);
      expect((onEventClick.mock.calls[0][0] as CalendarEvent).id).toBe(1);
    });
  });

  describe('チャンネル絞り込み', () => {
    it('events を絞り込み済みで渡せば、その分しか表示されない（フィルタは親側責務）', () => {
      // AgendaView 自体は絞り込みロジックを持たないため、props で絞り込まれた events を期待
      const ev = makeEvent(
        1,
        11,
        new Date(2026, 4, 5, 10, 0).toISOString(),
        new Date(2026, 4, 5, 11, 0).toISOString(),
      );
      render(
        <AgendaView
          cursor={CURSOR}
          today={TODAY}
          events={[ev]}
          channels={channels}
          channelColors={channelColors}
          users={users}
          currentUserId={1}
          onEventClick={onEventClick}
        />,
      );
      // # design チップが表示される（channelId=11）
      expect(screen.getByText('# design')).toBeInTheDocument();
    });
  });
});
