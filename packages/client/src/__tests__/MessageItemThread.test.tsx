/**
 * テスト対象: MessageItem のスレッド関連機能
 * 戦略: Socket モックを注入し、replyCount バッジ表示と「返信」ボタンの振る舞いをテストする
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import MessageItem from '../components/Chat/MessageItem';
import { dummyUsers } from './__fixtures__/users';
import { makeMessage } from './__fixtures__/messages';

const mockSocket = { emit: vi.fn(), on: vi.fn(), off: vi.fn() };
vi.mock('../contexts/SocketContext', () => ({
  useSocket: () => mockSocket,
}));

vi.mock('../components/Chat/RichEditor', () => ({
  default: ({ onCancel }: { onCancel: () => void; onSend: (c: string, m: number[]) => void }) => (
    <div data-testid="rich-editor">
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe('MessageItem（スレッド機能）', () => {
  describe('返信バッジ', () => {
    it('replyCount > 0 のとき「N件の返信」バッジを表示する', () => {
      const onOpenThread = vi.fn();
      render(
        <MessageItem
          message={makeMessage({ replyCount: 3 })}
          currentUserId={1}
          users={dummyUsers}
          onOpenThread={onOpenThread}
        />,
      );
      expect(screen.getByText(/3件の返信/)).toBeInTheDocument();
    });

    it('replyCount が 0 のときバッジを表示しない', () => {
      render(
        <MessageItem
          message={makeMessage({ replyCount: 0 })}
          currentUserId={1}
          users={dummyUsers}
        />,
      );
      expect(screen.queryByText(/件の返信/)).not.toBeInTheDocument();
    });

    it('バッジをクリックすると onOpenThread が呼ばれる', async () => {
      const onOpenThread = vi.fn();
      render(
        <MessageItem
          message={makeMessage({ id: 5, replyCount: 2 })}
          currentUserId={1}
          users={dummyUsers}
          onOpenThread={onOpenThread}
        />,
      );
      await userEvent.click(screen.getByText(/2件の返信/));
      expect(onOpenThread).toHaveBeenCalledWith(5);
    });
  });

  describe('返信ボタン', () => {
    it('ホバー時のアクションに「返信」ボタンが表示される', async () => {
      const onOpenThread = vi.fn();
      render(
        <MessageItem
          message={makeMessage({ id: 1 })}
          currentUserId={2}
          users={dummyUsers}
          onOpenThread={onOpenThread}
        />,
      );
      expect(screen.getByRole('button', { name: '返信' })).toBeInTheDocument();
    });

    it('「返信」ボタンをクリックすると onOpenThread が呼ばれる', async () => {
      const onOpenThread = vi.fn();
      render(
        <MessageItem
          message={makeMessage({ id: 7 })}
          currentUserId={2}
          users={dummyUsers}
          onOpenThread={onOpenThread}
        />,
      );
      await userEvent.click(screen.getByRole('button', { name: '返信' }));
      expect(onOpenThread).toHaveBeenCalledWith(7);
    });
  });
});
