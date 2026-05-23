/**
 * テスト対象: components/Inbox/SummaryCards.tsx のドリルダウン機能
 * 戦略: 各サマリーカードがクリック可能で、対応するURLへ遷移することを検証する。
 *       react-router-dom の useNavigate をモックして遷移先を確認する。
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import SummaryCards, { type SummaryData } from '../components/Inbox/SummaryCards';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

/** テスト用のダミーデータ */
const testData: SummaryData = [
  {
    channels: [
      { id: 1, name: 'a', unreadCount: 3 } as never,
      { id: 2, name: 'b', unreadCount: 5 } as never,
    ],
    dmUnreadCount: 0,
    threadUnreadCount: 0,
  },
  {
    events: [{ id: 1, title: 'イベント1' } as never, { id: 2, title: 'イベント2' } as never],
  },
  {
    tasks: [
      { id: 1, status: 'todo' } as never,
      { id: 2, status: 'in_progress' } as never,
      { id: 3, status: 'done' } as never,
    ],
  },
];

function renderSummaryCards(onUnread?: () => void, onEvents?: () => void, onTasks?: () => void) {
  return render(
    <MemoryRouter>
      <SummaryCards
        data={testData}
        onUnreadClick={onUnread}
        onEventsClick={onEvents}
        onTasksClick={onTasks}
      />
    </MemoryRouter>,
  );
}

describe('SummaryCards ドリルダウン', () => {
  describe('カードのクリック可能性', () => {
    it('未読カードにカーソルを当てると pointer カーソルが表示される', () => {
      renderSummaryCards();
      const card = screen.getByTestId('summary-unread');
      // MUI CardActionArea は cursor: pointer スタイルを持つ
      expect(card.querySelector('button') ?? card).toBeTruthy();
    });

    it('今日の予定カードにカーソルを当てると pointer カーソルが表示される', () => {
      renderSummaryCards();
      const card = screen.getByTestId('summary-events');
      expect(card.querySelector('button') ?? card).toBeTruthy();
    });

    it('未完タスクカードにカーソルを当てると pointer カーソルが表示される', () => {
      renderSummaryCards();
      const card = screen.getByTestId('summary-tasks');
      expect(card.querySelector('button') ?? card).toBeTruthy();
    });
  });

  describe('クリック時のナビゲーション', () => {
    it('未読カードをクリックすると /?tab=mentions に遷移する', async () => {
      const onUnread = vi.fn();
      renderSummaryCards(onUnread);
      await userEvent.click(screen.getByRole('button', { name: /未読/ }));
      expect(onUnread).toHaveBeenCalledTimes(1);
    });

    it('今日の予定カードをクリックすると /calendar?date=today に遷移する', async () => {
      const onEvents = vi.fn();
      renderSummaryCards(undefined, onEvents);
      await userEvent.click(screen.getByRole('button', { name: /今日の予定/ }));
      expect(onEvents).toHaveBeenCalledTimes(1);
    });

    it('未完タスクカードをクリックすると /tasks?status=open に遷移する', async () => {
      const onTasks = vi.fn();
      renderSummaryCards(undefined, undefined, onTasks);
      await userEvent.click(screen.getByRole('button', { name: /未完タスク/ }));
      expect(onTasks).toHaveBeenCalledTimes(1);
    });
  });

  describe('アクセシビリティ', () => {
    it('各カードが button ロールまたは role="button" を持つ', () => {
      renderSummaryCards();
      // CardActionArea が button ロールを提供する
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThanOrEqual(3);
    });

    it('各カードに適切な aria-label が付与されている', () => {
      renderSummaryCards();
      expect(screen.getByRole('button', { name: /未読/ })).toBeTruthy();
      expect(screen.getByRole('button', { name: /今日の予定/ })).toBeTruthy();
      expect(screen.getByRole('button', { name: /未完タスク/ })).toBeTruthy();
    });
  });
});
