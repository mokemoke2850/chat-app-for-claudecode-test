/**
 * components/Chat/ReactionBadge.tsx のユニットテスト
 *
 * テスト対象: Step 4 で導入したピル形状とアクセント色化
 *   - 高さ 22px / borderRadius 11px のピル形状
 *   - 自分がリアクション済みのとき accent 色枠 + accent 色文字
 *   - 他人のリアクション時は neutral カラー（既存挙動）
 *   - クリックで onClick(emoji) が呼ばれる（既存挙動）
 *
 * MUI の sx は jsdom 環境では `toHaveStyle` で値が取れないことがあるため、
 * 検証したい値は inline `style={{ ... }}` で渡してテスト容易性を確保する方針。
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import ReactionBadge from '../components/Chat/ReactionBadge';
import { dummyUsers } from './__fixtures__/users';
import type { Reaction } from '@chat-app/shared';

const baseReaction: Reaction = { emoji: '👍', count: 1, userIds: [2] };

const renderBadge = (overrides: {
  reaction?: Reaction;
  currentUserId?: number;
  onClick?: (emoji: string) => void;
}) =>
  render(
    <ReactionBadge
      reaction={overrides.reaction ?? baseReaction}
      currentUserId={overrides.currentUserId ?? 1}
      users={dummyUsers}
      onClick={overrides.onClick ?? vi.fn()}
    />,
  );

// jsdom の toHaveStyle は CSS カスタムプロパティ (var(--xxx)) を解決した値で比較するため
// 値が空文字に解決されてしまう。inline `style` 属性は HTMLElement.style.* で直接読み取れるので
// そちらで比較する。
const getBadge = (): HTMLElement => screen.getByTestId('reaction-badge');

describe('ReactionBadge (Step 4)', () => {
  describe('ピル形状', () => {
    it('バッジの高さが 22px で表示される (inline style)', () => {
      renderBadge({});
      expect(getBadge().style.height).toBe('22px');
    });

    it('バッジの borderRadius が 11px で表示される (inline style)', () => {
      renderBadge({});
      expect(getBadge().style.borderRadius).toBe('11px');
    });
  });

  describe('リアクション済み判定', () => {
    it('userIds に currentUserId が含まれるとき data-reacted="true" が付与される', () => {
      renderBadge({
        reaction: { emoji: '👍', count: 1, userIds: [1] },
        currentUserId: 1,
      });
      expect(getBadge()).toHaveAttribute('data-reacted', 'true');
    });

    it('userIds に currentUserId が含まれないとき data-reacted="false" が付与される', () => {
      renderBadge({
        reaction: { emoji: '👍', count: 1, userIds: [2] },
        currentUserId: 1,
      });
      expect(getBadge()).toHaveAttribute('data-reacted', 'false');
    });
  });

  describe('スタイル分岐 (Step 4 アクセント色化)', () => {
    it('自分のリアクション時、borderColor に accent 色 (var(--accent)) が適用される', () => {
      renderBadge({
        reaction: { emoji: '👍', count: 1, userIds: [1] },
        currentUserId: 1,
      });
      expect(getBadge().style.borderColor).toBe('var(--accent)');
    });

    it('自分のリアクション時、文字色 (color) に accent 色 (var(--accent)) が適用される', () => {
      renderBadge({
        reaction: { emoji: '👍', count: 1, userIds: [1] },
        currentUserId: 1,
      });
      expect(getBadge().style.color).toBe('var(--accent)');
    });

    it('他人のリアクション時、border は neutral カラー (var(--border)) のまま', () => {
      renderBadge({
        reaction: { emoji: '👍', count: 1, userIds: [2] },
        currentUserId: 1,
      });
      expect(getBadge().style.borderColor).toBe('var(--border)');
    });
  });

  describe('クリック挙動 (既存挙動の維持)', () => {
    it('クリックで onClick が emoji を引数に呼ばれる', async () => {
      const onClick = vi.fn();
      renderBadge({
        reaction: { emoji: '🎉', count: 1, userIds: [2] },
        currentUserId: 1,
        onClick,
      });
      await userEvent.click(screen.getByTestId('reaction-badge'));
      expect(onClick).toHaveBeenCalledWith('🎉');
    });
  });
});
