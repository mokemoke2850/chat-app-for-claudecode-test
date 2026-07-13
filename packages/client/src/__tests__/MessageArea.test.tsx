/**
 * テスト対象: DMPage 内の MessageArea コンポーネント
 * 責務: 選択中のDM会話のメッセージ一覧表示・入力・送信・編集・編集履歴・タイピングインジケーター
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DmMessage } from '@chat-app/shared';
import MessageArea from '../components/DM/MessageArea';
import { makeConversation, makeDmMessage } from './__fixtures__/dm';

const getDmHistoryMock = vi.hoisted(() => vi.fn());
const showErrorMock = vi.hoisted(() => vi.fn());

vi.mock('../api/client', () => ({
  api: { dm: { history: getDmHistoryMock } },
}));

vi.mock('../contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showError: showErrorMock }),
}));

const mockSocket = {
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
};

vi.mock('../contexts/SocketContext', () => ({
  useSocket: () => mockSocket,
}));

const makeMessage = (overrides: Partial<DmMessage> = {}): DmMessage => ({
  id: 1,
  conversationId: 1,
  senderId: 2,
  senderUsername: 'bob',
  senderAvatarUrl: null,
  content: 'こんにちは',
  isRead: false,
  isEdited: false,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  getDmHistoryMock.mockReset();
  showErrorMock.mockReset();
});

describe('MessageArea', () => {
  describe('DMメッセージ編集・編集履歴（#424）', () => {
    type EditableProps = React.ComponentProps<typeof MessageArea> & {
      onEdit: (messageId: number, content: string) => Promise<void>;
    };
    const EditableMessageArea = MessageArea as React.ComponentType<EditableProps>;

    function renderEditable(
      message: DmMessage,
      onEdit: EditableProps['onEdit'] = vi.fn().mockResolvedValue(undefined),
    ) {
      return render(
        <EditableMessageArea
          conversation={makeConversation()}
          currentUserId={1}
          onSend={vi.fn()}
          onEdit={onEdit}
          messages={[message]}
          typingUserId={null}
        />,
      );
    }

    it('自分のDMを編集して保存できる', async () => {
      const onEdit = vi.fn().mockResolvedValue(undefined);
      renderEditable(makeDmMessage({ senderId: 1, content: '編集前' }), onEdit);

      await userEvent.click(screen.getByRole('button', { name: 'DMを編集' }));
      const input = screen.getByLabelText('DM編集');
      await userEvent.clear(input);
      await userEvent.type(input, '編集後');
      await userEvent.click(screen.getByRole('button', { name: '編集を保存' }));

      expect(onEdit).toHaveBeenCalledWith(1, '編集後');
      expect(screen.queryByLabelText('DM編集')).not.toBeInTheDocument();
    });

    it('相手のDMには編集操作を表示しない', () => {
      renderEditable(makeDmMessage({ senderId: 2 }));
      expect(screen.queryByRole('button', { name: 'DMを編集' })).not.toBeInTheDocument();
    });

    it('編集済みDMは通常表示で編集済み表示だけを示し履歴本文を表示しない', () => {
      const message = {
        ...makeDmMessage({ content: '現在の本文' }),
        isEdited: true,
        updatedAt: '2024-01-02T00:00:00Z',
      } as DmMessage;
      renderEditable(message);
      expect(screen.getByRole('button', { name: 'DM編集履歴を表示' })).toHaveTextContent(
        '(edited)',
      );
      expect(screen.queryByText('以前の本文')).not.toBeInTheDocument();
    });

    it('編集済み表示の明示操作で履歴を取得し古い順に表示する', async () => {
      getDmHistoryMock.mockResolvedValue({
        items: [
          {
            id: 1,
            messageId: 1,
            content: '元本文',
            editorId: 1,
            editorUsername: 'alice',
            editedAt: '2024-01-01T00:00:00Z',
          },
          {
            id: 2,
            messageId: 1,
            content: '1回目',
            editorId: 1,
            editorUsername: 'alice',
            editedAt: '2024-01-02T00:00:00Z',
          },
        ],
      });
      const message = {
        ...makeDmMessage(),
        isEdited: true,
        updatedAt: '2024-01-03T00:00:00Z',
      } as DmMessage;
      renderEditable(message);
      await userEvent.click(screen.getByRole('button', { name: 'DM編集履歴を表示' }));

      expect(getDmHistoryMock).toHaveBeenCalledWith(1, 1);
      const dialog = await screen.findByRole('dialog', { name: 'DM編集履歴' });
      const contents = within(dialog).getAllByTestId('dm-history-content');
      expect(contents.map((item) => item.textContent)).toEqual(['元本文', '1回目']);
      expect(within(dialog).getAllByText(/alice/)).toHaveLength(2);
    });

    it('編集履歴を開く前は履歴APIを呼び出さない', () => {
      const message = {
        ...makeDmMessage(),
        isEdited: true,
        updatedAt: '2024-01-02T00:00:00Z',
      } as DmMessage;
      renderEditable(message);
      expect(getDmHistoryMock).not.toHaveBeenCalled();
    });

    it('DM編集に失敗した場合はエラーを通知して編集状態を維持する', async () => {
      const onEdit = vi.fn().mockRejectedValue(new Error('編集API失敗'));
      renderEditable(makeDmMessage({ senderId: 1, content: '編集前' }), onEdit);
      await userEvent.click(screen.getByRole('button', { name: 'DMを編集' }));
      const input = screen.getByLabelText('DM編集');
      await userEvent.clear(input);
      await userEvent.type(input, '保存できない本文');
      await userEvent.click(screen.getByRole('button', { name: '編集を保存' }));

      expect(await screen.findByLabelText('DM編集')).toHaveValue('保存できない本文');
      expect(showErrorMock).toHaveBeenCalledWith('DMの編集に失敗しました');
    });

    it('編集履歴の取得に失敗した場合はエラーを通知して履歴を開かない', async () => {
      getDmHistoryMock.mockRejectedValue(new Error('履歴API失敗'));
      const message = {
        ...makeDmMessage(),
        isEdited: true,
        updatedAt: '2024-01-02T00:00:00Z',
      } as DmMessage;
      renderEditable(message);
      await userEvent.click(screen.getByRole('button', { name: 'DM編集履歴を表示' }));

      expect(showErrorMock).toHaveBeenCalledWith('DM編集履歴の取得に失敗しました');
      expect(screen.queryByRole('dialog', { name: 'DM編集履歴' })).not.toBeInTheDocument();
    });
  });

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
      // row-reverse (自分) と row (相手) でflexDirectionが異なる
      // style属性で flexDirection を持つ最も近い祖先要素で確認する
      const myContainer = screen.getByText('自分のメッセージ').closest('[style*="row-reverse"]');
      expect(myContainer).toBeInTheDocument();
      const otherContainer = screen.getByText('相手のメッセージ').closest('[style*="row-reverse"]');
      expect(otherContainer).not.toBeInTheDocument();
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
      const messages = [
        makeMessage({ id: 1, senderId: 1, senderUsername: 'alice', content: '自分のメッセージ' }),
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
          conversation={makeConversation({
            otherUser: { id: 2, username: 'bob', displayName: null, avatarUrl: null },
          })}
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
          conversation={makeConversation({
            otherUser: { id: 2, username: 'bob', displayName: null, avatarUrl: null },
          })}
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
          conversation={makeConversation({
            otherUser: { id: 2, username: 'bob', displayName: 'Bob Smith', avatarUrl: null },
          })}
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
      // 空白のみのとき input.trim() === '' なので送信ボタンはdisabledになる
      expect(screen.getByRole('button', { name: '送信' })).toBeDisabled();
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
