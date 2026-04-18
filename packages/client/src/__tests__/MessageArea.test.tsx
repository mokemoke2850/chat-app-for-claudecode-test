/**
 * テスト対象: DMPage 内の MessageArea コンポーネント
 * 責務: 選択中のDM会話のメッセージ一覧表示・入力・送信・タイピングインジケーター
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DmConversationWithDetails, DmMessage } from '@chat-app/shared';
import MessageArea from '../components/DM/MessageArea';

const mockSocket = {
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
};

vi.mock('../contexts/SocketContext', () => ({
  useSocket: () => mockSocket,
}));

const makeConversation = (
  overrides: Partial<DmConversationWithDetails> = {},
): DmConversationWithDetails => ({
  id: 1,
  userAId: 1,
  userBId: 2,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  otherUser: { id: 2, username: 'bob', displayName: null, avatarUrl: null },
  unreadCount: 0,
  lastMessage: null,
  ...overrides,
});

const makeMessage = (overrides: Partial<DmMessage> = {}): DmMessage => ({
  id: 1,
  conversationId: 1,
  senderId: 2,
  senderUsername: 'bob',
  senderAvatarUrl: null,
  content: 'こんにちは',
  isRead: false,
  createdAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MessageArea', () => {
  describe('メッセージ一覧表示', () => {
    it('渡されたメッセージ一覧が順番通りに表示される', () => {
      const messages = [
        makeMessage({ id: 1, content: 'メッセージ1' }),
        makeMessage({ id: 2, content: 'メッセージ2' }),
        makeMessage({ id: 3, content: 'メッセージ3' }),
      ];
      render(
        <MessageArea
          conversation={makeConversation()}
          currentUserId={1}
          onSend={vi.fn()}
          messages={messages}
          typingUserId={null}
        />,
      );
      const items = screen.getAllByText(/メッセージ\d/);
      expect(items[0]).toHaveTextContent('メッセージ1');
      expect(items[1]).toHaveTextContent('メッセージ2');
      expect(items[2]).toHaveTextContent('メッセージ3');
    });

    it('自分のメッセージは右揃え、相手のメッセージは左揃えで表示される', () => {
      const messages = [
        makeMessage({ id: 1, senderId: 1, content: '自分のメッセージ' }),
        makeMessage({ id: 2, senderId: 2, content: '相手のメッセージ' }),
      ];
      render(
        <MessageArea
          conversation={makeConversation()}
          currentUserId={1}
          onSend={vi.fn()}
          messages={messages}
          typingUserId={null}
        />,
      );
      const myMsg = screen.getByText('自分のメッセージ').closest('[style]');
      expect(myMsg).toBeTruthy();
      // row-reverse (自分) と row (相手) でflexDirectionが異なる
      const myContainer = screen.getByText('自分のメッセージ').closest('div[class]')?.parentElement;
      expect(myContainer).toHaveStyle({ flexDirection: 'row-reverse' });
      const otherContainer = screen.getByText('相手のメッセージ').closest('div[class]')?.parentElement;
      expect(otherContainer).toHaveStyle({ flexDirection: 'row' });
    });

    it('相手のメッセージにはアバターが表示される', () => {
      const messages = [makeMessage({ senderId: 2 })];
      render(
        <MessageArea
          conversation={makeConversation()}
          currentUserId={1}
          onSend={vi.fn()}
          messages={messages}
          typingUserId={null}
        />,
      );
      // アバター: 相手のユーザー名の最初の文字
      const avatars = screen.getAllByText('B'); // bob[0].toUpperCase()
      expect(avatars.length).toBeGreaterThan(0);
    });

    it('自分のメッセージにはアバターが表示されない', () => {
      const messages = [makeMessage({ id: 1, senderId: 1, senderUsername: 'alice', content: '自分のメッセージ' })];
      render(
        <MessageArea
          conversation={makeConversation()}
          currentUserId={1}
          onSend={vi.fn()}
          messages={messages}
          typingUserId={null}
        />,
      );
      // ヘッダーのアバター(B)はあるが、メッセージのアバター(A)はない
      expect(screen.queryByText('A')).not.toBeInTheDocument();
    });

    it('各メッセージに送信時刻が表示される', () => {
      const messages = [makeMessage({ createdAt: '2024-01-01T10:30:00Z' })];
      render(
        <MessageArea
          conversation={makeConversation()}
          currentUserId={1}
          onSend={vi.fn()}
          messages={messages}
          typingUserId={null}
        />,
      );
      // toLocaleTimeString で時刻フォーマット
      expect(screen.getByText(/\d{2}:\d{2}/)).toBeInTheDocument();
    });

    it('メッセージが追加されると最下部にスクロールする', () => {
      // scrollIntoView はsetup.tsでポリフィル済み、呼ばれることを確認
      const scrollIntoViewMock = vi.fn();
      window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

      const { rerender } = render(
        <MessageArea
          conversation={makeConversation()}
          currentUserId={1}
          onSend={vi.fn()}
          messages={[]}
          typingUserId={null}
        />,
      );

      rerender(
        <MessageArea
          conversation={makeConversation()}
          currentUserId={1}
          onSend={vi.fn()}
          messages={[makeMessage()]}
          typingUserId={null}
        />,
      );

      expect(scrollIntoViewMock).toHaveBeenCalled();
    });
  });

  describe('ヘッダー表示', () => {
    it('会話相手のユーザー名がヘッダーに表示される', () => {
      render(
        <MessageArea
          conversation={makeConversation({ otherUser: { id: 2, username: 'bob', displayName: null, avatarUrl: null } })}
          currentUserId={1}
          onSend={vi.fn()}
          messages={[]}
          typingUserId={null}
        />,
      );
      expect(screen.getByText('bob')).toBeInTheDocument();
    });

    it('会話相手のアバターがヘッダーに表示される', () => {
      render(
        <MessageArea
          conversation={makeConversation({ otherUser: { id: 2, username: 'bob', displayName: null, avatarUrl: null } })}
          currentUserId={1}
          onSend={vi.fn()}
          messages={[]}
          typingUserId={null}
        />,
      );
      // ヘッダーのアバターはusername[0].toUpperCase()
      expect(screen.getByText('B')).toBeInTheDocument();
    });

    it('displayName がある場合は displayName が表示される', () => {
      render(
        <MessageArea
          conversation={makeConversation({ otherUser: { id: 2, username: 'bob', displayName: 'Bob Smith', avatarUrl: null } })}
          currentUserId={1}
          onSend={vi.fn()}
          messages={[]}
          typingUserId={null}
        />,
      );
      expect(screen.getByText('Bob Smith')).toBeInTheDocument();
      expect(screen.queryByText('bob')).not.toBeInTheDocument();
    });
  });

  describe('メッセージ入力・送信', () => {
    it('送信ボタンをクリックするとonSendが呼ばれる', async () => {
      const onSend = vi.fn();
      render(
        <MessageArea
          conversation={makeConversation()}
          currentUserId={1}
          onSend={onSend}
          messages={[]}
          typingUserId={null}
        />,
      );
      await userEvent.type(screen.getByLabelText('DM入力'), 'テスト');
      await userEvent.click(screen.getByRole('button', { name: '送信' }));
      expect(onSend).toHaveBeenCalledWith('テスト');
    });

    it('Enterキーを押すと送信される', async () => {
      const onSend = vi.fn();
      render(
        <MessageArea
          conversation={makeConversation()}
          currentUserId={1}
          onSend={onSend}
          messages={[]}
          typingUserId={null}
        />,
      );
      const input = screen.getByLabelText('DM入力');
      await userEvent.type(input, 'テスト{Enter}');
      expect(onSend).toHaveBeenCalledWith('テスト');
    });

    it('Shift+Enterキーでは送信されない（改行）', async () => {
      const onSend = vi.fn();
      render(
        <MessageArea
          conversation={makeConversation()}
          currentUserId={1}
          onSend={onSend}
          messages={[]}
          typingUserId={null}
        />,
      );
      const input = screen.getByLabelText('DM入力');
      await userEvent.type(input, 'テスト{Shift>}{Enter}{/Shift}');
      expect(onSend).not.toHaveBeenCalled();
    });

    it('IME変換中のEnterキーでは送信されない', async () => {
      const onSend = vi.fn();
      render(
        <MessageArea
          conversation={makeConversation()}
          currentUserId={1}
          onSend={onSend}
          messages={[]}
          typingUserId={null}
        />,
      );
      const input = screen.getByLabelText('DM入力');
      // isComposing=true のキーイベントを手動dispatch
      await userEvent.type(input, 'テスト');
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        isComposing: true,
      });
      input.dispatchEvent(event);
      expect(onSend).not.toHaveBeenCalled();
    });

    it('空文字列では送信ボタンがdisabledになる', () => {
      render(
        <MessageArea
          conversation={makeConversation()}
          currentUserId={1}
          onSend={vi.fn()}
          messages={[]}
          typingUserId={null}
        />,
      );
      expect(screen.getByRole('button', { name: '送信' })).toBeDisabled();
    });

    it('空白のみのメッセージは送信されない', async () => {
      const onSend = vi.fn();
      render(
        <MessageArea
          conversation={makeConversation()}
          currentUserId={1}
          onSend={onSend}
          messages={[]}
          typingUserId={null}
        />,
      );
      const input = screen.getByLabelText('DM入力');
      await userEvent.type(input, '   ');
      // 空白のみでも入力値があるので送信ボタンはenabledになるが、送信時にtrimされて送信されない
      await userEvent.click(screen.getByRole('button', { name: '送信' }));
      expect(onSend).not.toHaveBeenCalled();
    });

    it('送信後に入力欄がクリアされる', async () => {
      render(
        <MessageArea
          conversation={makeConversation()}
          currentUserId={1}
          onSend={vi.fn()}
          messages={[]}
          typingUserId={null}
        />,
      );
      const input = screen.getByLabelText('DM入力');
      await userEvent.type(input, 'テスト');
      await userEvent.click(screen.getByRole('button', { name: '送信' }));
      expect(input).toHaveValue('');
    });
  });

  describe('タイピングインジケーター', () => {
    it('相手がタイピング中のとき「〇〇が入力中...」と表示される', () => {
      render(
        <MessageArea
          conversation={makeConversation()}
          currentUserId={1}
          onSend={vi.fn()}
          messages={[]}
          typingUserId={2}
        />,
      );
      expect(screen.getByText(/bob.*入力中/)).toBeInTheDocument();
    });

    it('自分がタイピング中のときにはインジケーターが表示されない', () => {
      render(
        <MessageArea
          conversation={makeConversation()}
          currentUserId={1}
          onSend={vi.fn()}
          messages={[]}
          typingUserId={1}
        />,
      );
      expect(screen.queryByText(/入力中/)).not.toBeInTheDocument();
    });

    it('typingUserId が null のときにはインジケーターが表示されない', () => {
      render(
        <MessageArea
          conversation={makeConversation()}
          currentUserId={1}
          onSend={vi.fn()}
          messages={[]}
          typingUserId={null}
        />,
      );
      expect(screen.queryByText(/入力中/)).not.toBeInTheDocument();
    });
  });

  describe('Socket.IO タイピングイベント送出', () => {
    it('入力欄に文字を入力すると dm_typing_start が emit される', async () => {
      render(
        <MessageArea
          conversation={makeConversation({ id: 42 })}
          currentUserId={1}
          onSend={vi.fn()}
          messages={[]}
          typingUserId={null}
        />,
      );
      await userEvent.type(screen.getByLabelText('DM入力'), 'テスト');
      expect(mockSocket.emit).toHaveBeenCalledWith('dm_typing_start', 42);
    });

    it('入力欄からフォーカスが外れると dm_typing_stop が emit される', async () => {
      render(
        <MessageArea
          conversation={makeConversation({ id: 42 })}
          currentUserId={1}
          onSend={vi.fn()}
          messages={[]}
          typingUserId={null}
        />,
      );
      const input = screen.getByLabelText('DM入力');
      await userEvent.click(input);
      await userEvent.tab();
      expect(mockSocket.emit).toHaveBeenCalledWith('dm_typing_stop', 42);
    });
  });
});
