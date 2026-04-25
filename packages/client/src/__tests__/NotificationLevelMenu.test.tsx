/**
 * テスト対象: components/Channel/NotificationLevelMenu
 * 責務: 通知レベル（all / mentions / muted）を選択するポップオーバーメニューの表示・操作
 * 戦略:
 *   - onChangeLevel コールバックを vi.fn() で差し替えて API 呼び出しを検証する
 *   - userEvent でメニュー操作をシミュレートする
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NotificationLevelMenu from '../components/Channel/NotificationLevelMenu';

const defaultProps = {
  channelId: 1,
  currentLevel: 'all' as const,
  onChangeLevel: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

async function openMenu() {
  await userEvent.click(screen.getByRole('button', { name: '通知設定' }));
  await waitFor(() => {
    expect(screen.getByRole('menuitem', { name: 'すべての通知' })).toBeInTheDocument();
  });
}

describe('NotificationLevelMenu', () => {
  describe('メニュー表示', () => {
    it('「すべての通知」「メンションのみ」「ミュート」の3つの選択肢が表示される', async () => {
      render(<NotificationLevelMenu {...defaultProps} />);
      await openMenu();
      expect(screen.getByRole('menuitem', { name: 'すべての通知' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'メンションのみ' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'ミュート' })).toBeInTheDocument();
    });

    it('現在の通知レベルが選択済み状態で表示される', async () => {
      render(<NotificationLevelMenu {...defaultProps} currentLevel="mentions" />);
      await openMenu();
      // selected な menuitem は Mui-selected クラスを持つ
      const mentionsItem = screen.getByRole('menuitem', { name: 'メンションのみ' });
      expect(mentionsItem).toHaveClass('Mui-selected');
    });
  });

  describe('通知レベルの変更', () => {
    it('「すべての通知」を選択すると onChangeLevel が level="all" で呼ばれる', async () => {
      const onChangeLevel = vi.fn().mockResolvedValue(undefined);
      render(
        <NotificationLevelMenu
          {...defaultProps}
          currentLevel="muted"
          onChangeLevel={onChangeLevel}
        />,
      );
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: 'すべての通知' }));
      expect(onChangeLevel).toHaveBeenCalledWith(1, 'all');
    });

    it('「メンションのみ」を選択すると onChangeLevel が level="mentions" で呼ばれる', async () => {
      const onChangeLevel = vi.fn().mockResolvedValue(undefined);
      render(<NotificationLevelMenu {...defaultProps} onChangeLevel={onChangeLevel} />);
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: 'メンションのみ' }));
      expect(onChangeLevel).toHaveBeenCalledWith(1, 'mentions');
    });

    it('「ミュート」を選択すると onChangeLevel が level="muted" で呼ばれる', async () => {
      const onChangeLevel = vi.fn().mockResolvedValue(undefined);
      render(<NotificationLevelMenu {...defaultProps} onChangeLevel={onChangeLevel} />);
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: 'ミュート' }));
      expect(onChangeLevel).toHaveBeenCalledWith(1, 'muted');
    });

    it('選択後にメニューが閉じる', async () => {
      const onChangeLevel = vi.fn().mockResolvedValue(undefined);
      render(<NotificationLevelMenu {...defaultProps} onChangeLevel={onChangeLevel} />);
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: 'ミュート' }));
      await waitFor(() => {
        expect(screen.queryByRole('menuitem', { name: 'ミュート' })).not.toBeInTheDocument();
      });
    });
  });

  describe('API エラー処理', () => {
    it('API が失敗した場合にエラーが onChangeLevel から reject される', async () => {
      const error = new Error('Network error');
      const onChangeLevel = vi.fn().mockRejectedValue(error);
      render(<NotificationLevelMenu {...defaultProps} onChangeLevel={onChangeLevel} />);
      await openMenu();
      // エラーが発生しても UI がクラッシュしないことを確認
      await userEvent.click(screen.getByRole('menuitem', { name: 'ミュート' }));
      expect(onChangeLevel).toHaveBeenCalledWith(1, 'muted');
    });
  });
});
