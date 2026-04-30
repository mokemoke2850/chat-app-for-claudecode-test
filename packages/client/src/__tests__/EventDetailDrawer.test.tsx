/**
 * テスト対象: components/Calendar/EventDetailDrawer.tsx — イベント詳細右ドロワー（#152）
 *
 * 戦略:
 *   - api.calendar.events.rsvp / events.delete を vi.mock
 *   - イベント情報・参加者一覧・RSVP ボタン群の表示と操作を検証
 *   - 削除確認は MUI Dialog ベース（カスタムダイアログの開閉と API 連携）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { EventDetailDrawer } from '../components/Calendar/EventDetailDrawer';
import type {
  CalendarEvent,
  CalendarEventAttendee,
  CalendarRsvpStatus,
  Channel,
  User,
} from '@chat-app/shared';

const rsvpMock = vi.fn();
const deleteMock = vi.fn();

vi.mock('../api/client', () => ({
  api: {
    calendar: {
      events: {
        rsvp: (...args: unknown[]) => rsvpMock(...args),
        delete: (...args: unknown[]) => deleteMock(...args),
      },
      polls: {},
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

function makeAttendee(userId: number, status: CalendarRsvpStatus): CalendarEventAttendee {
  return { userId, status, respondedAt: '2026-04-30T00:00:00Z' };
}

function makeEvent(opts: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 100,
    channelId: 10,
    title: '定例会議',
    description: 'スプリントレビュー',
    location: '会議室A',
    startsAt: '2026-05-15T10:00:00Z',
    endsAt: '2026-05-15T11:00:00Z',
    organizerId: 2,
    createdAt: '2026-04-30T00:00:00Z',
    updatedAt: '2026-04-30T00:00:00Z',
    attendees: [],
    reminderOffsetMinutes: 15,
    ...opts,
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

const channelColors = new Map<number, string>([[10, '#1976d2']]);

const users: User[] = [makeUser(1, 'alice'), makeUser(2, 'bob'), makeUser(3, 'carol')];

const handlers = {
  onClose: vi.fn(),
  onEdit: vi.fn(),
  onRsvpUpdated: vi.fn(),
  onDeleted: vi.fn(),
};

beforeEach(() => {
  rsvpMock.mockReset();
  deleteMock.mockReset();
  Object.values(handlers).forEach((h) => h.mockClear());
  rsvpMock.mockResolvedValue({
    attendee: makeAttendee(1, 'accepted'),
  });
  deleteMock.mockResolvedValue(undefined);
});

const renderDrawer = (event: CalendarEvent | null) =>
  render(
    <EventDetailDrawer
      event={event}
      channels={channels}
      channelColors={channelColors}
      users={users}
      currentUserId={1}
      onClose={handlers.onClose}
      onEdit={handlers.onEdit}
      onRsvpUpdated={handlers.onRsvpUpdated}
      onDeleted={handlers.onDeleted}
    />,
  );

describe('EventDetailDrawer', () => {
  describe('表示', () => {
    it('event を渡すとタイトル・日時・場所・主催者・説明・参加者一覧が表示される', () => {
      renderDrawer(
        makeEvent({
          attendees: [makeAttendee(1, 'pending'), makeAttendee(2, 'accepted')],
        }),
      );
      expect(screen.getByText('定例会議')).toBeInTheDocument();
      expect(screen.getByText('会議室A')).toBeInTheDocument();
      // 「主催者」ラベルは主催者欄と参加者一覧の secondary 両方に出るので >= 1 で検証
      expect(screen.getAllByText('主催者').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('スプリントレビュー')).toBeInTheDocument();
      // 参加者一覧（user1=Alice / user2=Bob）
      expect(screen.getByTestId('attendee-row-1')).toBeInTheDocument();
      expect(screen.getByTestId('attendee-row-2')).toBeInTheDocument();
      // 同じ名前は主催者欄 + 参加者欄で複数登場するので getAllByText で検証
      expect(screen.getAllByText('Bob').length).toBeGreaterThanOrEqual(2);
    });

    it('event=null のとき何も描画されない', () => {
      renderDrawer(null);
      expect(screen.queryByTestId('event-detail-drawer')).toBeNull();
    });

    it('チャンネル名が左上のヘッダーに「# name」形式で表示される', () => {
      renderDrawer(makeEvent());
      expect(screen.getByText('# general')).toBeInTheDocument();
    });
  });

  describe('参加者一覧', () => {
    it('参加者の総数と accepted / maybe / declined / pending それぞれのカウントチップが表示される', () => {
      renderDrawer(
        makeEvent({
          attendees: [
            makeAttendee(1, 'accepted'),
            makeAttendee(2, 'maybe'),
            makeAttendee(3, 'pending'),
          ],
        }),
      );
      expect(screen.getByText('参加者（3名）')).toBeInTheDocument();
      expect(screen.getByText('参加 1')).toBeInTheDocument();
      expect(screen.getByText('未定 1')).toBeInTheDocument();
      expect(screen.getByText('不参加 0')).toBeInTheDocument();
      expect(screen.getByText('未回答 1')).toBeInTheDocument();
    });

    it('各参加者行にステータスアイコンが表示される', () => {
      renderDrawer(
        makeEvent({
          attendees: [makeAttendee(1, 'accepted'), makeAttendee(2, 'maybe')],
        }),
      );
      expect(screen.getByTestId('attendee-status-1').getAttribute('data-status')).toBe('accepted');
      expect(screen.getByTestId('attendee-status-2').getAttribute('data-status')).toBe('maybe');
    });

    it('主催者行に「主催者」サブテキストが表示される', () => {
      renderDrawer(
        makeEvent({
          organizerId: 2,
          attendees: [makeAttendee(2, 'accepted')],
        }),
      );
      const row = screen.getByTestId('attendee-row-2');
      expect(within(row).getByText('主催者')).toBeInTheDocument();
    });
  });

  describe('RSVP', () => {
    it('「参加」クリックで api.calendar.events.rsvp が status=accepted で呼ばれる', async () => {
      renderDrawer(makeEvent());
      await userEvent.click(screen.getByLabelText('rsvp-accepted'));
      expect(rsvpMock).toHaveBeenCalledTimes(1);
      expect(rsvpMock.mock.calls[0]).toEqual([100, 'accepted']);
    });

    it('「未定」クリックで status=maybe で呼ばれる', async () => {
      renderDrawer(makeEvent());
      await userEvent.click(screen.getByLabelText('rsvp-maybe'));
      expect(rsvpMock.mock.calls[0]).toEqual([100, 'maybe']);
    });

    it('「不参加」クリックで status=declined で呼ばれる', async () => {
      renderDrawer(makeEvent());
      await userEvent.click(screen.getByLabelText('rsvp-declined'));
      expect(rsvpMock.mock.calls[0]).toEqual([100, 'declined']);
    });

    it('現在の myStatus に応じて該当ボタンが contained variant で強調される', () => {
      renderDrawer(makeEvent({ attendees: [makeAttendee(1, 'accepted')] }));
      const acceptedBtn = screen.getByLabelText('rsvp-accepted');
      // contained variant では MuiButton-contained クラスが付与される
      expect(acceptedBtn.className).toMatch(/MuiButton-contained/);
      // maybe / declined は outlined のまま
      expect(screen.getByLabelText('rsvp-maybe').className).toMatch(/MuiButton-outlined/);
    });

    it('RSVP 成功時に親へ更新通知（onRsvpUpdated）が伝播する', async () => {
      renderDrawer(makeEvent());
      await userEvent.click(screen.getByLabelText('rsvp-accepted'));
      await waitFor(() => expect(handlers.onRsvpUpdated).toHaveBeenCalledTimes(1));
    });
  });

  describe('編集 / 削除', () => {
    it('編集アイコンクリックで onEdit コールバックが呼ばれる（ダイアログを開く責務は親）', async () => {
      const ev = makeEvent();
      renderDrawer(ev);
      await userEvent.click(screen.getByLabelText('event-edit'));
      expect(handlers.onEdit).toHaveBeenCalledTimes(1);
      expect(handlers.onEdit.mock.calls[0][0]).toEqual(ev);
    });

    it('閉じるアイコンで onClose が呼ばれる', async () => {
      renderDrawer(makeEvent());
      await userEvent.click(screen.getByLabelText('event-close'));
      expect(handlers.onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('削除確認 (MUI Dialog)', () => {
    it('削除アイコンクリックで MUI 確認ダイアログが開く（initial open=false）', async () => {
      renderDrawer(makeEvent());
      // 初期状態では Dialog の中身は描画されていない（presentation role が無い）
      expect(screen.queryByText('イベントを削除しますか？')).toBeNull();
      await userEvent.click(screen.getByLabelText('event-delete'));
      expect(screen.getByText('イベントを削除しますか？')).toBeInTheDocument();
    });

    it('確認ダイアログにイベントタイトルが表示され、誤操作を防げる', async () => {
      renderDrawer(makeEvent({ title: 'スプリント計画' }));
      await userEvent.click(screen.getByLabelText('event-delete'));
      // Dialog 内にもイベントタイトルが含まれる確認
      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getByText(/スプリント計画/)).toBeInTheDocument();
    });

    it('「削除」ボタンクリックで api.calendar.events.delete が呼ばれ、ダイアログが閉じる', async () => {
      renderDrawer(makeEvent());
      await userEvent.click(screen.getByLabelText('event-delete'));
      const dialogDeleteBtn = screen.getByRole('button', { name: '削除' });
      await userEvent.click(dialogDeleteBtn);
      await waitFor(() => expect(deleteMock).toHaveBeenCalledTimes(1));
      expect(deleteMock.mock.calls[0]).toEqual([100]);
      // ダイアログが閉じる
      await waitFor(() => expect(screen.queryByText('イベントを削除しますか？')).toBeNull());
    });

    it('「キャンセル」ボタンクリックでは api.calendar.events.delete は呼ばれず、ダイアログだけ閉じる', async () => {
      renderDrawer(makeEvent());
      await userEvent.click(screen.getByLabelText('event-delete'));
      await userEvent.click(screen.getByRole('button', { name: 'キャンセル' }));
      expect(deleteMock).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.queryByText('イベントを削除しますか？')).toBeNull());
    });

    it('削除成功後に onDeleted コールバックが呼ばれて親側でカレンダー再フェッチをトリガーする', async () => {
      renderDrawer(makeEvent());
      await userEvent.click(screen.getByLabelText('event-delete'));
      await userEvent.click(screen.getByRole('button', { name: '削除' }));
      await waitFor(() => expect(handlers.onDeleted).toHaveBeenCalledTimes(1));
    });

    it('API 失敗時は確認ダイアログ内にエラーメッセージが表示される（ダイアログは開いたまま）', async () => {
      deleteMock.mockRejectedValueOnce(new Error('Forbidden'));
      renderDrawer(makeEvent());
      await userEvent.click(screen.getByLabelText('event-delete'));
      await userEvent.click(screen.getByRole('button', { name: '削除' }));
      await waitFor(() =>
        expect(screen.getByTestId('delete-error-message')).toHaveTextContent('Forbidden'),
      );
      // Dialog はまだ開いている
      expect(screen.getByText('イベントを削除しますか？')).toBeInTheDocument();
      expect(handlers.onDeleted).not.toHaveBeenCalled();
    });
  });
});
