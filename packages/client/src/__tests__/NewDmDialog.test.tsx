/**
 * テスト対象: DMPage 内の NewDmDialog コンポーネント
 * 責務: 新規DM開始時のユーザー選択ダイアログ
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User } from '@chat-app/shared';
import NewDmDialog from '../components/DM/NewDmDialog';

const makeUser = (id: number, username: string, displayName?: string): User => ({
  id,
  username,
  email: `${username}@example.com`,
  avatarUrl: null,
  displayName: displayName ?? null,
  location: null,
  createdAt: '2024-01-01T00:00:00Z',
  role: 'user',
  isActive: true,
});

const dummyUsers = [
  makeUser(1, 'alice'),
  makeUser(2, 'bob'),
  makeUser(3, 'charlie', 'Charlie Brown'),
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('NewDmDialog', () => {
  describe('ダイアログ表示', () => {
    it('open=true のとき「新規ダイレクトメッセージ」ダイアログが表示される', () => {
      render(
        <NewDmDialog
          open={true}
          users={dummyUsers}
          currentUserId={1}
          onClose={vi.fn()}
          onSelect={vi.fn()}
        />,
      );
      expect(screen.getByText('新規ダイレクトメッセージ')).toBeInTheDocument();
    });

    it('open=false のときダイアログが表示されない', () => {
      render(
        <NewDmDialog
          open={false}
          users={dummyUsers}
          currentUserId={1}
          onClose={vi.fn()}
          onSelect={vi.fn()}
        />,
      );
      expect(screen.queryByText('新規ダイレクトメッセージ')).not.toBeInTheDocument();
    });
  });

  describe('ユーザー一覧表示', () => {
    it('現在のユーザー以外のユーザー一覧が表示される', () => {
      render(
        <NewDmDialog
          open={true}
          users={dummyUsers}
          currentUserId={1}
          onClose={vi.fn()}
          onSelect={vi.fn()}
        />,
      );
      expect(screen.getByText('bob')).toBeInTheDocument();
      expect(screen.getByText('Charlie Brown')).toBeInTheDocument();
    });

    it('現在のユーザー自身は一覧に表示されない', () => {
      render(
        <NewDmDialog
          open={true}
          users={dummyUsers}
          currentUserId={1}
          onClose={vi.fn()}
          onSelect={vi.fn()}
        />,
      );
      // alice (id=1) は currentUserId=1 なので非表示
      expect(screen.queryByText('alice')).not.toBeInTheDocument();
    });

    it('ユーザーの displayName がある場合は displayName が表示される', () => {
      render(
        <NewDmDialog
          open={true}
          users={dummyUsers}
          currentUserId={1}
          onClose={vi.fn()}
          onSelect={vi.fn()}
        />,
      );
      expect(screen.getByText('Charlie Brown')).toBeInTheDocument();
    });

    it('displayName がない場合は username が表示される', () => {
      render(
        <NewDmDialog
          open={true}
          users={dummyUsers}
          currentUserId={1}
          onClose={vi.fn()}
          onSelect={vi.fn()}
        />,
      );
      // bob に displayName はない
      expect(screen.getByText('bob')).toBeInTheDocument();
    });

    it('他のユーザーが存在しない場合は「他のユーザーがいません」と表示される', () => {
      render(
        <NewDmDialog
          open={true}
          users={[makeUser(1, 'alice')]}
          currentUserId={1}
          onClose={vi.fn()}
          onSelect={vi.fn()}
        />,
      );
      expect(screen.getByText('他のユーザーがいません')).toBeInTheDocument();
    });
  });

  describe('ユーザー選択', () => {
    it('ユーザーをクリックすると onSelect がそのユーザーIDで呼ばれる', async () => {
      const onSelect = vi.fn();
      render(
        <NewDmDialog
          open={true}
          users={dummyUsers}
          currentUserId={1}
          onClose={vi.fn()}
          onSelect={onSelect}
        />,
      );
      await userEvent.click(screen.getByText('bob'));
      expect(onSelect).toHaveBeenCalledWith(2);
    });

    it('ユーザーをクリックすると onClose が呼ばれてダイアログが閉じる', async () => {
      const onClose = vi.fn();
      render(
        <NewDmDialog
          open={true}
          users={dummyUsers}
          currentUserId={1}
          onClose={onClose}
          onSelect={vi.fn()}
        />,
      );
      await userEvent.click(screen.getByText('bob'));
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('ダイアログクローズ', () => {
    it('ダイアログの外側をクリックすると onClose が呼ばれる', async () => {
      const onClose = vi.fn();
      render(
        <NewDmDialog
          open={true}
          users={dummyUsers}
          currentUserId={1}
          onClose={onClose}
          onSelect={vi.fn()}
        />,
      );
      // MUI Dialog の backdrop をクリック
      const backdrop = document.querySelector('.MuiBackdrop-root');
      if (backdrop) {
        await userEvent.click(backdrop);
        expect(onClose).toHaveBeenCalled();
      }
    });
  });
});
