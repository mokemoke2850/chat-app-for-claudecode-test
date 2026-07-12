/**
 * components/Layout/Rail.tsx のユニットテスト
 *
 * テスト対象: 左 64px のアイコンレール
 * 戦略:
 *   - MemoryRouter でラップして react-router の NavLink を動作させる
 *   - AuthContext をモックして role 切替を検証する
 *   - aria-label / role="link" を頼りに各ナビ項目を特定する
 */

import { render, screen, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Rail from '../components/Layout/Rail';

const notificationMocks = vi.hoisted(() => ({
  list: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
}));
vi.mock('../api/client', () => ({ api: { appNotifications: { list: notificationMocks.list } } }));
vi.mock('../contexts/SocketContext', () => ({ useSocket: () => ({ on: notificationMocks.on, off: notificationMocks.off }) }));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

let mockDmUnreadCount = 0;
vi.mock('../hooks/useDmUnreadCount', () => ({
  useDmUnreadCount: () => mockDmUnreadCount,
}));

let mockMentionUnreadCount = 0;
vi.mock('../hooks/useMentionUnreadCount', () => ({
  useMentionUnreadCount: () => mockMentionUnreadCount,
}));

// Step 8e-3: SidebarFooter は Rail 内で render されるが、SidebarFooter 自体は
// SidebarFooter.test.tsx で検証する。Rail テストでは stub にして依存連鎖を切る。
vi.mock('../components/Layout/SidebarFooter', () => ({
  default: () => (
    <div data-testid="sidebar-footer-stub">
      <button aria-label="ステータスを設定">stub-status</button>
      <button aria-label="ダークモードに切り替える">stub-theme</button>
      <button aria-label="プロフィール設定">stub-profile</button>
      <button aria-label="ログアウト">stub-logout</button>
    </div>
  ),
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
  mockUser.role = 'user';
  mockDmUnreadCount = 0;
  mockMentionUnreadCount = 0;
  notificationMocks.list.mockResolvedValue({ items: [], unreadCount: 0 });
  notificationMocks.on.mockClear();
  notificationMocks.off.mockClear();
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

function renderRail(initialPath = '/', role: 'user' | 'admin' = 'user') {
  mockUser.role = role;
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Rail />
    </MemoryRouter>,
  );
}

describe('Rail', () => {
  describe('通知センター', () => {
    it('初期の未読件数、Socket通知、既読同期イベントをBellバッジへ反映する', async () => {
      notificationMocks.list.mockResolvedValue({ items: [], unreadCount: 2 });
      renderRail();
      await waitFor(() => expect(screen.getByRole('link', { name: '通知 (2 件未読)' })).toBeInTheDocument());
      const handler = notificationMocks.on.mock.calls.find(([event]) => event === 'notification_created')?.[1] as (data: { unreadCount: number }) => void;
      act(() => handler({ unreadCount: 4 }));
      expect(screen.getByRole('link', { name: '通知 (4 件未読)' })).toBeInTheDocument();
      act(() => window.dispatchEvent(new CustomEvent('app-notification-unread', { detail: 1 })));
      expect(screen.getByRole('link', { name: '通知 (1 件未読)' })).toBeInTheDocument();
    });
  });
  describe('ナビゲーション項目の表示', () => {
    it('上部にホーム / チャット / DM / カレンダー / タスク / ブックマーク / 検索 / 通知のアイコンが表示される', () => {
      renderRail();
      expect(screen.getByRole('link', { name: '受信箱' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'チャット' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'DM' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'カレンダー' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'タスク' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'ブックマーク' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: '検索' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: '通知' })).toBeInTheDocument();
    });

    it('区切り線の下にテンプレートのアイコンが表示される', () => {
      renderRail();
      expect(screen.getByRole('link', { name: 'テンプレート' })).toBeInTheDocument();
    });

    it('admin ロールのとき、下部に管理アイコンが表示される', () => {
      renderRail('/', 'admin');
      expect(screen.getByRole('link', { name: '管理' })).toBeInTheDocument();
    });

    it('user ロールのとき、下部に管理アイコンが表示されない', () => {
      renderRail('/', 'user');
      expect(screen.queryByRole('link', { name: '管理' })).not.toBeInTheDocument();
    });
  });

  describe('リンク先', () => {
    it.each([
      { label: '受信箱', href: '/' },
      { label: 'DM', href: '/dm' },
      { label: 'カレンダー', href: '/calendar' },
      { label: 'タスク', href: '/tasks' },
      { label: 'ブックマーク', href: '/bookmarks' },
      { label: 'テンプレート', href: '/templates' },
      { label: '検索', href: '/search' },
      { label: '通知', href: '/notifications' },
    ])('$label アイコンは $href にリンクする', ({ label, href }) => {
      renderRail();
      expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', href);
    });

    it('admin ロール時、管理アイコンは /admin にリンクする', () => {
      renderRail('/', 'admin');
      expect(screen.getByRole('link', { name: '管理' })).toHaveAttribute('href', '/admin');
    });
  });

  describe('ロゴ', () => {
    it('最上部に Chat App ロゴ要素が表示される', () => {
      renderRail();
      expect(screen.getByRole('img', { name: 'Chat App ロゴ' })).toBeInTheDocument();
    });
  });

  describe('DM 未読バッジ (Step 2c)', () => {
    it('useDmUnreadCount が 0 を返すとき、DM アイコンにバッジは表示されない', () => {
      mockDmUnreadCount = 0;
      renderRail();
      expect(screen.queryByText('5')).not.toBeInTheDocument();
      expect(screen.queryByText('9+')).not.toBeInTheDocument();
    });

    it('useDmUnreadCount が 5 を返すとき、DM アイコンに "5" のバッジが表示される', () => {
      mockDmUnreadCount = 5;
      renderRail();
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('useDmUnreadCount が 12 を返すとき、DM アイコンに "9+" のバッジが表示される (max=9)', () => {
      mockDmUnreadCount = 12;
      renderRail();
      expect(screen.getByText('9+')).toBeInTheDocument();
    });

    it('未読があるとき、DM アイコンの aria-label に未読数の情報が含まれる', () => {
      mockDmUnreadCount = 3;
      renderRail();
      const dmLink = screen.getByRole('link', { name: /DM.*3.*未読/ });
      expect(dmLink).toBeInTheDocument();
    });
  });

  describe('現在のパスのハイライト (aria-current)', () => {
    it('現在のパスが /dm のとき、DM アイコンに aria-current="page" が付与される', () => {
      renderRail('/dm');
      expect(screen.getByRole('link', { name: 'DM' })).toHaveAttribute('aria-current', 'page');
    });

    it('現在のパスが /calendar のとき、カレンダーアイコンに aria-current="page" が付与される', () => {
      renderRail('/calendar');
      expect(screen.getByRole('link', { name: 'カレンダー' })).toHaveAttribute(
        'aria-current',
        'page',
      );
    });

    it('現在のパスが /tasks のとき、タスクアイコンに aria-current="page" が付与される', () => {
      renderRail('/tasks');
      expect(screen.getByRole('link', { name: 'タスク' })).toHaveAttribute('aria-current', 'page');
    });

    it('現在のパスが /tasks のとき、ホームアイコンには aria-current が付与されない', () => {
      renderRail('/tasks');
      expect(screen.getByRole('link', { name: '受信箱' })).not.toHaveAttribute('aria-current');
    });

    it('現在のパスが / のとき、ホームアイコンに aria-current="page" が付与される', () => {
      renderRail('/');
      expect(screen.getByRole('link', { name: '受信箱' })).toHaveAttribute('aria-current', 'page');
    });
  });

  describe('メンション未読バッジ (Step 6d / 保留 TODO #5 解消)', () => {
    it('useMentionUnreadCount が 0 のとき、ホームアイコンにメンション数バッジは表示されない', () => {
      mockMentionUnreadCount = 0;
      // ホームアイコン外の他リンクのバッジ "3" 等の干渉を避けるため、現在パスは /chat
      renderRail('/chat');
      const homeLink = screen.getByRole('link', { name: '受信箱' });
      // バッジが「不可視（0）」状態であること（DOM 上に MuiBadge-invisible が付く）
      expect(homeLink.querySelector('.MuiBadge-invisible')).not.toBeNull();
    });

    it('useMentionUnreadCount が 3 のとき、ホームアイコンに "3" のバッジが表示される', () => {
      mockMentionUnreadCount = 3;
      renderRail('/chat');
      // DM 未読は 0 のため、画面上の "3" はホームアイコンのバッジ由来
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('useMentionUnreadCount が 12 のとき、ホームアイコンに "9+" のバッジが表示される (max=9)', () => {
      mockMentionUnreadCount = 12;
      renderRail('/chat');
      expect(screen.getByText('9+')).toBeInTheDocument();
    });

    it('未読メンションがあるとき、ホームアイコンの aria-label に未読数の情報が含まれる', () => {
      mockMentionUnreadCount = 4;
      renderRail('/chat');
      const homeLink = screen.getByRole('link', { name: /受信箱.*4.*未読/ });
      expect(homeLink).toBeInTheDocument();
    });
  });

  // Step 8d: Sidebar トグルボタン (TODO #17 解消)
  describe('Step 8d: Sidebar トグルボタン', () => {
    function renderRailWithToggle(sidebarOpen: boolean, onToggle = vi.fn()) {
      return render(
        <MemoryRouter>
          <Rail sidebarOpen={sidebarOpen} onToggleSidebar={onToggle} />
        </MemoryRouter>,
      );
    }

    it('Rail のロゴ直下に Sidebar トグルボタンが表示される', () => {
      renderRailWithToggle(true);
      // 開でも閉でも button としては存在する
      expect(screen.getByRole('button', { name: /サイドバーを(開く|閉じる)/ })).toBeInTheDocument();
    });

    it('sidebarOpen=true のとき aria-label="サイドバーを閉じる" のボタンが表示される', () => {
      renderRailWithToggle(true);
      expect(screen.getByRole('button', { name: 'サイドバーを閉じる' })).toBeInTheDocument();
    });

    it('sidebarOpen=false のとき aria-label="サイドバーを開く" のボタンが表示される', () => {
      renderRailWithToggle(false);
      expect(screen.getByRole('button', { name: 'サイドバーを開く' })).toBeInTheDocument();
    });

    it('トグルボタンクリックで onToggleSidebar が呼ばれる', async () => {
      const userEvent = (await import('@testing-library/user-event')).default;
      const onToggle = vi.fn();
      renderRailWithToggle(true, onToggle);
      await userEvent.click(screen.getByRole('button', { name: 'サイドバーを閉じる' }));
      expect(onToggle).toHaveBeenCalled();
    });
  });

  // Step 8b: チャット項目を Rail に追加 (TODO #16 解消)
  describe('Step 8b: チャット項目追加', () => {
    it('「チャット」項目 (/chat へのリンク) が表示される', () => {
      renderRail();
      const chatLink = screen.getByRole('link', { name: 'チャット' });
      expect(chatLink).toBeInTheDocument();
      expect(chatLink).toHaveAttribute('href', '/chat');
    });

    it('「チャット」項目は受信箱の直後 (上部 2 番目) に配置されている', () => {
      renderRail();
      const links = screen.getAllByRole('link');
      // 上部ナビの最初の 2 つは受信箱 / チャット の順
      expect(links[0]).toHaveAttribute('aria-label', '受信箱');
      expect(links[1]).toHaveAttribute('aria-label', 'チャット');
    });
  });

  // Issue #259: Rail の折り畳み状態を localStorage に永続化
  describe('折り畳み状態の localStorage 永続化 (Issue #259)', () => {
    describe('初回表示（未保存時のデフォルト値）', () => {
      it('localStorage に rail.collapsed が存在しない場合、折り畳み状態は false（展開）になる', () => {
        // localStorage に何もセットしない状態でレンダリング
        renderRail();
        // 展開状態 = Rail 折り畳みトグルボタンが「折り畳む」ラベルで存在する
        expect(screen.getByRole('button', { name: 'Rail を折り畳む' })).toBeInTheDocument();
      });
    });

    describe('リロード後の状態復元', () => {
      it('localStorage["rail.collapsed"] が "true" のとき、折り畳み状態 true で初期化される', () => {
        localStorage.setItem('rail.collapsed', 'true');
        renderRail();
        // 折り畳み状態 = Rail 折り畳みトグルボタンが「展開する」ラベルになる
        expect(screen.getByRole('button', { name: 'Rail を展開する' })).toBeInTheDocument();
      });

      it('localStorage["rail.collapsed"] が "false" のとき、折り畳み状態 false で初期化される', () => {
        localStorage.setItem('rail.collapsed', 'false');
        renderRail();
        expect(screen.getByRole('button', { name: 'Rail を折り畳む' })).toBeInTheDocument();
      });
    });

    describe('トグル時の localStorage への保存', () => {
      it('折り畳みボタンをクリックすると localStorage["rail.collapsed"] に "true" が保存される', async () => {
        const userEvent = (await import('@testing-library/user-event')).default;
        renderRail();
        // 展開状態から折り畳みボタンをクリック
        await act(async () => {
          await userEvent.click(screen.getByRole('button', { name: 'Rail を折り畳む' }));
        });
        expect(localStorage.getItem('rail.collapsed')).toBe('true');
      });

      it('展開ボタンをクリックすると localStorage["rail.collapsed"] に "false" が保存される', async () => {
        const userEvent = (await import('@testing-library/user-event')).default;
        localStorage.setItem('rail.collapsed', 'true');
        renderRail();
        // 折り畳み状態から展開ボタンをクリック
        await act(async () => {
          await userEvent.click(screen.getByRole('button', { name: 'Rail を展開する' }));
        });
        expect(localStorage.getItem('rail.collapsed')).toBe('false');
      });

      it('複数回トグルしても最後の状態のみ localStorage に保存される', async () => {
        const userEvent = (await import('@testing-library/user-event')).default;
        renderRail();
        // 展開 → 折り畳み → 展開 の順にクリック
        await act(async () => {
          await userEvent.click(screen.getByRole('button', { name: 'Rail を折り畳む' }));
        });
        await act(async () => {
          await userEvent.click(screen.getByRole('button', { name: 'Rail を展開する' }));
        });
        // 最終状態は展開 → "false"
        expect(localStorage.getItem('rail.collapsed')).toBe('false');
      });
    });
  });

  // Issue #259 バグ修正: collapsed state が UI に反映されているか検証
  // 元々のテストでは aria-label とlocalStorage書き込みのみを検証しており、
  // ナビ項目の表示/非表示という視覚的変化を検出できていなかった
  describe('折り畳み状態の視覚的反映 (Issue #259 バグ修正)', () => {
    it('collapsed=true で初期化したとき、ナビゲーションリンクが表示されない', () => {
      localStorage.setItem('rail.collapsed', 'true');
      renderRail();
      expect(screen.queryByRole('link', { name: '受信箱' })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'チャット' })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'DM' })).not.toBeInTheDocument();
    });

    it('collapsed=false（展開時）、ナビゲーションリンクが表示される', () => {
      localStorage.setItem('rail.collapsed', 'false');
      renderRail();
      expect(screen.getByRole('link', { name: '受信箱' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'チャット' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'DM' })).toBeInTheDocument();
    });

    it('collapsed=true のとき、ロゴが表示されない', () => {
      localStorage.setItem('rail.collapsed', 'true');
      renderRail();
      expect(screen.queryByRole('img', { name: 'Chat App ロゴ' })).not.toBeInTheDocument();
    });

    it('collapsed=true のとき、Rail 展開ボタンは表示されている（再展開のため必須）', () => {
      localStorage.setItem('rail.collapsed', 'true');
      renderRail();
      expect(screen.getByRole('button', { name: 'Rail を展開する' })).toBeInTheDocument();
    });

    it('折り畳みボタンをクリックすると、ナビゲーションリンクが非表示になる', async () => {
      const userEvent = (await import('@testing-library/user-event')).default;
      renderRail();
      // 初期状態は展開 → ナビが見える
      expect(screen.getByRole('link', { name: '受信箱' })).toBeInTheDocument();

      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'Rail を折り畳む' }));
      });
      // 折り畳み後 → ナビが消える
      expect(screen.queryByRole('link', { name: '受信箱' })).not.toBeInTheDocument();
    });

    it('展開ボタンをクリックすると、ナビゲーションリンクが再表示される', async () => {
      const userEvent = (await import('@testing-library/user-event')).default;
      localStorage.setItem('rail.collapsed', 'true');
      renderRail();
      // 初期状態は折り畳み → ナビが見えない
      expect(screen.queryByRole('link', { name: '受信箱' })).not.toBeInTheDocument();

      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'Rail を展開する' }));
      });
      // 展開後 → ナビが見える
      expect(screen.getByRole('link', { name: '受信箱' })).toBeInTheDocument();
    });
  });

  // SidebarFooter (ステータス / テーマ / 通知 / プロフィール / ログアウト) は Rail に統合
  describe('SidebarFooter 統合', () => {
    it('Rail 内に「ステータスを設定」ボタンが表示される', () => {
      renderRail();
      expect(screen.getByRole('button', { name: 'ステータスを設定' })).toBeInTheDocument();
    });

    it('Rail 内に「テーマ切替」ボタンが表示される', () => {
      renderRail();
      expect(screen.getByRole('button', { name: /モードに切り替える/ })).toBeInTheDocument();
    });

    it('Rail 内に「プロフィール設定」ボタンが表示される', () => {
      renderRail();
      expect(screen.getByRole('button', { name: 'プロフィール設定' })).toBeInTheDocument();
    });

    it('Rail 内に「ログアウト」ボタンが表示される', () => {
      renderRail();
      expect(screen.getByRole('button', { name: 'ログアウト' })).toBeInTheDocument();
    });

    it('ユーザー名 (alice) は Rail 内に直接表示されない (Tooltip のみ)', () => {
      renderRail();
      expect(screen.queryByText('alice')).not.toBeInTheDocument();
    });
  });
});
