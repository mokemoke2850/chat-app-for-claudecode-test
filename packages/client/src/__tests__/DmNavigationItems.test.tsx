/**
 * テスト対象: ChannelList 内の DmNavigationItems コンポーネント
 * 責務: DM・ブックマーク・管理画面へのナビゲーション項目の表示と未読バッジ管理
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import DmNavigationItems from '../components/Channel/DmNavigationItems';

// Socket モック：イベントハンドラを手動管理
const socketHandlers: Record<string, ((...args: unknown[]) => void)[]> = {};
const mockSocket = {
  emit: vi.fn(),
  on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    if (!socketHandlers[event]) socketHandlers[event] = [];
    socketHandlers[event].push(handler);
  }),
  off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    if (socketHandlers[event]) {
      socketHandlers[event] = socketHandlers[event].filter((h) => h !== handler);
    }
  }),
};

function emitSocket(event: string, ...args: unknown[]) {
  (socketHandlers[event] ?? []).forEach((h) => h(...args));
}

vi.mock('../contexts/SocketContext', () => ({
  useSocket: () => mockSocket,
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

beforeEach(() => {
  vi.clearAllMocks();
  // clearAllMocksではmockUseAuthの実装もリセットされるので、デフォルト実装を再設定する
  mockUseAuth.mockImplementation(() => ({ user: { id: 1, role: 'user', isActive: true } }));
  Object.keys(socketHandlers).forEach((k) => {
    delete socketHandlers[k];
  });
});

// AuthContext: vi.fn() で返り値を差し替え可能にする
const mockUseAuth = vi.fn(() => ({ user: { id: 1, role: 'user', isActive: true } }));
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('DmNavigationItems', () => {
  describe('ナビゲーション表示', () => {
    it('「ダイレクトメッセージ」リンクが表示される', () => {
      render(
        <MemoryRouter>
          <DmNavigationItems dmUnreadCount={0} onDmUnreadCountChange={vi.fn()} />
        </MemoryRouter>,
      );
      expect(screen.getByText('ダイレクトメッセージ')).toBeInTheDocument();
    });

    it('「ブックマーク」リンクが表示される', () => {
      render(
        <MemoryRouter>
          <DmNavigationItems dmUnreadCount={0} onDmUnreadCountChange={vi.fn()} />
        </MemoryRouter>,
      );
      expect(screen.getByText('ブックマーク')).toBeInTheDocument();
    });

    it('role=admin のユーザーには「管理画面」リンクが表示される', () => {
      mockUseAuth.mockReturnValueOnce({ user: { id: 1, role: 'admin', isActive: true } });
      render(
        <MemoryRouter>
          <DmNavigationItems dmUnreadCount={0} onDmUnreadCountChange={vi.fn()} />
        </MemoryRouter>,
      );
      expect(screen.getByText('管理画面')).toBeInTheDocument();
    });

    it('role=user のユーザーには「管理画面」リンクが表示されない', () => {
      render(
        <MemoryRouter>
          <DmNavigationItems dmUnreadCount={0} onDmUnreadCountChange={vi.fn()} />
        </MemoryRouter>,
      );
      // 現在のモックはrole=user
      expect(screen.queryByText('管理画面')).not.toBeInTheDocument();
    });
  });

  describe('DM未読バッジ', () => {
    it('dmUnreadCount > 0 のときDMアイコンに未読数バッジが表示される', () => {
      render(
        <MemoryRouter>
          <DmNavigationItems dmUnreadCount={5} onDmUnreadCountChange={vi.fn()} />
        </MemoryRouter>,
      );
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('dmUnreadCount === 0 のときDMアイコンにバッジは表示されない', () => {
      render(
        <MemoryRouter>
          <DmNavigationItems dmUnreadCount={0} onDmUnreadCountChange={vi.fn()} />
        </MemoryRouter>,
      );
      expect(screen.queryByText('0')).not.toBeInTheDocument();
    });

    it('「ダイレクトメッセージ」をクリックすると /dm へ遷移する', async () => {
      render(
        <MemoryRouter>
          <DmNavigationItems dmUnreadCount={0} onDmUnreadCountChange={vi.fn()} />
        </MemoryRouter>,
      );
      await userEvent.click(screen.getByText('ダイレクトメッセージ'));
      expect(mockNavigate).toHaveBeenCalledWith('/dm');
    });

    it('「ダイレクトメッセージ」をクリックすると dmUnreadCount が 0 にリセットされる', async () => {
      const onDmUnreadCountChange = vi.fn();
      render(
        <MemoryRouter>
          <DmNavigationItems dmUnreadCount={3} onDmUnreadCountChange={onDmUnreadCountChange} />
        </MemoryRouter>,
      );
      await userEvent.click(screen.getByText('ダイレクトメッセージ'));
      expect(onDmUnreadCountChange).toHaveBeenCalledWith(0);
    });
  });

  describe('Socket.IO dm_notification 受信', () => {
    it('/dm ページ以外にいるときに dm_notification を受信すると dmUnreadCount がインクリメントされる', async () => {
      const onDmUnreadCountChange = vi.fn();
      // window.location.pathname を / に設定
      Object.defineProperty(window, 'location', {
        writable: true,
        value: { pathname: '/' },
      });

      render(
        <MemoryRouter>
          <DmNavigationItems dmUnreadCount={0} onDmUnreadCountChange={onDmUnreadCountChange} />
        </MemoryRouter>,
      );

      await act(async () => {
        emitSocket('dm_notification', { conversationId: 1, unreadCount: 1 });
      });

      expect(onDmUnreadCountChange).toHaveBeenCalled();
    });

    it('/dm ページにいるときに dm_notification を受信しても dmUnreadCount は変化しない', async () => {
      const onDmUnreadCountChange = vi.fn();
      Object.defineProperty(window, 'location', {
        writable: true,
        value: { pathname: '/dm' },
      });

      render(
        <MemoryRouter>
          <DmNavigationItems dmUnreadCount={0} onDmUnreadCountChange={onDmUnreadCountChange} />
        </MemoryRouter>,
      );

      await act(async () => {
        emitSocket('dm_notification', { conversationId: 1, unreadCount: 1 });
      });

      expect(onDmUnreadCountChange).not.toHaveBeenCalled();
    });
  });

  describe('ナビゲーション', () => {
    it('「ブックマーク」をクリックすると /bookmarks へ遷移する', async () => {
      render(
        <MemoryRouter>
          <DmNavigationItems dmUnreadCount={0} onDmUnreadCountChange={vi.fn()} />
        </MemoryRouter>,
      );
      await userEvent.click(screen.getByText('ブックマーク'));
      expect(mockNavigate).toHaveBeenCalledWith('/bookmarks');
    });

    it('「管理画面」をクリックすると /admin へ遷移する', async () => {
      mockUseAuth.mockReturnValueOnce({ user: { id: 1, role: 'admin', isActive: true } });
      render(
        <MemoryRouter>
          <DmNavigationItems dmUnreadCount={0} onDmUnreadCountChange={vi.fn()} />
        </MemoryRouter>,
      );
      await userEvent.click(screen.getByText('管理画面'));
      expect(mockNavigate).toHaveBeenCalledWith('/admin');
    });
  });
});
