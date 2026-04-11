/**
 * components/Channel/ChannelMembersDialog.tsx のユニットテスト
 *
 * テスト対象: プライベートチャンネルのメンバー管理ダイアログ
 * 戦略:
 *   - api.channels.getMembers / addMember / removeMember, api.auth.users を vi.mock で差し替える
 *   - 全ユーザーをチェックボックスで表示し、チェック状態の切り替えで追加・解除を行う
 *   - displayName があれば displayName を、なければ username を表示する
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, vi, expect, beforeEach } from 'vitest';
import ChannelMembersDialog from '../components/Channel/ChannelMembersDialog';

vi.mock('../api/client', () => ({
  api: {
    channels: {
      getMembers: vi.fn(),
      addMember: vi.fn(),
      removeMember: vi.fn(),
    },
    auth: {
      users: vi.fn(),
    },
  },
}));

import { api } from '../api/client';
const mockGetMembers = api.channels.getMembers as ReturnType<typeof vi.fn>;
const mockAddMember = api.channels.addMember as ReturnType<typeof vi.fn>;
const mockRemoveMember = api.channels.removeMember as ReturnType<typeof vi.fn>;
const mockUsers = api.auth.users as ReturnType<typeof vi.fn>;

function makeUser(id: number, username: string, displayName?: string) {
  return {
    id,
    username,
    email: `${username}@example.com`,
    avatarUrl: null,
    displayName: displayName ?? null,
    location: null,
    createdAt: '2024-01-01T00:00:00Z',
  };
}

const defaultProps = {
  open: true,
  channelId: 1,
  onClose: vi.fn(),
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('ChannelMembersDialog', () => {
  describe('表示制御', () => {
    it('open=false のとき Dialog が非表示である', () => {
      render(<ChannelMembersDialog open={false} channelId={1} onClose={vi.fn()} />);

      expect(screen.queryByText('メンバー管理')).not.toBeInTheDocument();
    });

    it('open=true のとき Dialog が表示される', () => {
      mockUsers.mockResolvedValue({ users: [] });
      mockGetMembers.mockResolvedValue({ members: [] });

      render(<ChannelMembersDialog {...defaultProps} />);

      expect(screen.getByText('メンバー管理')).toBeInTheDocument();
    });
  });

  describe('ユーザー一覧の取得と表示', () => {
    it('ダイアログを開くと全ユーザーとチャンネルメンバーを同時取得する', async () => {
      mockUsers.mockResolvedValue({ users: [makeUser(1, 'owner')] });
      mockGetMembers.mockResolvedValue({ members: [makeUser(1, 'owner')] });

      render(<ChannelMembersDialog {...defaultProps} />);

      await waitFor(() => {
        expect(mockUsers).toHaveBeenCalled();
        expect(mockGetMembers).toHaveBeenCalledWith(1);
      });
    });

    it('displayName があればユーザー名より優先して表示される', async () => {
      mockUsers.mockResolvedValue({ users: [makeUser(2, 'alice', 'Alice Smith')] });
      mockGetMembers.mockResolvedValue({ members: [] });

      render(<ChannelMembersDialog {...defaultProps} />);

      await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
      expect(screen.queryByText('alice')).not.toBeInTheDocument();
    });

    it('displayName がない場合は username が表示される', async () => {
      mockUsers.mockResolvedValue({ users: [makeUser(2, 'bob')] });
      mockGetMembers.mockResolvedValue({ members: [] });

      render(<ChannelMembersDialog {...defaultProps} />);

      await waitFor(() => expect(screen.getByText('bob')).toBeInTheDocument());
    });

    it('現在のメンバーはチェックボックスがオンで表示される', async () => {
      mockUsers.mockResolvedValue({ users: [makeUser(1, 'owner'), makeUser(2, 'alice')] });
      mockGetMembers.mockResolvedValue({ members: [makeUser(1, 'owner')] });

      render(<ChannelMembersDialog {...defaultProps} />);

      await waitFor(() => screen.getByText('owner'));
      const ownerRow = screen.getByText('owner').closest('li')!;
      expect(ownerRow.querySelector('input[type="checkbox"]')).toBeChecked();

      const aliceRow = screen.getByText('alice').closest('li')!;
      expect(aliceRow.querySelector('input[type="checkbox"]')).not.toBeChecked();
    });
  });

  describe('メンバー追加', () => {
    it('未チェックのユーザー行をクリックすると api.channels.addMember が呼ばれる', async () => {
      mockUsers.mockResolvedValue({ users: [makeUser(2, 'alice')] });
      mockGetMembers.mockResolvedValue({ members: [] });
      mockAddMember.mockResolvedValue(undefined);

      render(<ChannelMembersDialog {...defaultProps} />);

      await waitFor(() => screen.getByText('alice'));
      await userEvent.click(screen.getByText('alice').closest('[role="button"]')!);

      await waitFor(() => expect(mockAddMember).toHaveBeenCalledWith(1, 2));
    });

    it('追加後にそのユーザーのチェックボックスがオンになる', async () => {
      mockUsers.mockResolvedValue({ users: [makeUser(2, 'alice')] });
      mockGetMembers.mockResolvedValue({ members: [] });
      mockAddMember.mockResolvedValue(undefined);

      render(<ChannelMembersDialog {...defaultProps} />);

      await waitFor(() => screen.getByText('alice'));
      await userEvent.click(screen.getByText('alice').closest('[role="button"]')!);

      await waitFor(() => {
        const row = screen.getByText('alice').closest('li')!;
        expect(row.querySelector('input[type="checkbox"]')).toBeChecked();
      });
    });
  });

  describe('メンバー解除', () => {
    it('チェック済みのユーザー行をクリックすると api.channels.removeMember が呼ばれる', async () => {
      mockUsers.mockResolvedValue({ users: [makeUser(1, 'owner')] });
      mockGetMembers.mockResolvedValue({ members: [makeUser(1, 'owner')] });
      mockRemoveMember.mockResolvedValue(undefined);

      render(<ChannelMembersDialog {...defaultProps} />);

      await waitFor(() => screen.getByText('owner'));
      await userEvent.click(screen.getByText('owner').closest('[role="button"]')!);

      await waitFor(() => expect(mockRemoveMember).toHaveBeenCalledWith(1, 1));
    });

    it('解除後にそのユーザーのチェックボックスがオフになる', async () => {
      mockUsers.mockResolvedValue({ users: [makeUser(1, 'owner')] });
      mockGetMembers.mockResolvedValue({ members: [makeUser(1, 'owner')] });
      mockRemoveMember.mockResolvedValue(undefined);

      render(<ChannelMembersDialog {...defaultProps} />);

      await waitFor(() => screen.getByText('owner'));
      await userEvent.click(screen.getByText('owner').closest('[role="button"]')!);

      await waitFor(() => {
        const row = screen.getByText('owner').closest('li')!;
        expect(row.querySelector('input[type="checkbox"]')).not.toBeChecked();
      });
    });
  });

  describe('エラーハンドリング', () => {
    it('追加 API エラー時にエラーメッセージが表示される', async () => {
      mockUsers.mockResolvedValue({ users: [makeUser(2, 'alice')] });
      mockGetMembers.mockResolvedValue({ members: [] });
      mockAddMember.mockRejectedValue(new Error('Failed to add member'));

      render(<ChannelMembersDialog {...defaultProps} />);

      await waitFor(() => screen.getByText('alice'));
      await userEvent.click(screen.getByText('alice').closest('[role="button"]')!);

      await waitFor(() => expect(screen.getByText('Failed to add member')).toBeInTheDocument());
    });
  });
});
