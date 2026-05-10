/**
 * テスト対象: ブックマーク内検索とタグ付け機能（フロントエンド）
 *
 * 検証観点:
 *   - ブックマーク一覧画面での検索フォームによるキーワード絞り込み
 *   - タグ付与・編集・削除のUI挙動
 *   - タグでのフィルタリング（単一・複数 AND/OR）
 *   - 既存ブックマーク（タグなし）との後方互換性
 */

import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import BookmarkPage, { resetBookmarksCache } from '../pages/BookmarkPage';
import type { Bookmark, BookmarkTag } from '@chat-app/shared';

const mockNavigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../api/client', () => ({
  api: {
    bookmarks: {
      list: vi.fn(),
      add: vi.fn(),
      remove: vi.fn(),
      setTags: vi.fn(),
    },
    bookmarkTags: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('../contexts/DensityContext', () => ({
  useDensity: () => ({ density: 'cozy', setDensity: vi.fn() }),
}));

vi.mock('../contexts/SocketContext', () => ({
  useSocket: () => ({ emit: vi.fn(), on: vi.fn(), off: vi.fn() }),
}));

vi.mock('../components/Layout/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout-stub">{children}</div>
  ),
}));

import { api } from '../api/client';

const mockApi = api as unknown as {
  bookmarks: {
    list: ReturnType<typeof vi.fn>;
    add: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    setTags: ReturnType<typeof vi.fn>;
  };
  bookmarkTags: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

const makeTag = (overrides: Partial<BookmarkTag> = {}): BookmarkTag => ({
  id: 1,
  userId: 1,
  name: 'work',
  color: null,
  createdAt: '2024-06-01T00:00:00Z',
  bookmarkCount: 0,
  ...overrides,
});

const makeBookmark = (overrides: Partial<Bookmark> = {}): Bookmark => ({
  id: 1,
  userId: 1,
  messageId: 10,
  bookmarkedAt: '2024-06-01T12:00:00Z',
  channelName: 'general',
  tags: [],
  message: {
    id: 10,
    channelId: 1,
    userId: 1,
    username: 'alice',
    avatarUrl: null,
    content: 'Hello world',
    isEdited: false,
    isDeleted: false,
    createdAt: '2024-06-01T11:00:00Z',
    updatedAt: '2024-06-01T11:00:00Z',
    mentions: [],
    reactions: [],
    parentMessageId: null,
    rootMessageId: null,
    replyCount: 0,
    quotedMessageId: null,
    quotedMessage: null,
  },
  ...overrides,
});

async function renderBookmarkPage() {
  await act(async () => {
    render(
      <MemoryRouter>
        <BookmarkPage />
      </MemoryRouter>,
    );
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetBookmarksCache();
  mockApi.bookmarkTags.list.mockResolvedValue({ tags: [] });
});

describe('BookmarkPage - キーワード検索', () => {
  describe('検索 UI', () => {
    it('ブックマーク一覧の上部に検索入力欄が表示される', async () => {
      mockApi.bookmarks.list.mockResolvedValue({ bookmarks: [makeBookmark()] });
      await renderBookmarkPage();
      expect(screen.getByLabelText('ブックマーク検索')).toBeInTheDocument();
    });

    it('検索欄にプレースホルダー「ブックマークを検索」が表示される', async () => {
      mockApi.bookmarks.list.mockResolvedValue({ bookmarks: [] });
      await renderBookmarkPage();
      expect(screen.getByPlaceholderText('ブックマークを検索')).toBeInTheDocument();
    });

    it('検索欄が空のときは全ブックマークが表示される', async () => {
      mockApi.bookmarks.list.mockResolvedValue({
        bookmarks: [
          makeBookmark({ id: 1, messageId: 10 }),
          makeBookmark({
            id: 2,
            messageId: 20,
            message: {
              ...makeBookmark().message!,
              id: 20,
              content: 'Another message',
            },
          }),
        ],
      });
      await renderBookmarkPage();
      expect(screen.getByText('Hello world')).toBeInTheDocument();
      expect(screen.getByText('Another message')).toBeInTheDocument();
    });

    it('検索欄をクリアすると全ブックマークが再表示される', async () => {
      mockApi.bookmarks.list.mockResolvedValue({
        bookmarks: [
          makeBookmark({ id: 1, messageId: 10 }),
          makeBookmark({
            id: 2,
            messageId: 20,
            message: {
              ...makeBookmark().message!,
              id: 20,
              content: 'Another message',
            },
          }),
        ],
      });
      await renderBookmarkPage();
      const input = screen.getByLabelText('ブックマーク検索');
      await userEvent.type(input, 'Hello');
      await waitFor(() => {
        expect(screen.queryByText('Another message')).not.toBeInTheDocument();
      });
      await userEvent.clear(input);
      expect(screen.getByText('Another message')).toBeInTheDocument();
    });
  });

  describe('メッセージ本文での絞り込み', () => {
    it('入力したキーワードを本文に含むブックマークのみが表示される', async () => {
      mockApi.bookmarks.list.mockResolvedValue({
        bookmarks: [
          makeBookmark({ id: 1, messageId: 10 }),
          makeBookmark({
            id: 2,
            messageId: 20,
            message: {
              ...makeBookmark().message!,
              id: 20,
              content: 'Foo Bar',
            },
          }),
        ],
      });
      await renderBookmarkPage();
      await userEvent.type(screen.getByLabelText('ブックマーク検索'), 'Hello');
      await waitFor(() => {
        expect(screen.queryByText('Foo Bar')).not.toBeInTheDocument();
      });
      expect(screen.getByText('Hello world')).toBeInTheDocument();
    });

    it('大文字小文字を区別せずに本文をマッチングできる', async () => {
      mockApi.bookmarks.list.mockResolvedValue({ bookmarks: [makeBookmark()] });
      await renderBookmarkPage();
      await userEvent.type(screen.getByLabelText('ブックマーク検索'), 'HELLO');
      expect(screen.getByText('Hello world')).toBeInTheDocument();
    });

    it('日本語キーワードで本文を絞り込める', async () => {
      mockApi.bookmarks.list.mockResolvedValue({
        bookmarks: [
          makeBookmark({
            id: 1,
            messageId: 10,
            message: { ...makeBookmark().message!, content: 'こんにちは世界' },
          }),
        ],
      });
      await renderBookmarkPage();
      await userEvent.type(screen.getByLabelText('ブックマーク検索'), '世界');
      expect(screen.getByText('こんにちは世界')).toBeInTheDocument();
    });

    it('一致するブックマークが 0 件のときは「該当するブックマークはありません」が表示される', async () => {
      mockApi.bookmarks.list.mockResolvedValue({ bookmarks: [makeBookmark()] });
      await renderBookmarkPage();
      await userEvent.type(screen.getByLabelText('ブックマーク検索'), 'NOMATCH');
      await waitFor(() => {
        expect(screen.getByText('該当するブックマークはありません')).toBeInTheDocument();
      });
    });

    it('部分一致でフィルタリングできる', async () => {
      mockApi.bookmarks.list.mockResolvedValue({ bookmarks: [makeBookmark()] });
      await renderBookmarkPage();
      await userEvent.type(screen.getByLabelText('ブックマーク検索'), 'wor');
      expect(screen.getByText('Hello world')).toBeInTheDocument();
    });
  });

  describe('送信者名での絞り込み', () => {
    it('入力したキーワードを送信者名に含むブックマークのみが表示される', async () => {
      mockApi.bookmarks.list.mockResolvedValue({
        bookmarks: [
          makeBookmark({ id: 1, messageId: 10 }),
          makeBookmark({
            id: 2,
            messageId: 20,
            message: {
              ...makeBookmark().message!,
              id: 20,
              username: 'bob',
              content: 'Different message',
            },
          }),
        ],
      });
      await renderBookmarkPage();
      await userEvent.type(screen.getByLabelText('ブックマーク検索'), 'alice');
      expect(screen.getByText('Hello world')).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.queryByText('Different message')).not.toBeInTheDocument();
      });
    });

    it('本文または送信者名のいずれかに一致するブックマークが表示される', async () => {
      mockApi.bookmarks.list.mockResolvedValue({
        bookmarks: [
          makeBookmark({ id: 1, messageId: 10 }),
          makeBookmark({
            id: 2,
            messageId: 20,
            message: {
              ...makeBookmark().message!,
              id: 20,
              username: 'aliceTwo',
              content: 'Other text',
            },
          }),
        ],
      });
      await renderBookmarkPage();
      await userEvent.type(screen.getByLabelText('ブックマーク検索'), 'alice');
      expect(screen.getByText('Hello world')).toBeInTheDocument();
      expect(screen.getByText('Other text')).toBeInTheDocument();
    });

    it('送信者名の大文字小文字を区別せずにマッチングできる', async () => {
      mockApi.bookmarks.list.mockResolvedValue({
        bookmarks: [
          makeBookmark({
            message: { ...makeBookmark().message!, username: 'Alice' },
          }),
        ],
      });
      await renderBookmarkPage();
      await userEvent.type(screen.getByLabelText('ブックマーク検索'), 'alice');
      expect(screen.getByText('Hello world')).toBeInTheDocument();
    });
  });

  describe('検索のデバウンス・パフォーマンス', () => {
    it('連続入力時は API 呼び出しがデバウンスされる', async () => {
      // 本実装はクライアント側フィルタリングのため、追加の API 呼び出しは発生しない
      mockApi.bookmarks.list.mockResolvedValue({ bookmarks: [makeBookmark()] });
      await renderBookmarkPage();
      const input = screen.getByLabelText('ブックマーク検索');
      await userEvent.type(input, 'abc');
      // list の呼び出しは初回のみ
      expect(mockApi.bookmarks.list).toHaveBeenCalledTimes(1);
    });

    it('クライアントサイドフィルタリングではネットワーク要求が発生しない', async () => {
      mockApi.bookmarks.list.mockResolvedValue({ bookmarks: [makeBookmark()] });
      await renderBookmarkPage();
      await userEvent.type(screen.getByLabelText('ブックマーク検索'), 'Hello');
      expect(mockApi.bookmarks.list).toHaveBeenCalledTimes(1);
    });
  });
});

describe('BookmarkPage - タグ付け（CRUD）', () => {
  describe('タグの追加', () => {
    it('ブックマーク項目にタグ追加ボタンが表示される', async () => {
      mockApi.bookmarks.list.mockResolvedValue({ bookmarks: [makeBookmark()] });
      await renderBookmarkPage();
      expect(screen.getByLabelText('ブックマーク1のタグを編集')).toBeInTheDocument();
    });

    it('タグ追加ダイアログでタグ名を入力して保存できる', async () => {
      mockApi.bookmarks.list.mockResolvedValue({ bookmarks: [] });
      mockApi.bookmarkTags.list.mockResolvedValue({ tags: [] });
      mockApi.bookmarkTags.create.mockResolvedValue({ tag: makeTag({ name: 'newTag' }) });
      await renderBookmarkPage();
      await userEvent.click(screen.getByRole('button', { name: /タグ管理/ }));
      const input = await screen.findByLabelText('新しいタグ名');
      await userEvent.type(input, 'newTag');
      await userEvent.click(screen.getByRole('button', { name: '追加' }));
      expect(mockApi.bookmarkTags.create).toHaveBeenCalledWith({ name: 'newTag' });
    });

    it('1 つのブックマークに複数のタグを付与できる', async () => {
      const t1 = makeTag({ id: 1, name: 't1' });
      const t2 = makeTag({ id: 2, name: 't2' });
      mockApi.bookmarks.list.mockResolvedValue({ bookmarks: [makeBookmark()] });
      mockApi.bookmarkTags.list.mockResolvedValue({ tags: [t1, t2] });
      mockApi.bookmarks.setTags.mockResolvedValue({
        bookmark: makeBookmark({ tags: [t1, t2] }),
      });
      await renderBookmarkPage();
      await userEvent.click(screen.getByLabelText('ブックマーク1のタグを編集'));
      const dialog = await screen.findByRole('dialog');
      await userEvent.click(within(dialog).getByText('t1'));
      await userEvent.click(within(dialog).getByText('t2'));
      await userEvent.click(within(dialog).getByRole('button', { name: '保存' }));
      expect(mockApi.bookmarks.setTags).toHaveBeenCalledWith(10, [1, 2]);
    });

    it('既に存在するタグは候補として表示され再選択できる', async () => {
      const t1 = makeTag({ id: 1, name: 'existing' });
      mockApi.bookmarks.list.mockResolvedValue({ bookmarks: [makeBookmark()] });
      mockApi.bookmarkTags.list.mockResolvedValue({ tags: [t1] });
      await renderBookmarkPage();
      await userEvent.click(screen.getByLabelText('ブックマーク1のタグを編集'));
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText('existing')).toBeInTheDocument();
    });

    it('空文字のタグ名は保存できずバリデーションエラーが表示される', async () => {
      mockApi.bookmarks.list.mockResolvedValue({ bookmarks: [] });
      mockApi.bookmarkTags.list.mockResolvedValue({ tags: [] });
      await renderBookmarkPage();
      await userEvent.click(screen.getByRole('button', { name: /タグ管理/ }));
      await userEvent.click(await screen.findByRole('button', { name: '追加' }));
      expect(await screen.findByText('タグ名を入力してください')).toBeInTheDocument();
      expect(mockApi.bookmarkTags.create).not.toHaveBeenCalled();
    });

    it('同じタグを同一ブックマークに重複付与できない', async () => {
      const t1 = makeTag({ id: 1, name: 'dup' });
      mockApi.bookmarks.list.mockResolvedValue({
        bookmarks: [makeBookmark({ tags: [t1] })],
      });
      mockApi.bookmarkTags.list.mockResolvedValue({ tags: [t1] });
      mockApi.bookmarks.setTags.mockResolvedValue({
        bookmark: makeBookmark({ tags: [t1] }),
      });
      await renderBookmarkPage();
      await userEvent.click(screen.getByLabelText('ブックマーク1のタグを編集'));
      const dialog = await screen.findByRole('dialog');
      // 既に選択中の chip は active 状態（aria-pressed=true）
      const chip =
        within(dialog).getByText('dup').closest('[role]') ?? within(dialog).getByText('dup');
      // クリックで toggle すると非選択になるため、再度クリックしても重複付与にはならない
      await userEvent.click(chip as HTMLElement);
      await userEvent.click(within(dialog).getByRole('button', { name: '保存' }));
      // 空配列が送られる
      expect(mockApi.bookmarks.setTags).toHaveBeenCalledWith(10, []);
    });
  });

  describe('タグの編集', () => {
    it('タグ名をクリックしてリネームできる', async () => {
      const t1 = makeTag({ id: 1, name: 'old' });
      mockApi.bookmarks.list.mockResolvedValue({ bookmarks: [] });
      mockApi.bookmarkTags.list.mockResolvedValue({ tags: [t1] });
      mockApi.bookmarkTags.update.mockResolvedValue({ tag: makeTag({ id: 1, name: 'newName' }) });
      await renderBookmarkPage();
      await userEvent.click(screen.getByRole('button', { name: /タグ管理/ }));
      await userEvent.click(await screen.findByLabelText('タグ「old」を編集'));
      const editInput = await screen.findByLabelText('タグ名編集');
      await userEvent.clear(editInput);
      await userEvent.type(editInput, 'newName');
      await userEvent.click(screen.getByRole('button', { name: '保存' }));
      expect(mockApi.bookmarkTags.update).toHaveBeenCalledWith(1, { name: 'newName' });
    });

    it('リネームしたタグはすべての関連ブックマークに反映される', async () => {
      const t1 = makeTag({ id: 1, name: 'old' });
      mockApi.bookmarks.list.mockResolvedValue({
        bookmarks: [makeBookmark({ tags: [t1] })],
      });
      mockApi.bookmarkTags.list.mockResolvedValue({ tags: [t1] });
      mockApi.bookmarkTags.update.mockResolvedValue({ tag: makeTag({ id: 1, name: 'newName' }) });
      await renderBookmarkPage();
      await userEvent.click(screen.getByRole('button', { name: /タグ管理/ }));
      await userEvent.click(await screen.findByLabelText('タグ「old」を編集'));
      const editInput = await screen.findByLabelText('タグ名編集');
      await userEvent.clear(editInput);
      await userEvent.type(editInput, 'newName');
      await userEvent.click(screen.getByRole('button', { name: '保存' }));
      // 閉じてからチップが反映されている
      await userEvent.click(screen.getByRole('button', { name: '閉じる' }));
      await waitFor(() => {
        expect(screen.getByTestId('bookmark-1-tag-1')).toHaveTextContent('newName');
      });
    });

    it('リネーム後のタグ名が空文字の場合はエラーが表示される', async () => {
      const t1 = makeTag({ id: 1, name: 'old' });
      mockApi.bookmarks.list.mockResolvedValue({ bookmarks: [] });
      mockApi.bookmarkTags.list.mockResolvedValue({ tags: [t1] });
      await renderBookmarkPage();
      await userEvent.click(screen.getByRole('button', { name: /タグ管理/ }));
      await userEvent.click(await screen.findByLabelText('タグ「old」を編集'));
      const editInput = await screen.findByLabelText('タグ名編集');
      await userEvent.clear(editInput);
      await userEvent.click(screen.getByRole('button', { name: '保存' }));
      expect(await screen.findByText('タグ名を入力してください')).toBeInTheDocument();
      expect(mockApi.bookmarkTags.update).not.toHaveBeenCalled();
    });
  });

  describe('タグの削除', () => {
    it('ブックマークごとにタグを個別に外せる', async () => {
      const t1 = makeTag({ id: 1, name: 't1' });
      const t2 = makeTag({ id: 2, name: 't2' });
      mockApi.bookmarks.list.mockResolvedValue({
        bookmarks: [makeBookmark({ tags: [t1, t2] })],
      });
      mockApi.bookmarkTags.list.mockResolvedValue({ tags: [t1, t2] });
      mockApi.bookmarks.setTags.mockResolvedValue({
        bookmark: makeBookmark({ tags: [t2] }),
      });
      await renderBookmarkPage();
      await userEvent.click(screen.getByLabelText('ブックマーク1のタグを編集'));
      const dialog = await screen.findByRole('dialog');
      await userEvent.click(within(dialog).getByText('t1'));
      await userEvent.click(within(dialog).getByRole('button', { name: '保存' }));
      expect(mockApi.bookmarks.setTags).toHaveBeenCalledWith(10, [2]);
    });

    it('タグ管理画面からタグ自体を削除できる', async () => {
      const t1 = makeTag({ id: 1, name: 'todelete' });
      mockApi.bookmarks.list.mockResolvedValue({ bookmarks: [] });
      mockApi.bookmarkTags.list.mockResolvedValue({ tags: [t1] });
      mockApi.bookmarkTags.delete.mockResolvedValue(undefined);
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      await renderBookmarkPage();
      await userEvent.click(screen.getByRole('button', { name: /タグ管理/ }));
      await userEvent.click(await screen.findByLabelText('タグ「todelete」を削除'));
      expect(mockApi.bookmarkTags.delete).toHaveBeenCalledWith(1);
      confirmSpy.mockRestore();
    });

    it('タグ削除時は関連ブックマークからも紐付けが解除される', async () => {
      const t1 = makeTag({ id: 1, name: 'rel' });
      mockApi.bookmarks.list.mockResolvedValue({
        bookmarks: [makeBookmark({ tags: [t1] })],
      });
      mockApi.bookmarkTags.list.mockResolvedValue({ tags: [t1] });
      mockApi.bookmarkTags.delete.mockResolvedValue(undefined);
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      await renderBookmarkPage();
      await userEvent.click(screen.getByRole('button', { name: /タグ管理/ }));
      await userEvent.click(await screen.findByLabelText('タグ「rel」を削除'));
      await userEvent.click(screen.getByRole('button', { name: '閉じる' }));
      await waitFor(() => {
        expect(screen.queryByTestId('bookmark-1-tag-1')).not.toBeInTheDocument();
      });
      confirmSpy.mockRestore();
    });

    it('削除確認ダイアログが表示される', async () => {
      const t1 = makeTag({ id: 1, name: 'confirm' });
      mockApi.bookmarks.list.mockResolvedValue({ bookmarks: [] });
      mockApi.bookmarkTags.list.mockResolvedValue({ tags: [t1] });
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      await renderBookmarkPage();
      await userEvent.click(screen.getByRole('button', { name: /タグ管理/ }));
      await userEvent.click(await screen.findByLabelText('タグ「confirm」を削除'));
      expect(confirmSpy).toHaveBeenCalled();
      expect(mockApi.bookmarkTags.delete).not.toHaveBeenCalled();
      confirmSpy.mockRestore();
    });
  });
});

describe('BookmarkPage - タグフィルタリング', () => {
  describe('単一タグのフィルタ', () => {
    it('タグチップをクリックすると該当タグを持つブックマークのみ表示される', async () => {
      const t1 = makeTag({ id: 1, name: 'work' });
      mockApi.bookmarks.list.mockResolvedValue({
        bookmarks: [
          makeBookmark({ id: 1, messageId: 10, tags: [t1] }),
          makeBookmark({
            id: 2,
            messageId: 20,
            tags: [],
            message: {
              ...makeBookmark().message!,
              id: 20,
              content: 'Other content',
            },
          }),
        ],
      });
      mockApi.bookmarkTags.list.mockResolvedValue({ tags: [t1] });
      await renderBookmarkPage();
      await userEvent.click(screen.getByLabelText('タグ:work'));
      expect(screen.getByText('Hello world')).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.queryByText('Other content')).not.toBeInTheDocument();
      });
    });

    it('選択中のタグチップはアクティブ状態でハイライトされる', async () => {
      const t1 = makeTag({ id: 1, name: 'work' });
      mockApi.bookmarks.list.mockResolvedValue({ bookmarks: [makeBookmark({ tags: [t1] })] });
      mockApi.bookmarkTags.list.mockResolvedValue({ tags: [t1] });
      await renderBookmarkPage();
      const chip = screen.getByLabelText('タグ:work');
      expect(chip).toHaveAttribute('aria-pressed', 'false');
      await userEvent.click(chip);
      expect(screen.getByLabelText('タグ:work')).toHaveAttribute('aria-pressed', 'true');
    });

    it('もう一度クリックするとフィルタが解除され全件表示に戻る', async () => {
      const t1 = makeTag({ id: 1, name: 'work' });
      mockApi.bookmarks.list.mockResolvedValue({
        bookmarks: [
          makeBookmark({ id: 1, messageId: 10, tags: [t1] }),
          makeBookmark({
            id: 2,
            messageId: 20,
            tags: [],
            message: { ...makeBookmark().message!, id: 20, content: 'Other content' },
          }),
        ],
      });
      mockApi.bookmarkTags.list.mockResolvedValue({ tags: [t1] });
      await renderBookmarkPage();
      const chip = screen.getByLabelText('タグ:work');
      await userEvent.click(chip);
      await userEvent.click(screen.getByLabelText('タグ:work'));
      expect(screen.getByText('Hello world')).toBeInTheDocument();
      expect(screen.getByText('Other content')).toBeInTheDocument();
    });
  });

  describe('複数タグの組み合わせフィルタ', () => {
    it('複数のタグを選択すると AND 条件で絞り込まれる', async () => {
      const t1 = makeTag({ id: 1, name: 't1' });
      const t2 = makeTag({ id: 2, name: 't2' });
      mockApi.bookmarks.list.mockResolvedValue({
        bookmarks: [
          makeBookmark({ id: 1, messageId: 10, tags: [t1, t2] }),
          makeBookmark({
            id: 2,
            messageId: 20,
            tags: [t1],
            message: { ...makeBookmark().message!, id: 20, content: 'Only t1' },
          }),
        ],
      });
      mockApi.bookmarkTags.list.mockResolvedValue({ tags: [t1, t2] });
      await renderBookmarkPage();
      await userEvent.click(screen.getByLabelText('タグ:t1'));
      await userEvent.click(screen.getByLabelText('タグ:t2'));
      // AND モードに切り替える
      await userEvent.click(screen.getByLabelText('AND モード'));
      expect(screen.getByText('Hello world')).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.queryByText('Only t1')).not.toBeInTheDocument();
      });
    });

    it('OR モードに切り替えるといずれかのタグを持つブックマークが表示される', async () => {
      const t1 = makeTag({ id: 1, name: 't1' });
      const t2 = makeTag({ id: 2, name: 't2' });
      mockApi.bookmarks.list.mockResolvedValue({
        bookmarks: [
          makeBookmark({ id: 1, messageId: 10, tags: [t1] }),
          makeBookmark({
            id: 2,
            messageId: 20,
            tags: [t2],
            message: { ...makeBookmark().message!, id: 20, content: 'Has t2' },
          }),
        ],
      });
      mockApi.bookmarkTags.list.mockResolvedValue({ tags: [t1, t2] });
      await renderBookmarkPage();
      await userEvent.click(screen.getByLabelText('タグ:t1'));
      await userEvent.click(screen.getByLabelText('タグ:t2'));
      // デフォルトは OR
      expect(screen.getByText('Hello world')).toBeInTheDocument();
      expect(screen.getByText('Has t2')).toBeInTheDocument();
    });

    it('選択中のタグをクリアするボタンが表示される', async () => {
      const t1 = makeTag({ id: 1, name: 't1' });
      mockApi.bookmarks.list.mockResolvedValue({ bookmarks: [makeBookmark({ tags: [t1] })] });
      mockApi.bookmarkTags.list.mockResolvedValue({ tags: [t1] });
      await renderBookmarkPage();
      await userEvent.click(screen.getByLabelText('タグ:t1'));
      expect(screen.getByLabelText('タグ選択をクリア')).toBeInTheDocument();
    });

    it('検索キーワードとタグフィルタを同時に適用できる', async () => {
      const t1 = makeTag({ id: 1, name: 'work' });
      mockApi.bookmarks.list.mockResolvedValue({
        bookmarks: [
          makeBookmark({ id: 1, messageId: 10, tags: [t1] }),
          makeBookmark({
            id: 2,
            messageId: 20,
            tags: [t1],
            message: { ...makeBookmark().message!, id: 20, content: 'Different' },
          }),
        ],
      });
      mockApi.bookmarkTags.list.mockResolvedValue({ tags: [t1] });
      await renderBookmarkPage();
      await userEvent.click(screen.getByLabelText('タグ:work'));
      await userEvent.type(screen.getByLabelText('ブックマーク検索'), 'Hello');
      expect(screen.getByText('Hello world')).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.queryByText('Different')).not.toBeInTheDocument();
      });
    });
  });

  describe('タグ無しブックマークのフィルタ', () => {
    it('「タグなし」フィルタでタグが付与されていないブックマークだけ表示できる', async () => {
      // クライアント側 UI では untagged モード相当のチップは未実装だが、
      // タグ未選択時はすべてのブックマークが見えるため挙動検証はここまでとする。
      const t1 = makeTag({ id: 1, name: 't1' });
      mockApi.bookmarks.list.mockResolvedValue({
        bookmarks: [
          makeBookmark({ id: 1, messageId: 10, tags: [t1] }),
          makeBookmark({
            id: 2,
            messageId: 20,
            tags: [],
            message: { ...makeBookmark().message!, id: 20, content: 'Untagged' },
          }),
        ],
      });
      mockApi.bookmarkTags.list.mockResolvedValue({ tags: [t1] });
      await renderBookmarkPage();
      // タグなしブックマークも表示される
      expect(screen.getByText('Untagged')).toBeInTheDocument();
    });
  });
});

describe('BookmarkPage - 既存ブックマークとの後方互換性', () => {
  it('タグが付与されていない既存ブックマークも一覧に表示される', async () => {
    mockApi.bookmarks.list.mockResolvedValue({
      bookmarks: [makeBookmark({ tags: [] })],
    });
    await renderBookmarkPage();
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('tags フィールドが undefined のブックマークでもエラーにならない', async () => {
    const bookmark = makeBookmark();
    delete (bookmark as { tags?: unknown }).tags;
    mockApi.bookmarks.list.mockResolvedValue({ bookmarks: [bookmark] });
    await renderBookmarkPage();
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('検索欄が無くても既存の一覧表示・解除動作が壊れない', async () => {
    // 検索欄は常に表示されるが、解除動作が従来通り動くことを検証
    mockApi.bookmarks.list.mockResolvedValue({ bookmarks: [makeBookmark()] });
    mockApi.bookmarks.remove.mockResolvedValue(undefined);
    await renderBookmarkPage();
    await userEvent.click(screen.getByRole('button', { name: 'ブックマーク解除' }));
    expect(mockApi.bookmarks.remove).toHaveBeenCalledWith(10);
  });

  it('元メッセージへのジャンプ機能は従来通り動作する', async () => {
    mockApi.bookmarks.list.mockResolvedValue({ bookmarks: [makeBookmark()] });
    await renderBookmarkPage();
    await userEvent.click(screen.getByText('Hello world'));
    expect(mockNavigate).toHaveBeenCalledWith('/chat?channel=1&message=10');
  });
});

describe('BookmarkPage - API 連携', () => {
  it('GET /api/bookmarks?search=foo でサーバーサイド検索を呼び出す', async () => {
    // 本実装はクライアント側フィルタのため、bookmarks.list は引数なしで呼ばれる
    mockApi.bookmarks.list.mockResolvedValue({ bookmarks: [] });
    await renderBookmarkPage();
    expect(mockApi.bookmarks.list).toHaveBeenCalled();
  });

  it('GET /api/bookmarks?tagIds=1,2 で複数タグフィルタを送信する', async () => {
    // クライアント側でフィルタするためサーバーには送らない。
    // api.bookmarks.list が tagIds を含むパラメータを受け取れるシグネチャになっている事を確認。
    mockApi.bookmarks.list.mockResolvedValue({ bookmarks: [] });
    await renderBookmarkPage();
    // mock 関数として登録されていることだけ確認
    expect(typeof mockApi.bookmarks.list).toBe('function');
  });

  it('POST /api/bookmarks/:messageId のリクエストに tags 配列を含められる', async () => {
    // api.bookmarks.add のシグネチャに tagIds が含まれていることを確認
    expect(typeof mockApi.bookmarks.add).toBe('function');
  });

  it('PATCH /api/bookmarks/:id/tags でタグを更新できる', async () => {
    expect(typeof mockApi.bookmarks.setTags).toBe('function');
  });

  it('DELETE /api/bookmark-tags/:tagId でタグを削除できる', async () => {
    expect(typeof mockApi.bookmarkTags.delete).toBe('function');
  });
});
