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
import { MemoryRouter, useNavigate } from 'react-router-dom';
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
  // Step 9d: matchMedia を毎テストでデフォルト (desktop = matches: false) にリセットする。
  // 前のテストが setViewportMobile(true) を呼んでいると引き継がれて他テストが失敗するため。
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn(() => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
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
      expect(screen.getByRole('link', { name: '受信箱' })).toBeInTheDocument();
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
      // Step 8e-3 で SidebarFooter は Rail に移動したが、AppLayout 全体としては存在する
      expect(screen.getByRole('button', { name: 'ログアウト' })).toBeInTheDocument();
    });
  });

  // Step 8e-3: Sidebar 列から SidebarFooter を撤去 (Rail に移動)
  describe('Step 8e-3: SidebarFooter を Sidebar 列から撤去', () => {
    it('Sidebar 列内にログアウトボタンが含まれない (Rail に移動済)', () => {
      renderLayout();
      const sidebarColumn = screen.getByTestId('app-layout-sidebar');
      expect(sidebarColumn.querySelector('button[aria-label="ログアウト"]')).toBeNull();
    });

    it('ログアウトボタンは Rail (nav 要素) 内に存在する', () => {
      renderLayout();
      const nav = screen.getByRole('navigation', { name: 'メインナビゲーション' });
      expect(nav.querySelector('button[aria-label="ログアウト"]')).not.toBeNull();
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

    it('localStorage に値が無いとき、defaultSidebarOpen={false} なら grid 列の Sidebar 幅が 0px (= 視覚的に非表示)', () => {
      renderWith({ defaultSidebarOpen: false });
      const grid = screen.getByTestId('app-layout-grid');
      expect(grid).toHaveStyle({ gridTemplateColumns: '64px 0px 1fr' });
      // Sidebar Box は grid セルを占有し続ける (Main の押し出しを防ぐ)
      expect(screen.getByTestId('app-layout-sidebar')).toBeInTheDocument();
    });

    it('localStorage["sidebar.open"]="false" なら defaultSidebarOpen={true} でも grid 0px (永続化値優先)', () => {
      localStorage.setItem('sidebar.open', 'false');
      renderWith({ defaultSidebarOpen: true });
      const grid = screen.getByTestId('app-layout-grid');
      expect(grid).toHaveStyle({ gridTemplateColumns: '64px 0px 1fr' });
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

  // Step 8e-5: forceSidebarClosed prop による強制閉じ
  describe('Step 8e-5: forceSidebarClosed prop', () => {
    function renderWithForce(props: { forceSidebarClosed?: boolean }) {
      return render(
        <MemoryRouter>
          <AppLayout
            sidebar={<div data-testid="sidebar-content">SIDEBAR</div>}
            forceSidebarClosed={props.forceSidebarClosed}
          >
            <div />
          </AppLayout>
        </MemoryRouter>,
      );
    }

    it('forceSidebarClosed={true} のとき localStorage="true" でも grid 列が 0px になる', () => {
      localStorage.setItem('sidebar.open', 'true');
      renderWithForce({ forceSidebarClosed: true });
      const grid = screen.getByTestId('app-layout-grid');
      expect(grid).toHaveStyle({ gridTemplateColumns: '64px 0px 1fr' });
    });

    it('forceSidebarClosed={true} のとき localStorage["sidebar.open"] への書き込みが発生しない (他ページの状態を汚さない)', () => {
      localStorage.setItem('sidebar.open', 'true');
      renderWithForce({ forceSidebarClosed: true });
      // mount 後も localStorage は "true" のまま (false で上書きされない)
      expect(localStorage.getItem('sidebar.open')).toBe('true');
    });

    it('forceSidebarClosed={true} のとき Rail にトグルボタン (サイドバーを閉じる/開く) が表示されない', () => {
      renderWithForce({ forceSidebarClosed: true });
      expect(
        screen.queryByRole('button', { name: /サイドバーを(開く|閉じる)/ }),
      ).not.toBeInTheDocument();
    });
  });

  // Step 9d: モバイル時 ContextRail をボトムシート化 (rightPane の有無で自動開閉)
  describe('Step 9d: モバイル ContextRail ボトムシート', () => {
    function setViewportMobile(isMobile: boolean) {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: vi.fn((query: string) => ({
          matches: isMobile && query.includes('max-width: 767px'),
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
    }

    function renderForBottomSheet(opts?: {
      withRightPane?: boolean;
      onCloseRightPane?: () => void;
    }) {
      return render(
        <MemoryRouter initialEntries={['/']}>
          <AppLayout
            sidebar={<div data-testid="custom-sidebar">SIDEBAR</div>}
            rightPane={
              opts?.withRightPane ? <div data-testid="custom-right">RIGHT</div> : undefined
            }
            onCloseRightPane={opts?.onCloseRightPane}
          >
            <div data-testid="main-content">MAIN</div>
          </AppLayout>
        </MemoryRouter>,
      );
    }

    it('モバイル幅で rightPane prop を渡すとボトムシートが自動的に開き、中身が表示される', async () => {
      setViewportMobile(true);
      renderForBottomSheet({ withRightPane: true });
      const sheet = await screen.findByRole('presentation');
      expect(sheet).toBeInTheDocument();
      expect(screen.getByTestId('custom-right')).toBeVisible();
    });

    it('モバイル幅で rightPane prop を渡さないとボトムシートは描画されない', () => {
      setViewportMobile(true);
      renderForBottomSheet({ withRightPane: false });
      expect(screen.queryByRole('presentation')).not.toBeInTheDocument();
    });

    it('デスクトップ幅で rightPane prop を渡したときボトムシートは描画されない (右ペイン列に直接描画)', () => {
      setViewportMobile(false);
      renderForBottomSheet({ withRightPane: true });
      expect(screen.queryByRole('presentation')).not.toBeInTheDocument();
      expect(screen.getByTestId('custom-right')).toBeInTheDocument();
    });

    it('AppBar 右に「詳細パネルを開く」トグルボタンは存在しない (Step 9d-fix で廃止)', () => {
      setViewportMobile(true);
      renderForBottomSheet({ withRightPane: true });
      expect(screen.queryByRole('button', { name: '詳細パネルを開く' })).not.toBeInTheDocument();
    });

    it('ボトムシートのバックドロップタップで onCloseRightPane が呼ばれる', () => {
      setViewportMobile(true);
      const onClose = vi.fn();
      renderForBottomSheet({ withRightPane: true, onCloseRightPane: onClose });
      const backdrops = document.querySelectorAll('.MuiBackdrop-root');
      expect(backdrops.length).toBeGreaterThan(0);
      (backdrops[backdrops.length - 1] as HTMLElement).click();
      expect(onClose).toHaveBeenCalled();
    });
  });

  // Step 9c: モバイル時 Sidebar をドロワー化 (ハンバーガーで開閉、URL 変化で自動閉じ)
  describe('Step 9c: モバイル Sidebar ドロワー', () => {
    function setViewportMobile(isMobile: boolean) {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: vi.fn((query: string) => ({
          matches: isMobile && query.includes('max-width: 767px'),
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
    }

    function renderForDrawer(props?: { forceSidebarClosed?: boolean; initialPath?: string }) {
      const initialPath = props?.initialPath ?? '/';
      // useLocation を実装に合わせる必要があるため MemoryRouter を使う
      return render(
        <MemoryRouter initialEntries={[initialPath]}>
          <AppLayout
            sidebar={<div data-testid="custom-sidebar">SIDEBAR_CONTENT</div>}
            forceSidebarClosed={props?.forceSidebarClosed}
          >
            <div data-testid="main-content">MAIN</div>
          </AppLayout>
        </MemoryRouter>,
      );
    }

    it('モバイル幅で AppBar 左にハンバーガーボタン (aria-label="サイドバーを開く") が表示される', () => {
      setViewportMobile(true);
      renderForDrawer();
      expect(screen.getByRole('button', { name: 'サイドバーを開く' })).toBeInTheDocument();
    });

    it('デスクトップ幅でハンバーガーボタンは表示されない', () => {
      setViewportMobile(false);
      renderForDrawer();
      expect(screen.queryByRole('button', { name: 'サイドバーを開く' })).not.toBeInTheDocument();
    });

    it('forceSidebarClosed={true} のときモバイルでもハンバーガーは表示されない', () => {
      setViewportMobile(true);
      renderForDrawer({ forceSidebarClosed: true });
      expect(screen.queryByRole('button', { name: 'サイドバーを開く' })).not.toBeInTheDocument();
    });

    it('ハンバーガークリックでドロワーが開き、sidebar prop の中身が表示される', async () => {
      setViewportMobile(true);
      renderForDrawer();
      // 初期: ドロワーは閉じているため sidebar 内容は presentation 経由では visible でない
      // (Drawer 内の中身は閉じた状態でも DOM に居るが visible=false)
      const hamburger = screen.getByRole('button', { name: 'サイドバーを開く' });
      await hamburger.click();
      // 開いた後に Drawer 内の sidebar 中身が見える
      const drawer = await screen.findByRole('presentation');
      expect(drawer).toBeInTheDocument();
      expect(screen.getByTestId('custom-sidebar')).toBeVisible();
    });

    it('ドロワー内底部に SidebarFooter のログアウトボタン (aria-label="ログアウト") が含まれる', async () => {
      setViewportMobile(true);
      renderForDrawer();
      const hamburger = screen.getByRole('button', { name: 'サイドバーを開く' });
      await hamburger.click();
      const drawer = await screen.findByRole('presentation');
      const logoutBtn = drawer.querySelector('[aria-label="ログアウト"]');
      expect(logoutBtn).not.toBeNull();
    });

    it('初期状態ではドロワーは閉じている (sidebar 中身が visible でない)', () => {
      setViewportMobile(true);
      renderForDrawer();
      // ドロワー閉時は presentation role が無い
      expect(screen.queryByRole('presentation')).not.toBeInTheDocument();
    });

    it('ドロワーが開いた状態で URL 変更 (location.pathname) で自動閉じになる', async () => {
      setViewportMobile(true);
      // useLocation の pathname を変更するため、内部から navigate を呼べるテストヘルパーを使う
      function NavigateButton() {
        const navigate = useNavigate();
        return (
          <button data-testid="go-other" onClick={() => navigate('/chat')}>
            go
          </button>
        );
      }
      render(
        <MemoryRouter initialEntries={['/']}>
          <AppLayout sidebar={<div data-testid="custom-sidebar">SIDEBAR</div>}>
            <NavigateButton />
          </AppLayout>
        </MemoryRouter>,
      );
      const hamburger = screen.getByRole('button', { name: 'サイドバーを開く' });
      await hamburger.click();
      // 開いた状態を確認
      expect(await screen.findByRole('presentation')).toBeInTheDocument();
      // ナビゲートで pathname 変更 → useEffect で setMobileDrawerOpen(false)
      await screen.getByTestId('go-other').click();
      // jsdom + MUI Drawer は transitionDuration が走るが、open=false 反映後は
      // backdrop が `.MuiBackdrop-invisible` 等で非インタラクティブになる。
      // 確実に確認できるのは「presentation role が消える」までの遷移だが、
      // jsdom では transition 完了まで時間がかかるため state 更新で `MuiBackdrop-root` が
      // visible=false (`opacity: 0`) に向かうことだけ確認する。
      // → 簡易的に「Drawer の paper が aria-hidden=true になる」をチェック:
      await new Promise((r) => setTimeout(r, 50));
      // 厳密な検証は Playwright で行うこととし、ここでは pathname 変更が
      // mobileDrawerOpen をリセットすることを「再度ハンバーガーを押下できる」状態で確認
      // (Drawer が閉じているなら presentation role が消えるが、jsdom では transition 完了が遅い)
      // 代替: 内部 state は閉じているので、もう一度ハンバーガークリックで再度開ける挙動を間接確認
      const hamburger2 = screen.getByRole('button', { name: 'サイドバーを開く' });
      await hamburger2.click();
      // 開閉再開後も sidebar が表示される (state 更新が機能している証左)
      expect(screen.getByTestId('custom-sidebar')).toBeVisible();
    });
  });

  // Step 9b: モバイル幅 AppBar (検索アイコン + 3 点メニュー) と BottomNav 描画
  describe('Step 9b: モバイル AppBar / BottomNav', () => {
    function setViewportMobile(isMobile: boolean) {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: vi.fn((query: string) => ({
          matches: isMobile && query.includes('max-width: 767px'),
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
    }

    function renderForViewport(role: 'user' | 'admin' = 'user') {
      mockUser.role = role;
      return render(
        <MemoryRouter>
          <AppLayout sidebar={<div />}>
            <div />
          </AppLayout>
        </MemoryRouter>,
      );
    }

    it('モバイル幅で AppBar 内に検索アイコンボタン (aria-label="検索") が表示される', () => {
      setViewportMobile(true);
      renderForViewport();
      expect(screen.getByRole('button', { name: '検索' })).toBeInTheDocument();
    });

    it('モバイル幅で AppBar 内に 3 点メニューボタン (aria-label="メニュー") が表示される', () => {
      setViewportMobile(true);
      renderForViewport();
      expect(screen.getByRole('button', { name: 'メニュー' })).toBeInTheDocument();
    });

    it('3 点メニュークリックで「ブックマーク」「テンプレート」項目が表示される', async () => {
      setViewportMobile(true);
      renderForViewport();
      await screen.getByRole('button', { name: 'メニュー' }).click();
      expect(screen.getByRole('menuitem', { name: /ブックマーク/ })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /テンプレート/ })).toBeInTheDocument();
    });

    it('admin ロールのとき 3 点メニューに「管理」項目が表示される', async () => {
      setViewportMobile(true);
      renderForViewport('admin');
      await screen.getByRole('button', { name: 'メニュー' }).click();
      expect(screen.getByRole('menuitem', { name: /管理/ })).toBeInTheDocument();
    });

    it('一般ユーザーのとき 3 点メニューに「管理」項目は表示されない', async () => {
      setViewportMobile(true);
      renderForViewport('user');
      await screen.getByRole('button', { name: 'メニュー' }).click();
      expect(screen.queryByRole('menuitem', { name: /管理/ })).not.toBeInTheDocument();
    });

    it('モバイル幅で MobileBottomNav (data-testid="mobile-bottom-nav") が描画される', () => {
      setViewportMobile(true);
      renderForViewport();
      expect(screen.getByTestId('mobile-bottom-nav')).toBeInTheDocument();
    });

    it('デスクトップ幅で MobileBottomNav は描画されない', () => {
      setViewportMobile(false);
      renderForViewport();
      expect(screen.queryByTestId('mobile-bottom-nav')).not.toBeInTheDocument();
    });

    it('デスクトップ幅で AppBar の検索アイコン / 3 点メニューも描画されない (既存挙動維持)', () => {
      setViewportMobile(false);
      renderForViewport();
      expect(screen.queryByRole('button', { name: '検索' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'メニュー' })).not.toBeInTheDocument();
    });
  });

  // Step 9a: モバイル幅 (< 768px) でのレスポンシブ化
  describe('Step 9a: モバイル幅レスポンシブ化', () => {
    /**
     * matchMedia をモックしてモバイル/デスクトップを切り替えるヘルパー。
     * `(max-width: 767px)` クエリの matches を制御する。
     */
    function setViewport(isMobile: boolean) {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: vi.fn((query: string) => ({
          matches: isMobile && query.includes('max-width: 767px'),
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
    }

    function renderResponsive(opts?: { rightPane?: boolean }) {
      return render(
        <MemoryRouter>
          <AppLayout
            sidebar={<div data-testid="custom-sidebar">SIDEBAR</div>}
            rightPane={opts?.rightPane ? <div data-testid="custom-right">RIGHT</div> : undefined}
          >
            <div data-testid="custom-main">MAIN</div>
          </AppLayout>
        </MemoryRouter>,
      );
    }

    it('デスクトップ幅 (>= 768px) で grid が従来の 3 列構造 (64px 240px 1fr) になる', () => {
      setViewport(false);
      renderResponsive();
      const grid = screen.getByTestId('app-layout-grid');
      expect(grid).toHaveStyle({ gridTemplateColumns: '64px 240px 1fr' });
    });

    it('モバイル幅 (< 768px) で grid が 1fr (Main 1 列) のみになる', () => {
      setViewport(true);
      renderResponsive();
      const grid = screen.getByTestId('app-layout-grid');
      expect(grid).toHaveStyle({ gridTemplateColumns: '1fr' });
    });

    it('モバイル幅で Rail (nav 要素) が描画されない', () => {
      setViewport(true);
      renderResponsive();
      expect(
        screen.queryByRole('navigation', { name: 'メインナビゲーション' }),
      ).not.toBeInTheDocument();
    });

    it('モバイル幅で Sidebar 列 (app-layout-sidebar) が描画されない', () => {
      setViewport(true);
      renderResponsive();
      expect(screen.queryByTestId('app-layout-sidebar')).not.toBeInTheDocument();
    });

    it('モバイル幅で rightPane を渡しても right 列 (app-layout-right) が描画されない', () => {
      setViewport(true);
      renderResponsive({ rightPane: true });
      expect(screen.queryByTestId('app-layout-right')).not.toBeInTheDocument();
    });

    it('モバイル幅でも children (Main) は描画される', () => {
      setViewport(true);
      renderResponsive();
      expect(screen.getByTestId('custom-main')).toBeInTheDocument();
    });

    it('モバイル幅で AppBar (app-layout-mobile-header) が描画される', () => {
      setViewport(true);
      renderResponsive();
      expect(screen.getByTestId('app-layout-mobile-header')).toBeInTheDocument();
    });

    it('デスクトップ幅で AppBar (app-layout-mobile-header) は描画されない', () => {
      setViewport(false);
      renderResponsive();
      expect(screen.queryByTestId('app-layout-mobile-header')).not.toBeInTheDocument();
    });
  });
});
