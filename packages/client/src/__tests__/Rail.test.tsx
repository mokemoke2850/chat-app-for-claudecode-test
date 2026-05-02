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

let mockDmUnreadCount = 0;
vi.mock('../hooks/useDmUnreadCount', () => ({
  useDmUnreadCount: () => mockDmUnreadCount,
}));

let mockMentionUnreadCount = 0;
vi.mock('../hooks/useMentionUnreadCount', () => ({
  useMentionUnreadCount: () => mockMentionUnreadCount,
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
  mockDmUnreadCount = 0;
  mockMentionUnreadCount = 0;
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
    it('上部にホーム / DM / カレンダー / タスク / ブックマーク / 検索の 6 つのアイコンが表示される', () => {
      renderRail();
      expect(screen.getByRole('link', { name: 'ホーム' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'DM' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'カレンダー' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'タスク' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'ブックマーク' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: '検索' })).toBeInTheDocument();
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

  describe('ロゴと検索アイコン (Step 2b で追加 / Step 7a で有効化)', () => {
    it('最上部に Chat App ロゴ要素が表示される', () => {
      renderRail();
      expect(screen.getByRole('img', { name: 'Chat App ロゴ' })).toBeInTheDocument();
    });

    it('上部ナビに検索アイコン (aria-label="検索") が表示される', () => {
      renderRail();
      expect(screen.getByRole('link', { name: '検索' })).toBeInTheDocument();
    });

    it('検索アイコンは /search にリンクする (Step 7a で disabled 解除)', () => {
      renderRail();
      expect(screen.getByRole('link', { name: '検索' })).toHaveAttribute('href', '/search');
    });
  });

  describe('DM 未読バッジ (Step 2c)', () => {
    it('useDmUnreadCount が 0 を返すとき、DM アイコンにバッジは表示されない', () => {
      mockDmUnreadCount = 0;
      renderRail();
      expect(screen.queryByText('5')).not.toBeInTheDocument();
      expect(screen.queryByText('9+')).not.toBeInTheDocument();
    });

    it('useDmUnreadCount が 5 を返すとき、DM アイコンに "5" のバッジが表示される', () => {
      mockDmUnreadCount = 5;
      renderRail();
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('useDmUnreadCount が 12 を返すとき、DM アイコンに "9+" のバッジが表示される (max=9)', () => {
      mockDmUnreadCount = 12;
      renderRail();
      expect(screen.getByText('9+')).toBeInTheDocument();
    });

    it('未読があるとき、DM アイコンの aria-label に未読数の情報が含まれる', () => {
      mockDmUnreadCount = 3;
      renderRail();
      const dmLink = screen.getByRole('link', { name: /DM.*3.*未読/ });
      expect(dmLink).toBeInTheDocument();
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

  describe('メンション未読バッジ (Step 6d / 保留 TODO #5 解消)', () => {
    it('useMentionUnreadCount が 0 のとき、ホームアイコンにメンション数バッジは表示されない', () => {
      mockMentionUnreadCount = 0;
      // ホームアイコン外の他リンクのバッジ "3" 等の干渉を避けるため、現在パスは /chat
      renderRail('/chat');
      const homeLink = screen.getByRole('link', { name: 'ホーム' });
      // バッジが「不可視（0）」状態であること（DOM 上に MuiBadge-invisible が付く）
      expect(homeLink.querySelector('.MuiBadge-invisible')).not.toBeNull();
    });

    it('useMentionUnreadCount が 3 のとき、ホームアイコンに "3" のバッジが表示される', () => {
      mockMentionUnreadCount = 3;
      renderRail('/chat');
      // DM 未読は 0 のため、画面上の "3" はホームアイコンのバッジ由来
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('useMentionUnreadCount が 12 のとき、ホームアイコンに "9+" のバッジが表示される (max=9)', () => {
      mockMentionUnreadCount = 12;
      renderRail('/chat');
      expect(screen.getByText('9+')).toBeInTheDocument();
    });

    it('未読メンションがあるとき、ホームアイコンの aria-label に未読数の情報が含まれる', () => {
      mockMentionUnreadCount = 4;
      renderRail('/chat');
      const homeLink = screen.getByRole('link', { name: /ホーム.*4.*未読/ });
      expect(homeLink).toBeInTheDocument();
    });
  });
});
