/**
 * ProfilePage のパスワード変更フォームに関するテスト
 *
 * テスト対象: pages/ProfilePage.tsx（パスワード変更セクション）
 * 戦略:
 *   - AuthContext をモックして現在のユーザー情報を注入する
 *   - api.auth.changePassword をモックして HTTP 通信を差し替える
 *   - useNavigate・SnackbarContext をモックしてルーティング・通知を差し替える
 *
 * 注意: AGENTS.md のテストファイル命名規則に従い、テスト対象ソースファイル名に合わせて
 * ProfilePage.changePassword.test.tsx とする（ProfilePage に追加される機能のため）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfilePage from '../pages/ProfilePage';

const mockChangePassword = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());
const mockShowSuccess = vi.hoisted(() => vi.fn());
const mockShowError = vi.hoisted(() => vi.fn());

const mockUserState = vi.hoisted(() => ({
  id: 1,
  username: 'alice',
  email: 'alice@example.com',
  avatarUrl: null as string | null,
  displayName: null as string | null,
  location: null as string | null,
  createdAt: '2024-01-01T00:00:00Z',
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUserState,
    updateUser: vi.fn(),
  }),
}));

vi.mock('../api/client', () => ({
  api: {
    auth: {
      updateProfile: vi.fn(),
      changePassword: mockChangePassword,
    },
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../contexts/SnackbarContext', () => ({
  useSnackbar: () => ({
    showSuccess: mockShowSuccess,
    showError: mockShowError,
    showInfo: vi.fn(),
  }),
}));

// Step 8a: ProfilePage が AppLayout を内側に含むようになったため最小スタブ化する
vi.mock('../components/Layout/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout-stub">{children}</div>
  ),
}));

// AccessibilityContext: ProfilePage が useAccessibility を使うため最小スタブ化
vi.mock('../contexts/AccessibilityContext', () => ({
  useAccessibility: () => ({
    fontSize: 'medium' as const,
    highContrast: false,
    setFontSize: vi.fn(),
    setHighContrast: vi.fn(),
  }),
}));

// DensityContext モック（ProfilePage が useDensity を使用するため）
vi.mock('../contexts/DensityContext', () => ({
  useDensity: () => ({
    density: 'cozy',
    setDensity: vi.fn(),
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

async function fillForm(opts: { current?: string; next?: string; confirm?: string }) {
  if (opts.current !== undefined) {
    await userEvent.type(screen.getByLabelText('現在のパスワード'), opts.current);
  }
  if (opts.next !== undefined) {
    await userEvent.type(screen.getByLabelText('新しいパスワード'), opts.next);
  }
  if (opts.confirm !== undefined) {
    await userEvent.type(screen.getByLabelText('新しいパスワード（確認）'), opts.confirm);
  }
}

describe('ProfilePage - パスワード変更フォーム', () => {
  describe('バリデーション（クライアント側）', () => {
    it('新しいパスワードが 8 文字未満の場合、送信前にエラーメッセージが表示される', async () => {
      render(<ProfilePage />);
      await fillForm({ current: 'oldpass', next: 'short', confirm: 'short' });
      await userEvent.click(screen.getByRole('button', { name: 'パスワードを変更' }));
      expect(screen.getByText('新しいパスワードは8文字以上で入力してください')).toBeInTheDocument();
      expect(mockChangePassword).not.toHaveBeenCalled();
    });

    it('新しいパスワードと確認用パスワードが一致しない場合、送信前にエラーメッセージが表示される', async () => {
      render(<ProfilePage />);
      await fillForm({ current: 'oldpass', next: 'newpassword1', confirm: 'newpassword2' });
      await userEvent.click(screen.getByRole('button', { name: 'パスワードを変更' }));
      expect(screen.getByText('新しいパスワードが一致しません')).toBeInTheDocument();
      expect(mockChangePassword).not.toHaveBeenCalled();
    });

    it('現在のパスワードが空のまま送信しようとした場合、エラーメッセージが表示される', async () => {
      render(<ProfilePage />);
      await fillForm({ next: 'newpassword1', confirm: 'newpassword1' });
      await userEvent.click(screen.getByRole('button', { name: 'パスワードを変更' }));
      expect(screen.getByText('現在のパスワードを入力してください')).toBeInTheDocument();
      expect(mockChangePassword).not.toHaveBeenCalled();
    });

    it('すべての入力が有効な場合、バリデーションエラーは表示されない', async () => {
      mockChangePassword.mockResolvedValue(undefined);
      render(<ProfilePage />);
      await fillForm({ current: 'oldpass', next: 'newpassword1', confirm: 'newpassword1' });
      await userEvent.click(screen.getByRole('button', { name: 'パスワードを変更' }));
      expect(screen.queryByText(/8文字以上/)).toBeNull();
      expect(screen.queryByText(/一致しません/)).toBeNull();
      expect(screen.queryByText(/現在のパスワードを入力/)).toBeNull();
    });
  });

  describe('API 呼び出し', () => {
    it('有効な入力で送信すると api.auth.changePassword が正しいパラメータで呼ばれる', async () => {
      mockChangePassword.mockResolvedValue(undefined);
      render(<ProfilePage />);
      await fillForm({ current: 'oldpass', next: 'newpassword1', confirm: 'newpassword1' });
      await userEvent.click(screen.getByRole('button', { name: 'パスワードを変更' }));
      await waitFor(() => {
        expect(mockChangePassword).toHaveBeenCalledWith({
          currentPassword: 'oldpass',
          newPassword: 'newpassword1',
          confirmPassword: 'newpassword1',
        });
      });
    });

    it('送信中はボタンが無効化される', async () => {
      // 永続的に pending するモック
      let resolveFn: (v: unknown) => void = () => {};
      mockChangePassword.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveFn = resolve;
          }),
      );
      render(<ProfilePage />);
      await fillForm({ current: 'oldpass', next: 'newpassword1', confirm: 'newpassword1' });
      const btn = screen.getByRole('button', { name: 'パスワードを変更' }) as HTMLButtonElement;
      fireEvent.click(btn);
      await waitFor(() => {
        expect(btn.disabled).toBe(true);
      });
      // 後始末
      await act(async () => {
        resolveFn(undefined);
      });
    });
  });

  describe('成功フィードバック', () => {
    it('パスワード変更成功後にスナックバーで成功メッセージが表示される', async () => {
      mockChangePassword.mockResolvedValue(undefined);
      render(<ProfilePage />);
      await fillForm({ current: 'oldpass', next: 'newpassword1', confirm: 'newpassword1' });
      await userEvent.click(screen.getByRole('button', { name: 'パスワードを変更' }));
      await waitFor(() => {
        expect(mockShowSuccess).toHaveBeenCalledWith(expect.stringContaining('パスワード'));
      });
    });

    it('パスワード変更成功後、フォームの入力値がリセットされる', async () => {
      mockChangePassword.mockResolvedValue(undefined);
      render(<ProfilePage />);
      await fillForm({ current: 'oldpass', next: 'newpassword1', confirm: 'newpassword1' });
      await userEvent.click(screen.getByRole('button', { name: 'パスワードを変更' }));
      await waitFor(() => {
        expect((screen.getByLabelText('現在のパスワード') as HTMLInputElement).value).toBe('');
        expect((screen.getByLabelText('新しいパスワード') as HTMLInputElement).value).toBe('');
        expect((screen.getByLabelText('新しいパスワード（確認）') as HTMLInputElement).value).toBe(
          '',
        );
      });
    });
  });

  describe('エラーフィードバック', () => {
    it('現在のパスワードが間違っている場合（API 401）、エラーメッセージが表示される', async () => {
      mockChangePassword.mockRejectedValue(new Error('現在のパスワードが正しくありません'));
      render(<ProfilePage />);
      await fillForm({ current: 'wrongpass', next: 'newpassword1', confirm: 'newpassword1' });
      await userEvent.click(screen.getByRole('button', { name: 'パスワードを変更' }));
      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith('現在のパスワードが正しくありません');
      });
    });

    it('サーバーエラー時にスナックバーでエラーメッセージが表示される', async () => {
      mockChangePassword.mockRejectedValue(new Error('Internal server error'));
      render(<ProfilePage />);
      await fillForm({ current: 'oldpass', next: 'newpassword1', confirm: 'newpassword1' });
      await userEvent.click(screen.getByRole('button', { name: 'パスワードを変更' }));
      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith('Internal server error');
      });
    });
  });
});
