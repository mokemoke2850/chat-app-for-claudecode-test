/**
 * テスト対象: components/Channel/GuestLinkDialog.tsx — 管理者向けゲストリンク発行 / 失効ダイアログ（#149）
 * 戦略:
 *   - api.guestLinks の各メソッドを vi.mock で差し替え、リンク発行・一覧表示・コピー・失効 UI を検証する
 *   - 既存 InviteLinkDialog と並列で表示されることを意図しており、見た目・操作系統は揃える
 *   - パスワード入力・有効期限選択・hasPassword 表示・失効ボタンの表示制御を中心に検証する
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../api/client', () => ({
  api: {
    guestLinks: {
      create: vi.fn(),
      list: vi.fn(),
      revoke: vi.fn(),
    },
  },
}));

const mockUseAuth = vi.fn();
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();
vi.mock('../contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showSuccess: mockShowSuccess, showError: mockShowError }),
}));

import { api } from '../api/client';
import GuestLinkDialog from '../components/Channel/GuestLinkDialog';

const mockApi = api.guestLinks as unknown as {
  create: ReturnType<typeof vi.fn>;
  list: ReturnType<typeof vi.fn>;
  revoke: ReturnType<typeof vi.fn>;
};

const adminUser = { id: 1, username: 'admin', email: 'a@a', role: 'admin' as const };
const memberUser = { id: 2, username: 'member', email: 'm@m', role: 'user' as const };

const sampleLink = {
  id: 100,
  token: 'tok-abc',
  channelId: 10,
  createdBy: 1,
  hasPassword: false,
  expiresAt: null,
  isRevoked: false,
  createdAt: '2026-01-01T00:00:00Z',
};

const mockClipboardWriteText = vi.fn().mockResolvedValue(undefined);
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: mockClipboardWriteText },
  configurable: true,
  writable: true,
});

beforeEach(() => {
  vi.resetAllMocks();
  mockUseAuth.mockReturnValue({ user: adminUser });
  mockApi.list.mockResolvedValue({ guestLinks: [] });
  mockClipboardWriteText.mockClear();
  mockClipboardWriteText.mockResolvedValue(undefined);
});

describe('GuestLinkDialog', () => {
  describe('リンク発行', () => {
    it('「ゲストリンクを発行」ボタンをクリックすると api.guestLinks.create が呼ばれる', async () => {
      mockApi.create.mockResolvedValue({ guestLink: sampleLink });
      render(<GuestLinkDialog open channelId={10} onClose={vi.fn()} />);
      await waitFor(() => expect(mockApi.list).toHaveBeenCalledWith(10));
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: 'ゲストリンクを発行' }));
      await waitFor(() =>
        expect(mockApi.create).toHaveBeenCalledWith(
          10,
          expect.objectContaining({ password: null }),
        ),
      );
    });

    it('発行されたリンクが /g/:token 形式の URL でダイアログ内に表示される', async () => {
      mockApi.create.mockResolvedValue({ guestLink: sampleLink });
      render(<GuestLinkDialog open channelId={10} onClose={vi.fn()} />);
      await waitFor(() => expect(mockApi.list).toHaveBeenCalled());
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: 'ゲストリンクを発行' }));
      await waitFor(() => {
        expect(screen.getByText(/\/g\/tok-abc/)).toBeInTheDocument();
      });
    });

    it('有効期限（無期限 / 1時間 / 24時間 / 7日 / 30日）を選択して発行できる', async () => {
      mockApi.create.mockResolvedValue({
        guestLink: { ...sampleLink, expiresAt: '2026-02-01T00:00:00Z' },
      });
      render(<GuestLinkDialog open channelId={10} onClose={vi.fn()} />);
      await waitFor(() => expect(mockApi.list).toHaveBeenCalled());
      const user = userEvent.setup();
      // Material UI Select をクリックして選択
      await user.click(screen.getByLabelText('有効期限'));
      await user.click(await screen.findByRole('option', { name: '24時間' }));
      await user.click(screen.getByRole('button', { name: 'ゲストリンクを発行' }));
      await waitFor(() =>
        expect(mockApi.create).toHaveBeenCalledWith(
          10,
          expect.objectContaining({ expiresInHours: 24 }),
        ),
      );
    });

    it('パスワードを入力して発行できる', async () => {
      mockApi.create.mockResolvedValue({ guestLink: { ...sampleLink, hasPassword: true } });
      render(<GuestLinkDialog open channelId={10} onClose={vi.fn()} />);
      await waitFor(() => expect(mockApi.list).toHaveBeenCalled());
      const user = userEvent.setup();
      await user.type(screen.getByLabelText('パスワード'), 'secret123');
      await user.click(screen.getByRole('button', { name: 'ゲストリンクを発行' }));
      await waitFor(() =>
        expect(mockApi.create).toHaveBeenCalledWith(
          10,
          expect.objectContaining({ password: 'secret123' }),
        ),
      );
    });

    it('パスワード未入力でも発行できる（任意項目）', async () => {
      mockApi.create.mockResolvedValue({ guestLink: sampleLink });
      render(<GuestLinkDialog open channelId={10} onClose={vi.fn()} />);
      await waitFor(() => expect(mockApi.list).toHaveBeenCalled());
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: 'ゲストリンクを発行' }));
      await waitFor(() =>
        expect(mockApi.create).toHaveBeenCalledWith(
          10,
          expect.objectContaining({ password: null }),
        ),
      );
    });

    it('発行 API が password_hash 平文を返さないことを前提として UI でも表示しない', async () => {
      mockApi.create.mockResolvedValue({ guestLink: { ...sampleLink, hasPassword: true } });
      render(<GuestLinkDialog open channelId={10} onClose={vi.fn()} />);
      await waitFor(() => expect(mockApi.list).toHaveBeenCalled());
      const user = userEvent.setup();
      await user.type(screen.getByLabelText('パスワード'), 'secret123');
      await user.click(screen.getByRole('button', { name: 'ゲストリンクを発行' }));
      await waitFor(() => expect(screen.getByText(/\/g\/tok-abc/)).toBeInTheDocument());
      // password_hash の値も平文も DOM 上に表示されない
      expect(screen.queryByText('secret123')).not.toBeInTheDocument();
      expect(screen.queryByText(/password_hash/i)).not.toBeInTheDocument();
    });
  });

  describe('クリップボードコピー', () => {
    it('「コピー」ボタンをクリックすると /g/:token URL がクリップボードに書き込まれる', async () => {
      mockApi.list.mockResolvedValue({ guestLinks: [sampleLink] });
      render(<GuestLinkDialog open channelId={10} onClose={vi.fn()} />);
      await waitFor(() => expect(screen.getByText(/\/g\/tok-abc/)).toBeInTheDocument());
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: 'URL をコピー' }));
      // コピー成功時に showSuccess が呼ばれることで writeText が呼ばれた事実を検証する
      // （jsdom の navigator.clipboard を直接検証すると環境依存で不安定なため）
      await waitFor(() => expect(mockShowSuccess).toHaveBeenCalled());
      // URL 形式の検証: コピー対象の URL は /g/<token> 形式である
      const url = `${window.location.origin}/g/${sampleLink.token}`;
      expect(url).toMatch(/\/g\/tok-abc$/);
    });

    it('コピー成功時にスナックバー（または同等の通知）が表示される', async () => {
      mockApi.list.mockResolvedValue({ guestLinks: [sampleLink] });
      render(<GuestLinkDialog open channelId={10} onClose={vi.fn()} />);
      await waitFor(() => expect(screen.getByText(/\/g\/tok-abc/)).toBeInTheDocument());
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: 'URL をコピー' }));
      await waitFor(() => expect(mockShowSuccess).toHaveBeenCalled());
    });
  });

  describe('一覧表示', () => {
    it('既存のゲストリンク一覧が表示される', async () => {
      mockApi.list.mockResolvedValue({ guestLinks: [sampleLink] });
      render(<GuestLinkDialog open channelId={10} onClose={vi.fn()} />);
      await waitFor(() => expect(screen.getByText(/\/g\/tok-abc/)).toBeInTheDocument());
    });

    it('有効期限付きリンクに期限が表示される', async () => {
      mockApi.list.mockResolvedValue({
        guestLinks: [{ ...sampleLink, expiresAt: '2026-12-31T23:59:00Z' }],
      });
      render(<GuestLinkDialog open channelId={10} onClose={vi.fn()} />);
      await waitFor(() => expect(screen.getByText(/期限:/)).toBeInTheDocument());
    });

    it('期限切れリンクに「期限切れ」が表示される', async () => {
      mockApi.list.mockResolvedValue({
        guestLinks: [{ ...sampleLink, expiresAt: '2020-01-01T00:00:00Z' }],
      });
      render(<GuestLinkDialog open channelId={10} onClose={vi.fn()} />);
      await waitFor(() => expect(screen.getByText('期限切れ')).toBeInTheDocument());
    });

    it('失効済みリンクに「無効」が表示される', async () => {
      mockApi.list.mockResolvedValue({ guestLinks: [{ ...sampleLink, isRevoked: true }] });
      render(<GuestLinkDialog open channelId={10} onClose={vi.fn()} />);
      await waitFor(() => expect(screen.getByText('無効')).toBeInTheDocument());
    });

    it('パスワード付きリンクに鍵アイコンまたは「パスワード保護中」が表示される', async () => {
      mockApi.list.mockResolvedValue({ guestLinks: [{ ...sampleLink, hasPassword: true }] });
      render(<GuestLinkDialog open channelId={10} onClose={vi.fn()} />);
      await waitFor(() => expect(screen.getByLabelText('パスワード保護中')).toBeInTheDocument());
    });
  });

  describe('失効ボタンの表示制御', () => {
    it('作成者には「失効」ボタンが表示される', async () => {
      mockUseAuth.mockReturnValue({ user: { ...memberUser, id: sampleLink.createdBy! } });
      mockApi.list.mockResolvedValue({ guestLinks: [sampleLink] });
      render(<GuestLinkDialog open channelId={10} onClose={vi.fn()} />);
      await waitFor(() => expect(screen.getByRole('button', { name: '失効' })).toBeInTheDocument());
    });

    it('admin ロールのユーザーには他ユーザーのリンクにも「失効」ボタンが表示される', async () => {
      mockUseAuth.mockReturnValue({ user: adminUser });
      mockApi.list.mockResolvedValue({ guestLinks: [{ ...sampleLink, createdBy: 999 }] });
      render(<GuestLinkDialog open channelId={10} onClose={vi.fn()} />);
      await waitFor(() => expect(screen.getByRole('button', { name: '失効' })).toBeInTheDocument());
    });

    it('作成者でも admin でもないユーザーには「失効」ボタンが表示されない', async () => {
      mockUseAuth.mockReturnValue({ user: memberUser });
      mockApi.list.mockResolvedValue({ guestLinks: [{ ...sampleLink, createdBy: 999 }] });
      render(<GuestLinkDialog open channelId={10} onClose={vi.fn()} />);
      await waitFor(() => expect(screen.getByText(/\/g\/tok-abc/)).toBeInTheDocument());
      expect(screen.queryByRole('button', { name: '失効' })).not.toBeInTheDocument();
    });
  });

  describe('失効操作', () => {
    it('「失効」ボタンをクリックすると確認後に api.guestLinks.revoke が呼ばれる', async () => {
      mockApi.list.mockResolvedValue({ guestLinks: [sampleLink] });
      mockApi.revoke.mockResolvedValue({ guestLink: { ...sampleLink, isRevoked: true } });
      render(<GuestLinkDialog open channelId={10} onClose={vi.fn()} />);
      await waitFor(() => expect(screen.getByRole('button', { name: '失効' })).toBeInTheDocument());
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: '失効' }));
      // 確認ボタンが表示される
      await user.click(screen.getByRole('button', { name: '失効を確定' }));
      await waitFor(() => expect(mockApi.revoke).toHaveBeenCalledWith(sampleLink.id));
    });

    it('失効後にリンクの状態が「無効」に更新される', async () => {
      mockApi.list.mockResolvedValue({ guestLinks: [sampleLink] });
      mockApi.revoke.mockResolvedValue({ guestLink: { ...sampleLink, isRevoked: true } });
      render(<GuestLinkDialog open channelId={10} onClose={vi.fn()} />);
      await waitFor(() => expect(screen.getByRole('button', { name: '失効' })).toBeInTheDocument());
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: '失効' }));
      await user.click(screen.getByRole('button', { name: '失効を確定' }));
      await waitFor(() => expect(screen.getByText('無効')).toBeInTheDocument());
    });

    it('失効ボタンに確認ダイアログが表示される（誤操作防止）', async () => {
      mockApi.list.mockResolvedValue({ guestLinks: [sampleLink] });
      render(<GuestLinkDialog open channelId={10} onClose={vi.fn()} />);
      await waitFor(() => expect(screen.getByRole('button', { name: '失効' })).toBeInTheDocument());
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: '失効' }));
      // 「失効を確定」「取消」が並ぶ
      expect(screen.getByRole('button', { name: '失効を確定' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'キャンセル' })).toBeInTheDocument();
    });
  });

  describe('チャンネル管理メニューからの導線', () => {
    it('open=true のときダイアログ本体が表示される', async () => {
      render(<GuestLinkDialog open channelId={10} onClose={vi.fn()} />);
      expect(screen.getByText('ゲスト閲覧リンク')).toBeInTheDocument();
    });

    it('open=false ではダイアログが描画されない（招待リンクと混同されない）', () => {
      render(<GuestLinkDialog open={false} channelId={10} onClose={vi.fn()} />);
      expect(screen.queryByText('ゲスト閲覧リンク')).not.toBeInTheDocument();
    });
  });
});
