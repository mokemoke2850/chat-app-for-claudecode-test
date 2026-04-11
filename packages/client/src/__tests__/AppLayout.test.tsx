/**
 * components/Layout/AppLayout.tsx のユニットテスト
 *
 * テスト対象: アプリ共通レイアウト（ヘッダー表示名）
 * 戦略:
 *   - AuthContext をモックして現在のユーザー情報を注入する
 *   - usePushNotifications をモックして通知機能を無効化する
 *   - useNavigate をモックしてルーティングを差し替える
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AppLayout from '../components/Layout/AppLayout';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, logout: vi.fn() }),
}));

vi.mock('../hooks/usePushNotifications', () => ({
  usePushNotifications: () => ({
    supported: false,
    subscribed: false,
    loading: false,
    error: null,
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

const mockUser = {
  id: 1,
  username: 'alice',
  email: 'alice@example.com',
  displayName: null as string | null,
  location: null,
  avatarUrl: null,
  createdAt: '2024-01-01T00:00:00Z',
};

beforeEach(() => {
  mockUser.displayName = null;
});

function renderLayout(sidebarContent?: React.ReactNode) {
  return render(
    <AppLayout sidebar={sidebarContent ?? <div />}>
      <div />
    </AppLayout>,
  );
}

describe('AppLayout', () => {
  describe('サイドバー開閉', () => {
    it('サイドバー開閉トグルボタンがヘッダーに表示される', () => {
      renderLayout();
      expect(screen.getByRole('button', { name: 'サイドバーを開閉する' })).toBeInTheDocument();
    });

    it('初期状態でサイドバーが開いており、トグルボタンの aria-expanded が true', () => {
      renderLayout();
      expect(screen.getByRole('button', { name: 'サイドバーを開閉する' })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
    });

    it('トグルボタンをクリックするとサイドバーが閉じ、aria-expanded が false になる', async () => {
      renderLayout();
      await userEvent.click(screen.getByRole('button', { name: 'サイドバーを開閉する' }));
      expect(screen.getByRole('button', { name: 'サイドバーを開閉する' })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
    });

    it('サイドバーが閉じた状態でトグルボタンをクリックするとサイドバーが開き、aria-expanded が true に戻る', async () => {
      renderLayout();
      const toggleBtn = screen.getByRole('button', { name: 'サイドバーを開閉する' });
      await userEvent.click(toggleBtn); // 閉じる
      await userEvent.click(toggleBtn); // 開く
      expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('ヘッダー表示名', () => {
    it('displayName が設定されているとき、ヘッダーに displayName が表示される', () => {
      mockUser.displayName = '田中花子';
      renderLayout();
      expect(screen.getByText('田中花子')).toBeInTheDocument();
    });

    it('displayName が null のとき、ヘッダーに username が表示される', () => {
      renderLayout();
      expect(screen.getByText('alice')).toBeInTheDocument();
    });
  });
});
