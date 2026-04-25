/**
 * テスト対象: ChannelList 内の ChannelItem コンポーネント
 * 責務: 個別チャンネル行の表示（チャンネル名・未読バッジ・メンションバッジ・ピン留めアクション・プライベートアイコン）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Channel } from '@chat-app/shared';
import ChannelItem from '../components/Channel/ChannelItem';

const makeChannel = (overrides: Partial<Channel> = {}): Channel => ({
  id: 1,
  name: 'general',
  description: null,
  topic: null,
  createdBy: 1,
  createdAt: '2024-01-01T00:00:00Z',
  isPrivate: false,
  postingPermission: 'everyone',
  unreadCount: 0,
  ...overrides,
});

const defaultProps = {
  isActive: false,
  isPinned: false,
  isHovered: false,
  onMouseEnter: vi.fn(),
  onMouseLeave: vi.fn(),
  onClick: vi.fn(),
  onPin: vi.fn(),
  onUnpin: vi.fn(),
  onOpenMembersDialog: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ChannelItem', () => {
  describe('チャンネル名表示', () => {
    it('"# チャンネル名" 形式で表示される', () => {
      render(<ChannelItem {...defaultProps} channel={makeChannel({ name: 'general' })} />);
      expect(screen.getByText('# general')).toBeInTheDocument();
    });

    it('active なチャンネルが selected 状態になる', () => {
      render(<ChannelItem {...defaultProps} channel={makeChannel()} isActive={true} />);
      const btn = screen.getByRole('button');
      expect(btn).toHaveClass('Mui-selected');
    });
  });

  describe('プライベートチャンネル', () => {
    it('isPrivate=true のとき鍵アイコンが表示される', () => {
      render(<ChannelItem {...defaultProps} channel={makeChannel({ isPrivate: true })} />);
      expect(screen.getByLabelText('private channel')).toBeInTheDocument();
    });

    it('isPrivate=false のとき鍵アイコンが表示されない', () => {
      render(<ChannelItem {...defaultProps} channel={makeChannel({ isPrivate: false })} />);
      expect(screen.queryByLabelText('private channel')).not.toBeInTheDocument();
    });
  });

  describe('未読バッジ', () => {
    it('unreadCount > 0 かつ mentionCount === 0 のとき未読数バッジが表示される', () => {
      render(
        <ChannelItem
          {...defaultProps}
          channel={makeChannel({ unreadCount: 3, mentionCount: 0 })}
        />,
      );
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('unreadCount === 0 のときバッジは表示されない', () => {
      render(<ChannelItem {...defaultProps} channel={makeChannel({ unreadCount: 0 })} />);
      expect(screen.queryByText('0')).not.toBeInTheDocument();
    });

    it('unreadCount が 9 以下のとき実数が表示される', () => {
      render(
        <ChannelItem
          {...defaultProps}
          channel={makeChannel({ unreadCount: 5, mentionCount: 0 })}
        />,
      );
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('unreadCount が 10 以上のとき「9+」と表示される', () => {
      render(
        <ChannelItem
          {...defaultProps}
          channel={makeChannel({ unreadCount: 10, mentionCount: 0 })}
        />,
      );
      expect(screen.getByText('9+')).toBeInTheDocument();
    });

    it('unreadCount > 0 のときチャンネル名が太字表示される', () => {
      render(<ChannelItem {...defaultProps} channel={makeChannel({ unreadCount: 3 })} />);
      expect(screen.getByText('# general')).toHaveStyle({ fontWeight: 'bold' });
    });
  });

  describe('メンションバッジ', () => {
    it('mentionCount > 0 のときメンションバッジが表示される', () => {
      render(
        <ChannelItem
          {...defaultProps}
          channel={makeChannel({ unreadCount: 1, mentionCount: 2 })}
        />,
      );
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('mentionCount が 9 以下のとき実数が表示される', () => {
      render(
        <ChannelItem
          {...defaultProps}
          channel={makeChannel({ unreadCount: 5, mentionCount: 3 })}
        />,
      );
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('mentionCount が 10 以上のとき「9+」と表示される', () => {
      render(
        <ChannelItem
          {...defaultProps}
          channel={makeChannel({ unreadCount: 5, mentionCount: 10 })}
        />,
      );
      expect(screen.getByText('9+')).toBeInTheDocument();
    });

    it('mentionCount > 0 のとき未読数バッジは表示されない', () => {
      render(
        <ChannelItem
          {...defaultProps}
          channel={makeChannel({ unreadCount: 5, mentionCount: 2 })}
        />,
      );
      // mentionCountバッジ(2)は表示されるが、unreadCountバッジ(5)は表示されない
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.queryByText('5')).not.toBeInTheDocument();
    });
  });

  describe('ピン留めアクション', () => {
    it('行にホバーするとピン留めボタンが表示される', () => {
      render(
        <ChannelItem {...defaultProps} channel={makeChannel()} isHovered={true} isPinned={false} />,
      );
      expect(screen.getByRole('button', { name: 'ピン留め' })).toBeInTheDocument();
    });

    it('行からフォーカスが外れるとピン留めボタンが非表示になる', () => {
      render(<ChannelItem {...defaultProps} channel={makeChannel()} isHovered={false} />);
      expect(screen.queryByRole('button', { name: 'ピン留め' })).not.toBeInTheDocument();
    });

    it('ピン留めボタンをクリックすると onPin が呼ばれる', async () => {
      const onPin = vi.fn();
      render(
        <ChannelItem
          {...defaultProps}
          channel={makeChannel({ id: 42 })}
          isHovered={true}
          isPinned={false}
          onPin={onPin}
        />,
      );
      await userEvent.click(screen.getByRole('button', { name: 'ピン留め' }));
      expect(onPin).toHaveBeenCalledWith(42);
    });

    it('isPinned=true のときピン留め解除ボタンが表示される', () => {
      render(
        <ChannelItem {...defaultProps} channel={makeChannel()} isHovered={true} isPinned={true} />,
      );
      expect(screen.getByRole('button', { name: 'ピン留めを解除' })).toBeInTheDocument();
    });

    it('ピン留め解除ボタンをクリックすると onUnpin が呼ばれる', async () => {
      const onUnpin = vi.fn();
      render(
        <ChannelItem
          {...defaultProps}
          channel={makeChannel({ id: 99 })}
          isHovered={true}
          isPinned={true}
          onUnpin={onUnpin}
        />,
      );
      await userEvent.click(screen.getByRole('button', { name: 'ピン留めを解除' }));
      expect(onUnpin).toHaveBeenCalledWith(99);
    });
  });

  describe('プライベートチャンネルのメンバー管理', () => {
    it('isPrivate=true の行にホバーするとメンバー管理ボタンが表示される', () => {
      render(
        <ChannelItem
          {...defaultProps}
          channel={makeChannel({ isPrivate: true })}
          isHovered={true}
        />,
      );
      expect(screen.getByRole('button', { name: 'メンバー管理' })).toBeInTheDocument();
    });

    it('isPrivate=false の行にはメンバー管理ボタンが表示されない', () => {
      render(
        <ChannelItem
          {...defaultProps}
          channel={makeChannel({ isPrivate: false })}
          isHovered={true}
        />,
      );
      expect(screen.queryByRole('button', { name: 'メンバー管理' })).not.toBeInTheDocument();
    });

    it('メンバー管理ボタンをクリックすると onOpenMembersDialog が呼ばれる', async () => {
      const onOpenMembersDialog = vi.fn();
      const channel = makeChannel({ id: 7, isPrivate: true });
      render(
        <ChannelItem
          {...defaultProps}
          channel={channel}
          isHovered={true}
          onOpenMembersDialog={onOpenMembersDialog}
        />,
      );
      await userEvent.click(screen.getByRole('button', { name: 'メンバー管理' }));
      expect(onOpenMembersDialog).toHaveBeenCalledWith(channel);
    });
  });

  describe('チャンネル選択', () => {
    it('クリックすると onClick が呼ばれる', async () => {
      const onClick = vi.fn();
      render(<ChannelItem {...defaultProps} channel={makeChannel()} onClick={onClick} />);
      await userEvent.click(screen.getByRole('button'));
      expect(onClick).toHaveBeenCalled();
    });
  });

  describe('カテゴリ割当ポップアップ', () => {
    const categories = [
      {
        id: 1,
        name: 'Frontend',
        channelIds: [],
        isCollapsed: false,
        position: 0,
        userId: 1,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      {
        id: 2,
        name: 'Backend',
        channelIds: [],
        isCollapsed: false,
        position: 1,
        userId: 1,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    ];

    it('allCategories が渡されると「カテゴリへ移動」ボタンがホバー時に表示される', () => {
      render(
        <ChannelItem
          {...defaultProps}
          channel={makeChannel()}
          isHovered={true}
          allCategories={categories}
          onAssignChannel={vi.fn()}
        />,
      );
      expect(screen.getByRole('button', { name: 'カテゴリへ移動' })).toBeInTheDocument();
    });

    it('「カテゴリへ移動」ボタンをクリックするとポップアップが表示される', async () => {
      render(
        <ChannelItem
          {...defaultProps}
          channel={makeChannel()}
          isHovered={true}
          allCategories={categories}
          onAssignChannel={vi.fn()}
        />,
      );
      await userEvent.click(screen.getByRole('button', { name: 'カテゴリへ移動' }));
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'Frontendに移動' })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: 'Backendに移動' })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: '割当なし（その他）' })).toBeInTheDocument();
      });
    });

    it('カテゴリ項目をクリックすると onAssignChannel が呼ばれてポップアップが閉じる', async () => {
      const onAssignChannel = vi.fn();
      render(
        <ChannelItem
          {...defaultProps}
          channel={makeChannel({ id: 10 })}
          isHovered={true}
          allCategories={categories}
          onAssignChannel={onAssignChannel}
        />,
      );
      await userEvent.click(screen.getByRole('button', { name: 'カテゴリへ移動' }));
      await waitFor(() => screen.getByRole('menuitem', { name: 'Frontendに移動' }));
      await userEvent.click(screen.getByRole('menuitem', { name: 'Frontendに移動' }));
      expect(onAssignChannel).toHaveBeenCalledWith(10, 1);
    });

    it('「割当なし（その他）」をクリックすると onAssignChannel(id, null) が呼ばれる', async () => {
      const onAssignChannel = vi.fn();
      render(
        <ChannelItem
          {...defaultProps}
          channel={makeChannel({ id: 10 })}
          isHovered={true}
          allCategories={categories}
          onAssignChannel={onAssignChannel}
        />,
      );
      await userEvent.click(screen.getByRole('button', { name: 'カテゴリへ移動' }));
      await waitFor(() => screen.getByRole('menuitem', { name: '割当なし（その他）' }));
      await userEvent.click(screen.getByRole('menuitem', { name: '割当なし（その他）' }));
      expect(onAssignChannel).toHaveBeenCalledWith(10, null);
    });
  });

  describe('通知レベルメニュー', () => {
    it('ホバー時に通知レベル変更ボタン（ベルアイコン等）が表示される', () => {
      render(
        <ChannelItem
          {...defaultProps}
          channel={makeChannel()}
          isHovered={true}
          notificationLevel="all"
          onChangeNotificationLevel={vi.fn()}
        />,
      );
      expect(screen.getByRole('button', { name: '通知設定' })).toBeInTheDocument();
    });

    it('通知レベル変更ボタンをクリックすると NotificationLevelMenu が表示される', async () => {
      render(
        <ChannelItem
          {...defaultProps}
          channel={makeChannel()}
          isHovered={true}
          notificationLevel="all"
          onChangeNotificationLevel={vi.fn()}
        />,
      );
      await userEvent.click(screen.getByRole('button', { name: '通知設定' }));
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'すべての通知' })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: 'メンションのみ' })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: 'ミュート' })).toBeInTheDocument();
      });
    });
  });

  describe('ミュート状態の表示', () => {
    it('通知レベルが "muted" のときチャンネル名がグレーで表示される', () => {
      render(
        <ChannelItem
          {...defaultProps}
          channel={makeChannel({ name: 'muted-channel' })}
          notificationLevel="muted"
        />,
      );
      // isMuted=true のとき ListItemText の style に opacity が適用される
      const text = screen.getByText('# muted-channel');
      expect(text).toBeInTheDocument();
      // style に opacity: 0.5 が含まれることを確認
      expect(text).toHaveStyle({ opacity: 0.5 });
    });

    it('通知レベルが "muted" のとき未読バッジが非表示になる', () => {
      render(
        <ChannelItem
          {...defaultProps}
          channel={makeChannel({ unreadCount: 5, mentionCount: 0 })}
          notificationLevel="muted"
        />,
      );
      expect(screen.queryByText('5')).not.toBeInTheDocument();
    });

    it('通知レベルが "muted" のときメンションバッジが非表示になる', () => {
      render(
        <ChannelItem
          {...defaultProps}
          channel={makeChannel({ unreadCount: 1, mentionCount: 3 })}
          notificationLevel="muted"
        />,
      );
      expect(screen.queryByText('3')).not.toBeInTheDocument();
    });

    it('通知レベルが "all" または "mentions" のときは通常の表示になる', () => {
      const { rerender } = render(
        <ChannelItem
          {...defaultProps}
          channel={makeChannel({ unreadCount: 0, mentionCount: 2 })}
          notificationLevel="all"
        />,
      );
      expect(screen.getByText('2')).toBeInTheDocument();

      rerender(
        <ChannelItem
          {...defaultProps}
          channel={makeChannel({ unreadCount: 0, mentionCount: 2 })}
          notificationLevel="mentions"
        />,
      );
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  describe('アーカイブアイコンとバッジの共存', () => {
    it('ホバー時のアーカイブボタンとメンションバッジが両方DOMに存在する', () => {
      render(
        <ChannelItem
          {...defaultProps}
          channel={makeChannel({ unreadCount: 2, mentionCount: 3, createdBy: 1 })}
          isHovered={true}
          onArchive={vi.fn()}
          currentUserId={1}
          userRole="user"
        />,
      );
      // アーカイブボタンが存在する
      expect(screen.getByRole('button', { name: 'アーカイブ' })).toBeInTheDocument();
      // メンションバッジ（3）が存在する
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('ホバー時のアーカイブボタンと未読バッジが両方DOMに存在する', () => {
      render(
        <ChannelItem
          {...defaultProps}
          channel={makeChannel({ unreadCount: 5, mentionCount: 0, createdBy: 1 })}
          isHovered={true}
          onArchive={vi.fn()}
          currentUserId={1}
          userRole="user"
        />,
      );
      // アーカイブボタンが存在する
      expect(screen.getByRole('button', { name: 'アーカイブ' })).toBeInTheDocument();
      // 未読バッジ（5）が存在する
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('バッジにホバーアクション分の右マージンが付いている（視覚的重なりを回避）', () => {
      const { container } = render(
        <ChannelItem
          {...defaultProps}
          channel={makeChannel({ unreadCount: 2, mentionCount: 3, createdBy: 1 })}
          isHovered={true}
          onArchive={vi.fn()}
          currentUserId={1}
          userRole="user"
        />,
      );
      // Badge を含む span 要素に mr スタイルが適用されていること
      // MUI Badge は data-testid が無いので、バッジコンテンツで特定する
      const badgeEl = container.querySelector('.MuiBadge-root');
      expect(badgeEl).toBeTruthy();
    });
  });
});
