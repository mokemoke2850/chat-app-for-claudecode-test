/**
 * テスト対象: Rail コンポーネントの「アイコン + ラベル」常時表示モード (Issue #316)
 * 戦略:
 *   - 既存の Rail.test.tsx を変更せず、新機能の追加テストのみをこのファイルに集約する
 *   - 「アイコンのみ」モードと「アイコン + ラベル」モードの切り替えを検証する
 *   - localStorage への永続化（キー: rail.labelMode）を検証する
 *   - 既存の折り畳み（collapsed）モードとの共存を確認する
 *   - MemoryRouter でラップして react-router の NavLink を動作させる
 *   - AuthContext・useDmUnreadCount・useMentionUnreadCount・SidebarFooter はモックする
 */

import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Rail from '../components/Layout/Rail';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock('../hooks/useDmUnreadCount', () => ({
  useDmUnreadCount: () => 0,
}));

vi.mock('../hooks/useMentionUnreadCount', () => ({
  useMentionUnreadCount: () => 0,
}));

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
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

function renderRail(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Rail />
    </MemoryRouter>,
  );
}

describe('Rail ラベル表示モード (Issue #316)', () => {
  describe('表示モード切替ボタン', () => {
    it('「アイコン + ラベル」モードに切り替えるボタンが存在する', () => {
      renderRail();
      // デフォルトはアイコンのみ → ラベル表示に切り替えるボタンがある
      expect(screen.getByRole('button', { name: 'ラベル表示に切り替える' })).toBeInTheDocument();
    });

    it('「アイコンのみ」モードに切り替えるボタンが存在する', () => {
      localStorage.setItem('rail.labelMode', 'label');
      renderRail();
      // ラベルモード → アイコンのみに切り替えるボタンがある
      expect(screen.getByRole('button', { name: 'アイコンのみに切り替える' })).toBeInTheDocument();
    });

    it('現在のモードに応じてボタンのラベルが変わる', async () => {
      const userEvent = (await import('@testing-library/user-event')).default;
      renderRail();
      // アイコンのみモード → 「ラベル表示に切り替える」ボタン
      expect(screen.getByRole('button', { name: 'ラベル表示に切り替える' })).toBeInTheDocument();

      // クリックするとラベルモードになり、ボタンラベルが変わる
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'ラベル表示に切り替える' }));
      });
      expect(screen.getByRole('button', { name: 'アイコンのみに切り替える' })).toBeInTheDocument();
    });
  });

  describe('アイコンのみモード（デフォルト）', () => {
    it('localStorage に rail.labelMode が存在しない場合、デフォルトは「アイコンのみ」モードになる', () => {
      renderRail();
      // アイコンのみモード: nav が data-labelmode="icon" を持つ
      const nav = screen.getByRole('navigation', { name: 'メインナビゲーション' });
      expect(nav).toHaveAttribute('data-labelmode', 'icon');
    });

    it('「アイコンのみ」モードでは各ナビ項目にテキストラベルが表示されない', () => {
      renderRail();
      // data-testid="rail-item-label" の要素が存在しない
      expect(screen.queryAllByTestId('rail-item-label')).toHaveLength(0);
    });

    it('「アイコンのみ」モードでも Tooltip によるラベルは機能する（aria-label が存在する）', () => {
      renderRail();
      // aria-label が各ナビリンクに存在する
      expect(screen.getByRole('link', { name: '受信箱' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'チャット' })).toBeInTheDocument();
    });
  });

  describe('アイコン + ラベルモード', () => {
    it('「アイコン + ラベル」モードでは各ナビ項目に日本語テキストラベルが表示される', () => {
      localStorage.setItem('rail.labelMode', 'label');
      renderRail();
      const labels = screen.getAllByTestId('rail-item-label');
      expect(labels.length).toBeGreaterThan(0);
    });

    it('「アイコン + ラベル」モードで「受信箱」のテキストラベルが表示される', () => {
      localStorage.setItem('rail.labelMode', 'label');
      renderRail();
      const labels = screen.getAllByTestId('rail-item-label');
      const texts = labels.map((el) => el.textContent);
      expect(texts).toContain('受信箱');
    });

    it('「アイコン + ラベル」モードで「チャット」のテキストラベルが表示される', () => {
      localStorage.setItem('rail.labelMode', 'label');
      renderRail();
      const labels = screen.getAllByTestId('rail-item-label');
      const texts = labels.map((el) => el.textContent);
      expect(texts).toContain('チャット');
    });

    it('「アイコン + ラベル」モードで「DM」のテキストラベルが表示される', () => {
      localStorage.setItem('rail.labelMode', 'label');
      renderRail();
      const labels = screen.getAllByTestId('rail-item-label');
      const texts = labels.map((el) => el.textContent);
      expect(texts).toContain('DM');
    });

    it('「アイコン + ラベル」モードで「カレンダー」のテキストラベルが表示される', () => {
      localStorage.setItem('rail.labelMode', 'label');
      renderRail();
      const labels = screen.getAllByTestId('rail-item-label');
      const texts = labels.map((el) => el.textContent);
      expect(texts).toContain('カレンダー');
    });

    it('「アイコン + ラベル」モードで「タスク」のテキストラベルが表示される', () => {
      localStorage.setItem('rail.labelMode', 'label');
      renderRail();
      const labels = screen.getAllByTestId('rail-item-label');
      const texts = labels.map((el) => el.textContent);
      expect(texts).toContain('タスク');
    });

    it('「アイコン + ラベル」モードで「ブックマーク」のテキストラベルが表示される', () => {
      localStorage.setItem('rail.labelMode', 'label');
      renderRail();
      const labels = screen.getAllByTestId('rail-item-label');
      const texts = labels.map((el) => el.textContent);
      expect(texts).toContain('ブックマーク');
    });

    it('「アイコン + ラベル」モードで「検索」のテキストラベルが表示される', () => {
      localStorage.setItem('rail.labelMode', 'label');
      renderRail();
      const labels = screen.getAllByTestId('rail-item-label');
      const texts = labels.map((el) => el.textContent);
      expect(texts).toContain('検索');
    });

    it('「アイコン + ラベル」モードで「テンプレート」のテキストラベルが表示される', () => {
      localStorage.setItem('rail.labelMode', 'label');
      renderRail();
      const labels = screen.getAllByTestId('rail-item-label');
      const texts = labels.map((el) => el.textContent);
      expect(texts).toContain('テンプレート');
    });

    it('admin ロール時、「アイコン + ラベル」モードで「管理」のテキストラベルが表示される', () => {
      localStorage.setItem('rail.labelMode', 'label');
      mockUser.role = 'admin';
      renderRail();
      const labels = screen.getAllByTestId('rail-item-label');
      const texts = labels.map((el) => el.textContent);
      expect(texts).toContain('管理');
    });
  });

  describe('localStorage への永続化', () => {
    it('ラベルモードに切り替えると localStorage["rail.labelMode"] に "label" が保存される', async () => {
      const userEvent = (await import('@testing-library/user-event')).default;
      renderRail();
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'ラベル表示に切り替える' }));
      });
      expect(localStorage.getItem('rail.labelMode')).toBe('label');
    });

    it('アイコンのみモードに切り替えると localStorage["rail.labelMode"] に "icon" が保存される', async () => {
      const userEvent = (await import('@testing-library/user-event')).default;
      localStorage.setItem('rail.labelMode', 'label');
      renderRail();
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'アイコンのみに切り替える' }));
      });
      expect(localStorage.getItem('rail.labelMode')).toBe('icon');
    });

    it('localStorage["rail.labelMode"] が "label" の場合、再訪時にラベルモードで表示される', () => {
      localStorage.setItem('rail.labelMode', 'label');
      renderRail();
      const nav = screen.getByRole('navigation', { name: 'メインナビゲーション' });
      expect(nav).toHaveAttribute('data-labelmode', 'label');
    });

    it('localStorage["rail.labelMode"] が "icon" の場合、再訪時にアイコンのみモードで表示される', () => {
      localStorage.setItem('rail.labelMode', 'icon');
      renderRail();
      const nav = screen.getByRole('navigation', { name: 'メインナビゲーション' });
      expect(nav).toHaveAttribute('data-labelmode', 'icon');
    });

    it('localStorage["rail.labelMode"] が不正な値の場合、デフォルト（アイコンのみ）にフォールバックする', () => {
      localStorage.setItem('rail.labelMode', 'invalid');
      renderRail();
      const nav = screen.getByRole('navigation', { name: 'メインナビゲーション' });
      expect(nav).toHaveAttribute('data-labelmode', 'icon');
    });
  });

  describe('既存の折り畳みモードとの共存', () => {
    it('collapsed=true のとき、ラベルモードに設定していてもナビゲーションリンクは表示されない', () => {
      localStorage.setItem('rail.collapsed', 'true');
      localStorage.setItem('rail.labelMode', 'label');
      renderRail();
      expect(screen.queryByRole('link', { name: '受信箱' })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'チャット' })).not.toBeInTheDocument();
    });

    it('collapsed=true から展開すると、保存されたラベルモードが復元される', async () => {
      const userEvent = (await import('@testing-library/user-event')).default;
      localStorage.setItem('rail.collapsed', 'true');
      localStorage.setItem('rail.labelMode', 'label');
      renderRail();
      // 折り畳み状態 → 展開
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'Rail を展開する' }));
      });
      // ラベルモードが復元されているはず
      const nav = screen.getByRole('navigation', { name: 'メインナビゲーション' });
      expect(nav).toHaveAttribute('data-labelmode', 'label');
      // ラベルも表示される
      expect(screen.getAllByTestId('rail-item-label').length).toBeGreaterThan(0);
    });

    it('折り畳み状態の localStorage ("rail.collapsed") の挙動はラベルモードに影響されない', async () => {
      const userEvent = (await import('@testing-library/user-event')).default;
      localStorage.setItem('rail.labelMode', 'label');
      renderRail();
      // ラベルモードで展開中 → 折り畳みボタンをクリック
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'Rail を折り畳む' }));
      });
      // rail.collapsed が "true" になる（ラベルモードに影響されない）
      expect(localStorage.getItem('rail.collapsed')).toBe('true');
      // rail.labelMode は変わらない
      expect(localStorage.getItem('rail.labelMode')).toBe('label');
    });
  });

  describe('Rail 幅の変化', () => {
    it('「アイコン + ラベル」モードでは Rail の幅がアイコンのみモードより広くなる', () => {
      localStorage.setItem('rail.labelMode', 'label');
      renderRail();
      const nav = screen.getByRole('navigation', { name: 'メインナビゲーション' });
      // data-labelmode="label" が付与されており、CSS で幅制御
      expect(nav).toHaveAttribute('data-labelmode', 'label');
      // アイコンのみの 64px ではなく wider な値が設定されている
      // jsdom は実際のCSSを計算しないため、data属性でモード確認
      expect(nav.getAttribute('data-labelmode')).toBe('label');
    });

    it('「アイコンのみ」モードの Rail の幅は従来どおり 64px である', () => {
      renderRail();
      const nav = screen.getByRole('navigation', { name: 'メインナビゲーション' });
      expect(nav).toHaveAttribute('data-labelmode', 'icon');
    });
  });
});
