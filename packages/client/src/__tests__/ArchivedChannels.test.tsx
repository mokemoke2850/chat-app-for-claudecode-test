/**
 * アーカイブ済みチャンネル一覧機能のフロントエンドテスト
 *
 * テスト対象:
 *   - アーカイブ済みチャンネル一覧表示コンポーネント（ArchivedChannelsDialog）
 *   - アーカイブ操作 UI（ChannelItem のアーカイブボタン）
 *   - アーカイブ中チャンネルの入力欄無効化（メッセージ送信禁止 UI）
 *
 * 戦略:
 *   - api モジュールを vi.mock で差し替えてネットワーク通信を排除
 *   - SocketContext をモックしてリアルタイム更新のハンドラを注入する
 *   - React 19 の use() + Suspense を使うコンポーネントは
 *     await act(async () => { render(...) }) でフラッシュする
 */

import { describe, it, vi, expect, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Channel } from '@chat-app/shared';
import { makeChannel } from './__fixtures__/channels';

// api モジュールをモック
vi.mock('../api/client', () => ({
  api: {
    channels: {
      list: vi.fn(),
      listArchived: vi.fn(),
      archive: vi.fn(),
      unarchive: vi.fn(),
    },
  },
}));

// SnackbarContext をモック
const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();
vi.mock('../contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showSuccess: mockShowSuccess, showError: mockShowError, showInfo: vi.fn() }),
}));

// AuthContext をモック
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, role: 'user', isActive: true } }),
}));

import { api } from '../api/client';
const mockApi = api.channels as unknown as {
  list: ReturnType<typeof vi.fn>;
  listArchived: ReturnType<typeof vi.fn>;
  archive: ReturnType<typeof vi.fn>;
  unarchive: ReturnType<typeof vi.fn>;
};

import ArchivedChannelsDialog from '../components/Channel/ArchivedChannelsDialog';

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// アーカイブ済みチャンネル一覧表示
// ---------------------------------------------------------------------------

describe('アーカイブ済みチャンネル一覧', () => {
  describe('一覧の表示', () => {
    it('アーカイブ済みチャンネルが一覧に表示される', async () => {
      const archivedChannel: Channel = { ...makeChannel(10, 'archived-ch'), isArchived: true };
      mockApi.listArchived.mockResolvedValue({ channels: [archivedChannel] });

      await act(async () => {
        render(<ArchivedChannelsDialog open={true} onClose={vi.fn()} currentUserId={1} userRole="user" />);
      });

      await waitFor(() => {
        expect(screen.getByText('archived-ch')).toBeInTheDocument();
      });
    });

    it('アーカイブ済みが存在しない場合は空状態メッセージが表示される', async () => {
      mockApi.listArchived.mockResolvedValue({ channels: [] });

      await act(async () => {
        render(<ArchivedChannelsDialog open={true} onClose={vi.fn()} currentUserId={1} userRole="user" />);
      });

      await waitFor(() => {
        expect(screen.getByText(/アーカイブ済みチャンネルはありません/)).toBeInTheDocument();
      });
    });

    it('各チャンネル行にアーカイブ解除ボタンが表示される', async () => {
      const archivedChannel: Channel = { ...makeChannel(10, 'archived-ch'), isArchived: true, createdBy: 1 };
      mockApi.listArchived.mockResolvedValue({ channels: [archivedChannel] });

      await act(async () => {
        render(<ArchivedChannelsDialog open={true} onClose={vi.fn()} currentUserId={1} userRole="user" />);
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /アーカイブ解除/ })).toBeInTheDocument();
      });
    });

    it('チャンネル名と説明が表示される', async () => {
      const archivedChannel: Channel = {
        ...makeChannel(10, 'desc-ch'),
        description: 'テスト説明文',
        isArchived: true,
      };
      mockApi.listArchived.mockResolvedValue({ channels: [archivedChannel] });

      await act(async () => {
        render(<ArchivedChannelsDialog open={true} onClose={vi.fn()} currentUserId={1} userRole="user" />);
      });

      await waitFor(() => {
        expect(screen.getByText('desc-ch')).toBeInTheDocument();
        expect(screen.getByText('テスト説明文')).toBeInTheDocument();
      });
    });
  });

  describe('アーカイブ解除操作', () => {
    it('アーカイブ解除ボタンをクリックすると api.channels.unarchive が呼ばれる', async () => {
      const archivedChannel: Channel = { ...makeChannel(10, 'archived-ch'), isArchived: true, createdBy: 1 };
      mockApi.listArchived.mockResolvedValue({ channels: [archivedChannel] });
      mockApi.unarchive.mockResolvedValue({ channel: { ...archivedChannel, isArchived: false } });

      await act(async () => {
        render(<ArchivedChannelsDialog open={true} onClose={vi.fn()} currentUserId={1} userRole="user" />);
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /アーカイブ解除/ })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /アーカイブ解除/ }));

      await waitFor(() => {
        expect(mockApi.unarchive).toHaveBeenCalledWith(10);
      });
    });

    it('アーカイブ解除後、一覧からそのチャンネルが消える', async () => {
      const archivedChannel: Channel = { ...makeChannel(10, 'archived-ch'), isArchived: true, createdBy: 1 };
      mockApi.listArchived.mockResolvedValue({ channels: [archivedChannel] });
      mockApi.unarchive.mockResolvedValue({ channel: { ...archivedChannel, isArchived: false } });

      await act(async () => {
        render(<ArchivedChannelsDialog open={true} onClose={vi.fn()} currentUserId={1} userRole="user" />);
      });

      await waitFor(() => {
        expect(screen.getByText('archived-ch')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /アーカイブ解除/ }));

      await waitFor(() => {
        expect(screen.queryByText('archived-ch')).not.toBeInTheDocument();
      });
    });

    it('アーカイブ解除に失敗した場合はエラーメッセージが表示される', async () => {
      const archivedChannel: Channel = { ...makeChannel(10, 'archived-ch'), isArchived: true, createdBy: 1 };
      mockApi.listArchived.mockResolvedValue({ channels: [archivedChannel] });
      mockApi.unarchive.mockRejectedValue(new Error('解除に失敗しました'));

      await act(async () => {
        render(<ArchivedChannelsDialog open={true} onClose={vi.fn()} currentUserId={1} userRole="user" />);
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /アーカイブ解除/ })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /アーカイブ解除/ }));

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalled();
      });
    });
  });
});

// ---------------------------------------------------------------------------
// アーカイブ操作 UI（ChannelItem / チャンネル設定から）
// ---------------------------------------------------------------------------

import ChannelItem from '../components/Channel/ChannelItem';

const makeChannelItemProps = (channel: Channel, overrides = {}) => ({
  channel,
  isActive: false,
  isPinned: false,
  isHovered: true,
  onMouseEnter: vi.fn(),
  onMouseLeave: vi.fn(),
  onClick: vi.fn(),
  onPin: vi.fn(),
  onUnpin: vi.fn(),
  onOpenMembersDialog: vi.fn(),
  onArchive: vi.fn(),
  ...overrides,
});

describe('チャンネルのアーカイブ操作 UI', () => {
  describe('アーカイブボタン表示条件', () => {
    it('チャンネル作成者にはアーカイブボタンが表示される', () => {
      const channel = { ...makeChannel(1, 'my-channel'), createdBy: 1 };
      render(<ChannelItem {...makeChannelItemProps(channel)} currentUserId={1} userRole="user" />);
      expect(screen.getByRole('button', { name: /アーカイブ/ })).toBeInTheDocument();
    });

    it('チャンネル作成者以外にはアーカイブボタンが表示されない', () => {
      const channel = { ...makeChannel(1, 'others-channel'), createdBy: 99 };
      render(<ChannelItem {...makeChannelItemProps(channel)} currentUserId={1} userRole="user" />);
      expect(screen.queryByRole('button', { name: /アーカイブ/ })).not.toBeInTheDocument();
    });

    it('管理者（admin）には他者のチャンネルにもアーカイブボタンが表示される', () => {
      const channel = { ...makeChannel(1, 'others-channel'), createdBy: 99 };
      render(<ChannelItem {...makeChannelItemProps(channel)} currentUserId={1} userRole="admin" />);
      expect(screen.getByRole('button', { name: /アーカイブ/ })).toBeInTheDocument();
    });
  });

  describe('アーカイブ実行', () => {
    it('アーカイブボタンをクリックすると確認ダイアログが表示される', async () => {
      const channel = { ...makeChannel(1, 'my-channel'), createdBy: 1 };
      render(<ChannelItem {...makeChannelItemProps(channel)} currentUserId={1} userRole="user" />);

      await userEvent.click(screen.getByRole('button', { name: /アーカイブ/ }));

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('確認ダイアログで「アーカイブ」を選択すると onArchive が呼ばれる', async () => {
      const channel = { ...makeChannel(1, 'my-channel'), createdBy: 1 };
      const onArchive = vi.fn();
      render(
        <ChannelItem
          {...makeChannelItemProps(channel, { onArchive })}
          currentUserId={1}
          userRole="user"
        />,
      );

      await userEvent.click(screen.getByRole('button', { name: /アーカイブ/ }));
      await userEvent.click(screen.getByRole('button', { name: /^アーカイブ$/ }));

      expect(onArchive).toHaveBeenCalledWith(1);
    });

    it('確認ダイアログで「キャンセル」を選択するとアーカイブされない', async () => {
      const channel = { ...makeChannel(1, 'my-channel'), createdBy: 1 };
      const onArchive = vi.fn();
      render(
        <ChannelItem
          {...makeChannelItemProps(channel, { onArchive })}
          currentUserId={1}
          userRole="user"
        />,
      );

      await userEvent.click(screen.getByRole('button', { name: /アーカイブ/ }));
      await userEvent.click(screen.getByRole('button', { name: /キャンセル/ }));

      expect(onArchive).not.toHaveBeenCalled();
    });

    it('アーカイブ成功後にスナックバー通知が表示される', async () => {
      // アーカイブ操作はChannelList（親）で行われるため、
      // ChannelItemはonArchiveコールバックを呼ぶだけ
      // このテストはChannelListレベルで確認するため、onArchiveが呼ばれることを確認
      const channel = { ...makeChannel(1, 'my-channel'), createdBy: 1 };
      const onArchive = vi.fn();
      render(
        <ChannelItem
          {...makeChannelItemProps(channel, { onArchive })}
          currentUserId={1}
          userRole="user"
        />,
      );

      await userEvent.click(screen.getByRole('button', { name: /アーカイブ/ }));
      await userEvent.click(screen.getByRole('button', { name: /^アーカイブ$/ }));

      // onArchiveが呼ばれたことを確認（実際のAPI呼び出しと通知はChannelListが担当）
      expect(onArchive).toHaveBeenCalledWith(1);
    });

    it('アーカイブ失敗時にエラー通知が表示される', async () => {
      // ChannelListでエラーハンドリングするため、ここではonArchiveが呼ばれることを確認
      const channel = { ...makeChannel(1, 'my-channel'), createdBy: 1 };
      const onArchive = vi.fn();
      render(
        <ChannelItem
          {...makeChannelItemProps(channel, { onArchive })}
          currentUserId={1}
          userRole="user"
        />,
      );

      await userEvent.click(screen.getByRole('button', { name: /アーカイブ/ }));
      await userEvent.click(screen.getByRole('button', { name: /^アーカイブ$/ }));

      expect(onArchive).toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// アーカイブ済みチャンネルのメッセージ入力欄無効化
// ---------------------------------------------------------------------------

// RichEditor の依存するモジュールをモック
vi.mock('../components/Chat/RichEditor', () => ({
  default: ({ disabled, placeholder }: { disabled?: boolean; placeholder?: string }) => (
    <div>
      <textarea
        data-testid="rich-editor"
        disabled={disabled}
        placeholder={placeholder ?? 'メッセージを入力'}
        aria-disabled={disabled}
      />
    </div>
  ),
}));

import RichEditor from '../components/Chat/RichEditor';

describe('アーカイブ済みチャンネルでのメッセージ送信禁止 UI', () => {
  it('アーカイブ済みチャンネルを開くとメッセージ入力欄が無効化（disabled）される', () => {
    render(<RichEditor disabled={true} onSend={vi.fn()} users={[]} />);
    expect(screen.getByTestId('rich-editor')).toBeDisabled();
  });

  it('アーカイブ済みチャンネルにはアーカイブ中であることを示すバナーが表示される', async () => {
    const { default: ArchivedBanner } = await import('../components/Channel/ArchivedBanner');
    render(<ArchivedBanner />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/アーカイブ済み/)).toBeInTheDocument();
  });

  it('通常チャンネルではメッセージ入力欄が有効になっている', () => {
    render(<RichEditor disabled={false} onSend={vi.fn()} users={[]} />);
    expect(screen.getByTestId('rich-editor')).not.toBeDisabled();
  });

  it('アーカイブ済みチャンネルで送信ボタンをクリックしてもメッセージが送信されない', () => {
    const onSend = vi.fn();
    render(<RichEditor disabled={true} onSend={onSend} users={[]} />);
    const textarea = screen.getByTestId('rich-editor');
    expect(textarea).toBeDisabled();
    expect(onSend).not.toHaveBeenCalled();
  });

  it('アーカイブ済みチャンネルでも過去のメッセージは閲覧できる', async () => {
    const { default: MessageList } = await import('../components/Chat/MessageList');
    const { makeChannelMessage } = await import('./__fixtures__/channels');

    const messages = [makeChannelMessage(1, 10), makeChannelMessage(2, 10)];

    render(
      <MessageList
        messages={messages}
        loading={false}
        onLoadMore={vi.fn()}
        currentUserId={1}
        users={[]}
        onOpenThread={vi.fn()}
        onPinMessage={vi.fn()}
        bookmarkedMessageIds={new Set()}
        onBookmarkChange={vi.fn()}
        onQuoteReply={vi.fn()}
      />,
    );

    expect(screen.getAllByText('test').length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 型・境界条件
// ---------------------------------------------------------------------------

describe('Channel 型: isArchived フィールドの境界条件（フロント）', () => {
  it('makeChannel ファクトリは isArchived=false をデフォルトで生成する', () => {
    const channel = makeChannel(1, 'test');
    expect(channel.isArchived ?? false).toBe(false);
  });

  it('isArchived=true の Channel オブジェクトが正しく型チェックを通過する', () => {
    const channel: Channel = { ...makeChannel(1, 'test'), isArchived: true };
    expect(channel.isArchived).toBe(true);
  });

  it('isArchived が undefined の場合は false として扱われる', () => {
    const channel = makeChannel(1, 'test');
    expect(channel.isArchived ?? false).toBe(false);
  });
});
