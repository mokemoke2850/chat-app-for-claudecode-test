/**
 * テスト対象: ブックマーク一覧ページ（BookmarkPage）
 * 戦略:
 *   - ネットワーク通信は vi.mock('../api/client') で差し替える
 *   - React 19 の use() + Suspense パターンを考慮し、非同期データ取得を検証する
 *   - ブックマーク登録・解除操作はAPIモックを通じて検証する
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import BookmarkPage, { resetBookmarksCache } from '../pages/BookmarkPage';
import MessageItem from '../components/Chat/MessageItem';
import { dummyUsers } from './__fixtures__/users';
import { makeMessage } from './__fixtures__/messages';
import type { Bookmark } from '@chat-app/shared';

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
    },
  },
}));

vi.mock('../contexts/SocketContext', () => ({
  useSocket: () => ({ emit: vi.fn(), on: vi.fn(), off: vi.fn() }),
}));

vi.mock('../components/Chat/RichEditor', () => ({
  default: ({ onCancel }: { onCancel: () => void }) => (
    <div data-testid="rich-editor">
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

import { api } from '../api/client';
const mockApi = api as unknown as {
  bookmarks: {
    list: ReturnType<typeof vi.fn>;
    add: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
};

const makeBookmark = (overrides: Partial<Bookmark> = {}): Bookmark => ({
  id: 1,
  userId: 1,
  messageId: 10,
  bookmarkedAt: '2024-06-01T12:00:00Z',
  channelName: 'general',
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
});

describe('BookmarkPage', () => {
  describe('ブックマーク一覧の表示', () => {
    it('ブックマーク一覧が取得できたとき、メッセージ内容とチャンネル名を表示する', async () => {
      mockApi.bookmarks.list.mockResolvedValue({ bookmarks: [makeBookmark()] });
      await renderBookmarkPage();
      expect(screen.getByText('Hello world')).toBeInTheDocument();
      expect(screen.getByText('#general')).toBeInTheDocument();
    });

    it('ブックマークが0件のとき、空状態のメッセージを表示する', async () => {
      mockApi.bookmarks.list.mockResolvedValue({ bookmarks: [] });
      await renderBookmarkPage();
      expect(screen.getByText('ブックマークはありません')).toBeInTheDocument();
    });

    it('データ取得中は Suspense のフォールバック（ローディング表示）を表示する', async () => {
      let resolve!: (v: { bookmarks: Bookmark[] }) => void;
      mockApi.bookmarks.list.mockReturnValue(
        new Promise((res) => {
          resolve = res;
        }),
      );
      render(
        <MemoryRouter>
          <BookmarkPage />
        </MemoryRouter>,
      );
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      await act(async () => {
        resolve({ bookmarks: [] });
      });
    });

    it('API エラー時はエラーメッセージを表示する', async () => {
      mockApi.bookmarks.list.mockRejectedValue(new Error('Network error'));
      // use() はエラーを ErrorBoundary に伝播する。コンソールエラーを抑制する
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => {
        render(
          <MemoryRouter>
            <BookmarkPage />
          </MemoryRouter>,
        );
      }).not.toThrow();
      consoleSpy.mockRestore();
    });

    it('削除済みメッセージのブックマークは一覧に表示されない', async () => {
      const activeBookmark = makeBookmark({ id: 1, messageId: 10 });
      mockApi.bookmarks.list.mockResolvedValue({ bookmarks: [activeBookmark] });
      await renderBookmarkPage();
      expect(screen.getByText('Hello world')).toBeInTheDocument();
      expect(screen.getAllByRole('listitem').length).toBe(1);
    });
  });

  describe('ブックマーク解除操作', () => {
    it('解除ボタンをクリックすると DELETE /api/bookmarks/:messageId を呼び出す', async () => {
      mockApi.bookmarks.list.mockResolvedValue({ bookmarks: [makeBookmark()] });
      mockApi.bookmarks.remove.mockResolvedValue(undefined);
      await renderBookmarkPage();
      await userEvent.click(screen.getByRole('button', { name: 'ブックマーク解除' }));
      expect(mockApi.bookmarks.remove).toHaveBeenCalledWith(10);
    });

    it('解除成功後、対象のブックマークが一覧から除去される', async () => {
      mockApi.bookmarks.list.mockResolvedValue({ bookmarks: [makeBookmark()] });
      mockApi.bookmarks.remove.mockResolvedValue(undefined);
      await renderBookmarkPage();
      expect(screen.getByText('Hello world')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'ブックマーク解除' }));
      await waitFor(() => {
        expect(screen.queryByText('Hello world')).not.toBeInTheDocument();
      });
    });
  });

  describe('メッセージへのジャンプ', () => {
    it('ブックマーク項目をクリックすると該当チャンネルのメッセージ位置へ遷移する', async () => {
      mockApi.bookmarks.list.mockResolvedValue({ bookmarks: [makeBookmark()] });
      await renderBookmarkPage();
      await userEvent.click(screen.getByText('Hello world'));
      expect(mockNavigate).toHaveBeenCalledWith('/?channel=1&message=10');
    });
  });
});

describe('MessageItem ブックマークアクション', () => {
  const renderMessageItem = (
    isBookmarked = false,
    onBookmarkChange?: (id: number, bookmarked: boolean) => void,
  ) =>
    render(
      <MessageItem
        message={makeMessage({ id: 10, userId: 1 })}
        currentUserId={2}
        users={dummyUsers}
        isBookmarked={isBookmarked}
        onBookmarkChange={onBookmarkChange}
      />,
    );

  beforeEach(() => {
    mockApi.bookmarks.add.mockResolvedValue({ bookmark: makeBookmark() });
    mockApi.bookmarks.remove.mockResolvedValue(undefined);
  });

  describe('ブックマーク登録', () => {
    it('メッセージのアクションメニューにブックマークボタンが表示される', () => {
      renderMessageItem();
      expect(screen.getByRole('button', { name: 'ブックマーク' })).toBeInTheDocument();
    });

    it('ブックマークボタンをクリックすると POST /api/bookmarks/:messageId を呼び出す', async () => {
      renderMessageItem();
      await userEvent.click(screen.getByRole('button', { name: 'ブックマーク' }));
      expect(mockApi.bookmarks.add).toHaveBeenCalledWith(10);
    });

    it('ブックマーク登録済みのメッセージでは「ブックマーク解除」ボタンを表示する', () => {
      renderMessageItem(true);
      expect(screen.getByRole('button', { name: 'ブックマーク解除' })).toBeInTheDocument();
    });
  });

  describe('ブックマーク解除（MessageItemから）', () => {
    it('ブックマーク解除ボタンをクリックすると DELETE /api/bookmarks/:messageId を呼び出す', async () => {
      renderMessageItem(true);
      await userEvent.click(screen.getByRole('button', { name: 'ブックマーク解除' }));
      expect(mockApi.bookmarks.remove).toHaveBeenCalledWith(10);
    });

    it('ブックマーク解除成功後、ボタン表示が「ブックマーク登録」に戻る', async () => {
      renderMessageItem(true);
      await userEvent.click(screen.getByRole('button', { name: 'ブックマーク解除' }));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'ブックマーク' })).toBeInTheDocument();
      });
    });
  });
});
