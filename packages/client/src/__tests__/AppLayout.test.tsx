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
  describe('ヘッダー表示名', () => {
    it('displayName が設定されているとき、ヘッダーに displayName が表示される', () => {
      mockUser.displayName = '田中花子';
      renderLayout();
      expect(screen.getByText('田中花子')).toBeInTheDocument();
    });

    it('displayName が null のとき、ヘッダーに username が表示される', () => {
      renderLayout();
      expect(screen.getByText('alice')).toBeInTheDocument();
    });
  });

  // ----------------------------------------------------------------
  // Step 2a: 3 列グリッド + Rail 統合
  // 既存の「タスクボードナビゲーション」「チャットナビゲーション」テストは
  // Rail.test.tsx に移管したため削除。AppLayout 側では「Rail が表示される」
  // 「3 列グリッド構造である」のみ確認する。
  // ----------------------------------------------------------------
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
});
