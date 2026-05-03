/**
 * components/Channel/ChannelSettingsForm.tsx のユニットテスト (Step 5c-1)
 *
 * テスト対象: ContextRail 概要タブに集約されるチャンネル設定編集 UI
 *   - 招待リンク作成 / ゲスト閲覧リンク発行 / トピック編集ダイアログの起動
 *   - 編集権限（admin or 作成者）による表示制御
 *   - 保存時の API 呼出
 *
 * 戦略:
 *   - InviteLinkDialog / GuestLinkDialog はスタブに差し替えて
 *     ダイアログの open prop の遷移のみ検証する
 *   - api.channels.updateTopic / updatePostingPermission をモックする
 *   - SnackbarContext は最小スタブ
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Channel } from '@chat-app/shared';
import ChannelSettingsForm from '../components/Channel/ChannelSettingsForm';
import { makeChannel } from './__fixtures__/channels';

// InviteLinkDialog / GuestLinkDialog: open prop を data-testid で確認可能なスタブに差し替え
vi.mock('../components/Channel/InviteLinkDialog', () => ({
  default: ({ open }: { open: boolean }) =>
    open ? <div data-testid="invite-link-dialog-stub" /> : null,
}));
vi.mock('../components/Channel/GuestLinkDialog', () => ({
  default: ({ open }: { open: boolean }) =>
    open ? <div data-testid="guest-link-dialog-stub" /> : null,
}));

const mockUpdateTopic = vi.hoisted(() => vi.fn());
const mockUpdatePostingPermission = vi.hoisted(() => vi.fn());
vi.mock('../api/client', () => ({
  api: {
    channels: {
      updateTopic: mockUpdateTopic,
      updatePostingPermission: mockUpdatePostingPermission,
    },
  },
}));

vi.mock('../contexts/SnackbarContext', () => ({
  useSnackbar: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showInfo: vi.fn(),
  }),
}));

beforeEach(() => {
  mockUpdateTopic.mockReset();
  mockUpdatePostingPermission.mockReset();
});

interface RenderOpts {
  userRole?: string;
  channelOverrides?: Partial<Channel>;
}

function renderForm(opts: RenderOpts = {}) {
  const channel: Channel = {
    ...makeChannel(42, 'design-review'),
    createdBy: 1,
    ...opts.channelOverrides,
  };
  return render(
    <ChannelSettingsForm
      channel={channel}
      currentUserId={1}
      userRole={opts.userRole ?? 'user'}
      onTopicUpdated={vi.fn()}
    />,
  );
}

describe('ChannelSettingsForm (Step 5c-1)', () => {
  describe('編集権限による表示制御', () => {
    it('canEdit=true (admin) のとき招待/ゲスト/設定編集ボタンが全て表示される', () => {
      renderForm({ userRole: 'admin', channelOverrides: { createdBy: 999 } });
      expect(screen.getByRole('button', { name: '招待リンクを作成' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'ゲスト閲覧リンクを発行' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '設定を編集' })).toBeInTheDocument();
    });

    it('canEdit=false (一般ユーザー & 非作成者) のとき編集系ボタンは非表示', () => {
      renderForm({ userRole: 'user', channelOverrides: { createdBy: 999 } });
      expect(screen.queryByRole('button', { name: '招待リンクを作成' })).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'ゲスト閲覧リンクを発行' }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '設定を編集' })).not.toBeInTheDocument();
    });
  });

  describe('編集ダイアログ', () => {
    it('「設定を編集」ボタンをクリックすると編集ダイアログが開く', async () => {
      renderForm({ userRole: 'admin' });
      await userEvent.click(screen.getByRole('button', { name: '設定を編集' }));
      // ダイアログタイトルで判定 (ChannelTopicBar 既存の文言 "チャンネルトピックを編集")
      expect(screen.getByText('チャンネルトピックを編集')).toBeInTheDocument();
    });

    it('編集ダイアログで保存すると api.channels.updateTopic が呼ばれる', async () => {
      mockUpdateTopic.mockResolvedValue({
        channel: { ...makeChannel(42, 'design-review'), topic: 'new topic' },
      });
      renderForm({
        userRole: 'admin',
        channelOverrides: { topic: 'old topic', description: null },
      });
      await userEvent.click(screen.getByRole('button', { name: '設定を編集' }));
      await userEvent.click(screen.getByRole('button', { name: '保存' }));
      await waitFor(() => {
        expect(mockUpdateTopic).toHaveBeenCalledWith(42, expect.any(Object));
      });
    });
  });

  describe('リンク発行ダイアログ', () => {
    it('招待ボタンをクリックすると InviteLinkDialog が開く', async () => {
      renderForm({ userRole: 'admin' });
      expect(screen.queryByTestId('invite-link-dialog-stub')).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: '招待リンクを作成' }));
      expect(screen.getByTestId('invite-link-dialog-stub')).toBeInTheDocument();
    });
  });
});
