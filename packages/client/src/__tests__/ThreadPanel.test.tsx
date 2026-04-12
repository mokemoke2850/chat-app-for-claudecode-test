/**
 * テスト対象: ThreadPanel コンポーネント
 * 戦略: Socket モックを注入し、スレッドの表示・返信送信の振る舞いをテストする
 */

import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import ThreadPanel from '../components/Chat/ThreadPanel';
import { dummyUsers } from './__fixtures__/users';
import { makeMessage } from './__fixtures__/messages';

type SocketEventHandler = (...args: unknown[]) => void;

const socketHandlers: Record<string, SocketEventHandler> = {};
const mockSocket = {
  emit: vi.fn(),
  on: vi.fn((event: string, handler: SocketEventHandler) => {
    socketHandlers[event] = handler;
  }),
  off: vi.fn(),
};

vi.mock('../contexts/SocketContext', () => ({
  useSocket: () => mockSocket,
}));

vi.mock('../components/Chat/RichEditor', () => ({
  default: ({
    onSend,
  }: {
    onSend: (content: string, mentionedUserIds: number[], attachmentIds: number[]) => void;
    onCancel?: () => void;
  }) => (
    <div data-testid="rich-editor">
      <button onClick={() => onSend(JSON.stringify({ ops: [{ insert: 'test reply\n' }] }), [], [])}>
        送信
      </button>
    </div>
  ),
}));

beforeEach(() => {
  vi.resetAllMocks();
  Object.keys(socketHandlers).forEach((k) => delete socketHandlers[k]);
});

const rootMessage = makeMessage({
  id: 1,
  content: JSON.stringify({ ops: [{ insert: 'ルートメッセージ\n' }] }),
  replyCount: 2,
});
const reply1 = makeMessage({
  id: 2,
  userId: 2,
  username: 'bob',
  content: JSON.stringify({ ops: [{ insert: '返信1\n' }] }),
  parentMessageId: 1,
  rootMessageId: 1,
  createdAt: '2024-06-01T12:01:00Z',
});
const reply2 = makeMessage({
  id: 3,
  content: JSON.stringify({ ops: [{ insert: '返信2\n' }] }),
  parentMessageId: 1,
  rootMessageId: 1,
  createdAt: '2024-06-01T12:02:00Z',
});

describe('ThreadPanel', () => {
  describe('表示', () => {
    it('ルートメッセージを先頭に表示する', () => {
      render(
        <ThreadPanel
          rootMessage={rootMessage}
          initialReplies={[reply1, reply2]}
          currentUserId={1}
          users={dummyUsers}
          onClose={vi.fn()}
        />,
      );
      // スレッドパネルのタイトル
      expect(screen.getByText('スレッド')).toBeInTheDocument();
    });

    it('返信一覧を表示する', () => {
      render(
        <ThreadPanel
          rootMessage={rootMessage}
          initialReplies={[reply1, reply2]}
          currentUserId={1}
          users={dummyUsers}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByText(/2件の返信/)).toBeInTheDocument();
    });

    it('閉じるボタンをクリックすると onClose が呼ばれる', async () => {
      const onClose = vi.fn();
      render(
        <ThreadPanel
          rootMessage={rootMessage}
          initialReplies={[]}
          currentUserId={1}
          users={dummyUsers}
          onClose={onClose}
        />,
      );
      await userEvent.click(screen.getByRole('button', { name: /閉じる/i }));
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('返信送信', () => {
    it('返信エディターから送信すると send_thread_reply イベントが emit される', async () => {
      render(
        <ThreadPanel
          rootMessage={rootMessage}
          initialReplies={[]}
          currentUserId={1}
          users={dummyUsers}
          onClose={vi.fn()}
        />,
      );
      await userEvent.click(screen.getByRole('button', { name: '送信' }));
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'send_thread_reply',
        expect.objectContaining({
          rootMessageId: rootMessage.id,
        }),
      );
    });

    it('返信先を選択中は「返信先: XX へ」ラベルを表示する', async () => {
      render(
        <ThreadPanel
          rootMessage={rootMessage}
          initialReplies={[reply1]}
          currentUserId={1}
          users={dummyUsers}
          onClose={vi.fn()}
        />,
      );
      // reply1 の「返信」ボタンをクリックして返信先を選択
      const replyButtons = screen.getAllByRole('button', { name: /^返信$/ });
      await userEvent.click(replyButtons[0]);
      expect(screen.getByText(/返信先:/)).toBeInTheDocument();
    });
  });

  describe('Socket イベント受信', () => {
    it('new_thread_reply を受信すると返信一覧に追加される', () => {
      render(
        <ThreadPanel
          rootMessage={rootMessage}
          initialReplies={[reply1]}
          currentUserId={1}
          users={dummyUsers}
          onClose={vi.fn()}
        />,
      );

      const newReply = makeMessage({
        id: 99,
        content: JSON.stringify({ ops: [{ insert: '新着返信\n' }] }),
        parentMessageId: 1,
        rootMessageId: 1,
      });

      act(() => {
        socketHandlers['new_thread_reply']?.({
          reply: newReply,
          rootMessageId: 1,
          channelId: 1,
          replyCount: 2,
        });
      });

      // 返信件数が更新される
      expect(screen.getByText(/2件の返信/)).toBeInTheDocument();
    });
  });
});
