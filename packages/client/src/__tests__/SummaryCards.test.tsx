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

  describe('未読カードの内訳チップ', () => {
    it.todo('チャンネル未読件数のチップが表示される');
    it.todo('DM未読件数のチップが表示される');
    it.todo('スレッド未読件数のチップが表示される');
    it.todo('すべての未読が0のときは内訳チップが表示されない');
    it.todo('チャンネル未読チップをクリックすると /?tab=mentions に遷移する');
    it.todo('DM未読チップをクリックすると /dm に遷移する');
    it.todo('スレッド未読チップをクリックすると /?tab=threads に遷移する');
  });

  describe('今日の予定カードの内訳チップ', () => {
    it.todo('自分が主催のイベント件数のチップが表示される');
    it.todo('自分が参加者（主催以外）のイベント件数のチップが表示される');
    it.todo('予定が0件のときは内訳チップが表示されない');
    it.todo('主催イベントチップをクリックすると /calendar?date=today&role=organizer に遷移する');
    it.todo('参加イベントチップをクリックすると /calendar?date=today&role=attendee に遷移する');
  });

  describe('未完タスクカードの内訳チップ', () => {
    it.todo('自分担当タスク件数のチップが表示される');
    it.todo('その他（担当者が自分以外）のタスク件数のチップが表示される');
    it.todo('未完タスクが0件のときは内訳チップが表示されない');
    it.todo('自分担当チップをクリックすると /tasks?status=open&mine=true に遷移する');
    it.todo('その他チップをクリックすると /tasks?status=open&mine=false に遷移する');
  });
});
