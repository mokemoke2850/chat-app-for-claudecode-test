/**
 * components/Chat/MessageActions.tsx のユニットテスト
 *
 * テスト対象: メッセージに対するアクションボタン群
 * テスト戦略:
 *   - リファクタ後の構成（直置きアイコン4個 + 3点メニュー）を検証する
 *   - 3点メニューは「その他のアクション」ボタンをクリックして開く
 *   - ブックマーク・ピン留めは状態によりラベル/アイコンが変わる
 *   - 編集・削除は自分のメッセージのみ、通報は他人のメッセージのみ表示される
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MessageActions from '../components/Chat/MessageActions';
import { makeMessage } from './__fixtures__/messages';

// react-router-dom の useNavigate をモック（#355 Wikiページ化の遷移検証用）
const mockNavigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

// Socket モック
const mockSocket = { emit: vi.fn(), on: vi.fn(), off: vi.fn() };
vi.mock('../contexts/SocketContext', () => ({
  useSocket: () => mockSocket,
}));

// EmojiPicker モック
vi.mock('../components/Chat/EmojiPicker', () => ({
  default: ({
    anchorEl,
    onSelect,
  }: {
    anchorEl: HTMLElement | null;
    onSelect: (e: string) => void;
  }) =>
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
const mockPinCategoriesList = vi.fn();
vi.mock('../api/client', () => ({
  api: {
    bookmarks: {
      add: (id: number) => mockBookmarksAdd(id),
      remove: (id: number) => mockBookmarksRemove(id),
    },
    messages: {
      forward: vi.fn().mockResolvedValue({ message: { id: 99 } }),
    },
    pins: {
      listCategories: (channelId: number) => mockPinCategoriesList(channelId),
    },
  },
}));

// CreateTaskDialog モック
vi.mock('../components/Task/CreateTaskDialog', () => ({
  default: ({
    open,
    onClose,
    sourceMessageId,
  }: {
    open: boolean;
    onClose: () => void;
    sourceMessageId?: number | null;
  }) =>
    open ? (
      <div data-testid="create-task-dialog" data-source-message-id={sourceMessageId ?? ''}>
        <button onClick={onClose}>close-task</button>
      </div>
    ) : null,
}));

// ForwardMessageDialog モック（チャンネル一覧を必要とするため簡略化）
vi.mock('../components/Chat/ForwardMessageDialog', () => ({
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div data-testid="forward-dialog">
        <button onClick={onClose}>close-forward</button>
      </div>
    ) : null,
}));

// ReportMessageDialog モック
vi.mock('../components/Chat/ReportMessageDialog', () => ({
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div data-testid="report-dialog">
        <button onClick={onClose}>close-report</button>
      </div>
    ) : null,
}));

beforeEach(() => {
  vi.resetAllMocks();
  mockBookmarksAdd.mockResolvedValue(undefined);
  mockBookmarksRemove.mockResolvedValue(undefined);
  mockPinCategoriesList.mockResolvedValue({
    categories: [{ id: 3, channelId: 1, name: '決定事項', isDefault: true, position: 0 }],
  });
  // jsdom には navigator.clipboard が存在しないためモックで補完する
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});

/** 3点メニューを開くヘルパー */
async function openMenu() {
  await userEvent.click(screen.getByRole('button', { name: 'その他のアクション' }));
}

describe('MessageActions', () => {
  // ----------------------------------------------------------------
  // 直置きアイコン（常時4個）
  // ----------------------------------------------------------------
  describe('直置きアイコン（4個）の表示', () => {
    it('リアクション追加ボタンが表示される', () => {
      render(<MessageActions message={makeMessage()} isOwn={false} />);
      expect(screen.getByRole('button', { name: 'リアクションを追加' })).toBeInTheDocument();
    });

    it('返信（スレッド）ボタンが表示される', () => {
      render(<MessageActions message={makeMessage()} isOwn={false} />);
      expect(screen.getByRole('button', { name: '返信' })).toBeInTheDocument();
    });

    it('isOwn=true のとき編集ボタンが直置きで表示される', () => {
      render(<MessageActions message={makeMessage()} isOwn={true} />);
      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    });

    it('isOwn=true のとき削除ボタンが直置きで表示される', () => {
      render(<MessageActions message={makeMessage()} isOwn={true} />);
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });

    it('isOwn=false のとき編集ボタンが表示されない', () => {
      render(<MessageActions message={makeMessage()} isOwn={false} />);
      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    });

    it('isOwn=false のとき削除ボタンが表示されない', () => {
      render(<MessageActions message={makeMessage()} isOwn={false} />);
      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    });

    it('3点メニューボタン（その他のアクション）が表示される', () => {
      render(<MessageActions message={makeMessage()} isOwn={false} />);
      expect(screen.getByRole('button', { name: 'その他のアクション' })).toBeInTheDocument();
    });

    it('引用返信・転送・ピン留め・ブックマーク等のアイコンが直置きには存在しない', () => {
      render(<MessageActions message={makeMessage()} isOwn={false} />);
      expect(screen.queryByRole('button', { name: '引用返信' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '転送' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'ピン留め' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'ブックマーク' })).not.toBeInTheDocument();
    });
  });

  // ----------------------------------------------------------------
  // 3点メニューの開閉
  // ----------------------------------------------------------------
  describe('3点メニューの開閉', () => {
    it('初期状態ではメニューが閉じている', () => {
      render(<MessageActions message={makeMessage()} isOwn={false} />);
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('3点メニューボタンをクリックするとメニューが開く', async () => {
      render(<MessageActions message={makeMessage()} isOwn={false} />);
      await openMenu();
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('メニューを開いた後に項目をクリックするとメニューが閉じる', async () => {
      render(<MessageActions message={makeMessage()} isOwn={false} />);
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: /リンクをコピー/ }));
      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });

    it('メニューを開いた後に Escape キーを押すとメニューが閉じる', async () => {
      render(<MessageActions message={makeMessage()} isOwn={false} />);
      await openMenu();
      expect(screen.getByRole('menu')).toBeInTheDocument();
      await userEvent.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });
  });

  // ----------------------------------------------------------------
  // 3点メニュー内の項目（他人のメッセージ）
  // ----------------------------------------------------------------
  describe('3点メニュー内の項目（isOwn=false）', () => {
    it('引用返信の項目が表示される', async () => {
      render(<MessageActions message={makeMessage()} isOwn={false} />);
      await openMenu();
      expect(screen.getByRole('menuitem', { name: /引用返信/ })).toBeInTheDocument();
    });

    it('転送の項目が表示される', async () => {
      render(<MessageActions message={makeMessage()} isOwn={false} />);
      await openMenu();
      expect(screen.getByRole('menuitem', { name: /転送/ })).toBeInTheDocument();
    });

    it('ピン留め（またはピン留め解除）の項目が表示される', async () => {
      render(<MessageActions message={makeMessage()} isOwn={false} />);
      await openMenu();
      expect(screen.getByRole('menuitem', { name: /ピン留め/ })).toBeInTheDocument();
    });

    it('ブックマーク（またはブックマーク解除）の項目が表示される', async () => {
      render(<MessageActions message={makeMessage()} isOwn={false} />);
      await openMenu();
      expect(screen.getByRole('menuitem', { name: /ブックマーク/ })).toBeInTheDocument();
    });

    it('リマインダー設定の項目が表示される', async () => {
      render(<MessageActions message={makeMessage()} isOwn={false} />);
      await openMenu();
      expect(screen.getByRole('menuitem', { name: /リマインダー設定/ })).toBeInTheDocument();
    });

    it('リンクをコピーの項目が表示される', async () => {
      render(<MessageActions message={makeMessage()} isOwn={false} />);
      await openMenu();
      expect(screen.getByRole('menuitem', { name: /リンクをコピー/ })).toBeInTheDocument();
    });

    it('タグを編集の項目が表示される', async () => {
      render(<MessageActions message={makeMessage()} isOwn={false} />);
      await openMenu();
      expect(screen.getByRole('menuitem', { name: /タグを編集/ })).toBeInTheDocument();
    });

    it('通報の項目が表示される', async () => {
      render(<MessageActions message={makeMessage()} isOwn={false} />);
      await openMenu();
      expect(screen.getByRole('menuitem', { name: /通報/ })).toBeInTheDocument();
    });
  });

  // ----------------------------------------------------------------
  // 3点メニュー内の各アクション動作
  // ----------------------------------------------------------------
  describe('引用返信（メニュー経由）', () => {
    it('メニューの引用返信をクリックすると onQuoteReply が message を引数に呼ばれる', async () => {
      const onQuoteReply = vi.fn();
      const message = makeMessage();
      render(<MessageActions message={message} isOwn={false} onQuoteReply={onQuoteReply} />);
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: /引用返信/ }));
      expect(onQuoteReply).toHaveBeenCalledWith(message);
    });

    it('引用返信クリック後にメニューが閉じる', async () => {
      render(<MessageActions message={makeMessage()} isOwn={false} onQuoteReply={vi.fn()} />);
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: /引用返信/ }));
      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });
  });

  describe('転送（メニュー経由）', () => {
    it('メニューの転送をクリックすると ForwardMessageDialog が開く', async () => {
      render(<MessageActions message={makeMessage()} isOwn={false} />);
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: /転送/ }));
      expect(screen.getByTestId('forward-dialog')).toBeInTheDocument();
    });

    it('転送クリック後にメニューが閉じる', async () => {
      render(<MessageActions message={makeMessage()} isOwn={false} />);
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: /転送/ }));
      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });
  });

  describe('ピン留め（メニュー経由）', () => {
    it('isPinned=false のとき「ピン留め」ラベルのメニュー項目を表示する', async () => {
      render(<MessageActions message={makeMessage()} isOwn={false} isPinned={false} />);
      await openMenu();
      expect(screen.getByRole('menuitem', { name: 'ピン留め' })).toBeInTheDocument();
    });

    it('isPinned=true のとき「ピン留めを解除」ラベルのメニュー項目を表示する', async () => {
      render(<MessageActions message={makeMessage()} isOwn={false} isPinned={true} />);
      await openMenu();
      expect(screen.getByRole('menuitem', { name: 'ピン留めを解除' })).toBeInTheDocument();
    });

    it('ピン留めクリック後にメニューが閉じる', async () => {
      render(
        <MessageActions
          message={makeMessage()}
          isOwn={false}
          isPinned={false}
          onPinMessage={vi.fn()}
        />,
      );
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: 'ピン留め' }));
      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });

    it('未ピン留めメッセージではピン留め時にカテゴリ選択ダイアログを開く', async () => {
      render(<MessageActions message={makeMessage()} isOwn={false} onPinMessage={vi.fn()} />);
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: 'ピン留め' }));
      expect(
        await screen.findByRole('dialog', { name: 'ピン留めカテゴリを選択' }),
      ).toBeInTheDocument();
    });

    it('未分類を選んで確定するとカテゴリなしでピン留めを依頼する', async () => {
      const onPinMessage = vi.fn();
      render(
        <MessageActions
          message={makeMessage({ id: 7 })}
          isOwn={false}
          onPinMessage={onPinMessage}
        />,
      );
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: 'ピン留め' }));
      await userEvent.click(await screen.findByRole('button', { name: 'ピン留めする' }));
      expect(onPinMessage).toHaveBeenCalledWith(7, null);
    });

    it('カテゴリを選んで確定すると選択したカテゴリIDでピン留めを依頼する', async () => {
      const onPinMessage = vi.fn();
      render(
        <MessageActions
          message={makeMessage({ id: 8 })}
          isOwn={false}
          onPinMessage={onPinMessage}
        />,
      );
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: 'ピン留め' }));
      await userEvent.click(await screen.findByRole('radio', { name: '決定事項' }));
      await userEvent.click(screen.getByRole('button', { name: 'ピン留めする' }));
      expect(onPinMessage).toHaveBeenCalledWith(8, 3);
    });

    it('ピン留め済みメッセージはカテゴリ選択を開かず従来どおり解除を依頼する', async () => {
      const onPinMessage = vi.fn();
      const onUnpinMessage = vi.fn();
      render(
        <MessageActions
          message={makeMessage({ id: 9 })}
          isOwn={false}
          isPinned
          onPinMessage={onPinMessage}
          onUnpinMessage={onUnpinMessage}
        />,
      );
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: 'ピン留めを解除' }));
      expect(onUnpinMessage).toHaveBeenCalledWith(9);
      expect(onPinMessage).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('カテゴリ一覧の取得に失敗した場合はエラーを表示してピン留めを依頼しない', async () => {
      const onPinMessage = vi.fn();
      mockPinCategoriesList.mockRejectedValueOnce(new Error('failed'));
      render(<MessageActions message={makeMessage()} isOwn={false} onPinMessage={onPinMessage} />);
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: 'ピン留め' }));
      await waitFor(() => expect(mockPinCategoriesList).toHaveBeenCalled());
      expect(onPinMessage).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('ブックマーク（メニュー経由）', () => {
    it('isBookmarked=false のとき「ブックマーク」ラベルのメニュー項目を表示する', async () => {
      render(<MessageActions message={makeMessage()} isOwn={false} isBookmarked={false} />);
      await openMenu();
      expect(screen.getByRole('menuitem', { name: 'ブックマーク' })).toBeInTheDocument();
    });

    it('isBookmarked=true のとき「ブックマーク解除」ラベルのメニュー項目を表示する', async () => {
      render(<MessageActions message={makeMessage()} isOwn={false} isBookmarked={true} />);
      await openMenu();
      expect(screen.getByRole('menuitem', { name: 'ブックマーク解除' })).toBeInTheDocument();
    });

    it('メニューのブックマークをクリックすると api.bookmarks.add が呼ばれ状態が更新される', async () => {
      render(
        <MessageActions message={makeMessage({ id: 3 })} isOwn={false} isBookmarked={false} />,
      );
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: 'ブックマーク' }));
      await waitFor(() => {
        expect(mockBookmarksAdd).toHaveBeenCalledWith(3);
      });
      await openMenu();
      expect(screen.getByRole('menuitem', { name: 'ブックマーク解除' })).toBeInTheDocument();
    });

    it('メニューのブックマーク解除をクリックすると api.bookmarks.remove が呼ばれ状態が更新される', async () => {
      render(<MessageActions message={makeMessage({ id: 4 })} isOwn={false} isBookmarked={true} />);
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: 'ブックマーク解除' }));
      await waitFor(() => {
        expect(mockBookmarksRemove).toHaveBeenCalledWith(4);
      });
      await openMenu();
      expect(screen.getByRole('menuitem', { name: 'ブックマーク' })).toBeInTheDocument();
    });

    it('ブックマーク API が失敗したとき状態を変更しない', async () => {
      mockBookmarksAdd.mockRejectedValueOnce(new Error('API error'));
      render(
        <MessageActions message={makeMessage({ id: 5 })} isOwn={false} isBookmarked={false} />,
      );
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: 'ブックマーク' }));
      await waitFor(() => {
        expect(mockBookmarksAdd).toHaveBeenCalledWith(5);
      });
      await openMenu();
      expect(screen.getByRole('menuitem', { name: 'ブックマーク' })).toBeInTheDocument();
    });

    it('ブックマーク変更後に onBookmarkChange コールバックが呼ばれる', async () => {
      const onBookmarkChange = vi.fn();
      render(
        <MessageActions
          message={makeMessage({ id: 6 })}
          isOwn={false}
          isBookmarked={false}
          onBookmarkChange={onBookmarkChange}
        />,
      );
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: 'ブックマーク' }));
      await waitFor(() => {
        expect(onBookmarkChange).toHaveBeenCalledWith(6, true);
      });
    });

    it('ブックマーククリック後にメニューが閉じる', async () => {
      render(<MessageActions message={makeMessage()} isOwn={false} isBookmarked={false} />);
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: 'ブックマーク' }));
      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });
  });

  describe('リマインダー設定（メニュー経由）', () => {
    it('メニューのリマインダー設定をクリックすると ReminderDialog が開く', async () => {
      render(<MessageActions message={makeMessage()} isOwn={false} />);
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: /リマインダー設定/ }));
      expect(screen.getByTestId('reminder-dialog')).toBeInTheDocument();
    });

    it('リマインダー設定クリック後にメニューが閉じる', async () => {
      render(<MessageActions message={makeMessage()} isOwn={false} />);
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: /リマインダー設定/ }));
      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });
  });

  describe('リンクコピー（メニュー経由）', () => {
    it('メニューのリンクをコピーをクリックすると navigator.clipboard.writeText が ?channel={channelId}&message={id} 形式の URL で呼ばれる', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });
      const message = makeMessage({ id: 10, channelId: 2 });
      render(<MessageActions message={message} isOwn={false} />);
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: /リンクをコピー/ }));
      await waitFor(() => {
        expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/\?channel=2&message=10/));
      });
    });

    it('リンクコピークリック後にメニューが閉じる', async () => {
      Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
      render(<MessageActions message={makeMessage()} isOwn={false} />);
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: /リンクをコピー/ }));
      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });
  });

  describe('タグを編集（メニュー経由）', () => {
    it('メニューのタグを編集をクリックすると onEditTags コールバックが呼ばれる', async () => {
      const onEditTags = vi.fn();
      render(<MessageActions message={makeMessage()} isOwn={false} onEditTags={onEditTags} />);
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: /タグを編集/ }));
      expect(onEditTags).toHaveBeenCalled();
    });

    it('タグ編集クリック後にメニューが閉じる', async () => {
      render(<MessageActions message={makeMessage()} isOwn={false} onEditTags={vi.fn()} />);
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: /タグを編集/ }));
      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });
  });

  describe('通報（メニュー経由）', () => {
    it('isOwn=false のとき「通報」メニュー項目が表示される', async () => {
      render(<MessageActions message={makeMessage()} isOwn={false} />);
      await openMenu();
      expect(screen.getByRole('menuitem', { name: /通報/ })).toBeInTheDocument();
    });

    it('isOwn=true のとき「通報」メニュー項目が表示されない', async () => {
      render(<MessageActions message={makeMessage()} isOwn={true} />);
      await openMenu();
      expect(screen.queryByRole('menuitem', { name: /通報/ })).not.toBeInTheDocument();
    });

    it('メニューの通報をクリックすると ReportMessageDialog が開く', async () => {
      render(<MessageActions message={makeMessage()} isOwn={false} />);
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: /通報/ }));
      expect(screen.getByTestId('report-dialog')).toBeInTheDocument();
    });

    it('通報クリック後にメニューが閉じる', async () => {
      render(<MessageActions message={makeMessage()} isOwn={false} />);
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: /通報/ }));
      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });
  });

  // ----------------------------------------------------------------
  // 直置きアイコンのアクション動作（引き続き直置きのもの）
  // ----------------------------------------------------------------
  describe('リアクション（直置きアイコン）', () => {
    it('リアクション追加ボタンをクリックすると EmojiPicker が表示される', async () => {
      render(<MessageActions message={makeMessage()} isOwn={false} />);
      await userEvent.click(screen.getByRole('button', { name: 'リアクションを追加' }));
      expect(screen.getByTestId('emoji-picker')).toBeInTheDocument();
    });

    it('EmojiPicker で絵文字を選択すると socket.emit("add_reaction") が呼ばれる', async () => {
      render(<MessageActions message={makeMessage({ id: 1 })} isOwn={false} />);
      await userEvent.click(screen.getByRole('button', { name: 'リアクションを追加' }));
      await userEvent.click(screen.getByText('emoji'));
      expect(mockSocket.emit).toHaveBeenCalledWith('add_reaction', { messageId: 1, emoji: '😀' });
    });
  });

  describe('スレッド返信（直置きアイコン）', () => {
    it('返信ボタンをクリックすると onOpenThread が message.id を引数に呼ばれる', async () => {
      const onOpenThread = vi.fn();
      render(
        <MessageActions
          message={makeMessage({ id: 8 })}
          isOwn={false}
          onOpenThread={onOpenThread}
        />,
      );
      await userEvent.click(screen.getByRole('button', { name: '返信' }));
      expect(onOpenThread).toHaveBeenCalledWith(8);
    });
  });

  describe('編集（直置きアイコン）', () => {
    it('編集ボタンをクリックすると onEdit コールバックが呼ばれる', async () => {
      const onEdit = vi.fn();
      render(<MessageActions message={makeMessage()} isOwn={true} onEdit={onEdit} />);
      await userEvent.click(screen.getByRole('button', { name: /edit/i }));
      expect(onEdit).toHaveBeenCalled();
    });
  });

  describe('削除（直置きアイコン）', () => {
    it('削除ボタンをクリックすると socket.emit("delete_message") が呼ばれる', async () => {
      render(<MessageActions message={makeMessage({ id: 9 })} isOwn={true} />);
      await userEvent.click(screen.getByRole('button', { name: /delete/i }));
      expect(mockSocket.emit).toHaveBeenCalledWith('delete_message', 9);
    });
  });

  // ----------------------------------------------------------------
  // タスク化（3点メニュー）#151
  // ----------------------------------------------------------------
  describe('タスク化（メニュー経由）', () => {
    it('3点メニューに「タスク化」メニュー項目が表示される', async () => {
      render(<MessageActions message={makeMessage()} isOwn={false} />);
      await openMenu();
      expect(screen.getByRole('menuitem', { name: /タスク化/ })).toBeInTheDocument();
    });

    it('「タスク化」をクリックすると CreateTaskDialog が開く', async () => {
      render(<MessageActions message={makeMessage()} isOwn={false} />);
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: /タスク化/ }));
      expect(screen.getByTestId('create-task-dialog')).toBeInTheDocument();
    });

    it('「タスク化」をクリックすると source_message_id に message.id がセットされた状態でダイアログが開く', async () => {
      const message = makeMessage({ id: 42 });
      render(<MessageActions message={message} isOwn={false} />);
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: /タスク化/ }));
      const dialog = screen.getByTestId('create-task-dialog');
      expect(dialog.getAttribute('data-source-message-id')).toBe('42');
    });

    it('「タスク化」クリック後にメニューが閉じる', async () => {
      render(<MessageActions message={makeMessage()} isOwn={false} />);
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: /タスク化/ }));
      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });
  });

  // Wikiページ化（3点メニュー）#355
  describe('Wikiページ化（メニュー経由）', () => {
    it('3点メニューに「Wikiページ化」メニュー項目が表示される', async () => {
      render(<MessageActions message={makeMessage()} isOwn={false} />);
      await openMenu();
      expect(screen.getByRole('menuitem', { name: /Wikiページ化/ })).toBeInTheDocument();
    });

    it('「Wikiページ化」をクリックするとWikiタブ（newWiki=1）かつfromMessage付きURLに遷移する', async () => {
      const message = makeMessage({ id: 42, channelId: 7, content: 'メッセージ本文' });
      render(<MessageActions message={message} isOwn={false} />);
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: /Wikiページ化/ }));
      // sessionStorage にプリフィル情報が入る
      const stored = sessionStorage.getItem('wiki.fromMessage.42');
      expect(stored).not.toBeNull();
      expect(JSON.parse(stored as string).content).toBe('メッセージ本文');
      // React Router の navigate で wiki タブに遷移する
      expect(mockNavigate).toHaveBeenCalledWith('/chat?channel=7&newWiki=1&fromMessage=42');
      sessionStorage.removeItem('wiki.fromMessage.42');
    });

    it('「Wikiページ化」クリック後にメニューが閉じる', async () => {
      render(<MessageActions message={makeMessage()} isOwn={false} />);
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: /Wikiページ化/ }));
      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });
  });
});
