/**
 * pages/ProfilePage.tsx のユニットテスト
 *
 * テスト対象: プロフィール編集画面
 * 戦略:
 *   - AuthContext をモックして現在のユーザー情報を注入する
 *   - api.auth.updateProfile をモックして HTTP 通信を差し替える
 *   - useNavigate をモックしてルーティングを差し替える
 *   - mockUserState オブジェクトを beforeEach でリセットし、テストごとに状態を制御する
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProfilePage from '../pages/ProfilePage';

const mockUpdateUser = vi.hoisted(() => vi.fn());
const mockUpdateProfile = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());

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
    },
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

beforeEach(() => {
  vi.clearAllMocks();
  // ユーザー状態をデフォルトにリセット
  mockUserState.avatarUrl = null;
  mockUserState.displayName = null;
  mockUserState.location = null;
});

describe('ProfilePage', () => {
  describe('初期表示', () => {
    it('現在の displayName が入力欄に初期値として表示される', () => {
      mockUserState.displayName = 'Alice Smith';
      render(<ProfilePage />);
      expect(screen.getByDisplayValue('Alice Smith')).toBeInTheDocument();
    });

    it('現在の location が入力欄に初期値として表示される', () => {
      mockUserState.location = '東京';
      render(<ProfilePage />);
      expect(screen.getByDisplayValue('東京')).toBeInTheDocument();
    });

    it('avatarUrl が設定済みのとき現在のアバター画像が表示される', () => {
      mockUserState.avatarUrl = 'data:image/png;base64,abc';
      render(<ProfilePage />);
      expect(screen.getByRole('img', { name: /アバター/i })).toHaveAttribute(
        'src',
        'data:image/png;base64,abc',
      );
    });

    it('avatarUrl が null のとき、アバター画像の代わりにユーザー名の頭文字が表示される', () => {
      render(<ProfilePage />);
      // MUI Avatar は src なしのとき children（頭文字）を表示する
      expect(screen.getByText('A')).toBeInTheDocument();
      expect(screen.queryByRole('img', { name: /アバター/i })).not.toBeInTheDocument();
    });
  });

  describe('フォーム操作', () => {
    it('displayName フィールドに入力できる', async () => {
      render(<ProfilePage />);
      const input = screen.getByLabelText('表示名');
      await userEvent.type(input, '田中花子');
      expect(input).toHaveValue('田中花子');
    });

    it('location フィールドに入力できる', async () => {
      render(<ProfilePage />);
      const input = screen.getByLabelText('勤務地');
      await userEvent.type(input, '大阪');
      expect(input).toHaveValue('大阪');
    });

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
  });
});
