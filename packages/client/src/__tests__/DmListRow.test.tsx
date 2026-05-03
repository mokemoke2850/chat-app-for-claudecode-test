/**
 * components/DM/DmListRow.tsx のユニットテスト (Step 8e-4)
 *
 * 純粋表示コンポーネントのため Suspense / API 不要。
 * variant 別の表示差分 (avatar 径 / lastMessage プレビュー有無) を検証する。
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import type { DmConversationWithDetails } from '@chat-app/shared';
import DmListRow from '../components/DM/DmListRow';

function makeConversation(
  overrides: Partial<DmConversationWithDetails> = {},
): DmConversationWithDetails {
  return {
    id: 1,
    userAId: 1,
    userBId: 2,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    otherUser: { id: 2, username: 'bob', displayName: null, avatarUrl: null },
    unreadCount: 0,
    lastMessage: null,
    ...overrides,
  };
}

describe('DmListRow', () => {
  describe('共通表示', () => {
    it('相手の username が表示される', () => {
      render(<DmListRow conversation={makeConversation()} variant="expanded" onClick={vi.fn()} />);
      expect(screen.getByText('bob')).toBeInTheDocument();
    });

    it('displayName があれば displayName が優先される', () => {
      render(
        <DmListRow
          conversation={makeConversation({
            otherUser: { id: 2, username: 'bob', displayName: '田中花子', avatarUrl: null },
          })}
          variant="expanded"
          onClick={vi.fn()}
        />,
      );
      expect(screen.getByText('田中花子')).toBeInTheDocument();
    });

    it('unreadCount > 0 のとき未読バッジが表示される', () => {
      render(
        <DmListRow
          conversation={makeConversation({ unreadCount: 3 })}
          variant="compact"
          onClick={vi.fn()}
        />,
      );
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('クリックで onClick が呼ばれる', async () => {
      const onClick = vi.fn();
      render(<DmListRow conversation={makeConversation()} variant="compact" onClick={onClick} />);
      await userEvent.click(screen.getByRole('button'));
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('variant=expanded', () => {
    it('lastMessage プレビューが表示される', () => {
      render(
        <DmListRow
          conversation={makeConversation({
            lastMessage: {
              content: 'こんにちは',
              createdAt: '2024-01-01T00:00:00Z',
              senderId: 2,
            },
          })}
          variant="expanded"
          onClick={vi.fn()}
        />,
      );
      expect(screen.getByText('こんにちは')).toBeInTheDocument();
    });

    it('lastMessage の時刻が表示される', () => {
      render(
        <DmListRow
          conversation={makeConversation({
            lastMessage: {
              content: 'msg',
              createdAt: '2024-06-01T12:34:00Z',
              senderId: 2,
            },
          })}
          variant="expanded"
          onClick={vi.fn()}
        />,
      );
      // 月/日が含まれた caption テキストが表示される (詳細フォーマットは locale 依存のため緩く検証)
      expect(screen.getByText(/6月|Jun|6\/1/)).toBeInTheDocument();
    });

    it('isActive=true のとき selected 状態になる (Mui-selected クラス)', () => {
      render(
        <DmListRow
          conversation={makeConversation()}
          variant="expanded"
          isActive={true}
          onClick={vi.fn()}
        />,
      );
      const btn = screen.getByRole('button');
      expect(btn).toHaveClass('Mui-selected');
    });
  });

  describe('variant=compact', () => {
    it('lastMessage プレビューが表示されない', () => {
      render(
        <DmListRow
          conversation={makeConversation({
            lastMessage: {
              content: 'compact では非表示',
              createdAt: '2024-01-01T00:00:00Z',
              senderId: 2,
            },
          })}
          variant="compact"
          onClick={vi.fn()}
        />,
      );
      expect(screen.queryByText('compact では非表示')).not.toBeInTheDocument();
    });

    it('lastMessage の時刻が表示されない', () => {
      render(
        <DmListRow
          conversation={makeConversation({
            lastMessage: {
              content: 'msg',
              createdAt: '2024-06-01T12:34:00Z',
              senderId: 2,
            },
          })}
          variant="compact"
          onClick={vi.fn()}
        />,
      );
      // 6月 や 6/1 等の日付フォーマット文字列が表示されない
      expect(screen.queryByText(/6月|Jun|6\/1/)).not.toBeInTheDocument();
    });
  });
});
