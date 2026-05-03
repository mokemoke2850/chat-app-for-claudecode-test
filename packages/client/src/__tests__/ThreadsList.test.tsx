/**
 * components/Inbox/ThreadsList.tsx のユニットテスト (Step 6c)
 *
 * テスト対象:
 *   - InboxPage の「スレッド」タブで使う表示用の純粋コンポーネント
 *   - 親 (InboxPage) の Suspense 内で `use(promise)` を解決して配列を渡す責務分離パターン
 *
 * 戦略:
 *   - 配列を直接 props で渡して描画結果を検証する (ネットワーク呼び出しなし)
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { ThreadSummary, Message } from '@chat-app/shared';
import ThreadsList from '../components/Inbox/ThreadsList';

const mockNavigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 1,
    channelId: 100,
    userId: 1,
    username: 'alice',
    avatarUrl: null,
    content: 'ルート本文',
    isEdited: false,
    isDeleted: false,
    createdAt: '2026-05-01T10:00:00Z',
    updatedAt: '2026-05-01T10:00:00Z',
    mentions: [],
    reactions: [],
    parentMessageId: null,
    rootMessageId: null,
    replyCount: 0,
    quotedMessageId: null,
    quotedMessage: null,
    ...overrides,
  };
}

function makeThread(overrides: Partial<ThreadSummary> = {}): ThreadSummary {
  return {
    rootMessage: makeMessage(),
    channelName: 'general',
    replyCount: 1,
    lastReplyAt: '2026-05-02T12:30:00Z',
    unreadCount: 0,
    ...overrides,
  };
}

describe('ThreadsList (Step 6c)', () => {
  it('配列が空のとき「購読中スレッドはありません」と表示される', () => {
    render(<ThreadsList threads={[]} />);
    expect(screen.getByText('購読中スレッドはありません')).toBeInTheDocument();
  });

  it('スレッドが渡されたとき、各カードにルートメッセージ本文・チャンネル名・返信件数が表示される', () => {
    const thread = makeThread({
      rootMessage: makeMessage({ id: 42, content: '今夜のリリース大丈夫？' }),
      channelName: 'release',
      replyCount: 3,
    });
    render(<ThreadsList threads={[thread]} />);
    expect(screen.getByText(/今夜のリリース大丈夫？/)).toBeInTheDocument();
    expect(screen.getByText(/#release/)).toBeInTheDocument();
    expect(screen.getByText(/返信 3 件/)).toBeInTheDocument();
  });

  it('複数のスレッドが配列順で表示される', () => {
    const threads: ThreadSummary[] = [
      makeThread({ rootMessage: makeMessage({ id: 1, content: '一番目' }) }),
      makeThread({ rootMessage: makeMessage({ id: 2, content: '二番目' }) }),
      makeThread({ rootMessage: makeMessage({ id: 3, content: '三番目' }) }),
    ];
    render(<ThreadsList threads={threads} />);
    const cards = screen.getAllByTestId('thread-card');
    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveTextContent('一番目');
    expect(cards[1]).toHaveTextContent('二番目');
    expect(cards[2]).toHaveTextContent('三番目');
  });

  // Step 8c: カードクリック遷移 (TODO #15 解消)
  describe('Step 8c: カードクリック遷移', () => {
    beforeEach(() => {
      mockNavigate.mockReset();
    });

    it('カードクリックで rootMessage の /chat?channel=X#message-Y に navigate される', async () => {
      const thread = makeThread({
        rootMessage: makeMessage({ id: 99, channelId: 5 }),
      });
      render(
        <MemoryRouter>
          <ThreadsList threads={[thread]} />
        </MemoryRouter>,
      );
      await userEvent.click(screen.getByTestId('thread-card'));
      expect(mockNavigate).toHaveBeenCalledWith('/chat?channel=5#message-99');
    });

    it('Enter キー押下でも navigate される (a11y)', async () => {
      const thread = makeThread({
        rootMessage: makeMessage({ id: 99, channelId: 5 }),
      });
      render(
        <MemoryRouter>
          <ThreadsList threads={[thread]} />
        </MemoryRouter>,
      );
      const card = screen.getByTestId('thread-card');
      card.focus();
      await userEvent.keyboard('{Enter}');
      expect(mockNavigate).toHaveBeenCalledWith('/chat?channel=5#message-99');
    });

    it('カードに role="button" / tabindex="0" が設定されている (キーボード操作可能)', () => {
      render(
        <MemoryRouter>
          <ThreadsList threads={[makeThread()]} />
        </MemoryRouter>,
      );
      const card = screen.getByTestId('thread-card');
      expect(card).toHaveAttribute('role', 'button');
      expect(card).toHaveAttribute('tabindex', '0');
    });
  });
});
