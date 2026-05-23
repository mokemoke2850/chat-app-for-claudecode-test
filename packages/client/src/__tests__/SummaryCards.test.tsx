/**
 * components/Inbox/SummaryCards.tsx のユニットテスト (Step 6a + Issue #320)
 *
 * 純粋コンポーネントとして data を直接渡してテストする。
 * Promise 解決は親 (InboxPage 内 Suspense ラッパー) で行うため Suspense は不要。
 *
 * Issue #320: サマリーカードの意味を補足するミニ内訳
 * - 未読カード: チャンネル・DM・スレッド別の件数内訳を表示
 * - 今日の予定カード: 自分が主催 / 参加 の内訳を表示
 * - 未完タスクカード: 自分担当 / その他 の内訳を表示
 * - 各内訳チップクリックで対応ビューへナビゲーション
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SummaryCards, { type SummaryData } from '../components/Inbox/SummaryCards';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

describe('SummaryCards (Step 6a)', () => {
  it('未読数: channels の unreadCount 合計が表示される', () => {
    const data = [
      {
        channels: [
          { id: 1, name: 'a', unreadCount: 3 },
          { id: 2, name: 'b', unreadCount: 5 },
          { id: 3, name: 'c', unreadCount: 0 },
        ],
      },
      { events: [] },
      { tasks: [] },
    ] as unknown as SummaryData;
    render(<SummaryCards data={data} />);
    expect(screen.getByTestId('summary-unread')).toHaveTextContent('8');
  });

  it('今日の予定: events 件数が表示される', () => {
    const data = [
      { channels: [] },
      {
        events: [
          { id: 1, title: 'a' },
          { id: 2, title: 'b' },
        ],
      },
      { tasks: [] },
    ] as unknown as SummaryData;
    render(<SummaryCards data={data} />);
    expect(screen.getByTestId('summary-events')).toHaveTextContent('2');
  });

  it('未完タスク: status !== "done" のタスク数が表示される', () => {
    const data = [
      { channels: [] },
      { events: [] },
      {
        tasks: [
          { id: 1, status: 'todo' },
          { id: 2, status: 'in_progress' },
          { id: 3, status: 'done' },
        ],
      },
    ] as unknown as SummaryData;
    render(<SummaryCards data={data} />);
    expect(screen.getByTestId('summary-tasks')).toHaveTextContent('2');
  });
});

// Issue #320: サマリーカードのミニ内訳表示
describe('SummaryCards 内訳表示 (Issue #320)', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  // 未読カードのテスト用データ: チャンネル3件・DM2件・スレッド1件の未読
  const unreadData = [
    {
      channels: [
        { id: 1, name: 'ch-a', unreadCount: 2 },
        { id: 2, name: 'ch-b', unreadCount: 1 },
      ],
      dmUnreadCount: 2,
      threadUnreadCount: 1,
    },
    { events: [] },
    { tasks: [] },
  ] as unknown as SummaryData;

  // 予定カードのテスト用データ: 主催1件・参加2件
  const ORGANIZER_ID = 10;
  const eventsData = [
    { channels: [], dmUnreadCount: 0, threadUnreadCount: 0 },
    {
      events: [
        { id: 1, title: '主催イベント', organizerId: ORGANIZER_ID, attendees: [] },
        {
          id: 2,
          title: '参加イベントA',
          organizerId: 99,
          attendees: [{ userId: ORGANIZER_ID, status: 'accepted' }],
        },
        {
          id: 3,
          title: '参加イベントB',
          organizerId: 99,
          attendees: [{ userId: ORGANIZER_ID, status: 'maybe' }],
        },
      ],
    },
    { tasks: [] },
  ] as unknown as SummaryData;

  // タスクカードのテスト用データ: 自分担当2件・その他1件・完了1件
  const MY_USER_ID = 42;
  const tasksData = [
    { channels: [], dmUnreadCount: 0, threadUnreadCount: 0 },
    { events: [] },
    {
      tasks: [
        { id: 1, status: 'todo', assigneeId: MY_USER_ID },
        { id: 2, status: 'in_progress', assigneeId: MY_USER_ID },
        { id: 3, status: 'todo', assigneeId: 99 },
        { id: 4, status: 'done', assigneeId: MY_USER_ID },
      ],
    },
  ] as unknown as SummaryData;

  describe('未読カードの内訳チップ', () => {
    it('チャンネル未読件数のチップが表示される', () => {
      render(
        <MemoryRouter>
          <SummaryCards data={unreadData} currentUserId={1} />
        </MemoryRouter>,
      );
      // チャンネル未読合計 3 件のチップが表示される
      expect(screen.getByTestId('chip-unread-channel')).toHaveTextContent('3');
    });

    it('DM未読件数のチップが表示される', () => {
      render(
        <MemoryRouter>
          <SummaryCards data={unreadData} currentUserId={1} />
        </MemoryRouter>,
      );
      expect(screen.getByTestId('chip-unread-dm')).toHaveTextContent('2');
    });

    it('スレッド未読件数のチップが表示される', () => {
      render(
        <MemoryRouter>
          <SummaryCards data={unreadData} currentUserId={1} />
        </MemoryRouter>,
      );
      expect(screen.getByTestId('chip-unread-thread')).toHaveTextContent('1');
    });

    it('すべての未読が0のときは内訳チップが表示されない', () => {
      const zeroData = [
        { channels: [], dmUnreadCount: 0, threadUnreadCount: 0 },
        { events: [] },
        { tasks: [] },
      ] as unknown as SummaryData;
      render(
        <MemoryRouter>
          <SummaryCards data={zeroData} currentUserId={1} />
        </MemoryRouter>,
      );
      expect(screen.queryByTestId('chip-unread-channel')).toBeNull();
      expect(screen.queryByTestId('chip-unread-dm')).toBeNull();
      expect(screen.queryByTestId('chip-unread-thread')).toBeNull();
    });

    it('チャンネル未読チップをクリックすると /?tab=mentions に遷移する', async () => {
      render(
        <MemoryRouter>
          <SummaryCards data={unreadData} currentUserId={1} />
        </MemoryRouter>,
      );
      await userEvent.click(screen.getByTestId('chip-unread-channel'));
      expect(mockNavigate).toHaveBeenCalledWith('/?tab=mentions');
    });

    it('DM未読チップをクリックすると /dm に遷移する', async () => {
      render(
        <MemoryRouter>
          <SummaryCards data={unreadData} currentUserId={1} />
        </MemoryRouter>,
      );
      await userEvent.click(screen.getByTestId('chip-unread-dm'));
      expect(mockNavigate).toHaveBeenCalledWith('/dm');
    });

    it('スレッド未読チップをクリックすると /?tab=threads に遷移する', async () => {
      render(
        <MemoryRouter>
          <SummaryCards data={unreadData} currentUserId={1} />
        </MemoryRouter>,
      );
      await userEvent.click(screen.getByTestId('chip-unread-thread'));
      expect(mockNavigate).toHaveBeenCalledWith('/?tab=threads');
    });
  });

  describe('今日の予定カードの内訳チップ', () => {
    it('自分が主催のイベント件数のチップが表示される', () => {
      render(
        <MemoryRouter>
          <SummaryCards data={eventsData} currentUserId={ORGANIZER_ID} />
        </MemoryRouter>,
      );
      // 主催イベントは1件
      expect(screen.getByTestId('chip-event-organizer')).toHaveTextContent('1');
    });

    it('自分が参加者（主催以外）のイベント件数のチップが表示される', () => {
      render(
        <MemoryRouter>
          <SummaryCards data={eventsData} currentUserId={ORGANIZER_ID} />
        </MemoryRouter>,
      );
      // 参加イベントは2件
      expect(screen.getByTestId('chip-event-attendee')).toHaveTextContent('2');
    });

    it('予定が0件のときは内訳チップが表示されない', () => {
      const noEventsData = [
        { channels: [], dmUnreadCount: 0, threadUnreadCount: 0 },
        { events: [] },
        { tasks: [] },
      ] as unknown as SummaryData;
      render(
        <MemoryRouter>
          <SummaryCards data={noEventsData} currentUserId={1} />
        </MemoryRouter>,
      );
      expect(screen.queryByTestId('chip-event-organizer')).toBeNull();
      expect(screen.queryByTestId('chip-event-attendee')).toBeNull();
    });

    it('主催イベントチップをクリックすると /calendar?date=today&role=organizer に遷移する', async () => {
      render(
        <MemoryRouter>
          <SummaryCards data={eventsData} currentUserId={ORGANIZER_ID} />
        </MemoryRouter>,
      );
      await userEvent.click(screen.getByTestId('chip-event-organizer'));
      expect(mockNavigate).toHaveBeenCalledWith('/calendar?date=today&role=organizer');
    });

    it('参加イベントチップをクリックすると /calendar?date=today&role=attendee に遷移する', async () => {
      render(
        <MemoryRouter>
          <SummaryCards data={eventsData} currentUserId={ORGANIZER_ID} />
        </MemoryRouter>,
      );
      await userEvent.click(screen.getByTestId('chip-event-attendee'));
      expect(mockNavigate).toHaveBeenCalledWith('/calendar?date=today&role=attendee');
    });
  });

  describe('未完タスクカードの内訳チップ', () => {
    it('自分担当タスク件数のチップが表示される', () => {
      render(
        <MemoryRouter>
          <SummaryCards data={tasksData} currentUserId={MY_USER_ID} />
        </MemoryRouter>,
      );
      // 自分担当の未完タスクは2件（done は除外）
      expect(screen.getByTestId('chip-task-mine')).toHaveTextContent('2');
    });

    it('その他（担当者が自分以外）のタスク件数のチップが表示される', () => {
      render(
        <MemoryRouter>
          <SummaryCards data={tasksData} currentUserId={MY_USER_ID} />
        </MemoryRouter>,
      );
      // 他者担当の未完タスクは1件
      expect(screen.getByTestId('chip-task-others')).toHaveTextContent('1');
    });

    it('未完タスクが0件のときは内訳チップが表示されない', () => {
      const noTasksData = [
        { channels: [], dmUnreadCount: 0, threadUnreadCount: 0 },
        { events: [] },
        { tasks: [{ id: 1, status: 'done', assigneeId: MY_USER_ID }] },
      ] as unknown as SummaryData;
      render(
        <MemoryRouter>
          <SummaryCards data={noTasksData} currentUserId={MY_USER_ID} />
        </MemoryRouter>,
      );
      expect(screen.queryByTestId('chip-task-mine')).toBeNull();
      expect(screen.queryByTestId('chip-task-others')).toBeNull();
    });

    it('自分担当チップをクリックすると /tasks?status=open&mine=true に遷移する', async () => {
      render(
        <MemoryRouter>
          <SummaryCards data={tasksData} currentUserId={MY_USER_ID} />
        </MemoryRouter>,
      );
      await userEvent.click(screen.getByTestId('chip-task-mine'));
      expect(mockNavigate).toHaveBeenCalledWith('/tasks?status=open&mine=true');
    });

    it('その他チップをクリックすると /tasks?status=open&mine=false に遷移する', async () => {
      render(
        <MemoryRouter>
          <SummaryCards data={tasksData} currentUserId={MY_USER_ID} />
        </MemoryRouter>,
      );
      await userEvent.click(screen.getByTestId('chip-task-others'));
      expect(mockNavigate).toHaveBeenCalledWith('/tasks?status=open&mine=false');
    });
  });
});
