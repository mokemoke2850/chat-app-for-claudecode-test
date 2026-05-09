/**
 * components/Inbox/DraftsList.tsx のユニットテスト (Step 6a)
 *
 * 純粋コンポーネントとして drafts 配列を直接渡してテストする。
 * Promise の解決は親 (InboxPage) で行うため Suspense は不要。
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import DraftsList from '../components/Inbox/DraftsList';
import type { Draft } from '@chat-app/shared';

function makeDraft(overrides: Partial<Draft> = {}): Draft {
  return {
    id: 1,
    userId: 1,
    channelId: 5,
    dmConversationId: null,
    content: 'まだ送ってない下書き',
    updatedAt: '2026-05-01T12:00:00Z',
    ...overrides,
  };
}

describe('DraftsList (Step 6a)', () => {
  it('drafts が空のとき「下書きはありません」と表示される', () => {
    render(<DraftsList drafts={[]} />);
    expect(screen.getByText('下書きはありません')).toBeInTheDocument();
  });

  it('drafts[].content をテキストとして表示する', () => {
    render(<DraftsList drafts={[makeDraft()]} />);
    expect(screen.getByText(/まだ送ってない下書き/)).toBeInTheDocument();
  });

  it('複数の drafts が並んで表示される', () => {
    const drafts = [
      makeDraft({ id: 1, content: '下書き1' }),
      makeDraft({ id: 2, content: '下書き2' }),
    ];
    render(<DraftsList drafts={drafts} />);
    expect(screen.getAllByTestId('draft-card')).toHaveLength(2);
  });

  // unreadOnly prop のテスト (Issue #266)
  describe('unreadOnly prop の受け取り', () => {
    it('unreadOnly=true のとき全下書きが表示される（下書きは未読フラグなし）', () => {
      const drafts = [makeDraft({ id: 1 }), makeDraft({ id: 2 })];
      render(<DraftsList drafts={drafts} unreadOnly={true} />);
      expect(screen.getAllByTestId('draft-card')).toHaveLength(2);
    });

    it('unreadOnly=false のとき全下書きが表示される', () => {
      const drafts = [makeDraft({ id: 1 }), makeDraft({ id: 2 })];
      render(<DraftsList drafts={drafts} unreadOnly={false} />);
      expect(screen.getAllByTestId('draft-card')).toHaveLength(2);
    });

    it('unreadOnly prop が渡されない場合でも既存の動作が変わらない（後方互換）', () => {
      const drafts = [makeDraft({ id: 1 }), makeDraft({ id: 2 })];
      render(<DraftsList drafts={drafts} />);
      expect(screen.getAllByTestId('draft-card')).toHaveLength(2);
    });
  });

  describe('クイックアクション (Step 6d)', () => {
    it('チャンネル下書きのカードに「再開」ボタンが表示される', () => {
      render(<DraftsList drafts={[makeDraft({ channelId: 7 })]} />);
      expect(screen.getByRole('button', { name: '再開' })).toBeInTheDocument();
    });

    it('「再開」ボタンを押すと onResume props が該当の channelId で呼ばれる', async () => {
      const onResume = vi.fn();
      render(<DraftsList drafts={[makeDraft({ channelId: 7 })]} onResume={onResume} />);
      await userEvent.click(screen.getByRole('button', { name: '再開' }));
      expect(onResume).toHaveBeenCalledWith({ kind: 'channel', channelId: 7 });
    });

    it('DM 下書き (channelId = null, dmConversationId 有) の「再開」は dmConversationId で onResume を呼ぶ', async () => {
      const onResume = vi.fn();
      render(
        <DraftsList
          drafts={[makeDraft({ channelId: null, dmConversationId: 99 })]}
          onResume={onResume}
        />,
      );
      await userEvent.click(screen.getByRole('button', { name: '再開' }));
      expect(onResume).toHaveBeenCalledWith({ kind: 'dm', dmConversationId: 99 });
    });

    it('onResume が未指定でも描画はクラッシュしない', () => {
      expect(() => render(<DraftsList drafts={[makeDraft()]} />)).not.toThrow();
    });
  });
});
