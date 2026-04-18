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

import { describe, it, vi, beforeEach } from 'vitest';

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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ProfilePage - パスワード変更フォーム', () => {
  describe('バリデーション（クライアント側）', () => {
    it('新しいパスワードが 8 文字未満の場合、送信前にエラーメッセージが表示される', async () => {
      // TODO
    });

    it('新しいパスワードと確認用パスワードが一致しない場合、送信前にエラーメッセージが表示される', async () => {
      // TODO
    });

    it('現在のパスワードが空のまま送信しようとした場合、エラーメッセージが表示される', async () => {
      // TODO
    });

    it('すべての入力が有効な場合、バリデーションエラーは表示されない', async () => {
      // TODO
    });
  });

  describe('API 呼び出し', () => {
    it('有効な入力で送信すると api.auth.changePassword が正しいパラメータで呼ばれる', async () => {
      // TODO
    });

    it('送信中はボタンが無効化される', async () => {
      // TODO
    });
  });

  describe('成功フィードバック', () => {
    it('パスワード変更成功後にスナックバーで成功メッセージが表示される', async () => {
      // TODO
    });

    it('パスワード変更成功後、フォームの入力値がリセットされる', async () => {
      // TODO
    });
  });

  describe('エラーフィードバック', () => {
    it('現在のパスワードが間違っている場合（API 401）、エラーメッセージが表示される', async () => {
      // TODO
    });

    it('サーバーエラー時にスナックバーでエラーメッセージが表示される', async () => {
      // TODO
    });
  });
});
