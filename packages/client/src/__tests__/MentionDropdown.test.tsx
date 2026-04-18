/**
 * components/Chat/MentionDropdown.tsx のユニットテスト
 *
 * テスト対象: @メンション候補ドロップダウン
 *   - クエリ文字列によるユーザーフィルタリング
 *   - キーボード操作（↑↓ で候補移動、Enter で確定、Escape で閉じる）
 *   - マウスクリックによる候補選択
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import MentionDropdown from '../components/Chat/MentionDropdown';
import { dummyUsers } from './__fixtures__/users';
import type { User } from '@chat-app/shared';

const makeAnchor = () => ({
  getBoundingClientRect: () => new DOMRect(0, 0, 0, 0),
});

describe('MentionDropdown', () => {
  describe('候補リストの表示', () => {
    it('open=true かつ candidates が存在するとき候補リストを表示する', () => {
      render(
        <MentionDropdown
          open={true}
          anchorEl={makeAnchor()}
          candidates={dummyUsers}
          selectedIdx={0}
          onSelect={vi.fn()}
        />,
      );
      expect(screen.getByText('@alice')).toBeInTheDocument();
    });

    it('open=false のとき候補リストを表示しない', () => {
      render(
        <MentionDropdown
          open={false}
          anchorEl={makeAnchor()}
          candidates={dummyUsers}
          selectedIdx={0}
          onSelect={vi.fn()}
        />,
      );
      expect(screen.queryByText('@alice')).not.toBeInTheDocument();
    });

    it('candidates が空のとき何も表示しない', () => {
      render(
        <MentionDropdown
          open={true}
          anchorEl={makeAnchor()}
          candidates={[]}
          selectedIdx={0}
          onSelect={vi.fn()}
        />,
      );
      expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
    });

    it('各候補を "@{username}" 形式で表示する', () => {
      render(
        <MentionDropdown
          open={true}
          anchorEl={makeAnchor()}
          candidates={dummyUsers}
          selectedIdx={0}
          onSelect={vi.fn()}
        />,
      );
      expect(screen.getByText('@alice')).toBeInTheDocument();
      expect(screen.getByText('@bob')).toBeInTheDocument();
    });

    it('表示件数は最大 8 件に絞られる', () => {
      const manyUsers: User[] = Array.from({ length: 12 }, (_, i) => ({
        id: i + 1,
        username: `user${i + 1}`,
        email: `user${i + 1}@example.com`,
        avatarUrl: null,
        displayName: null,
        location: null,
        createdAt: '2024-01-01T00:00:00Z',
        role: 'user' as const,
        isActive: true,
      }));
      render(
        <MentionDropdown
          open={true}
          anchorEl={makeAnchor()}
          candidates={manyUsers}
          selectedIdx={0}
          onSelect={vi.fn()}
        />,
      );
      // 表示件数がちょうど8件であることを確認
      expect(screen.getAllByRole('listitem')).toHaveLength(8);
      expect(screen.queryByText('@user9')).not.toBeInTheDocument();
      expect(screen.getByText('@user8')).toBeInTheDocument();
    });
  });

  describe('選択状態のハイライト', () => {
    it('selectedIdx に対応する候補がハイライト（selected）される', () => {
      render(
        <MentionDropdown
          open={true}
          anchorEl={makeAnchor()}
          candidates={dummyUsers}
          selectedIdx={1}
          onSelect={vi.fn()}
        />,
      );
      // MUI ListItemButton の selected 状態は Mui-selected クラスで表現される
      const bobButton = screen.getByText('@bob').closest('div[role="button"]') as HTMLElement;
      expect(bobButton).toHaveClass('Mui-selected');
    });
  });

  describe('クリックによる選択', () => {
    it('候補をクリックすると onSelect がその User を引数に呼ばれる', async () => {
      const onSelect = vi.fn();
      render(
        <MentionDropdown
          open={true}
          anchorEl={makeAnchor()}
          candidates={dummyUsers}
          selectedIdx={0}
          onSelect={onSelect}
        />,
      );
      await userEvent.click(screen.getByText('@alice'));
      expect(onSelect).toHaveBeenCalledWith(dummyUsers[0]);
    });

    it('候補クリック時に onMouseDown が e.preventDefault() を呼びエディタのフォーカスを維持する', async () => {
      const onSelect = vi.fn();
      render(
        <MentionDropdown
          open={true}
          anchorEl={makeAnchor()}
          candidates={dummyUsers}
          selectedIdx={0}
          onSelect={onSelect}
        />,
      );
      // MUI ListItemButton のボタン要素を取得
      const aliceButton = screen.getByText('@alice').closest('div[role="button"]') as HTMLElement;
      expect(aliceButton).not.toBeNull();
      // mousedown イベントで preventDefault が呼ばれることを確認
      const mousedownEvent = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
      aliceButton.dispatchEvent(mousedownEvent);
      expect(mousedownEvent.defaultPrevented).toBe(true);
    });
  });

});

