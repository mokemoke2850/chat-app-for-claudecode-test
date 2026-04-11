/**
 * components/Channel/ChannelMembersDialog.tsx のユニットテスト
 *
 * テスト対象: プライベートチャンネルのメンバー管理ダイアログ
 * 戦略:
 *   - api.channels.addMember, api.auth.users を vi.mock で差し替える
 *   - userEvent でユーザー選択・追加操作をシミュレートする
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, vi, expect, beforeEach } from 'vitest';
import ChannelMembersDialog from '../components/Channel/ChannelMembersDialog';

vi.mock('../api/client', () => ({
  api: {
    channels: {
      addMember: vi.fn(),
    },
    auth: {
      users: vi.fn(),
    },
  },
}));

import { api } from '../api/client';
const mockAddMember = api.channels.addMember as ReturnType<typeof vi.fn>;
const mockUsers = api.auth.users as ReturnType<typeof vi.fn>;

const defaultProps = {
  open: true,
  channelId: 1,
  currentMemberIds: [1],
  onClose: vi.fn(),
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('ChannelMembersDialog', () => {
  describe('表示制御', () => {
    it('open=false のとき Dialog が非表示である', () => {
      render(
        <ChannelMembersDialog open={false} channelId={1} currentMemberIds={[]} onClose={vi.fn()} />,
      );

      expect(screen.queryByText(/メンバー追加/)).not.toBeInTheDocument();
    });

    it('open=true のとき Dialog が表示される', () => {
      mockUsers.mockResolvedValue({ users: [] });

      render(<ChannelMembersDialog {...defaultProps} />);

      expect(screen.getByText(/メンバー追加/)).toBeInTheDocument();
    });
  });

  describe('ユーザー一覧の取得と表示', () => {
    it('ダイアログを開くと api.auth.users からユーザー一覧を取得する', async () => {
      mockUsers.mockResolvedValue({ users: [{ id: 2, username: 'alice' }] });

      render(<ChannelMembersDialog {...defaultProps} />);

      await waitFor(() => expect(mockUsers).toHaveBeenCalled());
    });

    it('既存メンバーは一覧から除外して表示される', async () => {
      mockUsers.mockResolvedValue({
        users: [
          { id: 1, username: 'owner' },
          { id: 2, username: 'alice' },
        ],
      });

      // currentMemberIds=[1] なので owner は除外、alice のみ表示
      render(<ChannelMembersDialog {...defaultProps} currentMemberIds={[1]} />);

      await waitFor(() => screen.getByText('alice'));
      expect(screen.queryByText('owner')).not.toBeInTheDocument();
    });
  });

  describe('メンバー追加', () => {
    it('ユーザーを選択して追加ボタンを押すと api.channels.addMember が呼ばれる', async () => {
      mockUsers.mockResolvedValue({ users: [{ id: 2, username: 'alice' }] });
      mockAddMember.mockResolvedValue(undefined);

      render(<ChannelMembersDialog {...defaultProps} />);

      await waitFor(() => screen.getByText('alice'));
      await userEvent.click(screen.getByText('alice'));
      await userEvent.click(screen.getByRole('button', { name: /追加/i }));

      await waitFor(() => expect(mockAddMember).toHaveBeenCalledWith(1, 2));
    });

    it('追加成功後にそのユーザーは一覧から除外される', async () => {
      mockUsers.mockResolvedValue({ users: [{ id: 2, username: 'alice' }] });
      mockAddMember.mockResolvedValue(undefined);

      render(<ChannelMembersDialog {...defaultProps} />);

      await waitFor(() => screen.getByText('alice'));
      await userEvent.click(screen.getByText('alice'));
      await userEvent.click(screen.getByRole('button', { name: /追加/i }));

      await waitFor(() => expect(screen.queryByText('alice')).not.toBeInTheDocument());
    });

    it('API エラー時にエラーメッセージが表示される', async () => {
      mockUsers.mockResolvedValue({ users: [{ id: 2, username: 'alice' }] });
      mockAddMember.mockRejectedValue(new Error('Failed to add member'));

      render(<ChannelMembersDialog {...defaultProps} />);

      await waitFor(() => screen.getByText('alice'));
      await userEvent.click(screen.getByText('alice'));
      await userEvent.click(screen.getByRole('button', { name: /追加/i }));

      await waitFor(() => expect(screen.getByText('Failed to add member')).toBeInTheDocument());
    });
  });
});
