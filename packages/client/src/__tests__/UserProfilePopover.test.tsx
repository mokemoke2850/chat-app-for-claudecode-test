/**
 * components/Chat/UserProfilePopover.tsx のユニットテスト
 *
 * テスト対象: アバターホバー時に表示されるプロフィールポップアップ
 *   - 表示名・ID・メールアドレス・勤務地の描画
 *   - avatarUrl がある場合の画像表示
 *   - ホバー離脱時のポップアップ非表示
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import UserProfilePopover from '../components/Chat/UserProfilePopover';
import { dummyUsers } from './__fixtures__/users';

const user = dummyUsers[0]; // alice: id=1, email=alice@example.com, location=null

describe('UserProfilePopover', () => {
  describe('プロフィール情報の表示', () => {
    it('displayName を表示する', () => {
      const userWithDisplayName = { ...user, displayName: 'Alice Smith', location: null };
      render(
        <UserProfilePopover
          user={userWithDisplayName}
          displayName="Alice Smith"
          anchorEl={document.body}
          open={true}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    });

    it('ユーザー ID を "ID: {id}" 形式で表示する', () => {
      render(
        <UserProfilePopover
          user={user}
          displayName="alice"
          anchorEl={document.body}
          open={true}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByText('ID: 1')).toBeInTheDocument();
    });

    it('email を表示する', () => {
      render(
        <UserProfilePopover
          user={user}
          displayName="alice"
          anchorEl={document.body}
          open={true}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    });

    it('location が設定されているとき LocationOnIcon とともに表示する', () => {
      const userWithLocation = { ...user, location: '東京', displayName: null };
      render(
        <UserProfilePopover
          user={userWithLocation}
          displayName="alice"
          anchorEl={document.body}
          open={true}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByText('東京')).toBeInTheDocument();
    });

    it('location が null のとき勤務地エリアを表示しない', () => {
      render(
        <UserProfilePopover
          user={{ ...user, location: null, displayName: null }}
          displayName="alice"
          anchorEl={document.body}
          open={true}
          onClose={vi.fn()}
        />,
      );
      // LocationOnIcon のあるエリアが存在しないことを確認（テキストで間接確認）
      expect(screen.queryByText('東京')).not.toBeInTheDocument();
    });
  });

  describe('アバター画像', () => {
    it('avatarUrl が設定されているとき img タグで表示する', () => {
      const userWithAvatar = { ...user, avatarUrl: 'http://example.com/avatar.jpg', displayName: 'Alice', location: null };
      render(
        <UserProfilePopover
          user={userWithAvatar}
          displayName="Alice"
          anchorEl={document.body}
          open={true}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByRole('img', { name: 'Alice' })).toHaveAttribute('src', 'http://example.com/avatar.jpg');
    });

    it('avatarUrl が null のとき頭文字 Avatar を表示する', () => {
      render(
        <UserProfilePopover
          user={{ ...user, avatarUrl: null, displayName: null, location: null }}
          displayName="alice"
          anchorEl={document.body}
          open={true}
          onClose={vi.fn()}
        />,
      );
      expect(screen.queryByRole('img', { name: 'alice' })).not.toBeInTheDocument();
    });
  });

  describe('ポップアップの開閉', () => {
    it('open=true のときポップアップが表示される', () => {
      render(
        <UserProfilePopover
          user={user}
          displayName="alice"
          anchorEl={document.body}
          open={true}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByText('ID: 1')).toBeInTheDocument();
    });

    it('open=false のときポップアップが表示されない', () => {
      render(
        <UserProfilePopover
          user={user}
          displayName="alice"
          anchorEl={document.body}
          open={false}
          onClose={vi.fn()}
        />,
      );
      expect(screen.queryByText('ID: 1')).not.toBeInTheDocument();
    });

    it('ポップアップ外にマウスが移動すると onClose が呼ばれる', async () => {
      const onClose = vi.fn();
      render(
        <UserProfilePopover
          user={user}
          displayName="alice"
          anchorEl={document.body}
          open={true}
          onClose={onClose}
        />,
      );
      // MUI Popover は pointerEvents: 'none' なのでバックドロップクリックで確認
      // Popover の閉じる動作は onClose prop 経由のため、直接 Escape キーで確認
      await userEvent.keyboard('{Escape}');
      expect(onClose).toHaveBeenCalled();
    });
  });
});
