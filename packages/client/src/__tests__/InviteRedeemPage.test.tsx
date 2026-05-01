/**
 * テスト対象: pages/InviteRedeemPage.tsx（/invite/:token ルート）
 * 戦略: AuthContext と api.invites を vi.mock で差し替え、
 *       未ログイン時のリダイレクト・ログイン済み時の lookup と参加フロー・
 *       エラーハンドリングを検証する。
 *
 * NOTE: 「ログイン済みで自動 redeem」「sessionStorage redirect_after_login の
 *       LoginPage 側挙動」は実装と齟齬があったため #182 で項目修正済み。
 *       redirect_after_login の消費は LoginPage の責務（LoginPage.test.tsx でカバー）。
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import InviteRedeemPage from '../pages/InviteRedeemPage';

const lookupMock = vi.fn();
const redeemMock = vi.fn();
vi.mock('../api/client', () => ({
  api: {
    invites: {
      lookup: (...args: unknown[]) => lookupMock(...args),
      redeem: (...args: unknown[]) => redeemMock(...args),
    },
  },
}));

let mockUser: { id: number; username: string } | null = null;
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

let mockToken: string | undefined = 'tok';
const navigateFn = vi.fn();
vi.mock('react-router-dom', () => ({
  useParams: () => ({ token: mockToken }),
  useNavigate: () => navigateFn,
  Navigate: ({ to }: { to: string }) =>
    React.createElement('div', { 'data-testid': 'navigate' }, to),
}));

beforeEach(() => {
  lookupMock.mockReset();
  redeemMock.mockReset();
  mockUser = null;
  mockToken = 'tok';
  navigateFn.mockClear();
  sessionStorage.clear();
});

function validInvite(channelId: number | null = 5, channelName: string | null = 'general') {
  return {
    invite: {
      token: 'tok',
      channelId,
      channelName,
      expiresAt: null,
      isExpired: false,
      isRevoked: false,
      isExhausted: false,
    },
  };
}

describe('InviteRedeemPage', () => {
  describe('未ログイン状態でのアクセス', () => {
    it('/invite/:token に未ログインでアクセスすると /login へリダイレクトされる', () => {
      mockUser = null;
      render(<InviteRedeemPage />);
      expect(screen.getByTestId('navigate').textContent).toBe('/login');
    });

    it('リダイレクト前に sessionStorage に redirect_after_login が保存される', () => {
      mockUser = null;
      mockToken = 'mytok';
      render(<InviteRedeemPage />);
      expect(sessionStorage.getItem('redirect_after_login')).toBe('/invite/mytok');
    });

    // 仕様の精緻化（#182）:
    // 旧テスト「token の情報（チャンネル名）が表示されてからリダイレクトされる」は
    // 実装と乖離していたため「未ログイン時は lookup を呼ばずに即リダイレクトされる」に変更。
    it('未ログイン時は lookup を呼ばずに即リダイレクトされる', () => {
      mockUser = null;
      render(<InviteRedeemPage />);
      expect(lookupMock).not.toHaveBeenCalled();
      expect(screen.getByTestId('navigate').textContent).toBe('/login');
    });
  });

  describe('ログイン済み状態での lookup と参加確認カード', () => {
    // 仕様の精緻化（#182）:
    // 旧テスト「自動で redeem が呼ばれる」は実装と乖離（実装は手動「参加する」ボタン）。
    it('ログイン済みで有効なトークンにアクセスすると lookup が呼ばれて参加確認カード（参加するボタン）が表示される', async () => {
      mockUser = { id: 1, username: 'me' };
      lookupMock.mockResolvedValue(validInvite());
      render(<InviteRedeemPage />);
      await waitFor(() => {
        expect(lookupMock).toHaveBeenCalledWith('tok');
      });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: '参加する' })).toBeInTheDocument();
      });
    });

    // 新規追加（#182）: 旧 #4 の自動 redeem 部分を手動操作として独立項目化。
    it('参加するボタンをクリックすると redeem が呼ばれる', async () => {
      mockUser = { id: 1, username: 'me' };
      lookupMock.mockResolvedValue(validInvite());
      redeemMock.mockResolvedValue({ success: true, channelId: 5 });
      render(<InviteRedeemPage />);
      await waitFor(() => screen.getByRole('button', { name: '参加する' }));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '参加する' }));
      });
      expect(redeemMock).toHaveBeenCalledWith('tok');
    });

    it('redeem 成功後に対象チャンネルへ遷移する', async () => {
      mockUser = { id: 1, username: 'me' };
      lookupMock.mockResolvedValue(validInvite(5));
      redeemMock.mockResolvedValue({ success: true, channelId: 5 });
      render(<InviteRedeemPage />);
      await waitFor(() => screen.getByRole('button', { name: '参加する' }));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '参加する' }));
      });
      expect(navigateFn).toHaveBeenCalledWith('/?channel=5', { replace: true });
    });

    it('ワークスペース招待（channelId = null）の redeem 成功後はホームへ遷移する', async () => {
      mockUser = { id: 1, username: 'me' };
      lookupMock.mockResolvedValue(validInvite(null, null));
      redeemMock.mockResolvedValue({ success: true, channelId: null });
      render(<InviteRedeemPage />);
      await waitFor(() => screen.getByRole('button', { name: '参加する' }));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '参加する' }));
      });
      expect(navigateFn).toHaveBeenCalledWith('/', { replace: true });
    });
  });

  describe('トークンのエラーハンドリング', () => {
    function invalidInvite(flags: {
      isExpired?: boolean;
      isRevoked?: boolean;
      isExhausted?: boolean;
    }) {
      return {
        invite: {
          token: 'tok',
          channelId: 5,
          channelName: 'general',
          expiresAt: null,
          isExpired: false,
          isRevoked: false,
          isExhausted: false,
          ...flags,
        },
      };
    }

    it('期限切れトークンにアクセスするとエラーメッセージが表示される', async () => {
      mockUser = { id: 1, username: 'me' };
      lookupMock.mockResolvedValue(invalidInvite({ isExpired: true }));
      render(<InviteRedeemPage />);
      await waitFor(() => {
        expect(screen.getByText(/有効期限切れ/)).toBeInTheDocument();
      });
    });

    it('revoke 済みトークンにアクセスするとエラーメッセージが表示される', async () => {
      mockUser = { id: 1, username: 'me' };
      lookupMock.mockResolvedValue(invalidInvite({ isRevoked: true }));
      render(<InviteRedeemPage />);
      await waitFor(() => {
        expect(screen.getByText(/無効化されています/)).toBeInTheDocument();
      });
    });

    it('使用上限到達トークンにアクセスするとエラーメッセージが表示される', async () => {
      mockUser = { id: 1, username: 'me' };
      lookupMock.mockResolvedValue(invalidInvite({ isExhausted: true }));
      render(<InviteRedeemPage />);
      await waitFor(() => {
        expect(screen.getByText(/使用上限/)).toBeInTheDocument();
      });
    });

    it('存在しないトークンにアクセスすると 404 エラーメッセージが表示される', async () => {
      mockUser = { id: 1, username: 'me' };
      lookupMock.mockRejectedValue(new Error('Not found'));
      render(<InviteRedeemPage />);
      await waitFor(() => {
        expect(screen.getByText(/招待リンクが見つかりません/)).toBeInTheDocument();
      });
    });
  });
});
