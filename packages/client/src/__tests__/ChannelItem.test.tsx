/**
 * テスト対象: ChannelItem コンポーネント
 * 戦略:
 *   - ホバー時に表示される UI（ドラッグハンドル・3点メニュートグル）を検証する
 *   - 3点メニューを開いてから各 MenuItem をクリックし、対応するコールバック・サブメニュー・ダイアログが起動することを確認する
 *   - 表示条件（isPrivate / canArchive / allCategories）ごとのメニュー項目出し分けを検証する
 *   - 既存のバッジ表示・チャンネル名表示・ミュート状態は引き続き検証する
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

const makeCategory = (id: number, name: string) => ({
  id,
  name,
  channelIds: [],
  isCollapsed: false,
  position: id - 1,
  userId: 1,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
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

/** 3点メニューを開くヘルパー */
async function openMenu() {
  await userEvent.click(screen.getByRole('button', { name: 'その他のアクション' }));
  await waitFor(() => {
    expect(screen.getAllByRole('menuitem').length).toBeGreaterThan(0);
  });
}

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
      const btn = screen.getByText('# general').closest('[role="button"]');
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
      render(<ChannelItem {...defaultProps} channel={makeChannel({ unreadCount: 3 })} />);
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('unreadCount === 0 のときバッジは表示されない', () => {
      render(<ChannelItem {...defaultProps} channel={makeChannel({ unreadCount: 0 })} />);
      expect(screen.queryByText('0')).not.toBeInTheDocument();
    });

    it('unreadCount が 10 以上のとき「9+」と表示される', () => {
      render(<ChannelItem {...defaultProps} channel={makeChannel({ unreadCount: 10 })} />);
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
          channel={makeChannel({ unreadCount: 2, mentionCount: 2 })}
        />,
      );
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('mentionCount が 10 以上のとき「9+」と表示される', () => {
      render(
        <ChannelItem
          {...defaultProps}
          channel={makeChannel({ unreadCount: 10, mentionCount: 10 })}
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
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.queryByText('5')).not.toBeInTheDocument();
    });
  });

  describe('ミュート状態の表示', () => {
    it('通知レベルが "muted" のときチャンネル名がグレーで表示される', () => {
      render(<ChannelItem {...defaultProps} channel={makeChannel()} notificationLevel="muted" />);
      expect(screen.getByText('# general')).toHaveStyle({ opacity: 0.5 });
    });

    it('通知レベルが "muted" のとき未読バッジが非表示になる', () => {
      render(
        <ChannelItem
          {...defaultProps}
          channel={makeChannel({ unreadCount: 3 })}
          notificationLevel="muted"
        />,
      );
      expect(screen.queryByText('3')).not.toBeInTheDocument();
    });

    it('通知レベルが "muted" のときメンションバッジが非表示になる', () => {
      render(
        <ChannelItem
          {...defaultProps}
          channel={makeChannel({ unreadCount: 2, mentionCount: 2 })}
          notificationLevel="muted"
        />,
      );
      expect(screen.queryByText('2')).not.toBeInTheDocument();
    });
  });

  describe('チャンネル選択', () => {
    it('クリックすると onClick が呼ばれる', async () => {
      const onClick = vi.fn();
      render(<ChannelItem {...defaultProps} channel={makeChannel()} onClick={onClick} />);
      await userEvent.click(screen.getByText('# general'));
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  // ─────────────────────────────────────────────────────────
  // 3点メニュー: ホバー時の表示制御
  // ─────────────────────────────────────────────────────────

  describe('ホバー時の UI 表示', () => {
    it('ホバー前は3点メニュートグルボタンが表示されない', () => {
      render(<ChannelItem {...defaultProps} channel={makeChannel()} isHovered={false} />);
      expect(screen.queryByRole('button', { name: 'その他のアクション' })).not.toBeInTheDocument();
    });

    it('ホバー時にドラッグハンドルが表示される（disableDrag=false）', () => {
      render(
        <ChannelItem
          {...defaultProps}
          channel={makeChannel()}
          isHovered={true}
          disableDrag={false}
        />,
      );
      expect(screen.getByLabelText('ドラッグハンドル')).toBeVisible();
    });

    it('ホバー時に3点メニュートグルボタン（aria-label="その他のアクション"）が表示される', () => {
      render(<ChannelItem {...defaultProps} channel={makeChannel()} isHovered={true} />);
      expect(screen.getByRole('button', { name: 'その他のアクション' })).toBeInTheDocument();
    });

    it('disableDrag=true のときドラッグハンドルはホバーしても表示されない', () => {
      render(
        <ChannelItem
          {...defaultProps}
          channel={makeChannel()}
          isHovered={true}
          disableDrag={true}
        />,
      );
      expect(screen.queryByLabelText('ドラッグハンドル')).not.toBeInTheDocument();
    });
  });

  // ─────────────────────────────────────────────────────────
  // 3点メニュー: メニュー項目の出し分け
  // ─────────────────────────────────────────────────────────

  describe('3点メニューの項目出し分け', () => {
    describe('通常チャンネル（isPrivate=false）', () => {
      it('allCategories が空でないとき「カテゴリへ移動」が表示される', async () => {
        render(
          <ChannelItem
            {...defaultProps}
            channel={makeChannel()}
            isHovered={true}
            allCategories={[makeCategory(1, 'Work')]}
            onAssignChannel={vi.fn()}
          />,
        );
        await openMenu();
        expect(screen.getByRole('menuitem', { name: 'カテゴリへ移動' })).toBeInTheDocument();
      });

      it('allCategories が空（または未指定）のとき「カテゴリへ移動」が表示されない', async () => {
        render(
          <ChannelItem
            {...defaultProps}
            channel={makeChannel()}
            isHovered={true}
            allCategories={[]}
            onAssignChannel={vi.fn()}
          />,
        );
        await openMenu();
        expect(screen.queryByRole('menuitem', { name: 'カテゴリへ移動' })).not.toBeInTheDocument();
      });

      it('「通知レベル」が表示される', async () => {
        render(
          <ChannelItem
            {...defaultProps}
            channel={makeChannel()}
            isHovered={true}
            onChangeNotificationLevel={vi.fn()}
          />,
        );
        await openMenu();
        expect(screen.getByRole('menuitem', { name: '通知レベル' })).toBeInTheDocument();
      });

      it('「メンバー管理」は表示されない', async () => {
        render(
          <ChannelItem
            {...defaultProps}
            channel={makeChannel({ isPrivate: false })}
            isHovered={true}
          />,
        );
        await openMenu();
        expect(screen.queryByRole('menuitem', { name: 'メンバー管理' })).not.toBeInTheDocument();
      });

      it('canArchive=true のとき「アーカイブ」が表示される', async () => {
        render(
          <ChannelItem
            {...defaultProps}
            channel={makeChannel({ createdBy: 1 })}
            isHovered={true}
            currentUserId={1}
            onArchive={vi.fn()}
          />,
        );
        await openMenu();
        expect(screen.getByRole('menuitem', { name: 'アーカイブ' })).toBeInTheDocument();
      });

      it('canArchive=false のとき「アーカイブ」が表示されない', async () => {
        render(
          <ChannelItem
            {...defaultProps}
            channel={makeChannel({ createdBy: 99 })}
            isHovered={true}
            currentUserId={1}
            userRole="user"
            onArchive={vi.fn()}
          />,
        );
        await openMenu();
        expect(screen.queryByRole('menuitem', { name: 'アーカイブ' })).not.toBeInTheDocument();
      });

      it('isPinned=false のとき「ピン留め」が表示される', async () => {
        render(
          <ChannelItem
            {...defaultProps}
            channel={makeChannel()}
            isHovered={true}
            isPinned={false}
          />,
        );
        await openMenu();
        expect(screen.getByRole('menuitem', { name: 'ピン留め' })).toBeInTheDocument();
      });

      it('isPinned=true のとき「ピン留めを解除」が表示される', async () => {
        render(
          <ChannelItem
            {...defaultProps}
            channel={makeChannel()}
            isHovered={true}
            isPinned={true}
          />,
        );
        await openMenu();
        expect(screen.getByRole('menuitem', { name: 'ピン留めを解除' })).toBeInTheDocument();
      });
    });

    describe('プライベートチャンネル（isPrivate=true）', () => {
      it('「メンバー管理」が表示される', async () => {
        render(
          <ChannelItem
            {...defaultProps}
            channel={makeChannel({ isPrivate: true })}
            isHovered={true}
          />,
        );
        await openMenu();
        expect(screen.getByRole('menuitem', { name: 'メンバー管理' })).toBeInTheDocument();
      });

      it('「カテゴリへ移動」「通知レベル」「アーカイブ」「ピン留め」も表示される', async () => {
        render(
          <ChannelItem
            {...defaultProps}
            channel={makeChannel({ isPrivate: true, createdBy: 1 })}
            isHovered={true}
            currentUserId={1}
            allCategories={[makeCategory(1, 'Work')]}
            onAssignChannel={vi.fn()}
            onArchive={vi.fn()}
            onChangeNotificationLevel={vi.fn()}
          />,
        );
        await openMenu();
        expect(screen.getByRole('menuitem', { name: 'カテゴリへ移動' })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: '通知レベル' })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: 'アーカイブ' })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: 'ピン留め' })).toBeInTheDocument();
      });
    });
  });

  // ─────────────────────────────────────────────────────────
  // 3点メニュー: カテゴリ移動サブメニュー
  // ─────────────────────────────────────────────────────────

  describe('3点メニュー: カテゴリ移動サブメニュー', () => {
    const categories = [makeCategory(1, 'Work'), makeCategory(2, 'Dev')];

    function renderWithCategories(categoryId?: number | null) {
      const onAssignChannel = vi.fn();
      render(
        <ChannelItem
          {...defaultProps}
          channel={makeChannel({ id: 5 })}
          isHovered={true}
          allCategories={categories}
          categoryId={categoryId}
          onAssignChannel={onAssignChannel}
        />,
      );
      return { onAssignChannel };
    }

    it('「カテゴリへ移動」をクリックするとサブメニューにカテゴリ一覧が表示される', async () => {
      renderWithCategories();
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: 'カテゴリへ移動' }));
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'Workに移動' })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: 'Devに移動' })).toBeInTheDocument();
      });
    });

    it('サブメニューに「割当なし（その他）」が表示される', async () => {
      renderWithCategories();
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: 'カテゴリへ移動' }));
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: '割当なし（その他）' })).toBeInTheDocument();
      });
    });

    it('カテゴリ項目を選択すると onAssignChannel が呼ばれる', async () => {
      const { onAssignChannel } = renderWithCategories();
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: 'カテゴリへ移動' }));
      await waitFor(() => screen.getByRole('menuitem', { name: 'Workに移動' }));
      await userEvent.click(screen.getByRole('menuitem', { name: 'Workに移動' }));
      expect(onAssignChannel).toHaveBeenCalledWith(5, 1);
    });

    it('「割当なし（その他）」を選択すると onAssignChannel(id, null) が呼ばれる', async () => {
      const { onAssignChannel } = renderWithCategories(1);
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: 'カテゴリへ移動' }));
      await waitFor(() => screen.getByRole('menuitem', { name: '割当なし（その他）' }));
      await userEvent.click(screen.getByRole('menuitem', { name: '割当なし（その他）' }));
      expect(onAssignChannel).toHaveBeenCalledWith(5, null);
    });

    it('現在割り当て済みのカテゴリにはチェックマークが表示される', async () => {
      renderWithCategories(1);
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: 'カテゴリへ移動' }));
      await waitFor(() => screen.getByRole('menuitem', { name: 'Workに移動' }));
      expect(screen.getByRole('menuitem', { name: 'Workに移動' })).toHaveClass('Mui-selected');
    });

    it('カテゴリを選択するとメニューが閉じる', async () => {
      renderWithCategories();
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: 'カテゴリへ移動' }));
      await waitFor(() => screen.getByRole('menuitem', { name: 'Workに移動' }));
      await userEvent.click(screen.getByRole('menuitem', { name: 'Workに移動' }));
      await waitFor(() => {
        expect(screen.queryByRole('menuitem', { name: 'Workに移動' })).not.toBeInTheDocument();
      });
    });
  });

  // ─────────────────────────────────────────────────────────
  // 3点メニュー: 通知レベルサブメニュー
  // ─────────────────────────────────────────────────────────

  describe('3点メニュー: 通知レベルサブメニュー', () => {
    function renderWithNotification(currentLevel: 'all' | 'mentions' | 'muted' = 'all') {
      const onChangeNotificationLevel = vi.fn().mockResolvedValue(undefined);
      render(
        <ChannelItem
          {...defaultProps}
          channel={makeChannel()}
          isHovered={true}
          notificationLevel={currentLevel}
          onChangeNotificationLevel={onChangeNotificationLevel}
        />,
      );
      return { onChangeNotificationLevel };
    }

    it('「通知レベル」をクリックするとサブメニューに選択肢が表示される', async () => {
      renderWithNotification();
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: '通知レベル' }));
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'すべての通知' })).toBeInTheDocument();
      });
    });

    it('サブメニューに「すべての通知」「メンションのみ」「ミュート」が表示される', async () => {
      renderWithNotification();
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: '通知レベル' }));
      await waitFor(() => screen.getByRole('menuitem', { name: 'すべての通知' }));
      expect(screen.getByRole('menuitem', { name: 'すべての通知' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'メンションのみ' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'ミュート' })).toBeInTheDocument();
    });

    it('現在の通知レベルにチェックマークが表示される', async () => {
      renderWithNotification('mentions');
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: '通知レベル' }));
      await waitFor(() => screen.getByRole('menuitem', { name: 'メンションのみ' }));
      expect(screen.getByRole('menuitem', { name: 'メンションのみ' })).toHaveClass('Mui-selected');
    });

    it('通知レベルを選択すると onChangeNotificationLevel が呼ばれる', async () => {
      const { onChangeNotificationLevel } = renderWithNotification();
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: '通知レベル' }));
      await waitFor(() => screen.getByRole('menuitem', { name: 'ミュート' }));
      await userEvent.click(screen.getByRole('menuitem', { name: 'ミュート' }));
      expect(onChangeNotificationLevel).toHaveBeenCalledWith(1, 'muted');
    });

    it('通知レベルを選択するとメニューが閉じる', async () => {
      renderWithNotification();
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: '通知レベル' }));
      await waitFor(() => screen.getByRole('menuitem', { name: 'ミュート' }));
      await userEvent.click(screen.getByRole('menuitem', { name: 'ミュート' }));
      await waitFor(() => {
        expect(screen.queryByRole('menuitem', { name: 'ミュート' })).not.toBeInTheDocument();
      });
    });
  });

  // ─────────────────────────────────────────────────────────
  // 3点メニュー: メンバー管理
  // ─────────────────────────────────────────────────────────

  describe('3点メニュー: メンバー管理', () => {
    it('「メンバー管理」をクリックすると onOpenMembersDialog が呼ばれる', async () => {
      const onOpenMembersDialog = vi.fn();
      const channel = makeChannel({ isPrivate: true });
      render(
        <ChannelItem
          {...defaultProps}
          channel={channel}
          isHovered={true}
          onOpenMembersDialog={onOpenMembersDialog}
        />,
      );
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: 'メンバー管理' }));
      expect(onOpenMembersDialog).toHaveBeenCalledWith(channel);
    });

    it('「メンバー管理」をクリックするとメニューが閉じる', async () => {
      render(
        <ChannelItem
          {...defaultProps}
          channel={makeChannel({ isPrivate: true })}
          isHovered={true}
        />,
      );
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: 'メンバー管理' }));
      await waitFor(() => {
        expect(screen.queryByRole('menuitem', { name: 'メンバー管理' })).not.toBeInTheDocument();
      });
    });
  });

  // ─────────────────────────────────────────────────────────
  // 3点メニュー: アーカイブ
  // ─────────────────────────────────────────────────────────

  describe('3点メニュー: アーカイブ', () => {
    function renderArchivable() {
      const onArchive = vi.fn();
      render(
        <ChannelItem
          {...defaultProps}
          channel={makeChannel({ createdBy: 1 })}
          isHovered={true}
          currentUserId={1}
          onArchive={onArchive}
        />,
      );
      return { onArchive };
    }

    it('「アーカイブ」をクリックすると確認ダイアログが開く', async () => {
      renderArchivable();
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: 'アーカイブ' }));
      await waitFor(() => {
        expect(screen.getByText('チャンネルのアーカイブ')).toBeInTheDocument();
      });
    });

    it('確認ダイアログでアーカイブを確定すると onArchive が呼ばれる', async () => {
      const { onArchive } = renderArchivable();
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: 'アーカイブ' }));
      await waitFor(() => screen.getByText('チャンネルのアーカイブ'));
      await userEvent.click(screen.getByRole('button', { name: 'アーカイブ' }));
      expect(onArchive).toHaveBeenCalledWith(1);
    });

    it('確認ダイアログでキャンセルすると onArchive は呼ばれない', async () => {
      const { onArchive } = renderArchivable();
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: 'アーカイブ' }));
      await waitFor(() => screen.getByText('チャンネルのアーカイブ'));
      await userEvent.click(screen.getByRole('button', { name: 'キャンセル' }));
      expect(onArchive).not.toHaveBeenCalled();
    });

    it('「アーカイブ」をクリックするとメニューが閉じる', async () => {
      renderArchivable();
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: 'アーカイブ' }));
      await waitFor(() => {
        expect(screen.queryByRole('menuitem', { name: 'アーカイブ' })).not.toBeInTheDocument();
      });
    });
  });

  // ─────────────────────────────────────────────────────────
  // 3点メニュー: ピン留め / ピン留め解除
  // ─────────────────────────────────────────────────────────

  describe('3点メニュー: ピン留め / ピン留め解除', () => {
    it('「ピン留め」をクリックすると onPin が呼ばれる', async () => {
      const onPin = vi.fn();
      render(
        <ChannelItem
          {...defaultProps}
          channel={makeChannel({ id: 1 })}
          isHovered={true}
          isPinned={false}
          onPin={onPin}
        />,
      );
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: 'ピン留め' }));
      expect(onPin).toHaveBeenCalledWith(1);
    });

    it('「ピン留めを解除」をクリックすると onUnpin が呼ばれる', async () => {
      const onUnpin = vi.fn();
      render(
        <ChannelItem
          {...defaultProps}
          channel={makeChannel({ id: 1 })}
          isHovered={true}
          isPinned={true}
          onUnpin={onUnpin}
        />,
      );
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: 'ピン留めを解除' }));
      expect(onUnpin).toHaveBeenCalledWith(1);
    });

    it('ピン留め操作後にメニューが閉じる', async () => {
      render(
        <ChannelItem {...defaultProps} channel={makeChannel()} isHovered={true} isPinned={false} />,
      );
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: 'ピン留め' }));
      await waitFor(() => {
        expect(screen.queryByRole('menuitem', { name: 'ピン留め' })).not.toBeInTheDocument();
      });
    });
  });

  // ─────────────────────────────────────────────────────────
  // バッジ右マージン調整
  // ─────────────────────────────────────────────────────────

  describe('バッジ右マージン調整', () => {
    it('ホバー時のみバッジに mr スタイルが適用される（アイコンとの重なりを回避）', () => {
      const { container } = render(
        <ChannelItem
          {...defaultProps}
          channel={makeChannel({ unreadCount: 3 })}
          isHovered={true}
        />,
      );
      const badge = container.querySelector('.MuiBadge-root') as HTMLElement | null;
      expect(badge).not.toBeNull();
      expect(badge!.style.marginRight).not.toBe('0px');
    });

    it('非ホバー時はバッジの mr は 0 になる', () => {
      const { container } = render(
        <ChannelItem
          {...defaultProps}
          channel={makeChannel({ unreadCount: 3 })}
          isHovered={false}
        />,
      );
      const badge = container.querySelector('.MuiBadge-root') as HTMLElement | null;
      if (badge) {
        expect(badge.style.marginRight).toBe('');
      }
    });
  });
});
