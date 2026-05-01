/**
 * テスト対象: components/Channel/InviteLinkDialog.tsx
 * 戦略: api.invites の各メソッドを vi.mock で差し替え、
 *       招待リンクの生成・一覧表示・コピー・無効化 UI を検証する。
 *       管理者／作成者のみ「無効化」ボタンが表示されることを確認する。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { InviteLink } from '@chat-app/shared';
import InviteLinkDialog from '../components/Channel/InviteLinkDialog';

const createMock = vi.fn();
const listMock = vi.fn();
const revokeMock = vi.fn();
vi.mock('../api/client', () => ({
  api: {
    invites: {
      create: (...args: unknown[]) => createMock(...args),
      list: (...args: unknown[]) => listMock(...args),
      revoke: (...args: unknown[]) => revokeMock(...args),
    },
  },
}));

type MockUser = { id: number; username: string; role: string };
let mockUserOverride: MockUser | null = { id: 1, username: 'me', role: 'user' };
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUserOverride }),
}));

const writeTextMock = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  createMock.mockReset();
  listMock.mockReset().mockResolvedValue({ invites: [] });
  revokeMock.mockReset();
  mockUserOverride = { id: 1, username: 'me', role: 'user' };
  writeTextMock.mockClear();
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: writeTextMock },
    configurable: true,
  });
});

function makeInvite(overrides: Partial<InviteLink> = {}): InviteLink {
  return {
    id: 1,
    token: 'tok',
    channelId: 5,
    createdBy: 1,
    maxUses: null,
    usedCount: 0,
    expiresAt: null,
    isRevoked: false,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

async function renderDialog() {
  const onClose = vi.fn();
  render(<InviteLinkDialog open={true} channelId={5} onClose={onClose} />);
  // MUI Dialog の onEntered で list が呼ばれるまで待つ
  await waitFor(() => expect(listMock).toHaveBeenCalled());
  return { onClose };
}

describe('InviteLinkDialog', () => {
  describe('リンク生成', () => {
    it('「リンクを生成」ボタンをクリックすると api.invites.create が呼ばれる', async () => {
      createMock.mockResolvedValue({ invite: makeInvite() });
      await renderDialog();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'リンクを生成' }));
      });
      expect(createMock).toHaveBeenCalled();
    });

    it('生成されたリンクが URL 形式でダイアログ内に表示される', async () => {
      createMock.mockResolvedValue({ invite: makeInvite({ id: 99, token: 'newtok' }) });
      await renderDialog();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'リンクを生成' }));
      });
      // ${origin}/invite/newtok を表示
      expect(screen.getByText(/\/invite\/newtok/)).toBeInTheDocument();
    });

    it('有効期限（expiresInHours）を選択して生成できる', async () => {
      const user = userEvent.setup();
      createMock.mockResolvedValue({ invite: makeInvite() });
      await renderDialog();
      // MUI Select の trigger を combobox role で取得（このダイアログ内で1つだけ）
      await user.click(screen.getAllByRole('combobox')[0]);
      await user.click(await screen.findByRole('option', { name: '24時間' }));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'リンクを生成' }));
      });
      expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ expiresInHours: 24 }));
    });

    it('最大使用回数（maxUses）を入力して生成できる', async () => {
      createMock.mockResolvedValue({ invite: makeInvite() });
      await renderDialog();
      fireEvent.change(screen.getByLabelText('最大使用回数'), { target: { value: '5' } });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'リンクを生成' }));
      });
      expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ maxUses: 5 }));
    });
  });

  describe('クリップボードコピー', () => {
    it('「コピー」ボタンをクリックするとリンクがクリップボードに書き込まれる', async () => {
      listMock.mockResolvedValue({ invites: [makeInvite({ token: 'copytok' })] });
      await renderDialog();
      await act(async () => {
        fireEvent.click(screen.getByLabelText('URLをコピー'));
      });
      expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('/invite/copytok'));
    });
  });

  describe('一覧表示', () => {
    it('既存の招待リンク一覧が表示される', async () => {
      listMock.mockResolvedValue({
        invites: [makeInvite({ id: 1, token: 't1' }), makeInvite({ id: 2, token: 't2' })],
      });
      await renderDialog();
      await waitFor(() => {
        expect(screen.getByText(/\/invite\/t1/)).toBeInTheDocument();
        expect(screen.getByText(/\/invite\/t2/)).toBeInTheDocument();
      });
    });

    it('有効期限付きリンクに期限が表示される', async () => {
      listMock.mockResolvedValue({
        invites: [makeInvite({ expiresAt: '2030-12-31T23:59:00Z' })],
      });
      await renderDialog();
      await waitFor(() => {
        // 期限: の表示が secondary に出る
        expect(screen.getByText(/期限:/)).toBeInTheDocument();
      });
    });

    it('期限切れリンクに「期限切れ」が表示される', async () => {
      listMock.mockResolvedValue({
        invites: [makeInvite({ expiresAt: '2000-01-01T00:00:00Z' })],
      });
      await renderDialog();
      await waitFor(() => {
        expect(screen.getByText(/期限切れ/)).toBeInTheDocument();
      });
    });

    it('revoke 済みリンクに「無効」が表示される', async () => {
      listMock.mockResolvedValue({
        invites: [makeInvite({ isRevoked: true })],
      });
      await renderDialog();
      await waitFor(() => {
        // statusLabel が「無効」を返す
        expect(screen.getByText(/状態: 無効/)).toBeInTheDocument();
      });
    });
  });

  describe('無効化ボタンの表示制御', () => {
    it('作成者には「無効化」ボタンが表示される', async () => {
      mockUserOverride = { id: 1, username: 'me', role: 'user' };
      listMock.mockResolvedValue({ invites: [makeInvite({ createdBy: 1 })] });
      await renderDialog();
      await waitFor(() => {
        expect(screen.getByLabelText('無効化')).toBeInTheDocument();
      });
    });

    it('admin ロールのユーザーには他ユーザーのリンクにも「無効化」ボタンが表示される', async () => {
      mockUserOverride = { id: 99, username: 'admin', role: 'admin' };
      listMock.mockResolvedValue({ invites: [makeInvite({ createdBy: 1 })] });
      await renderDialog();
      await waitFor(() => {
        expect(screen.getByLabelText('無効化')).toBeInTheDocument();
      });
    });

    it('作成者でも admin でもないユーザーには「無効化」ボタンが表示されない', async () => {
      mockUserOverride = { id: 99, username: 'other', role: 'user' };
      listMock.mockResolvedValue({ invites: [makeInvite({ createdBy: 1 })] });
      await renderDialog();
      await waitFor(() => {
        expect(screen.getByText(/\/invite\//)).toBeInTheDocument();
      });
      expect(screen.queryByLabelText('無効化')).toBeNull();
    });
  });

  describe('無効化操作', () => {
    it('「無効化」ボタンをクリックすると api.invites.revoke が呼ばれる', async () => {
      const invite = makeInvite({ id: 7, createdBy: 1 });
      listMock.mockResolvedValue({ invites: [invite] });
      revokeMock.mockResolvedValue({ invite: { ...invite, isRevoked: true } });
      await renderDialog();
      await waitFor(() => {
        expect(screen.getByLabelText('無効化')).toBeInTheDocument();
      });
      await act(async () => {
        fireEvent.click(screen.getByLabelText('無効化'));
      });
      expect(revokeMock).toHaveBeenCalledWith(7);
    });

    it('revoke 後にリンクの状態が「無効」に更新される', async () => {
      const invite = makeInvite({ id: 7, createdBy: 1 });
      listMock.mockResolvedValue({ invites: [invite] });
      revokeMock.mockResolvedValue({ invite: { ...invite, isRevoked: true } });
      await renderDialog();
      await waitFor(() => {
        expect(screen.getByLabelText('無効化')).toBeInTheDocument();
      });
      await act(async () => {
        fireEvent.click(screen.getByLabelText('無効化'));
      });
      await waitFor(() => {
        expect(screen.getByText(/状態: 無効/)).toBeInTheDocument();
      });
    });
  });
});
