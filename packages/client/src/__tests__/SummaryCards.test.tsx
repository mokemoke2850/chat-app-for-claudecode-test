/**
 * components/Inbox/SummaryCards.tsx のユニットテスト (Step 6a)
 *
 * 純粋コンポーネントとして data を直接渡してテストする。
 * Promise 解決は親 (InboxPage 内 Suspense ラッパー) で行うため Suspense は不要。
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SummaryCards, { type SummaryData } from '../components/Inbox/SummaryCards';

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
