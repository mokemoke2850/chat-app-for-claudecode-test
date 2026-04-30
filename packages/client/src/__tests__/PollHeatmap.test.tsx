/**
 * テスト対象: components/Calendar/PollHeatmap.tsx — 日程調整のヒートマップ表示 + 投票（#152）
 *
 * 戦略:
 *   - api.calendar.polls.castVote / confirm を vi.mock
 *   - 集計ロジック（yes/maybe/no カウント、最多得票候補ハイライト、参加可能率バー）
 *   - 自分のセルクリックで yes → maybe → no → null（解除）→ yes の循環ロジック
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PollHeatmap } from '../components/Calendar/PollHeatmap';
import type { CalendarPoll, CalendarPollCandidate, CalendarPollVote, User } from '@chat-app/shared';

const castVoteMock = vi.fn();
const confirmMock = vi.fn();

vi.mock('../api/client', () => ({
  api: {
    calendar: {
      polls: {
        castVote: (...args: unknown[]) => castVoteMock(...args),
        confirm: (...args: unknown[]) => confirmMock(...args),
      },
      events: {},
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

function makeCandidate(id: number, day: number): CalendarPollCandidate {
  return {
    id,
    pollId: 1,
    startsAt: new Date(2030, 5, day, 10, 0).toISOString(),
    endsAt: new Date(2030, 5, day, 11, 0).toISOString(),
  };
}

function makeVote(
  candidateId: number,
  userId: number,
  vote: 'yes' | 'maybe' | 'no',
): CalendarPollVote {
  return { candidateId, userId, vote, votedAt: '2030-05-01T00:00:00Z' };
}

function makePoll(opts: Partial<CalendarPoll> = {}): CalendarPoll {
  return {
    id: 1,
    channelId: 10,
    title: '次回レビューの日程',
    organizerId: 2,
    deadline: null,
    confirmedEventId: null,
    createdAt: '2030-05-01T00:00:00Z',
    candidates: [makeCandidate(101, 1), makeCandidate(102, 2), makeCandidate(103, 3)],
    votes: [],
    ...opts,
  };
}

const users: User[] = [makeUser(1, 'alice'), makeUser(2, 'bob'), makeUser(3, 'carol')];

const handlers = {
  onVoteUpdated: vi.fn(),
  onConfirmed: vi.fn(),
};

beforeEach(() => {
  castVoteMock.mockReset();
  confirmMock.mockReset();
  Object.values(handlers).forEach((h) => h.mockClear());
});

const renderHeatmap = (
  overrides: Partial<{
    poll: CalendarPoll;
    currentUserId: number;
    isOrganizer: boolean;
  }> = {},
) =>
  render(
    <PollHeatmap
      poll={overrides.poll ?? makePoll()}
      users={users}
      currentUserId={overrides.currentUserId ?? 1}
      isOrganizer={overrides.isOrganizer ?? false}
      onVoteUpdated={handlers.onVoteUpdated}
      onConfirmed={handlers.onConfirmed}
    />,
  );

describe('PollHeatmap', () => {
  describe('集計', () => {
    it('各候補の yes / maybe / no の人数がヘッダーに表示される', () => {
      const poll = makePoll({
        votes: [makeVote(101, 1, 'yes'), makeVote(101, 2, 'maybe'), makeVote(102, 1, 'no')],
      });
      renderHeatmap({ poll });
      const header101 = screen.getByTestId('poll-heatmap-header-101');
      expect(header101).toHaveTextContent('◯ 1');
      expect(header101).toHaveTextContent('△ 1');
      // 102 は no=1, yes=0, maybe=0
      const header102 = screen.getByTestId('poll-heatmap-header-102');
      expect(header102).toHaveTextContent('◯ 0');
    });

    it('yes 件数が最多の候補が data-best=true でハイライトされる', () => {
      const poll = makePoll({
        votes: [
          makeVote(101, 1, 'yes'),
          makeVote(102, 1, 'yes'),
          makeVote(102, 2, 'yes'),
          makeVote(103, 3, 'maybe'),
        ],
      });
      renderHeatmap({ poll });
      expect(screen.getByTestId('poll-heatmap-header-101').getAttribute('data-best')).toBe('false');
      expect(screen.getByTestId('poll-heatmap-header-102').getAttribute('data-best')).toBe('true');
      expect(screen.getByTestId('poll-heatmap-header-103').getAttribute('data-best')).toBe('false');
    });

    it('参加可能率バーは yes 件数 / 最多 yes 件数の比率で長さが決まる', () => {
      const poll = makePoll({
        votes: [
          makeVote(101, 1, 'yes'),
          makeVote(102, 1, 'yes'),
          makeVote(102, 2, 'yes'),
          makeVote(102, 3, 'yes'),
        ],
      });
      renderHeatmap({ poll });
      // 102 が yes=3 で最多。101 は yes=1 → pct = 1/3
      const bar101 = screen.getByTestId('poll-bar-101');
      const bar102 = screen.getByTestId('poll-bar-102');
      expect(Number(bar102.getAttribute('data-pct'))).toBeCloseTo(1.0, 5);
      expect(Number(bar101.getAttribute('data-pct'))).toBeCloseTo(1 / 3, 3);
    });

    it('全候補で yes 件数が同じ場合は最初の候補がハイライトされる（決定論）', () => {
      const poll = makePoll({
        votes: [makeVote(101, 1, 'yes'), makeVote(102, 1, 'yes'), makeVote(103, 1, 'yes')],
      });
      renderHeatmap({ poll });
      expect(screen.getByTestId('poll-heatmap-header-101').getAttribute('data-best')).toBe('true');
      expect(screen.getByTestId('poll-heatmap-header-102').getAttribute('data-best')).toBe('false');
      expect(screen.getByTestId('poll-heatmap-header-103').getAttribute('data-best')).toBe('false');
    });
  });

  describe('投票表示', () => {
    it('既に投票済みのユーザー行に対応する vote 値（◯/△/×）が色分けで表示される', () => {
      const poll = makePoll({
        votes: [makeVote(101, 2, 'yes'), makeVote(102, 2, 'maybe'), makeVote(103, 2, 'no')],
      });
      renderHeatmap({ poll });
      const c1 = screen.getByTestId('poll-cell-2-101');
      const c2 = screen.getByTestId('poll-cell-2-102');
      const c3 = screen.getByTestId('poll-cell-2-103');
      expect(c1).toHaveTextContent('◯');
      expect(c2).toHaveTextContent('△');
      expect(c3).toHaveTextContent('×');
      expect(c1.getAttribute('data-vote')).toBe('yes');
      expect(c2.getAttribute('data-vote')).toBe('maybe');
      expect(c3.getAttribute('data-vote')).toBe('no');
    });

    it('未投票のセルは data-vote=none でラベルが空', () => {
      const poll = makePoll();
      renderHeatmap({ poll });
      const c = screen.getByTestId('poll-cell-1-101');
      expect(c.getAttribute('data-vote')).toBe('none');
      expect(c.textContent).toBe('');
    });

    it('自分の行には「(あなた)」ラベルが付く', () => {
      const poll = makePoll();
      renderHeatmap({ poll, currentUserId: 1 });
      // 自分(=1) の行
      const myRow = screen.getByTestId('poll-row-1');
      expect(myRow).toHaveTextContent('(あなた)');
    });

    it('自分が未投票でも自分の行は表示される', () => {
      const poll = makePoll({
        votes: [
          // 自分(=1)は投票していない、他人は投票済み
          makeVote(101, 2, 'yes'),
        ],
      });
      renderHeatmap({ poll, currentUserId: 1 });
      expect(screen.getByTestId('poll-row-1')).toBeInTheDocument();
    });
  });

  describe('投票循環', () => {
    it('未投票セル（null）のクリックで yes が送信される', async () => {
      castVoteMock.mockResolvedValue({ poll: makePoll() });
      const poll = makePoll();
      renderHeatmap({ poll, currentUserId: 1 });
      await userEvent.click(screen.getByTestId('poll-cell-1-101'));
      await waitFor(() => expect(castVoteMock).toHaveBeenCalledTimes(1));
      const [pollId, votes] = castVoteMock.mock.calls[0];
      expect(pollId).toBe(1);
      expect(votes).toEqual([{ candidateId: 101, vote: 'yes' }]);
    });

    it('yes セルのクリックで maybe が送信される', async () => {
      castVoteMock.mockResolvedValue({ poll: makePoll() });
      const poll = makePoll({ votes: [makeVote(101, 1, 'yes')] });
      renderHeatmap({ poll, currentUserId: 1 });
      await userEvent.click(screen.getByTestId('poll-cell-1-101'));
      await waitFor(() => expect(castVoteMock).toHaveBeenCalled());
      expect(castVoteMock.mock.calls[0][1]).toEqual([{ candidateId: 101, vote: 'maybe' }]);
    });

    it('maybe セルのクリックで no が送信される', async () => {
      castVoteMock.mockResolvedValue({ poll: makePoll() });
      const poll = makePoll({ votes: [makeVote(101, 1, 'maybe')] });
      renderHeatmap({ poll, currentUserId: 1 });
      await userEvent.click(screen.getByTestId('poll-cell-1-101'));
      await waitFor(() => expect(castVoteMock).toHaveBeenCalled());
      expect(castVoteMock.mock.calls[0][1]).toEqual([{ candidateId: 101, vote: 'no' }]);
    });

    it('no セルのクリックで null（投票削除）が送信される', async () => {
      castVoteMock.mockResolvedValue({ poll: makePoll() });
      const poll = makePoll({ votes: [makeVote(101, 1, 'no')] });
      renderHeatmap({ poll, currentUserId: 1 });
      await userEvent.click(screen.getByTestId('poll-cell-1-101'));
      await waitFor(() => expect(castVoteMock).toHaveBeenCalled());
      expect(castVoteMock.mock.calls[0][1]).toEqual([{ candidateId: 101, vote: null }]);
    });

    it('他人のセルをクリックしても api.calendar.polls.castVote は呼ばれない', async () => {
      const poll = makePoll({ votes: [makeVote(101, 2, 'yes')] });
      renderHeatmap({ poll, currentUserId: 1 });
      // user 2 のセルをクリック
      await userEvent.click(screen.getByTestId('poll-cell-2-101'));
      expect(castVoteMock).not.toHaveBeenCalled();
    });
  });

  describe('確定操作', () => {
    it('「最多回答で確定」クリックで最多得票の candidateId が api.calendar.polls.confirm に渡る', async () => {
      confirmMock.mockResolvedValue({
        event: {
          id: 999,
          channelId: 10,
          title: 'X',
          description: null,
          location: null,
          startsAt: '2030-06-02T10:00:00Z',
          endsAt: '2030-06-02T11:00:00Z',
          organizerId: 2,
          createdAt: '2030-05-01T00:00:00Z',
          updatedAt: '2030-05-01T00:00:00Z',
          attendees: [],
          reminderOffsetMinutes: null,
        },
      });
      const poll = makePoll({
        votes: [makeVote(102, 1, 'yes'), makeVote(102, 2, 'yes'), makeVote(101, 1, 'yes')],
      });
      renderHeatmap({ poll, currentUserId: 2, isOrganizer: true });
      await userEvent.click(screen.getByLabelText('poll-confirm-best'));
      await waitFor(() => expect(confirmMock).toHaveBeenCalledTimes(1));
      // 最多得票は 102（yes=2）
      expect(confirmMock.mock.calls[0]).toEqual([1, 102]);
    });

    it('confirm 成功時に onConfirmed コールバックが呼ばれて親側でカレンダー再フェッチをトリガーする', async () => {
      confirmMock.mockResolvedValue({
        event: {
          id: 999,
          channelId: 10,
          title: 'X',
          description: null,
          location: null,
          startsAt: '2030-06-01T10:00:00Z',
          endsAt: '2030-06-01T11:00:00Z',
          organizerId: 2,
          createdAt: '2030-05-01T00:00:00Z',
          updatedAt: '2030-05-01T00:00:00Z',
          attendees: [],
          reminderOffsetMinutes: null,
        },
      });
      const poll = makePoll({ votes: [makeVote(101, 1, 'yes')] });
      renderHeatmap({ poll, currentUserId: 2, isOrganizer: true });
      await userEvent.click(screen.getByLabelText('poll-confirm-best'));
      await waitFor(() => expect(handlers.onConfirmed).toHaveBeenCalledTimes(1));
      expect(handlers.onConfirmed.mock.calls[0][0].id).toBe(999);
    });

    it('confirmedEventId が既にセットされている poll では確定ボタンが disable される', () => {
      const poll = makePoll({ confirmedEventId: 999 });
      renderHeatmap({ poll, currentUserId: 2, isOrganizer: true });
      expect((screen.getByLabelText('poll-confirm-best') as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe('権限', () => {
    it('organizer 以外のユーザーには確定ボタンが表示されない', () => {
      const poll = makePoll();
      renderHeatmap({ poll, currentUserId: 1, isOrganizer: false });
      expect(screen.queryByLabelText('poll-confirm-best')).toBeNull();
    });
  });
});
