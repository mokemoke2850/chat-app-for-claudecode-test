/**
 * components/Layout/SidebarFooter.tsx のユニットテスト
 *
 * テスト対象: Sidebar 列フッター（ステータス + 表示名 / テーマ切替 / 通知 / プロフィール / ログアウト）
 * 戦略:
 *   - AuthContext / ThemeContext / usePushNotifications をモックする
 *   - useNavigate を vi.fn() で差し替え、プロフィール遷移を検証する
 *   - StatusEditDialog は jsdom で開閉確認可能なため、ダイアログタイトル等で検証
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SidebarFooter from '../components/Layout/SidebarFooter';

const mockToggleTheme = vi.fn();
const mockLogout = vi.fn();
const mockSubscribe = vi.fn();
const mockUnsubscribe = vi.fn();
const mockNavigate = vi.fn();
const mockMe = vi.fn().mockResolvedValue({
  user: { id: 1, username: 'alice', email: 'a@test.com', displayName: null, role: 'user' },
});

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, logout: mockLogout, updateUser: vi.fn() }),
}));

vi.mock('../contexts/ThemeContext', () => ({
  useTheme: () => ({ mode: mockMode, toggleTheme: mockToggleTheme }),
}));

vi.mock('../hooks/usePushNotifications', () => ({
  usePushNotifications: () => ({
    supported: mockPushSupported,
    subscribed: false,
    loading: false,
    error: null,
    subscribe: mockSubscribe,
    unsubscribe: mockUnsubscribe,
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../api/client', () => ({
  api: {
    auth: {
      me: () => mockMe(),
    },
  },
}));

const mockUser: {
  id: number;
  username: string;
  email: string;
  displayName: string | null;
  role: 'user' | 'admin';
  status?: { emoji?: string; text?: string } | null;
} = {
  id: 1,
  username: 'alice',
  email: 'a@test.com',
  displayName: null,
  role: 'user',
  status: null,
};

let mockMode: 'light' | 'dark' = 'light';
let mockPushSupported = false;

beforeEach(() => {
  mockUser.displayName = null;
  mockUser.status = null;
  mockMode = 'light';
  mockPushSupported = false;
  mockToggleTheme.mockClear();
  mockLogout.mockClear();
  mockSubscribe.mockClear();
  mockUnsubscribe.mockClear();
  mockNavigate.mockClear();
});

function renderFooter() {
  return render(
    <MemoryRouter>
      <SidebarFooter />
    </MemoryRouter>,
  );
}

describe('SidebarFooter', () => {
  describe('表示', () => {
    it('ステータス絵文字が表示される（status.emoji がある場合）', () => {
      mockUser.status = { emoji: '🔵', text: 'available' };
      renderFooter();
      expect(screen.getByText('🔵')).toBeInTheDocument();
    });

    // Step 8e-3: Rail に統合され 64px 幅になったため、displayName/username は
    // SidebarFooter 内に直接テキスト表示されず Tooltip 経由でのみ表示される。
    it('表示名は SidebarFooter 内に直接表示されない (Step 8e-3: Tooltip 化)', () => {
      mockUser.displayName = '田中花子';
      renderFooter();
      expect(screen.queryByText('田中花子')).not.toBeInTheDocument();
    });

    it('displayName が null のとき username も SidebarFooter 内に直接表示されない (Step 8e-3)', () => {
      renderFooter();
      expect(screen.queryByText('alice')).not.toBeInTheDocument();
    });

    it('テーマ切替ボタン（ダーク/ライト）が表示される', () => {
      renderFooter();
      expect(screen.getByRole('button', { name: 'ダークモードに切り替える' })).toBeInTheDocument();
    });

    it('プロフィール設定ボタンが表示される', () => {
      renderFooter();
      expect(screen.getByRole('button', { name: 'プロフィール設定' })).toBeInTheDocument();
    });

    it('ログアウトボタンが表示される', () => {
      renderFooter();
      expect(screen.getByRole('button', { name: 'ログアウト' })).toBeInTheDocument();
    });

    it('Push 通知サポート時、通知トグルボタンが表示される', () => {
      mockPushSupported = true;
      renderFooter();
      expect(screen.getByRole('button', { name: '通知を有効にする' })).toBeInTheDocument();
    });

    it('Push 通知未対応時、通知トグルボタンが表示されない', () => {
      mockPushSupported = false;
      renderFooter();
      expect(screen.queryByRole('button', { name: '通知を有効にする' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '通知を無効にする' })).not.toBeInTheDocument();
    });
  });

  describe('動作', () => {
    it('ステータスボタンをクリックするとステータス編集ダイアログが開く', async () => {
      renderFooter();
      const statusButton = screen.getByRole('button', { name: 'ステータスを設定' });
      await userEvent.click(statusButton);
      // StatusEditDialog 内のタイトル文字列で開いたことを確認
      expect(await screen.findByRole('dialog')).toBeInTheDocument();
    });

    it('テーマ切替ボタンをクリックすると toggleTheme が呼ばれる', async () => {
      renderFooter();
      const button = screen.getByRole('button', { name: 'ダークモードに切り替える' });
      await userEvent.click(button);
      expect(mockToggleTheme).toHaveBeenCalledTimes(1);
    });

    it('プロフィール設定ボタンをクリックすると /profile に遷移する', async () => {
      renderFooter();
      const button = screen.getByRole('button', { name: 'プロフィール設定' });
      await userEvent.click(button);
      expect(mockNavigate).toHaveBeenCalledWith('/profile');
    });

    it('ログアウトボタンをクリックすると logout が呼ばれる', async () => {
      renderFooter();
      const button = screen.getByRole('button', { name: 'ログアウト' });
      await userEvent.click(button);
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });
  });
});
