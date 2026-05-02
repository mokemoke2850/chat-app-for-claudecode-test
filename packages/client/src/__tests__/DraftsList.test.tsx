/**
 * components/Inbox/DraftsList.tsx のユニットテスト (Step 6a)
 *
 * 純粋コンポーネントとして drafts 配列を直接渡してテストする。
 * Promise の解決は親 (InboxPage) で行うため Suspense は不要。
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
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
});
