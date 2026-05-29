/**
 * components/Inbox/RemindersList.tsx のユニットテスト (Step 6a)
 *
 * 純粋コンポーネントとして reminders 配列を直接渡してテストする。
 * Promise の解決は親 (InboxPage) で行うため Suspense は不要。
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import RemindersList from '../components/Inbox/RemindersList';
import type { Reminder } from '@chat-app/shared';
import { makeReminder } from './__fixtures__/reminders';

const mockNavigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

describe('RemindersList (Step 6a)', () => {
  it('reminders が空のとき「リマインダーはありません」と表示される', () => {
    render(<RemindersList reminders={[]} />);
    expect(screen.getByText('リマインダーはありません')).toBeInTheDocument();
  });

  it('reminders[].message.content (Quill Delta JSON) をプレーンテキストに変換して表示する', () => {
    render(<RemindersList reminders={[makeReminder()]} />);
    expect(screen.getByText(/スプリントレビュー/)).toBeInTheDocument();
  });

  it('複数の reminders が並んで表示される', () => {
    const reminders = [
      makeReminder({ id: 1 }),
      makeReminder({
        id: 2,
        message: {
          ...makeReminder().message!,
          content: 'プレーンテキスト本文',
        },
      }),
    ];
    render(<RemindersList reminders={reminders} />);
    expect(screen.getAllByTestId('reminder-card')).toHaveLength(2);
  });

  describe('クイックアクション (Step 6d)', () => {
    it('各カードに「完了」ボタンが表示される', () => {
      render(<RemindersList reminders={[makeReminder(), makeReminder({ id: 2 })]} />);
      const buttons = screen.getAllByRole('button', { name: '完了' });
      expect(buttons).toHaveLength(2);
    });

    it('「完了」ボタンを押すと onComplete props が該当 id で呼ばれる', async () => {
      const onComplete = vi.fn();
      render(<RemindersList reminders={[makeReminder({ id: 42 })]} onComplete={onComplete} />);
      await userEvent.click(screen.getByRole('button', { name: '完了' }));
      expect(onComplete).toHaveBeenCalledWith(42);
    });

    it('onComplete が未指定でも描画はクラッシュしない', () => {
      expect(() => render(<RemindersList reminders={[makeReminder()]} />)).not.toThrow();
    });
  });

  // unreadOnly prop のテスト (Issue #266)
  describe('unreadOnly prop の受け取り', () => {
    it('unreadOnly=true のとき未送信（isSent=false）のリマインダーのみ表示される', () => {
      const reminders = [
        makeReminder({ id: 1, isSent: false }),
        makeReminder({
          id: 2,
          isSent: true,
          message: { ...makeReminder().message!, id: 20, content: '送信済みリマインダー本文' },
        }),
      ];
      render(
        <MemoryRouter>
          <RemindersList reminders={reminders} unreadOnly={true} />
        </MemoryRouter>,
      );
      const cards = screen.getAllByTestId('reminder-card');
      expect(cards).toHaveLength(1);
    });

    it('unreadOnly=false のとき全リマインダーが表示される', () => {
      const reminders = [
        makeReminder({ id: 1, isSent: false }),
        makeReminder({ id: 2, isSent: true }),
      ];
      render(
        <MemoryRouter>
          <RemindersList reminders={reminders} unreadOnly={false} />
        </MemoryRouter>,
      );
      expect(screen.getAllByTestId('reminder-card')).toHaveLength(2);
    });

    it('unreadOnly prop が渡されない場合でも既存の動作が変わらない（後方互換）', () => {
      const reminders = [
        makeReminder({ id: 1, isSent: false }),
        makeReminder({ id: 2, isSent: true }),
      ];
      render(
        <MemoryRouter>
          <RemindersList reminders={reminders} />
        </MemoryRouter>,
      );
      expect(screen.getAllByTestId('reminder-card')).toHaveLength(2);
    });
  });

  // Step 8c: カードクリック遷移 (TODO #15 解消)
  describe('Step 8c: カードクリック遷移', () => {
    beforeEach(() => {
      mockNavigate.mockReset();
    });

    it('message が存在するときカードクリックで /chat?channel=X#message-Y に navigate される', async () => {
      render(
        <MemoryRouter>
          <RemindersList reminders={[makeReminder({ messageId: 10 })]} />
        </MemoryRouter>,
      );
      // 完了ボタン以外の領域 (CardContent) をクリック
      const card = screen.getByTestId('reminder-card');
      await userEvent.click(card);
      expect(mockNavigate).toHaveBeenCalledWith('/chat?channel=1#message-10');
    });

    it('完了ボタンクリックではカードの navigate が発火しない (stopPropagation)', async () => {
      const onComplete = vi.fn();
      render(
        <MemoryRouter>
          <RemindersList reminders={[makeReminder({ id: 5 })]} onComplete={onComplete} />
        </MemoryRouter>,
      );
      await userEvent.click(screen.getByRole('button', { name: '完了' }));
      expect(onComplete).toHaveBeenCalledWith(5);
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('message が undefined のときカードクリックは無効 (navigate 呼ばれない)', async () => {
      const reminderWithoutMessage = makeReminder();
      // message を明示的に削除
      const r: Reminder = { ...reminderWithoutMessage, message: undefined };
      render(
        <MemoryRouter>
          <RemindersList reminders={[r]} />
        </MemoryRouter>,
      );
      await userEvent.click(screen.getByTestId('reminder-card'));
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('カードに role="button" / tabIndex が設定されている (message ありのみ)', () => {
      render(
        <MemoryRouter>
          <RemindersList reminders={[makeReminder()]} />
        </MemoryRouter>,
      );
      const card = screen.getByTestId('reminder-card');
      expect(card).toHaveAttribute('role', 'button');
      expect(card).toHaveAttribute('tabindex', '0');
    });
  });
});
