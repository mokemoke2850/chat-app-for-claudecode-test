/**
 * テスト対象: ChatPage の ?message= パラメータによるメッセージジャンプ処理
 * 戦略:
 *   - URL に ?channel=X&message=Y が含まれるとき、対象メッセージへのスクロールが発火することを検証する
 *   - ハイライト状態（highlightMessageId 等）が正しく設定されることを検証する
 *   - ジャンプ後に ?message= パラメータが URL から除去されることを検証する
 *   - メッセージが存在しない場合の挙動を検証する
 *   - 子コンポーネントはすべてスタブ化し、MessageList は props キャプチャ可能な vi.fn にする
 */

import { render, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import ChatPage from '../pages/ChatPage';

// LocationDisplay: URL 変化を data-testid で検証するヘルパー
function LocationDisplay() {
  const loc = useLocation();
  return <div data-testid="location-display">{loc.pathname + loc.search}</div>;
}

function renderChatPage(initialPath: string = '/chat') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <ChatPage users={[]} />
      <LocationDisplay />
    </MemoryRouter>,
  );
}

// MessageList を props キャプチャ可能なモックにする
const MockMessageList = vi.hoisted(() => vi.fn(() => null));
vi.mock('../components/Chat/MessageList', () => ({ default: MockMessageList }));

// ChannelList スタブ
const MockChannelList = vi.hoisted(() => vi.fn(() => null));
vi.mock('../components/Channel/ChannelList', () => ({ default: MockChannelList }));

vi.mock('../components/Layout/SidebarDmList', () => ({ default: () => null }));

vi.mock('../components/Layout/AppLayout', async () => {
  const React = (await import('react')) as typeof import('react');
  return {
    default: ({ sidebar, children }: { sidebar: React.ReactNode; children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, sidebar, children),
  };
});

vi.mock('../components/Channel/ContextRail', () => ({
  default: () => <div data-testid="context-rail-stub" />,
}));

const MockRichEditor = vi.hoisted(() => vi.fn(() => null));
vi.mock('../components/Chat/RichEditor', () => ({ default: MockRichEditor }));

vi.mock('../components/Chat/ThreadPanel', () => ({ default: () => null }));
vi.mock('../components/Channel/ChannelTopicBar', () => ({ default: () => null }));
vi.mock('../components/Channel/ArchivedBanner', () => ({ default: () => null }));
vi.mock('../components/Chat/ScheduledMessagesDialog', () => ({
  default: ({ open }: { open: boolean }) =>
    open ? <div data-testid="scheduled-messages-dialog" /> : null,
}));
vi.mock('../pages/FilesPage', () => ({
  ChannelFilesTab: () => <div data-testid="channel-files-tab" />,
}));
vi.mock('../components/CommandPalette/CommandPalette', () => ({ default: () => null }));
vi.mock('../components/ShortcutHelp/ShortcutHelpModal', () => ({ default: () => null }));
vi.mock('../components/Chat/CreateEventDialog', () => ({ default: () => null }));

const mockSnackbar = vi.hoisted(() => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
  showInfo: vi.fn(),
}));
vi.mock('../contexts/SnackbarContext', () => ({
  useSnackbar: () => mockSnackbar,
}));

const mockBookmarksList = vi.hoisted(() => vi.fn().mockResolvedValue({ bookmarks: [] }));
const mockDraftsGetAll = vi.hoisted(() => vi.fn().mockResolvedValue({ drafts: [] }));
const mockChannelsList = vi.hoisted(() => vi.fn().mockResolvedValue({ channels: [] }));

vi.mock('../api/client', () => ({
  api: {
    messages: { search: vi.fn().mockResolvedValue({ messages: [] }) },
    bookmarks: { list: mockBookmarksList },
    drafts: { getAll: mockDraftsGetAll },
    channels: { list: mockChannelsList },
  },
}));

// useMessages: ?message=Y で指定したメッセージも含むメッセージリストを返す
const mockMessages = vi.hoisted(() => ({
  current: [] as Array<{ id: number; channelId: number }>,
}));
vi.mock('../hooks/useMessages', () => ({
  useMessages: () => ({
    messages: mockMessages.current,
    loading: false,
    loadMore: vi.fn(),
    refetch: vi.fn(),
  }),
}));

vi.mock('../hooks/useScheduledMessages', () => ({
  useScheduledMessages: () => ({
    promise: Promise.resolve([]),
    refresh: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    cancel: vi.fn(),
  }),
}));

vi.mock('../contexts/SocketContext', () => ({ useSocket: () => null }));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, role: 'user', isActive: true, username: 'testuser' },
  }),
}));

vi.mock('../hooks/useMessageKeyNav', () => ({
  useMessageKeyNav: () => ({ focusedMessageId: null }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  MockChannelList.mockImplementation(() => null);
  MockRichEditor.mockImplementation(() => null);
  MockMessageList.mockImplementation(() => null);
  mockBookmarksList.mockResolvedValue({ bookmarks: [] });
  mockDraftsGetAll.mockResolvedValue({ drafts: [] });
  mockChannelsList.mockResolvedValue({ channels: [] });
  mockMessages.current = [];
});

describe('ChatPage パーマリンクジャンプ', () => {
  describe('?message= パラメータの読み取り', () => {
    it('マウント時に ?message=Y があるとき、該当メッセージへのスクロール処理が行われる', async () => {
      // scrollIntoView をモック化して呼び出しを検証する
      const scrollIntoView = vi.fn();
      // data-message-id="42" を持つ要素を DOM に用意
      const el = document.createElement('div');
      el.setAttribute('data-message-id', '42');
      el.scrollIntoView = scrollIntoView;
      document.body.appendChild(el);

      await act(async () => {
        renderChatPage('/chat?channel=1&message=42');
      });

      await waitFor(() => {
        expect(scrollIntoView).toHaveBeenCalled();
      });

      document.body.removeChild(el);
    });

    it('?message= がないときスクロール処理は行われない', async () => {
      const scrollIntoView = vi.fn();
      const el = document.createElement('div');
      el.setAttribute('data-message-id', '42');
      el.scrollIntoView = scrollIntoView;
      document.body.appendChild(el);

      await act(async () => {
        renderChatPage('/chat?channel=1');
      });

      // 少し待ってもスクロールが呼ばれないことを確認
      await new Promise((r) => setTimeout(r, 50));
      expect(scrollIntoView).not.toHaveBeenCalled();

      document.body.removeChild(el);
    });

    it('?message=Y で指定されたメッセージが存在しない場合、スクロールは発火しない', async () => {
      const scrollIntoView = vi.fn();
      // data-message-id="999" は DOM に存在しない

      await act(async () => {
        renderChatPage('/chat?channel=1&message=999');
      });

      await new Promise((r) => setTimeout(r, 50));
      expect(scrollIntoView).not.toHaveBeenCalled();
    });
  });

  describe('ハイライト状態', () => {
    it('?message=Y があるとき、MessageList に highlightMessageId=Y が渡される', async () => {
      await act(async () => {
        renderChatPage('/chat?channel=1&message=42');
      });

      await waitFor(() => {
        const calls = MockMessageList.mock.calls as unknown as Array<
          [{ highlightMessageId?: number }]
        >;
        const lastCall = calls[calls.length - 1];
        expect(lastCall?.[0]?.highlightMessageId).toBe(42);
      });
    });

    it('一定時間後（またはユーザー操作後）にハイライトが解除される', async () => {
      // フェイクタイマーは waitFor のポーリングと競合するため shouldAdvanceTime を有効にする
      vi.useFakeTimers({ shouldAdvanceTime: true });

      await act(async () => {
        renderChatPage('/chat?channel=1&message=42');
      });

      // ハイライトが設定されていることを確認
      await waitFor(() => {
        const calls = MockMessageList.mock.calls as unknown as Array<
          [{ highlightMessageId?: number | null }]
        >;
        const lastCall = calls[calls.length - 1];
        expect(lastCall?.[0]?.highlightMessageId).toBe(42);
      });

      // タイマーを進めてハイライト解除を確認
      await act(async () => {
        vi.advanceTimersByTime(3000);
      });

      await waitFor(() => {
        const calls = MockMessageList.mock.calls as unknown as Array<
          [{ highlightMessageId?: number | null }]
        >;
        const lastCall = calls[calls.length - 1];
        expect(lastCall?.[0]?.highlightMessageId).toBeFalsy();
      });

      vi.useRealTimers();
    });
  });

  describe('URL クリーンアップ', () => {
    it('ジャンプ後に URL から &message=Y パラメータが除去される', async () => {
      const { getByTestId } = render(
        <MemoryRouter initialEntries={['/chat?channel=1&message=42']}>
          <ChatPage users={[]} />
          <LocationDisplay />
        </MemoryRouter>,
      );

      // useEffect([], []) は同期的に処理されるため、act で flush する
      await act(async () => {
        await Promise.resolve();
      });

      const locationEl = getByTestId('location-display');
      expect(locationEl.textContent).not.toContain('message=');
    });

    it('?channel=X は除去されず残る', async () => {
      const { getByTestId } = render(
        <MemoryRouter initialEntries={['/chat?channel=1&message=42']}>
          <ChatPage users={[]} />
          <LocationDisplay />
        </MemoryRouter>,
      );

      await act(async () => {
        await Promise.resolve();
      });

      const locationEl = getByTestId('location-display');
      expect(locationEl.textContent).toContain('channel=1');
    });
  });
});
