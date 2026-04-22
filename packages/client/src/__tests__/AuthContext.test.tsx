/**
 * contexts/AuthContext.tsx のユニットテスト
 *
 * テスト対象: AuthProvider の状態管理、useAuth フック
 * 戦略: api モジュールを vi.mock で差し替え、
 *       実際のネットワーク通信なしに AuthProvider の振る舞いを検証する
 *
 * React 19 移行後の変更点:
 *   - AuthProvider は use(mePromise) によってサスペンドするため、
 *     wrapper に <Suspense> を追加した
 *   - loading 状態は Suspense によって管理されるため、
 *     loading プロパティに関するアサーションを削除した
 *   - use() + Suspense を含むコンポーネントは waitFor では再レンダリングが
 *     フラッシュされないため、await act(async () => { render(...) }) を使用する
 */

import { Suspense, act, useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import type { User } from '@chat-app/shared';

vi.mock('../api/client', () => ({
  api: {
    auth: {
      me: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
      completeOnboarding: vi.fn(),
    },
  },
}));

import { api } from '../api/client';
const mockMe = api.auth.me as ReturnType<typeof vi.fn>;
const mockLogin = api.auth.login as ReturnType<typeof vi.fn>;
const mockLogout = api.auth.logout as ReturnType<typeof vi.fn>;
const mockCompleteOnboarding = (
  api.auth as unknown as { completeOnboarding: ReturnType<typeof vi.fn> }
).completeOnboarding;

const dummyUser: User = {
  id: 1,
  username: 'alice',
  email: 'alice@example.com',
  avatarUrl: null,
  displayName: null,
  location: null,
  createdAt: '2024-01-01T00:00:00Z',
  role: 'user',
  isActive: true,
  onboardingCompletedAt: null,
};

beforeEach(() => {
  vi.resetAllMocks();
});

/** ユーザー状態を DOM に描画するテスト用コンポーネント */
function UserDisplay() {
  const { user } = useAuth();
  return <div data-testid="user">{user ? user.username : 'null'}</div>;
}

/** login ボタンを含むテスト用コンポーネント */
function LoginControl({ email, password }: { email: string; password: string }) {
  const { user, login } = useAuth();
  const [error, setError] = useState('');
  return (
    <div>
      <div data-testid="user">{user ? user.username : 'null'}</div>
      <div data-testid="error">{error}</div>
      <button onClick={() => login(email, password).catch((e: Error) => setError(e.message))}>
        login
      </button>
    </div>
  );
}

/** logout ボタンを含むテスト用コンポーネント */
function LogoutControl() {
  const { user, logout } = useAuth();
  return (
    <div>
      <div data-testid="user">{user ? user.username : 'null'}</div>
      <button onClick={() => void logout()}>logout</button>
    </div>
  );
}

/**
 * AuthProvider を Suspense でラップしてレンダリングする。
 * use() による Suspense を確実にフラッシュするため await act(async) を使用する。
 */
async function renderWithAuth(ui: React.ReactNode) {
  await act(async () => {
    render(
      <Suspense fallback={<div data-testid="loading" />}>
        <AuthProvider>{ui}</AuthProvider>
      </Suspense>,
    );
  });
}

describe('AuthProvider', () => {
  describe('初期化', () => {
    it('マウント時に GET /api/auth/me を呼び出し、レスポンスのユーザーを user state にセットする', async () => {
      mockMe.mockResolvedValue({ user: dummyUser });

      await renderWithAuth(<UserDisplay />);

      expect(screen.getByTestId('user')).toHaveTextContent('alice');
      // React 19 concurrent mode では useState initializer が複数回呼ばれる場合があるため
      // 「少なくとも1回呼ばれた」ことを確認する
      expect(mockMe).toHaveBeenCalled();
    });

    it('/auth/me が失敗したとき user を null のまま初期化する', async () => {
      // 未ログイン状態では /auth/me が 401 を返す
      mockMe.mockRejectedValue(new Error('Unauthorized'));

      await renderWithAuth(<UserDisplay />);

      expect(screen.getByTestId('user')).toHaveTextContent('null');
    });
  });

  describe('login', () => {
    it('login() を呼ぶと POST /api/auth/login が発火し user state が更新される', async () => {
      // 初期化時の /me は失敗（未ログイン）
      mockMe.mockRejectedValue(new Error('Unauthorized'));
      mockLogin.mockResolvedValue({ user: dummyUser });

      await renderWithAuth(<LoginControl email="alice@example.com" password="password" />);
      expect(screen.getByTestId('user')).toHaveTextContent('null');

      await act(async () => {
        screen.getByRole('button', { name: 'login' }).click();
      });

      await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('alice'));
    });

    it('login() が失敗したとき Error を throw する（user state は変わらない）', async () => {
      mockMe.mockRejectedValue(new Error('Unauthorized'));
      mockLogin.mockRejectedValue(new Error('Invalid credentials'));

      await renderWithAuth(<LoginControl email="x@x.com" password="wrong" />);
      expect(screen.getByTestId('user')).toHaveTextContent('null');

      await act(async () => {
        screen.getByRole('button', { name: 'login' }).click();
      });

      await waitFor(() =>
        expect(screen.getByTestId('error')).toHaveTextContent('Invalid credentials'),
      );
      expect(screen.getByTestId('user')).toHaveTextContent('null');
    });
  });

  describe('logout', () => {
    it('logout() を呼ぶと POST /api/auth/logout が発火し user state が null になる', async () => {
      // 既にログイン済みの状態から開始
      mockMe.mockResolvedValue({ user: dummyUser });
      mockLogout.mockResolvedValue(undefined);

      await renderWithAuth(<LogoutControl />);
      expect(screen.getByTestId('user')).toHaveTextContent('alice');

      await act(async () => {
        screen.getByRole('button', { name: 'logout' }).click();
      });

      await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('null'));
    });
  });
});

describe('useAuth', () => {
  it('AuthProvider の外で呼ぶと "useAuth must be used inside AuthProvider" を throw する', () => {
    // Provider なしで useAuth を呼ぶと即座に throw する
    expect(() => renderHook(() => useAuth())).toThrow('useAuth must be used inside AuthProvider');
  });
});

/**
 * オンボーディング関連の AuthContext テスト（Issue #114）
 */
describe('AuthContext: onboardingCompletedAt フィールド', () => {
  /** onboardingCompletedAt 表示用テストコンポーネント */
  function OnboardingDisplay() {
    const { user } = useAuth();
    return <div data-testid="onboarding">{user?.onboardingCompletedAt ?? 'null'}</div>;
  }

  /** completeOnboarding を呼ぶボタン付きテストコンポーネント */
  function CompleteControl() {
    const { user, completeOnboarding } = useAuth();
    const [error, setError] = useState('');
    return (
      <div>
        <div data-testid="onboarding">{user?.onboardingCompletedAt ?? 'null'}</div>
        <div data-testid="error">{error}</div>
        <button onClick={() => completeOnboarding().catch((e: Error) => setError(e.message))}>
          complete
        </button>
      </div>
    );
  }

  it('me レスポンスの onboardingCompletedAt が user オブジェクトに反映される', async () => {
    mockMe.mockResolvedValue({
      user: { ...dummyUser, onboardingCompletedAt: '2024-02-01T00:00:00Z' },
    });

    await renderWithAuth(<OnboardingDisplay />);

    expect(screen.getByTestId('onboarding')).toHaveTextContent('2024-02-01T00:00:00Z');
  });

  it('completeOnboarding() を呼ぶと api.auth.completeOnboarding が呼ばれる', async () => {
    mockMe.mockResolvedValue({ user: dummyUser });
    mockCompleteOnboarding.mockResolvedValue({
      user: { ...dummyUser, onboardingCompletedAt: '2024-03-01T00:00:00Z' },
    });

    await renderWithAuth(<CompleteControl />);
    await act(async () => {
      screen.getByRole('button', { name: 'complete' }).click();
    });
    await waitFor(() => expect(mockCompleteOnboarding).toHaveBeenCalled());
  });

  it('completeOnboarding() 成功後に user.onboardingCompletedAt が更新される', async () => {
    mockMe.mockResolvedValue({ user: dummyUser });
    mockCompleteOnboarding.mockResolvedValue({
      user: { ...dummyUser, onboardingCompletedAt: '2024-03-01T00:00:00Z' },
    });

    await renderWithAuth(<CompleteControl />);
    expect(screen.getByTestId('onboarding')).toHaveTextContent('null');

    await act(async () => {
      screen.getByRole('button', { name: 'complete' }).click();
    });
    await waitFor(() =>
      expect(screen.getByTestId('onboarding')).toHaveTextContent('2024-03-01T00:00:00Z'),
    );
  });

  it('completeOnboarding() 失敗時はエラーを throw する', async () => {
    mockMe.mockResolvedValue({ user: dummyUser });
    mockCompleteOnboarding.mockRejectedValue(new Error('server error'));

    await renderWithAuth(<CompleteControl />);

    await act(async () => {
      screen.getByRole('button', { name: 'complete' }).click();
    });
    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('server error'));
  });
});
