/**
 * pages/LoginPage.tsx のユニットテスト
 *
 * テスト対象: ログイン画面の redirect_after_login 消費ロジック
 * 戦略:
 *   - AuthContext / react-router-dom をモックして状態を制御する
 *   - sessionStorage の redirect_after_login が正しく消費されることを検証する
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LoginPage from '../pages/LoginPage';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockLogin = vi.hoisted(() => vi.fn());

// ログイン済みユーザーの状態を制御するオブジェクト
const mockAuthState = vi.hoisted(() => ({ user: null as { id: number } | null }));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockAuthState.user,
    login: mockLogin,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  Navigate: ({ to }: { to: string }) => {
    mockNavigate(to);
    return null;
  },
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockAuthState.user = null;
  });

  describe('ログイン成功後のリダイレクト', () => {
    it('sessionStorage に redirect_after_login がなければ / へ遷移する', async () => {
      mockLogin.mockResolvedValue(undefined);
      render(<LoginPage />);

      await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com');
      await userEvent.type(screen.getByLabelText(/password/i), 'password123');
      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/');
      });
    });

    it('sessionStorage に redirect_after_login があればそのパスへ遷移する', async () => {
      sessionStorage.setItem('redirect_after_login', '/invite/abc123');
      mockLogin.mockResolvedValue(undefined);
      render(<LoginPage />);

      await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com');
      await userEvent.type(screen.getByLabelText(/password/i), 'password123');
      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/invite/abc123');
      });
    });

    it('ログイン成功後に redirect_after_login が sessionStorage から削除される', async () => {
      sessionStorage.setItem('redirect_after_login', '/invite/abc123');
      mockLogin.mockResolvedValue(undefined);
      render(<LoginPage />);

      await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com');
      await userEvent.type(screen.getByLabelText(/password/i), 'password123');
      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalled();
      });
      expect(sessionStorage.getItem('redirect_after_login')).toBeNull();
    });
  });

  describe('既ログイン時のリダイレクト', () => {
    it('ログイン済みかつ redirect_after_login がなければ / へリダイレクトされる', () => {
      mockAuthState.user = { id: 1 };
      render(<LoginPage />);
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    it('ログイン済みかつ redirect_after_login があればそのパスへリダイレクトされる', () => {
      sessionStorage.setItem('redirect_after_login', '/invite/xyz');
      mockAuthState.user = { id: 1 };
      render(<LoginPage />);
      expect(mockNavigate).toHaveBeenCalledWith('/invite/xyz');
    });

    it('既ログイン時リダイレクト後に redirect_after_login が削除される', () => {
      sessionStorage.setItem('redirect_after_login', '/invite/xyz');
      mockAuthState.user = { id: 1 };
      render(<LoginPage />);
      expect(sessionStorage.getItem('redirect_after_login')).toBeNull();
    });
  });
});
