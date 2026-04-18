/**
 * components/Chat/MessageActions.tsx のユニットテスト
 *
 * テスト対象: メッセージに対するアクションボタン群
 *   - 引用返信・返信・リアクション・ピン留め・ブックマーク・リマインダー・リンクコピー
 *   - 自分のメッセージのみ表示する編集・削除ボタン
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MessageActions from '../components/Chat/MessageActions';
import { makeMessage } from './__fixtures__/messages';

// Socket モック
const mockSocket = { emit: vi.fn(), on: vi.fn(), off: vi.fn() };
vi.mock('../contexts/SocketContext', () => ({
  useSocket: () => mockSocket,
}));

// EmojiPicker モック
vi.mock('../components/Chat/EmojiPicker', () => ({
  default: ({ anchorEl, onSelect }: { anchorEl: HTMLElement | null; onSelect: (e: string) => void }) =>
    anchorEl ? (
      <div data-testid="emoji-picker">
        <button onClick={() => onSelect('😀')}>emoji</button>
      </div>
    ) : null,
}));

// ReminderDialog モック
vi.mock('../components/Reminder/ReminderDialog', () => ({
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div data-testid="reminder-dialog">
        <button onClick={onClose}>close</button>
      </div>
    ) : null,
}));

// API モック
const mockBookmarksAdd = vi.fn();
const mockBookmarksRemove = vi.fn();
vi.mock('../api/client', () => ({
  api: {
    bookmarks: {
      add: (id: number) => mockBookmarksAdd(id),
      remove: (id: number) => mockBookmarksRemove(id),
    },
  },
}));

beforeEach(() => {
  vi.resetAllMocks();
  mockBookmarksAdd.mockResolvedValue(undefined);
  mockBookmarksRemove.mockResolvedValue(undefined);
});

describe('MessageActions', () => {
  describe('共通アクションボタンの表示', () => {
    it('引用返信ボタンが表示される', () => {
      render(<MessageActions message={makeMessage()} isOwn={false} />);
      expect(screen.getByRole('button', { name: '引用返信' })).toBeInTheDocument();
    });

    it('返信（スレッド）ボタンが表示される', () => {
      render(<MessageActions message={makeMessage()} isOwn={false} />);
      expect(screen.getByRole('button', { name: '返信' })).toBeInTheDocument();
    });

    it('リアクション追加ボタンが表示される', () => {
      render(<MessageActions message={makeMessage()} isOwn={false} />);
      expect(screen.getByRole('button', { name: 'リアクションを追加' })).toBeInTheDocument();
    });

    it('ピン留めボタンが表示される', () => {
      render(<MessageActions message={makeMessage()} isOwn={false} isPinned={false} />);
      expect(screen.getByRole('button', { name: 'ピン留め' })).toBeInTheDocument();
    });

    it('ブックマークボタンが表示される', () => {
      render(<MessageActions message={makeMessage()} isOwn={false} isBookmarked={false} />);
      expect(screen.getByRole('button', { name: 'ブックマーク' })).toBeInTheDocument();
    });

    it('リマインダー設定ボタンが表示される', () => {
      render(<MessageActions message={makeMessage()} isOwn={false} />);
      expect(screen.getByRole('button', { name: 'リマインダー設定' })).toBeInTheDocument();
    });

    it('リンクをコピーボタンが表示される', () => {
      render(<MessageActions message={makeMessage()} isOwn={false} />);
      expect(screen.getByRole('button', { name: 'リンクをコピー' })).toBeInTheDocument();
    });
  });

  describe('自分のメッセージのアクション', () => {
    it('isOwn=true のとき Edit ボタンが表示される', () => {
      render(<MessageActions message={makeMessage()} isOwn={true} />);
      expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    });

    it('isOwn=true のとき Delete ボタンが表示される', () => {
      render(<MessageActions message={makeMessage()} isOwn={true} />);
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    });

    it('isOwn=false のとき Edit ボタンが表示されない', () => {
      render(<MessageActions message={makeMessage()} isOwn={false} />);
      expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    });

    it('isOwn=false のとき Delete ボタンが表示されない', () => {
      render(<MessageActions message={makeMessage()} isOwn={false} />);
      expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    });
  });

  describe('引用返信', () => {
    it('引用返信ボタンをクリックすると onQuoteReply が message を引数に呼ばれる', async () => {
      const onQuoteReply = vi.fn();
      const message = makeMessage({ id: 1 });
      render(<MessageActions message={message} isOwn={false} onQuoteReply={onQuoteReply} />);
      await userEvent.click(screen.getByRole('button', { name: '引用返信' }));
      expect(onQuoteReply).toHaveBeenCalledWith(message);
    });
  });

  describe('スレッド返信', () => {
    it('返信ボタンをクリックすると onOpenThread が message.id を引数に呼ばれる', async () => {
      const onOpenThread = vi.fn();
      render(<MessageActions message={makeMessage({ id: 42 })} isOwn={false} onOpenThread={onOpenThread} />);
      await userEvent.click(screen.getByRole('button', { name: '返信' }));
      expect(onOpenThread).toHaveBeenCalledWith(42);
    });
  });

  describe('ピン留め', () => {
    it('isPinned=false のとき「ピン留め」ラベルのボタンを表示する', () => {
      render(<MessageActions message={makeMessage()} isOwn={false} isPinned={false} />);
      expect(screen.getByRole('button', { name: 'ピン留め' })).toBeInTheDocument();
    });

    it('isPinned=true のとき「ピン留めを解除」ラベルのボタンを表示し primary カラーで強調する', () => {
      render(<MessageActions message={makeMessage()} isOwn={false} isPinned={true} />);
      expect(screen.getByRole('button', { name: 'ピン留めを解除' })).toBeInTheDocument();
    });

    it('ピン留めボタンをクリックすると onPinMessage が message.id を引数に呼ばれる', async () => {
      const onPinMessage = vi.fn();
      render(
        <MessageActions message={makeMessage({ id: 5 })} isOwn={false} isPinned={false} onPinMessage={onPinMessage} />,
      );
      await userEvent.click(screen.getByRole('button', { name: 'ピン留め' }));
      expect(onPinMessage).toHaveBeenCalledWith(5);
    });
  });

  describe('ブックマーク', () => {
    it('isBookmarked=false のとき BookmarkBorderIcon を表示する', () => {
      render(<MessageActions message={makeMessage()} isOwn={false} isBookmarked={false} />);
      expect(screen.getByRole('button', { name: 'ブックマーク' })).toBeInTheDocument();
    });

    it('isBookmarked=true のとき BookmarkIcon を表示し primary カラーで強調する', () => {
      render(<MessageActions message={makeMessage()} isOwn={false} isBookmarked={true} />);
      expect(screen.getByRole('button', { name: 'ブックマーク解除' })).toBeInTheDocument();
    });

    it('ブックマークボタンをクリックすると api.bookmarks.add が呼ばれ状態が更新される', async () => {
      render(<MessageActions message={makeMessage({ id: 10 })} isOwn={false} isBookmarked={false} />);
      await userEvent.click(screen.getByRole('button', { name: 'ブックマーク' }));
      await waitFor(() => {
        expect(mockBookmarksAdd).toHaveBeenCalledTimes(1);
        expect(mockBookmarksAdd).toHaveBeenCalledWith(10);
      });
    });

    it('ブックマーク解除ボタンをクリックすると api.bookmarks.remove が呼ばれ状態が更新される', async () => {
      render(<MessageActions message={makeMessage({ id: 10 })} isOwn={false} isBookmarked={true} />);
      await userEvent.click(screen.getByRole('button', { name: 'ブックマーク解除' }));
      await waitFor(() => {
        expect(mockBookmarksRemove).toHaveBeenCalledTimes(1);
      });
    });

    it('ブックマーク API が失敗したとき状態を変更しない', async () => {
      mockBookmarksAdd.mockRejectedValue(new Error('fail'));
      render(<MessageActions message={makeMessage()} isOwn={false} isBookmarked={false} />);
      await userEvent.click(screen.getByRole('button', { name: 'ブックマーク' }));
      // エラー後もブックマークボタンのまま（解除ボタンに変わらない）
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'ブックマーク解除' })).not.toBeInTheDocument();
      });
    });

    it('ブックマーク変更後に onBookmarkChange コールバックが呼ばれる', async () => {
      const onBookmarkChange = vi.fn();
      render(
        <MessageActions
          message={makeMessage({ id: 7 })}
          isOwn={false}
          isBookmarked={false}
          onBookmarkChange={onBookmarkChange}
        />,
      );
      await userEvent.click(screen.getByRole('button', { name: 'ブックマーク' }));
      await waitFor(() => {
        expect(onBookmarkChange).toHaveBeenCalledWith(7, true);
      });
    });
  });

  describe('リマインダー', () => {
    it('リマインダー設定ボタンをクリックすると ReminderDialog が開く', async () => {
      render(<MessageActions message={makeMessage()} isOwn={false} />);
      await userEvent.click(screen.getByRole('button', { name: 'リマインダー設定' }));
      expect(screen.getByTestId('reminder-dialog')).toBeInTheDocument();
    });
  });

  describe('リンクコピー', () => {
    it('リンクコピーボタンをクリックすると navigator.clipboard.writeText が #message-{id} と ?channel={channelId} を含む URL で呼ばれる', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
        writable: true,
      });
      render(<MessageActions message={makeMessage({ id: 42, channelId: 5 })} isOwn={false} />);
      await userEvent.click(screen.getByRole('button', { name: 'リンクをコピー' }));
      expect(writeText).toHaveBeenCalledOnce();
      const url = writeText.mock.calls[0][0] as string;
      expect(url).toMatch(/#message-42$/);
      expect(url).toMatch(/[?&]channel=5/);
    });
  });

  describe('編集', () => {
    it('Edit ボタンをクリックすると onEdit コールバックが呼ばれる', async () => {
      const onEdit = vi.fn();
      render(<MessageActions message={makeMessage()} isOwn={true} onEdit={onEdit} />);
      await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
      expect(onEdit).toHaveBeenCalledTimes(1);
    });
  });

  describe('削除', () => {
    it('Delete ボタンをクリックすると socket.emit("delete_message") が呼ばれる', async () => {
      render(<MessageActions message={makeMessage({ id: 99 })} isOwn={true} />);
      await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
      expect(mockSocket.emit).toHaveBeenCalledWith('delete_message', 99);
    });
  });

  describe('リアクション', () => {
    it('リアクション追加ボタンをクリックすると EmojiPicker が表示される', async () => {
      render(<MessageActions message={makeMessage()} isOwn={false} />);
      await userEvent.click(screen.getByRole('button', { name: 'リアクションを追加' }));
      expect(screen.getByTestId('emoji-picker')).toBeInTheDocument();
    });
  });
});
