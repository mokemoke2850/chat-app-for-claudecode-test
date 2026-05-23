/**
 * テスト対象: BookmarkPage のジャンプ機能（元メッセージへの遷移とハイライト）
 * 戦略:
 *   - ネットワーク通信は vi.mock('../api/client') で差し替える
 *   - useNavigate をモックして遷移先 URL を検証する
 *   - チャンネルメッセージと DM メッセージの両遷移パスを検証する
 *   - ChatPage の既存 highlightMessageId 実装との連携は ChatPagePermalink.test.tsx で担保済みのため、
 *     ここでは BookmarkPage 側の遷移 URL 生成ロジックのみを検証する
 */

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import BookmarkPage, { resetBookmarksCache } from '../pages/BookmarkPage';
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
      setTags: vi.fn(),
    },
    bookmarkTags: {
      list: vi.fn().mockResolvedValue({ tags: [] }),
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

vi.mock('../components/Chat/RichEditor', () => ({
  default: ({ onCancel }: { onCancel: () => void }) => (
    <div data-testid="rich-editor">
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
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
});

describe('BookmarkPage ジャンプ機能', () => {
  describe('チャンネルメッセージへのジャンプ', () => {
    it('ブックマーク行をクリックすると /chat?channel={channelId}&message={messageId} へ遷移する', async () => {
      mockApi.bookmarks.list.mockResolvedValue({ bookmarks: [makeBookmark()] });
      await renderBookmarkPage();
      await userEvent.click(screen.getByText('Hello world'));
      expect(mockNavigate).toHaveBeenCalledWith('/chat?channel=1&message=10');
    });

    it('channelId が null のブックマーク行をクリックしても遷移しない', async () => {
      const bookmarkWithoutChannel = makeBookmark({
        message: {
          id: 10,
          channelId: null as unknown as number,
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
      });
      mockApi.bookmarks.list.mockResolvedValue({ bookmarks: [bookmarkWithoutChannel] });
      await renderBookmarkPage();
      await userEvent.click(screen.getByText('Hello world'));
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  // DM ブックマーク機能自体が未実装（bookmarks テーブルが messages のみ参照する設計）のため、
  // #344 ではテスト項目を削除した。DM ブックマーク対応は DB スキーマ変更を伴うため別 Issue で扱う。

  describe('遷移先でのハイライト', () => {
    it('チャンネルジャンプ時に message パラメータが URL に含まれる（ChatPage の highlightMessageId 連携前提）', async () => {
      mockApi.bookmarks.list.mockResolvedValue({ bookmarks: [makeBookmark()] });
      await renderBookmarkPage();
      await userEvent.click(screen.getByText('Hello world'));
      // navigate の第1引数に &message={messageId} が含まれることを確認
      const calledUrl = mockNavigate.mock.calls[0][0] as string;
      expect(calledUrl).toContain('message=10');
    });
  });

  describe('クリック操作と解除ボタンの競合', () => {
    it('解除ボタンのクリックではジャンプが発火しない（stopPropagation が正しく機能する）', async () => {
      mockApi.bookmarks.list.mockResolvedValue({ bookmarks: [makeBookmark()] });
      mockApi.bookmarks.remove.mockResolvedValue(undefined);
      await renderBookmarkPage();
      await userEvent.click(screen.getByRole('button', { name: 'ブックマーク解除' }));
      // 解除ボタンをクリックしても navigate は呼ばれない
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
});
