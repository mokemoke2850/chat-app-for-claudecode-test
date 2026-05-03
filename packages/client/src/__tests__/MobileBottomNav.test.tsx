/**
 * components/Layout/MobileBottomNav.tsx のユニットテスト
 *
 * テスト対象: モバイル幅 (< 768px) 時に画面下部に固定表示される 5 タブナビ
 * 戦略:
 *   - useDmUnreadCount / useMentionUnreadCount をモックする (既存 Rail.test.tsx と同じ方針)
 *   - react-router-dom は実体を使い MemoryRouter でラップする (NavLink を使うため)
 */

import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import MobileBottomNav from '../components/Layout/MobileBottomNav';

const mockDmUnread = vi.fn(() => 0);
const mockMentionUnread = vi.fn(() => 0);

vi.mock('../hooks/useDmUnreadCount', () => ({
  useDmUnreadCount: () => mockDmUnread(),
}));
vi.mock('../hooks/useMentionUnreadCount', () => ({
  useMentionUnreadCount: () => mockMentionUnread(),
}));

function renderNav(initialPath: string = '/') {
  mockDmUnread.mockReturnValue(0);
  mockMentionUnread.mockReturnValue(0);
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <MobileBottomNav />
    </MemoryRouter>,
  );
}

describe('MobileBottomNav', () => {
  it('5 タブ (受信箱 / チャット / DM / カレンダー / タスク) すべてが表示される', () => {
    renderNav();
    expect(screen.getByRole('link', { name: '受信箱' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'チャット' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'DM' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'カレンダー' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'タスク' })).toBeInTheDocument();
  });

  it('受信箱タブのリンク先が "/" である', () => {
    renderNav();
    expect(screen.getByRole('link', { name: '受信箱' })).toHaveAttribute('href', '/');
  });

  it('チャットタブのリンク先が "/chat" である', () => {
    renderNav();
    expect(screen.getByRole('link', { name: 'チャット' })).toHaveAttribute('href', '/chat');
  });

  it('DM タブのリンク先が "/dm" である', () => {
    renderNav();
    expect(screen.getByRole('link', { name: 'DM' })).toHaveAttribute('href', '/dm');
  });

  it('カレンダータブのリンク先が "/calendar" である', () => {
    renderNav();
    expect(screen.getByRole('link', { name: 'カレンダー' })).toHaveAttribute('href', '/calendar');
  });

  it('タスクタブのリンク先が "/tasks" である', () => {
    renderNav();
    expect(screen.getByRole('link', { name: 'タスク' })).toHaveAttribute('href', '/tasks');
  });

  it('受信箱タブにメンション未読バッジ (mentionUnreadCount > 0) が表示される', () => {
    mockMentionUnread.mockReturnValue(3);
    render(
      <MemoryRouter initialEntries={['/chat']}>
        <MobileBottomNav />
      </MemoryRouter>,
    );
    const inboxLink = screen.getByRole('link', { name: '受信箱' });
    expect(within(inboxLink).getByText('3')).toBeInTheDocument();
  });

  it('DM タブに DM 未読バッジ (dmUnreadCount > 0) が表示される', () => {
    mockDmUnread.mockReturnValue(5);
    render(
      <MemoryRouter initialEntries={['/']}>
        <MobileBottomNav />
      </MemoryRouter>,
    );
    const dmLink = screen.getByRole('link', { name: 'DM' });
    expect(within(dmLink).getByText('5')).toBeInTheDocument();
  });

  describe('aria-current (アクティブタブ表示)', () => {
    it('現在パスが "/" のとき受信箱タブのみが aria-current="page" になる', () => {
      renderNav('/');
      expect(screen.getByRole('link', { name: '受信箱' })).toHaveAttribute('aria-current', 'page');
      expect(screen.getByRole('link', { name: 'チャット' })).not.toHaveAttribute('aria-current');
      expect(screen.getByRole('link', { name: 'DM' })).not.toHaveAttribute('aria-current');
    });

    it('現在パスが "/chat" のときチャットタブが aria-current="page" になり、受信箱は前方一致でも active にならない (受信箱は完全一致のため)', () => {
      renderNav('/chat');
      expect(screen.getByRole('link', { name: 'チャット' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      expect(screen.getByRole('link', { name: '受信箱' })).not.toHaveAttribute('aria-current');
    });

    it('現在パスが "/dm" のとき DM タブが aria-current="page" になる', () => {
      renderNav('/dm');
      expect(screen.getByRole('link', { name: 'DM' })).toHaveAttribute('aria-current', 'page');
      expect(screen.getByRole('link', { name: '受信箱' })).not.toHaveAttribute('aria-current');
    });
  });
});
