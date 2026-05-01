/**
 * components/Layout/AppLayout.tsx のユニットテスト
 *
 * テスト対象: アプリ共通レイアウト（ヘッダー表示名 / Rail 統合 / 3 列グリッド）
 * 戦略:
 *   - AuthContext / ThemeContext / SocketContext / usePushNotifications をモックする
 *   - react-router-dom は実体を使い MemoryRouter でラップする（NavLink を使う Rail のため）
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AppLayout from '../components/Layout/AppLayout';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, logout: vi.fn(), updateUser: vi.fn() }),
}));

vi.mock('../contexts/ThemeContext', () => ({
  useTheme: () => ({ mode: 'light', toggleTheme: vi.fn() }),
}));

vi.mock('../hooks/usePushNotifications', () => ({
  usePushNotifications: () => ({
    supported: false,
    subscribed: false,
    loading: false,
    error: null,
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  }),
}));

vi.mock('../contexts/SocketContext', () => ({
  useSocket: () => null,
}));

const mockUser = {
  id: 1,
  username: 'alice',
  email: 'alice@example.com',
  displayName: null as string | null,
  role: 'user' as 'user' | 'admin',
  location: null,
  avatarUrl: null,
  createdAt: '2024-01-01T00:00:00Z',
};

beforeEach(() => {
  mockUser.displayName = null;
  mockUser.role = 'user';
});

function renderLayout(sidebarContent?: React.ReactNode, mainContent?: React.ReactNode) {
  return render(
    <MemoryRouter>
      <AppLayout sidebar={sidebarContent ?? <div />}>{mainContent ?? <div />}</AppLayout>
    </MemoryRouter>,
  );
}

describe('AppLayout', () => {
  // Step 2b で AppBar 撤去・displayName は SidebarFooter に移譲したため
  // 「ヘッダー表示名」describe を削除（同等の検証は SidebarFooter.test.tsx 側で実施）。

  describe('Rail との統合', () => {
    it('Rail コンポーネントの代表的なナビ（ホーム）が AppLayout 内に表示される', () => {
      renderLayout();
      expect(screen.getByRole('link', { name: 'ホーム' })).toBeInTheDocument();
    });

    it('AppLayout のレイアウト要素が grid 表示で 3 列構造になっている', () => {
      renderLayout();
      const grid = screen.getByTestId('app-layout-grid');
      expect(grid).toHaveStyle({ display: 'grid' });
      expect(grid).toHaveStyle({ gridTemplateColumns: '64px 240px 1fr' });
    });

    it('sidebar prop に渡したコンテンツが Sidebar 列に表示される', () => {
      renderLayout(<div data-testid="custom-sidebar">SIDEBAR</div>);
      expect(screen.getByTestId('custom-sidebar')).toBeInTheDocument();
    });

    it('children に渡したコンテンツが Main 列に表示される', () => {
      renderLayout(undefined, <div data-testid="custom-main">MAIN</div>);
      expect(screen.getByTestId('custom-main')).toBeInTheDocument();
    });
  });

  describe('AppBar 撤去 + SidebarFooter 統合 (Step 2b)', () => {
    it('AppBar (旧 "Chat App" ロゴテキスト) が描画されない', () => {
      renderLayout();
      // 旧 AppBar 内に存在した "Chat App" のテキストロゴが消えている
      expect(screen.queryByText('Chat App')).not.toBeInTheDocument();
    });

    it('SidebarFooter の代表的な要素（ログアウトボタン）が AppLayout 内に表示される', () => {
      renderLayout();
      expect(screen.getByRole('button', { name: 'ログアウト' })).toBeInTheDocument();
    });
  });
});
