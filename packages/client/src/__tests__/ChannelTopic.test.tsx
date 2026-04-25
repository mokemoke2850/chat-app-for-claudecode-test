/**
 * チャンネルトピック表示・編集機能のフロントエンドテスト
 *
 * テスト対象:
 *   - components/Channel/ChannelTopicBar: チャンネルヘッダーのトピック表示と編集UI
 *
 * 戦略: vi.mock でAPI・Socket・AuthContextをスタブ化し、
 * 表示・編集フローをコンポーネントレベルでテストする。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChannelTopicBar from '../components/Channel/ChannelTopicBar';

// api モジュールをモック
vi.mock('../api/client', () => ({
  api: {
    channels: {
      updateTopic: vi.fn(),
    },
    invites: {
      list: vi.fn().mockResolvedValue({ invites: [] }),
      create: vi.fn(),
      revoke: vi.fn(),
    },
  },
}));

// SnackbarContext をモック
vi.mock('../contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showSuccess: vi.fn(), showError: vi.fn() }),
}));

// InviteLinkDialog は AuthContext に依存するためモック化
vi.mock('../components/Channel/InviteLinkDialog', () => ({
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div role="dialog" aria-label="招待リンクダイアログ">
        <button onClick={onClose}>閉じる</button>
      </div>
    ) : null,
}));

import { api } from '../api/client';
const mockApi = api.channels as unknown as {
  updateTopic: ReturnType<typeof vi.fn>;
};

const baseChannel = {
  id: 1,
  name: 'general',
  description: null,
  createdBy: 1,
  createdAt: '2024-01-01T00:00:00Z',
  isPrivate: false,
  unreadCount: 0,
  topic: null,
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('チャンネルヘッダーのトピック表示', () => {
  it('チャンネルにtopicが設定されている場合、ヘッダーにトピックが表示される', () => {
    const channel = { ...baseChannel, topic: 'このチャンネルのトピックです' };
    render(
      <ChannelTopicBar
        channel={channel}
        currentUserId={2}
        userRole="user"
        onTopicUpdated={vi.fn()}
      />,
    );

    expect(screen.getByText('このチャンネルのトピックです')).toBeInTheDocument();
  });

  it('topicがnullの場合、トピックテキストは表示されない', () => {
    render(
      <ChannelTopicBar
        channel={baseChannel}
        currentUserId={2}
        userRole="user"
        onTopicUpdated={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('channel-topic-text')).not.toBeInTheDocument();
  });
});

describe('トピック編集ダイアログ', () => {
  describe('表示制御', () => {
    it('チャンネル作成者（createdBy === currentUserId）には編集ボタンが表示される', () => {
      // createdBy === currentUserId === 1
      render(
        <ChannelTopicBar
          channel={baseChannel}
          currentUserId={1}
          userRole="user"
          onTopicUpdated={vi.fn()}
        />,
      );

      expect(screen.getByRole('button', { name: /編集/i })).toBeInTheDocument();
    });

    it('管理者（userRole === "admin"）には編集ボタンが表示される', () => {
      render(
        <ChannelTopicBar
          channel={baseChannel}
          currentUserId={2}
          userRole="admin"
          onTopicUpdated={vi.fn()}
        />,
      );

      expect(screen.getByRole('button', { name: /編集/i })).toBeInTheDocument();
    });

    it('一般ユーザー（作成者以外）には編集ボタンが表示されない', () => {
      // currentUserId=2 / createdBy=1 / role="user"
      render(
        <ChannelTopicBar
          channel={baseChannel}
          currentUserId={2}
          userRole="user"
          onTopicUpdated={vi.fn()}
        />,
      );

      expect(screen.queryByRole('button', { name: /編集/i })).not.toBeInTheDocument();
    });
  });

  describe('編集フロー', () => {
    it('編集ボタンを押すとダイアログが開く', async () => {
      const user = userEvent.setup();
      render(
        <ChannelTopicBar
          channel={baseChannel}
          currentUserId={1}
          userRole="user"
          onTopicUpdated={vi.fn()}
        />,
      );

      await user.click(screen.getByRole('button', { name: /編集/i }));

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('トピック・説明を入力して保存するとAPIが呼ばれる', async () => {
      const user = userEvent.setup();
      const mockOnTopicUpdated = vi.fn();
      mockApi.updateTopic.mockResolvedValue({ channel: { ...baseChannel, topic: '新トピック' } });

      render(
        <ChannelTopicBar
          channel={baseChannel}
          currentUserId={1}
          userRole="user"
          onTopicUpdated={mockOnTopicUpdated}
        />,
      );

      await user.click(screen.getByRole('button', { name: /編集/i }));
      await user.clear(screen.getByLabelText(/^トピック$/i));
      await user.type(screen.getByLabelText(/^トピック$/i), '新トピック');
      await user.click(screen.getByRole('button', { name: /保存/i }));

      await waitFor(() => {
        expect(mockApi.updateTopic).toHaveBeenCalledWith(
          1,
          expect.objectContaining({ topic: '新トピック' }),
        );
      });
    });

    it('保存成功後にダイアログが閉じる', async () => {
      const user = userEvent.setup();
      mockApi.updateTopic.mockResolvedValue({ channel: { ...baseChannel, topic: '新トピック' } });

      render(
        <ChannelTopicBar
          channel={baseChannel}
          currentUserId={1}
          userRole="user"
          onTopicUpdated={vi.fn()}
        />,
      );

      await user.click(screen.getByRole('button', { name: /編集/i }));
      await user.click(screen.getByRole('button', { name: /保存/i }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  // #115 タグ機能 — ChannelTopicBar でのチャンネルタグ表示
  describe('チャンネルタグ表示 (#115)', () => {
    it('channel.tags が存在するとき TopicBar にタグチップが並んで表示される', () => {
      // TODO
    });

    it('channel.tags が空配列のときタグ表示エリアは描画されない', () => {
      // TODO
    });

    it('タグチップをクリックすると onTagClick が tag.name を引数に呼ばれる', () => {
      // TODO
    });
  });
});

// 仕様変更（#112）: 招待リンク作成ボタンは ChannelMembersDialog ではなく
// ChannelTopicBar に設置する方針に変更したため、以下のテストをここに移動した。
describe('招待リンク（仕様変更: ChannelMembersDialog から移動）', () => {
  it('チャンネル作成者には「招待リンクを作成」ボタンが表示される', () => {
    render(
      <ChannelTopicBar
        channel={baseChannel}
        currentUserId={1}
        userRole="user"
        onTopicUpdated={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /招待リンクを作成/i })).toBeInTheDocument();
  });

  it('管理者には「招待リンクを作成」ボタンが表示される', () => {
    render(
      <ChannelTopicBar
        channel={baseChannel}
        currentUserId={2}
        userRole="admin"
        onTopicUpdated={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /招待リンクを作成/i })).toBeInTheDocument();
  });

  it('一般ユーザー（作成者以外）には「招待リンクを作成」ボタンが表示されない', () => {
    render(
      <ChannelTopicBar
        channel={baseChannel}
        currentUserId={2}
        userRole="user"
        onTopicUpdated={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /招待リンクを作成/i })).not.toBeInTheDocument();
  });

  it('「招待リンクを作成」ボタンをクリックすると InviteLinkDialog が開く', async () => {
    const user = userEvent.setup();
    render(
      <ChannelTopicBar
        channel={baseChannel}
        currentUserId={1}
        userRole="user"
        onTopicUpdated={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /招待リンクを作成/i }));

    expect(screen.getByRole('dialog', { name: /招待リンクダイアログ/i })).toBeInTheDocument();
  });
});
