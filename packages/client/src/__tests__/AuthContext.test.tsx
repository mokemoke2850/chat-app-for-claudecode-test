/**
 * contexts/AuthContext.tsx のユニットテスト
 *
 * テスト対象: AuthProvider の状態管理、useAuth フック
 * 戦略: api モジュールを vi.mock で差し替え、
 *       実際のネットワーク通信なしに AuthProvider の振る舞いを検証する
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import type { User } from '@chat-app/shared';

// api モジュール全体をモックし、各テストで制御できるようにする
vi.mock('../api/client', () => ({
  api: {
    auth: {
      me: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
    },
  },
}));

// モック関数を取り出すヘルパー
import { api } from '../api/client';
const mockMe = api.auth.me as ReturnType<typeof vi.fn>;
const mockLogin = api.auth.login as ReturnType<typeof vi.fn>;
const mockLogout = api.auth.logout as ReturnType<typeof vi.fn>;

const dummyUser: User = {
  id: 1,
  username: 'alice',
  email: 'alice@example.com',
  avatarUrl: null,
  displayName: null,
  location: null,
  createdAt: '2024-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.resetAllMocks();
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('AuthProvider', () => {
  describe('初期化', () => {
    it('マウント時に GET /api/auth/me を呼び出し、レスポンスのユーザーを user state にセットする', async () => {
      mockMe.mockResolvedValue({ user: dummyUser });

      const { result } = renderHook(() => useAuth(), { wrapper });

      // 初期状態は loading=true
      expect(result.current.loading).toBe(true);

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.user).toEqual(dummyUser);
      expect(mockMe).toHaveBeenCalledTimes(1);
    });

    it('/auth/me が失敗したとき user を null のまま loading を false にする', async () => {
      // 未ログイン状態では /auth/me が 401 を返す
      mockMe.mockRejectedValue(new Error('Unauthorized'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.user).toBeNull();
    });
  });

  describe('login', () => {
    it('login() を呼ぶと POST /api/auth/login が発火し user state が更新される', async () => {
      // 初期化時の /me は失敗（未ログイン）
      mockMe.mockRejectedValue(new Error('Unauthorized'));
      mockLogin.mockResolvedValue({ user: dummyUser });

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.login('alice@example.com', 'password');
      });

      expect(result.current.user).toEqual(dummyUser);
    });

    it('login() が失敗したとき Error を throw する（user state は変わらない）', async () => {
      mockMe.mockRejectedValue(new Error('Unauthorized'));
      mockLogin.mockRejectedValue(new Error('Invalid credentials'));

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      // login が throw することと、user が null のままであることを確認
      await expect(
        act(async () => {
          await result.current.login('x@x.com', 'wrong');
        }),
      ).rejects.toThrow('Invalid credentials');

      expect(result.current.user).toBeNull();
    });
  });

  describe('logout', () => {
    it('logout() を呼ぶと POST /api/auth/logout が発火し user state が null になる', async () => {
      // 既にログイン済みの状態から開始
      mockMe.mockResolvedValue({ user: dummyUser });
      mockLogout.mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.user).toEqual(dummyUser));

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.user).toBeNull();
    });
  });
});

describe('useAuth', () => {
  it('AuthProvider の外で呼ぶと "useAuth must be used inside AuthProvider" を throw する', () => {
    // Provider なしで useAuth を呼ぶと即座に throw する
    expect(() => renderHook(() => useAuth())).toThrow('useAuth must be used inside AuthProvider');
  });
});
