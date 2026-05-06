/**
 * pages/ProfilePage.tsx のユニットテスト
 *
 * テスト対象: プロフィール編集画面（プロフィール更新 + パスワード変更）
 * 戦略:
 *   - AuthContext をモックして現在のユーザー情報を注入する
 *   - api.auth.updateProfile / api.auth.changePassword をモックして HTTP 通信を差し替える
 *   - useNavigate をモックしてルーティングを差し替える
 *   - mockUserState オブジェクトを beforeEach でリセットし、テストごとに状態を制御する
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProfilePage from '../pages/ProfilePage';

const mockUpdateUser = vi.hoisted(() => vi.fn());
const mockUpdateProfile = vi.hoisted(() => vi.fn());
const mockChangePassword = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());
const mockShowSuccess = vi.hoisted(() => vi.fn());
const mockShowError = vi.hoisted(() => vi.fn());

// AuthContext モック — mockUserState はテストごとに上書き可能
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
    updateUser: mockUpdateUser,
  }),
}));

vi.mock('../api/client', () => ({
  api: {
    auth: {
      updateProfile: mockUpdateProfile,
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

// Step 8a: AppLayout を最小スタブ化
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

beforeEach(() => {
  vi.clearAllMocks();
  // ユーザー状態をデフォルトにリセット
  mockUserState.avatarUrl = null;
  mockUserState.displayName = null;
  mockUserState.location = null;
});

describe('ProfilePage', () => {
  describe('フォーム操作', () => {
    it('画像ファイルを選択するとプレビューが表示される', async () => {
      // FileReader をクラス形式でモックして即座に data URL を返す
      const fakeDataUrl = 'data:image/png;base64,fakepreview';
      class MockFileReader {
        onload: ((e: { target: { result: string } }) => void) | null = null;
        readAsDataURL = vi.fn(() => {
          this.onload?.({ target: { result: fakeDataUrl } });
        });
      }
      vi.stubGlobal('FileReader', MockFileReader);

      render(<ProfilePage />);

      const file = new File(['fake'], 'avatar.png', { type: 'image/png' });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await userEvent.upload(input, file);

      await waitFor(() => {
        expect(screen.getByTestId('avatar-preview')).toBeInTheDocument();
      });

      vi.unstubAllGlobals();
    });
  });

  describe('保存処理', () => {
    it('保存ボタンをクリックすると api.auth.updateProfile が呼ばれる', async () => {
      mockUpdateProfile.mockResolvedValueOnce({ user: { ...mockUserState } });
      render(<ProfilePage />);

      await userEvent.click(screen.getByRole('button', { name: /保存/i }));

      await waitFor(() => {
        expect(mockUpdateProfile).toHaveBeenCalledOnce();
      });
    });

    it('displayName と location が正しいリクエストボディで送信される', async () => {
      mockUpdateProfile.mockResolvedValueOnce({
        user: { ...mockUserState, displayName: '田中花子', location: '大阪' },
      });
      render(<ProfilePage />);

      await userEvent.type(screen.getByLabelText('表示名'), '田中花子');
      await userEvent.type(screen.getByLabelText('勤務地'), '大阪');
      await userEvent.click(screen.getByRole('button', { name: /保存/i }));

      await waitFor(() => {
        expect(mockUpdateProfile).toHaveBeenCalledWith(
          expect.objectContaining({ displayName: '田中花子', location: '大阪' }),
        );
      });
    });

    it('保存成功後、AuthContext の updateUser が更新されたユーザーで呼ばれる', async () => {
      const updatedUser = { ...mockUserState, displayName: '更新太郎', location: '名古屋' };
      mockUpdateProfile.mockResolvedValueOnce({ user: updatedUser });
      render(<ProfilePage />);

      await userEvent.click(screen.getByRole('button', { name: /保存/i }));

      await waitFor(() => {
        expect(mockUpdateUser).toHaveBeenCalledWith(updatedUser);
      });
    });

    it('保存中はボタンが無効化される', async () => {
      let resolve!: (v: { user: typeof mockUserState }) => void;
      mockUpdateProfile.mockReturnValueOnce(new Promise((r) => (resolve = r)));
      render(<ProfilePage />);

      await userEvent.click(screen.getByRole('button', { name: /保存/i }));

      expect(screen.getByRole('button', { name: /保存/i })).toBeDisabled();

      resolve({ user: { ...mockUserState } });
    });

    it('API エラー時にエラーメッセージが表示される', async () => {
      mockUpdateProfile.mockRejectedValueOnce(new Error('サーバーエラー'));
      render(<ProfilePage />);

      await userEvent.click(screen.getByRole('button', { name: /保存/i }));

      await waitFor(() => {
        expect(screen.getByText('サーバーエラー')).toBeInTheDocument();
      });
    });

    it('保存成功時にスナックバーで成功メッセージが表示される', async () => {
      mockUpdateProfile.mockResolvedValueOnce({ user: { ...mockUserState } });
      render(<ProfilePage />);

      await userEvent.click(screen.getByRole('button', { name: /保存/i }));

      await waitFor(() => {
        expect(mockShowSuccess).toHaveBeenCalledWith('プロフィールを保存しました');
      });
    });

    it('保存失敗時にスナックバーでエラーメッセージが表示される', async () => {
      mockUpdateProfile.mockRejectedValueOnce(new Error('サーバーエラー'));
      render(<ProfilePage />);

      await userEvent.click(screen.getByRole('button', { name: /保存/i }));

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith('サーバーエラー');
      });
    });
  });

  describe('パスワード変更', () => {
    // パスワード変更フォームの詳細なバリデーション・API 呼び出し・成功 / 失敗フィードバックは
    // ProfilePage.changePassword.test.tsx で網羅。ここではフォームが ProfilePage に
    // 統合されていることのみ確認する。
    it('現在のパスワード・新しいパスワード・確認パスワードの3フィールドが表示される', async () => {
      render(<ProfilePage />);

      expect(screen.getByLabelText('現在のパスワード')).toBeInTheDocument();
      expect(screen.getByLabelText('新しいパスワード')).toBeInTheDocument();
      expect(screen.getByLabelText('新しいパスワード（確認）')).toBeInTheDocument();
    });
  });

  // Step 8a: AppLayout 適用拡大
  describe('Step 8a: AppLayout 化', () => {
    it('AppLayout 内にレンダリングされる', () => {
      render(<ProfilePage />);
      expect(screen.getByTestId('app-layout-stub')).toBeInTheDocument();
    });

    it('独自ヘッダの戻るボタン (aria-label="戻る") が撤去されている', () => {
      render(<ProfilePage />);
      expect(screen.queryByRole('button', { name: '戻る' })).not.toBeInTheDocument();
    });

    it('AppLayout 内に統一見出し行「プロフィール設定」が表示される', () => {
      render(<ProfilePage />);
      const layout = screen.getByTestId('app-layout-stub');
      expect(within(layout).getByRole('heading', { name: 'プロフィール設定' })).toBeInTheDocument();
    });

    it('プロフィール編集 / パスワード変更フォームが AppLayout 内に表示される', () => {
      render(<ProfilePage />);
      const layout = screen.getByTestId('app-layout-stub');
      expect(within(layout).getByLabelText('表示名')).toBeInTheDocument();
      expect(within(layout).getByLabelText('現在のパスワード')).toBeInTheDocument();
    });
  });
});
