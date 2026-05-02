/**
 * components/Inbox/RemindersList.tsx のユニットテスト (Step 6a)
 *
 * 純粋コンポーネントとして reminders 配列を直接渡してテストする。
 * Promise の解決は親 (InboxPage) で行うため Suspense は不要。
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import RemindersList from '../components/Inbox/RemindersList';
import type { Reminder } from '@chat-app/shared';

function makeReminder(overrides: Partial<Reminder> = {}): Reminder {
  return {
    id: 1,
    userId: 1,
    messageId: 10,
    remindAt: '2026-05-10T09:00:00Z',
    isSent: false,
    createdAt: '2026-05-01T00:00:00Z',
    message: {
      id: 10,
      channelId: 1,
      userId: 1,
      username: 'alice',
      avatarUrl: null,
      content: JSON.stringify({ ops: [{ insert: 'スプリントレビュー\n' }] }),
      isEdited: false,
      isDeleted: false,
      createdAt: '2026-05-01T00:00:00Z',
      updatedAt: '2026-05-01T00:00:00Z',
      mentions: [],
      reactions: [],
      parentMessageId: null,
      rootMessageId: null,
      replyCount: 0,
      quotedMessageId: null,
      quotedMessage: null,
    },
    ...overrides,
  };
}

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
});
