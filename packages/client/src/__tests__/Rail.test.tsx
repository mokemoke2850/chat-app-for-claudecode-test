/**
 * components/Layout/Rail.tsx のユニットテスト
 *
 * テスト対象: 左 64px のアイコンレール
 * 戦略:
 *   - MemoryRouter でラップして react-router の NavLink を動作させる
 *   - AuthContext をモックして role 切替を検証する
 *   - aria-label / role="link" を頼りに各ナビ項目を特定する
 */

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Rail from '../components/Layout/Rail';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

const mockUser = {
  id: 1,
  username: 'alice',
  email: 'alice@example.com',
  displayName: null as string | null,
  role: 'user' as 'user' | 'admin',
  location: null,
  avatarUrl: null,
  createdAt: '2024-01-01T00:00:00Z',
};

beforeEach(() => {
  mockUser.role = 'user';
});

function renderRail(initialPath = '/', role: 'user' | 'admin' = 'user') {
  mockUser.role = role;
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Rail />
    </MemoryRouter>,
  );
}

describe('Rail', () => {
  describe('ナビゲーション項目の表示', () => {
    it('上部にホーム / DM / カレンダー / タスク / ブックマークの 5 つのアイコンが表示される', () => {
      renderRail();
      expect(screen.getByRole('link', { name: 'ホーム' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'DM' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'カレンダー' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'タスク' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'ブックマーク' })).toBeInTheDocument();
    });

    it('区切り線の下にテンプレートのアイコンが表示される', () => {
      renderRail();
      expect(screen.getByRole('link', { name: 'テンプレート' })).toBeInTheDocument();
    });

    it('admin ロールのとき、下部に管理アイコンが表示される', () => {
      renderRail('/', 'admin');
      expect(screen.getByRole('link', { name: '管理' })).toBeInTheDocument();
    });

    it('user ロールのとき、下部に管理アイコンが表示されない', () => {
      renderRail('/', 'user');
      expect(screen.queryByRole('link', { name: '管理' })).not.toBeInTheDocument();
    });
  });

  describe('リンク先', () => {
    it('ホームアイコンは / にリンクする', () => {
      renderRail();
      expect(screen.getByRole('link', { name: 'ホーム' })).toHaveAttribute('href', '/');
    });

    it('DM アイコンは /dm にリンクする', () => {
      renderRail();
      expect(screen.getByRole('link', { name: 'DM' })).toHaveAttribute('href', '/dm');
    });

    it('カレンダーアイコンは /calendar にリンクする', () => {
      renderRail();
      expect(screen.getByRole('link', { name: 'カレンダー' })).toHaveAttribute('href', '/calendar');
    });

    it('タスクアイコンは /tasks にリンクする', () => {
      renderRail();
      expect(screen.getByRole('link', { name: 'タスク' })).toHaveAttribute('href', '/tasks');
    });

    it('ブックマークアイコンは /bookmarks にリンクする', () => {
      renderRail();
      expect(screen.getByRole('link', { name: 'ブックマーク' })).toHaveAttribute(
        'href',
        '/bookmarks',
      );
    });

    it('テンプレートアイコンは /templates にリンクする', () => {
      renderRail();
      expect(screen.getByRole('link', { name: 'テンプレート' })).toHaveAttribute(
        'href',
        '/templates',
      );
    });

    it('admin ロール時、管理アイコンは /admin にリンクする', () => {
      renderRail('/', 'admin');
      expect(screen.getByRole('link', { name: '管理' })).toHaveAttribute('href', '/admin');
    });
  });

  describe('現在のパスのハイライト (aria-current)', () => {
    it('現在のパスが /dm のとき、DM アイコンに aria-current="page" が付与される', () => {
      renderRail('/dm');
      expect(screen.getByRole('link', { name: 'DM' })).toHaveAttribute('aria-current', 'page');
    });

    it('現在のパスが /calendar のとき、カレンダーアイコンに aria-current="page" が付与される', () => {
      renderRail('/calendar');
      expect(screen.getByRole('link', { name: 'カレンダー' })).toHaveAttribute(
        'aria-current',
        'page',
      );
    });

    it('現在のパスが /tasks のとき、タスクアイコンに aria-current="page" が付与される', () => {
      renderRail('/tasks');
      expect(screen.getByRole('link', { name: 'タスク' })).toHaveAttribute('aria-current', 'page');
    });

    it('現在のパスが /tasks のとき、ホームアイコンには aria-current が付与されない', () => {
      renderRail('/tasks');
      expect(screen.getByRole('link', { name: 'ホーム' })).not.toHaveAttribute('aria-current');
    });

    it('現在のパスが / のとき、ホームアイコンに aria-current="page" が付与される', () => {
      renderRail('/');
      expect(screen.getByRole('link', { name: 'ホーム' })).toHaveAttribute('aria-current', 'page');
    });
  });
});
