/**
 * テスト対象: components/Chat/TagChip.tsx
 * 戦略:
 *   - タグの表示と「クリックで検索フィルタにセット」「× で削除」のコールバック挙動を検証する。
 *   - スタイリングや細かい aria 属性は対象外（画面で確認可能な範囲）。
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Tag } from '@chat-app/shared';
import TagChip from '../TagChip';

const sample: Tag = {
  id: 1,
  name: 'bug',
  useCount: 3,
  createdAt: '2026-01-01T00:00:00Z',
};

describe('TagChip', () => {
  describe('表示', () => {
    it('渡された tag.name が "#" プレフィックス付きで表示される', () => {
      render(<TagChip tag={sample} />);
      expect(screen.getByText('#bug')).toBeInTheDocument();
    });

    it('readOnly=true のとき削除ボタン (×) が表示されない', () => {
      const onDelete = vi.fn();
      render(<TagChip tag={sample} readOnly onDelete={onDelete} />);
      // MUI Chip の削除アイコンは onDelete が渡らないと描画されない
      expect(screen.queryByTestId('CancelIcon')).toBeNull();
    });

    it('readOnly=false のとき削除ボタン (×) が表示される', () => {
      const onDelete = vi.fn();
      render(<TagChip tag={sample} readOnly={false} onDelete={onDelete} />);
      expect(screen.getByTestId('CancelIcon')).toBeInTheDocument();
    });
  });

  describe('クリック動作', () => {
    it('チップ本体をクリックすると onClick が tag.name を引数に呼ばれる', () => {
      const onClick = vi.fn();
      render(<TagChip tag={sample} onClick={onClick} />);
      fireEvent.click(screen.getByText('#bug'));
      expect(onClick).toHaveBeenCalledWith('bug');
    });

    it('削除ボタンをクリックすると onDelete が tag.id を引数に呼ばれ、onClick は呼ばれない (stopPropagation)', () => {
      const onClick = vi.fn();
      const onDelete = vi.fn();
      render(<TagChip tag={sample} onClick={onClick} readOnly={false} onDelete={onDelete} />);
      fireEvent.click(screen.getByTestId('CancelIcon'));
      expect(onDelete).toHaveBeenCalledWith(1);
      expect(onClick).not.toHaveBeenCalled();
    });
  });
});
