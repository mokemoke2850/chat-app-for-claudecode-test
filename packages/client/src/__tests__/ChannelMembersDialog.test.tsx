/**
 * components/Channel/ChannelMembersDialog.tsx のユニットテスト
 *
 * テスト対象: プライベートチャンネルのメンバー管理ダイアログ
 * 戦略:
 *   - api.channels.getMembers / addMember / removeMember, api.auth.users を vi.mock で差し替える
 *   - 全ユーザーをチェックボックスで表示し、チェック状態の切り替えで追加・解除を行う
 *   - displayName があれば displayName を、なければ username を表示する
 *
 * React 19 移行後の変更点:
 *   - open=true 時に MembersContent が use() + Suspense を使うため、
 *     render を await act(async () => { render(...) }) でラップして Suspense をフラッシュする
 */

import { act } from 'react';
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
    dm: {
      createConversation: vi.fn(),
    },
  },
}));

// Step 8e-2: useNavigate / useSnackbar / useAuth を mock
const mockNavigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const mockShowError = vi.hoisted(() => vi.fn());
vi.mock('../contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showError: mockShowError, showSuccess: vi.fn(), showInfo: vi.fn() }),
}));

const mockAuthUser = vi.hoisted(() => ({
  id: 1,
  username: 'me',
  email: 'me@example.com',
  role: 'user',
}));
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockAuthUser }),
}));

import { api } from '../api/client';
const mockGetMembers = api.channels.getMembers as ReturnType<typeof vi.fn>;
const mockAddMember = api.channels.addMember as ReturnType<typeof vi.fn>;
const mockRemoveMember = api.channels.removeMember as ReturnType<typeof vi.fn>;
const mockUsers = api.auth.users as ReturnType<typeof vi.fn>;
const mockCreateConv = (api as unknown as { dm: { createConversation: ReturnType<typeof vi.fn> } })
  .dm.createConversation;

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

/** open=true のダイアログを act でフラッシュしてレンダリングする */
async function renderDialog(props: typeof defaultProps) {
  await act(async () => {
    render(<ChannelMembersDialog {...props} />);
  });
}

describe('ChannelMembersDialog', () => {
  describe('表示制御', () => {
    it('open=false のとき Dialog が非表示である', () => {
      // open=false は use() を呼ばないため act 不要
      render(<ChannelMembersDialog open={false} channelId={1} onClose={vi.fn()} />);

      expect(screen.queryByText('メンバー管理')).not.toBeInTheDocument();
    });

    it('open=true のとき Dialog が表示される', async () => {
      mockUsers.mockResolvedValue({ users: [] });
      mockGetMembers.mockResolvedValue({ members: [] });

      await renderDialog(defaultProps);

      expect(screen.getByText('メンバー管理')).toBeInTheDocument();
    });
  });

  describe('ユーザー一覧の取得と表示', () => {
    it('ダイアログを開くと全ユーザーとチャンネルメンバーを同時取得する', async () => {
      mockUsers.mockResolvedValue({ users: [makeUser(1, 'owner')] });
      mockGetMembers.mockResolvedValue({ members: [makeUser(1, 'owner')] });

      await renderDialog(defaultProps);

      expect(mockUsers).toHaveBeenCalled();
      expect(mockGetMembers).toHaveBeenCalledWith(1);
    });

    it('displayName があればユーザー名より優先して表示される', async () => {
      mockUsers.mockResolvedValue({ users: [makeUser(2, 'alice', 'Alice Smith')] });
      mockGetMembers.mockResolvedValue({ members: [] });

      await renderDialog(defaultProps);

      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      expect(screen.queryByText('alice')).not.toBeInTheDocument();
    });

    it('displayName がない場合は username が表示される', async () => {
      mockUsers.mockResolvedValue({ users: [makeUser(2, 'bob')] });
      mockGetMembers.mockResolvedValue({ members: [] });

      await renderDialog(defaultProps);

      expect(screen.getByText('bob')).toBeInTheDocument();
    });

    it('現在のメンバーはチェックボックスがオンで表示される', async () => {
      mockUsers.mockResolvedValue({ users: [makeUser(1, 'owner'), makeUser(2, 'alice')] });
      mockGetMembers.mockResolvedValue({ members: [makeUser(1, 'owner')] });

      await renderDialog(defaultProps);

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

      await renderDialog(defaultProps);

      await userEvent.click(screen.getByText('alice').closest('[role="button"]')!);

      await waitFor(() => expect(mockAddMember).toHaveBeenCalledWith(1, 2));
    });

    it('追加後にそのユーザーのチェックボックスがオンになる', async () => {
      mockUsers.mockResolvedValue({ users: [makeUser(2, 'alice')] });
      mockGetMembers.mockResolvedValue({ members: [] });
      mockAddMember.mockResolvedValue(undefined);

      await renderDialog(defaultProps);

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

      await renderDialog(defaultProps);

      await userEvent.click(screen.getByText('owner').closest('[role="button"]')!);

      await waitFor(() => expect(mockRemoveMember).toHaveBeenCalledWith(1, 1));
    });

    it('解除後にそのユーザーのチェックボックスがオフになる', async () => {
      mockUsers.mockResolvedValue({ users: [makeUser(1, 'owner')] });
      mockGetMembers.mockResolvedValue({ members: [makeUser(1, 'owner')] });
      mockRemoveMember.mockResolvedValue(undefined);

      await renderDialog(defaultProps);

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

      await renderDialog(defaultProps);

      await userEvent.click(screen.getByText('alice').closest('[role="button"]')!);

      await waitFor(() => expect(screen.getByText('Failed to add member')).toBeInTheDocument());
    });
  });

  // ===========================
  // #147 カスタムステータス表示（追加）
  // ===========================
  //
  // 仕様前提:
  //   - メンバー一覧の各行にユーザーのステータス絵文字を表示する
  //   - ステータスが null のユーザーはステータス表示なし
  describe('カスタムステータス表示', () => {
    it('メンバーにステータス絵文字が設定されているときメンバー行に絵文字が表示される', async () => {
      const userWithStatus = {
        ...makeUser(1, 'alice'),
        status: { emoji: '🎉', text: null, expiresAt: null },
      };
      mockUsers.mockResolvedValue({ users: [userWithStatus] });
      mockGetMembers.mockResolvedValue({ members: [] });

      await renderDialog(defaultProps);

      expect(screen.getByText('🎉')).toBeInTheDocument();
    });

    it('ステータスが null のメンバーはステータス表示がない', async () => {
      const userNoStatus = { ...makeUser(1, 'alice'), status: null };
      mockUsers.mockResolvedValue({ users: [userNoStatus] });
      mockGetMembers.mockResolvedValue({ members: [] });

      await renderDialog(defaultProps);

      expect(screen.queryByTestId('user-status')).not.toBeInTheDocument();
    });
  });

  // Step 8e-2: ContextRail メンバータブから DM 開始導線
  describe('Step 8e-2: DM 開始ボタン', () => {
    it('自分以外の行に「DM を開始」ボタンが表示される', async () => {
      mockUsers.mockResolvedValue({
        users: [makeUser(1, 'me'), makeUser(2, 'alice'), makeUser(3, 'bob')],
      });
      mockGetMembers.mockResolvedValue({ members: [] });

      await renderDialog(defaultProps);

      // 自分 (id=1) 以外の 2 人 (alice, bob) に DM ボタンが表示される
      const dmButtons = screen.getAllByRole('button', { name: 'DM を開始' });
      expect(dmButtons).toHaveLength(2);
    });

    it('自分自身の行には「DM を開始」ボタンが表示されない', async () => {
      mockUsers.mockResolvedValue({ users: [makeUser(1, 'me'), makeUser(2, 'alice')] });
      mockGetMembers.mockResolvedValue({ members: [] });

      await renderDialog(defaultProps);

      // 自分 (id=1) の行内には DM ボタンが無い
      const meRow = screen.getByText('me').closest('li')!;
      expect(meRow.querySelector('button[aria-label="DM を開始"]')).toBeNull();
    });

    it('DM ボタンクリックで api.dm.createConversation が呼ばれる', async () => {
      mockUsers.mockResolvedValue({ users: [makeUser(1, 'me'), makeUser(2, 'alice')] });
      mockGetMembers.mockResolvedValue({ members: [] });
      mockCreateConv.mockResolvedValue({ conversation: { id: 99 } });

      await renderDialog(defaultProps);

      await userEvent.click(screen.getByRole('button', { name: 'DM を開始' }));

      await waitFor(() => expect(mockCreateConv).toHaveBeenCalledWith(2));
    });

    it('createConversation 成功時に /dm?conv=N に navigate される', async () => {
      mockUsers.mockResolvedValue({ users: [makeUser(1, 'me'), makeUser(2, 'alice')] });
      mockGetMembers.mockResolvedValue({ members: [] });
      mockCreateConv.mockResolvedValue({ conversation: { id: 99 } });

      await renderDialog(defaultProps);

      await userEvent.click(screen.getByRole('button', { name: 'DM を開始' }));

      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dm?conv=99'));
    });

    it('DM ボタンクリックでメンバー追加/削除 (handleToggle) が呼ばれない (stopPropagation)', async () => {
      mockUsers.mockResolvedValue({ users: [makeUser(1, 'me'), makeUser(2, 'alice')] });
      mockGetMembers.mockResolvedValue({ members: [] });
      mockCreateConv.mockResolvedValue({ conversation: { id: 99 } });

      await renderDialog(defaultProps);

      await userEvent.click(screen.getByRole('button', { name: 'DM を開始' }));

      // メンバー追加 API は呼ばれない (DM ボタンが ListItemButton onClick を発火させない)
      expect(mockAddMember).not.toHaveBeenCalled();
    });

    it('createConversation 失敗時に showError でエラー通知される', async () => {
      mockUsers.mockResolvedValue({ users: [makeUser(1, 'me'), makeUser(2, 'alice')] });
      mockGetMembers.mockResolvedValue({ members: [] });
      mockCreateConv.mockRejectedValue(new Error('DM 開始に失敗'));

      await renderDialog(defaultProps);

      await userEvent.click(screen.getByRole('button', { name: 'DM を開始' }));

      await waitFor(() => expect(mockShowError).toHaveBeenCalledWith('DM 開始に失敗'));
    });
  });
});
