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
  // Step 8d: localStorage を毎テストでクリーンに
  localStorage.removeItem('sidebar.open');
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

  describe('rightPane prop による 4 列対応 (Step 5a)', () => {
    it('rightPane を渡したとき grid が 4 列 (Rail / Sidebar / Main / RightPane 320px) になる', () => {
      render(
        <MemoryRouter>
          <AppLayout sidebar={<div />} rightPane={<div data-testid="right-pane-content" />}>
            <div />
          </AppLayout>
        </MemoryRouter>,
      );
      const grid = screen.getByTestId('app-layout-grid');
      expect(grid).toHaveStyle({ gridTemplateColumns: '64px 240px 1fr 320px' });
    });

    it('rightPane を渡さないとき grid は従来の 3 列構造のまま', () => {
      renderLayout();
      const grid = screen.getByTestId('app-layout-grid');
      expect(grid).toHaveStyle({ gridTemplateColumns: '64px 240px 1fr' });
    });

    it('rightPane に渡したコンテンツが Right 列に描画される', () => {
      render(
        <MemoryRouter>
          <AppLayout sidebar={<div />} rightPane={<div data-testid="right-pane-content" />}>
            <div />
          </AppLayout>
        </MemoryRouter>,
      );
      expect(screen.getByTestId('right-pane-content')).toBeInTheDocument();
    });
  });

  // Step 8d: Sidebar 開閉機構 (TODO #17 解消)
  describe('Step 8d: Sidebar 開閉機構', () => {
    function renderWith(props: { defaultSidebarOpen?: boolean }) {
      return render(
        <MemoryRouter>
          <AppLayout
            sidebar={<div data-testid="sidebar-content">SIDEBAR</div>}
            defaultSidebarOpen={props.defaultSidebarOpen}
          >
            <div />
          </AppLayout>
        </MemoryRouter>,
      );
    }

    it('localStorage に値が無いとき、defaultSidebarOpen={true} なら sidebar が表示される', () => {
      renderWith({ defaultSidebarOpen: true });
      expect(screen.getByTestId('sidebar-content')).toBeVisible();
    });

    it('localStorage に値が無いとき、defaultSidebarOpen={false} なら sidebar が非表示', () => {
      renderWith({ defaultSidebarOpen: false });
      // sidebar 列の Box が display: none → 子要素も hidden
      const sidebar = screen.queryByTestId('sidebar-content');
      // jsdom では非表示でもクエリには引っかかるため style 検証
      expect(sidebar?.closest('[data-testid="app-layout-sidebar"]')).toHaveStyle({
        display: 'none',
      });
    });

    it('localStorage["sidebar.open"]="false" なら defaultSidebarOpen={true} でも非表示 (永続化値優先)', () => {
      localStorage.setItem('sidebar.open', 'false');
      renderWith({ defaultSidebarOpen: true });
      expect(
        screen.queryByTestId('sidebar-content')?.closest('[data-testid="app-layout-sidebar"]'),
      ).toHaveStyle({ display: 'none' });
    });

    it('localStorage["sidebar.open"]="true" なら defaultSidebarOpen={false} でも表示 (永続化値優先)', () => {
      localStorage.setItem('sidebar.open', 'true');
      renderWith({ defaultSidebarOpen: false });
      expect(screen.getByTestId('sidebar-content')).toBeVisible();
    });

    it('Sidebar 表示時、grid 列に SIDEBAR_WIDTH(240px) が含まれる', () => {
      renderWith({ defaultSidebarOpen: true });
      const grid = screen.getByTestId('app-layout-grid');
      expect(grid).toHaveStyle({ gridTemplateColumns: '64px 240px 1fr' });
    });

    it('Sidebar 非表示時、grid 列の Sidebar 部分が 0px になる', () => {
      renderWith({ defaultSidebarOpen: false });
      const grid = screen.getByTestId('app-layout-grid');
      expect(grid).toHaveStyle({ gridTemplateColumns: '64px 0px 1fr' });
    });
  });
});
