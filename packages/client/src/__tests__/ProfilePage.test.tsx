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

import { render, screen, waitFor } from '@testing-library/react';
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
    it('現在のパスワード・新しいパスワード・確認パスワードの3フィールドが表示される', async () => {
      render(<ProfilePage />);

      expect(screen.getByLabelText('現在のパスワード')).toBeInTheDocument();
      expect(screen.getByLabelText('新しいパスワード')).toBeInTheDocument();
      expect(screen.getByLabelText('新しいパスワード（確認）')).toBeInTheDocument();
    });

    it('新しいパスワードと確認パスワードが一致しない場合はエラーが表示される', async () => {
      render(<ProfilePage />);

      await userEvent.type(screen.getByLabelText('現在のパスワード'), 'currentPass1');
      await userEvent.type(screen.getByLabelText('新しいパスワード'), 'newPassword1');
      await userEvent.type(screen.getByLabelText('新しいパスワード（確認）'), 'differentPass1');
      await userEvent.click(screen.getByRole('button', { name: /パスワードを変更/i }));

      await waitFor(() => {
        expect(screen.getByText('新しいパスワードが一致しません')).toBeInTheDocument();
      });
      expect(mockChangePassword).not.toHaveBeenCalled();
    });

    it('新しいパスワードが8文字未満の場合はエラーが表示される', async () => {
      render(<ProfilePage />);

      await userEvent.type(screen.getByLabelText('現在のパスワード'), 'currentPass1');
      await userEvent.type(screen.getByLabelText('新しいパスワード'), 'short');
      await userEvent.type(screen.getByLabelText('新しいパスワード（確認）'), 'short');
      await userEvent.click(screen.getByRole('button', { name: /パスワードを変更/i }));

      await waitFor(() => {
        expect(screen.getByText('新しいパスワードは8文字以上で入力してください')).toBeInTheDocument();
      });
      expect(mockChangePassword).not.toHaveBeenCalled();
    });

    it('バリデーション通過後、api.auth.changePassword が正しいパラメータで呼ばれる', async () => {
      mockChangePassword.mockResolvedValueOnce({ message: 'Password changed' });
      render(<ProfilePage />);

      await userEvent.type(screen.getByLabelText('現在のパスワード'), 'currentPass1');
      await userEvent.type(screen.getByLabelText('新しいパスワード'), 'newPassword1');
      await userEvent.type(screen.getByLabelText('新しいパスワード（確認）'), 'newPassword1');
      await userEvent.click(screen.getByRole('button', { name: /パスワードを変更/i }));

      await waitFor(() => {
        expect(mockChangePassword).toHaveBeenCalledWith({
          currentPassword: 'currentPass1',
          newPassword: 'newPassword1',
          confirmPassword: 'newPassword1',
        });
      });
    });

    it('パスワード変更成功後、フォームがリセットされスナックバーで成功メッセージが表示される', async () => {
      mockChangePassword.mockResolvedValueOnce({ message: 'Password changed' });
      render(<ProfilePage />);

      await userEvent.type(screen.getByLabelText('現在のパスワード'), 'currentPass1');
      await userEvent.type(screen.getByLabelText('新しいパスワード'), 'newPassword1');
      await userEvent.type(screen.getByLabelText('新しいパスワード（確認）'), 'newPassword1');
      await userEvent.click(screen.getByRole('button', { name: /パスワードを変更/i }));

      await waitFor(() => {
        expect(mockShowSuccess).toHaveBeenCalledWith('パスワードを変更しました');
      });
      // フォームがリセットされる
      expect((screen.getByLabelText('現在のパスワード') as HTMLInputElement).value).toBe('');
    });

    it('API エラー時にスナックバーでエラーメッセージが表示される', async () => {
      mockChangePassword.mockRejectedValueOnce(new Error('現在のパスワードが正しくありません'));
      render(<ProfilePage />);

      await userEvent.type(screen.getByLabelText('現在のパスワード'), 'wrongPass1');
      await userEvent.type(screen.getByLabelText('新しいパスワード'), 'newPassword1');
      await userEvent.type(screen.getByLabelText('新しいパスワード（確認）'), 'newPassword1');
      await userEvent.click(screen.getByRole('button', { name: /パスワードを変更/i }));

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith('現在のパスワードが正しくありません');
      });
    });
  });
});
