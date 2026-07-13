/**
 * components/Layout/SidebarDmList.tsx のユニットテスト
 *
 * テスト対象: Sidebar 列下部の DM 会話一覧ブロック
 * 戦略:
 *   - api.dm.listConversations をモックして会話データを制御
 *   - SocketContext をモックして new_dm_message を任意に発火
 *   - useNavigate を vi.fn() で差し替え、URL 遷移を検証
 *   - MemoryRouter でラップ
 *   - use() + Suspense をフラッシュするため await act でラップ
 */

import { act } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SidebarDmList, { resetSidebarDmListCache } from '../components/Layout/SidebarDmList';
import { makeConversation } from './__fixtures__/dm';

const mockListConversations = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../api/client', () => ({
  api: {
    dm: {
      listConversations: () => mockListConversations(),
    },
  },
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

type SocketEventHandler = (data: unknown) => void;
const capturedHandlers: Record<string, SocketEventHandler> = {};
const mockSocket = {
  on: vi.fn((event: string, handler: SocketEventHandler) => {
    capturedHandlers[event] = handler;
  }),
  off: vi.fn(),
};
vi.mock('../contexts/SocketContext', () => ({
  useSocket: () => mockSocket,
}));

// Step 8e-4: SidebarDmList が useAuth で currentUserId を取得するようになったため mock 追加
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, username: 'me', email: 'me@example.com', role: 'user' },
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  resetSidebarDmListCache();
  for (const key of Object.keys(capturedHandlers)) {
    delete capturedHandlers[key];
  }
});

async function renderSidebarDmList() {
  await act(async () => {
    render(
      <MemoryRouter>
        <SidebarDmList />
      </MemoryRouter>,
    );
  });
}

describe('SidebarDmList', () => {
  describe('表示', () => {
    it('ヘッダー「DM」が表示される', async () => {
      mockListConversations.mockResolvedValue({ conversations: [] });
      await renderSidebarDmList();
      expect(screen.getByText('DM')).toBeInTheDocument();
    });

    it('「新規 DM」アイコン (aria-label="新規 DM") が表示される', async () => {
      mockListConversations.mockResolvedValue({ conversations: [] });
      await renderSidebarDmList();
      expect(screen.getByRole('button', { name: '新規 DM' })).toBeInTheDocument();
    });

    it('会話一覧が表示される（アバター + 名前）', async () => {
      mockListConversations.mockResolvedValue({
        conversations: [
          makeConversation({
            id: 1,
            otherUser: { id: 2, username: 'bob', displayName: null, avatarUrl: null },
          }),
          makeConversation({
            id: 2,
            otherUser: { id: 3, username: 'carol', displayName: 'キャロル', avatarUrl: null },
          }),
        ],
      });
      await renderSidebarDmList();
      expect(screen.getByText('bob')).toBeInTheDocument();
      expect(screen.getByText('キャロル')).toBeInTheDocument();
    });

    it('会話 0 件のとき空状態メッセージが表示される', async () => {
      mockListConversations.mockResolvedValue({ conversations: [] });
      await renderSidebarDmList();
      expect(screen.getByText('DM会話がありません')).toBeInTheDocument();
    });
  });

  describe('動作', () => {
    it('行クリックで navigate("/dm?conv=" + convId) が呼ばれる', async () => {
      mockListConversations.mockResolvedValue({
        conversations: [
          makeConversation({
            id: 7,
            otherUser: { id: 2, username: 'bob', displayName: null, avatarUrl: null },
          }),
        ],
      });
      await renderSidebarDmList();
      await userEvent.click(screen.getByText('bob'));
      expect(mockNavigate).toHaveBeenCalledWith('/dm?conv=7');
    });

    it('「新規 DM」アイコンクリックで navigate("/dm") が呼ばれる', async () => {
      mockListConversations.mockResolvedValue({ conversations: [] });
      await renderSidebarDmList();
      await userEvent.click(screen.getByRole('button', { name: '新規 DM' }));
      expect(mockNavigate).toHaveBeenCalledWith('/dm');
    });
  });

  describe('未読バッジ', () => {
    it('unreadCount > 0 のとき未読バッジが表示される', async () => {
      mockListConversations.mockResolvedValue({
        conversations: [makeConversation({ id: 1, unreadCount: 3 })],
      });
      await renderSidebarDmList();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('unreadCount === 0 のときバッジは表示されない', async () => {
      mockListConversations.mockResolvedValue({
        conversations: [makeConversation({ id: 1, unreadCount: 0 })],
      });
      await renderSidebarDmList();
      expect(screen.queryByText('0')).not.toBeInTheDocument();
    });

    it('unreadCount > 9 のとき "9+" 表示される', async () => {
      mockListConversations.mockResolvedValue({
        conversations: [makeConversation({ id: 1, unreadCount: 12 })],
      });
      await renderSidebarDmList();
      expect(screen.getByText('9+')).toBeInTheDocument();
    });
  });

  describe('Socket リアルタイム更新', () => {
    // SidebarDmList は compact variant で lastMessage プレビューを描画しないため、
    // socket → state 更新パスの検証は下記 unreadCount +1 ケースで一括して行う。
    // (DmConversationList 側 (expanded variant) で lastMessage 表示は別途検証済み)

    it('非アクティブ会話の new_dm_message で unreadCount が +1 される', async () => {
      mockListConversations.mockResolvedValue({
        conversations: [
          makeConversation({
            id: 1,
            otherUser: { id: 2, username: 'bob', displayName: null, avatarUrl: null },
            unreadCount: 2,
          }),
        ],
      });
      await renderSidebarDmList();

      await act(async () => {
        capturedHandlers['new_dm_message']?.({
          id: 101,
          conversationId: 1,
          senderId: 2, // 自分以外
          senderUsername: 'bob',
          senderAvatarUrl: null,
          content: 'new msg',
          isRead: false,
          isEdited: false,
          createdAt: '2024-02-01T10:01:00Z',
          updatedAt: '2024-02-01T10:01:00Z',
        });
      });

      // 未読バッジが 3 に増えていることを確認
      const badge = await screen.findByText('3');
      expect(badge).toBeInTheDocument();
    });
  });
});

// 未使用 import 警告対策 (一部テストでのみ within を使用する想定)
void within;
