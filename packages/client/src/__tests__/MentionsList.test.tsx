/**
 * components/Inbox/MentionsList.tsx のユニットテスト (Step 6b)
 *
 * 純粋コンポーネントとして messages 配列を直接渡してテストする。
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import MentionsList from '../components/Inbox/MentionsList';
import type { MessageSearchResult } from '@chat-app/shared';

const mockNavigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

function makeSearchResult(overrides: Partial<MessageSearchResult> = {}): MessageSearchResult {
  return {
    id: 1,
    channelId: 1,
    channelName: 'general',
    userId: 2,
    username: 'bob',
    avatarUrl: null,
    content: JSON.stringify({ ops: [{ insert: '@alice こんにちは\n' }] }),
    isEdited: false,
    isDeleted: false,
    createdAt: '2026-05-02T10:00:00Z',
    updatedAt: '2026-05-02T10:00:00Z',
    mentions: [],
    reactions: [],
    parentMessageId: null,
    rootMessageId: null,
    replyCount: 0,
    quotedMessageId: null,
    quotedMessage: null,
    rootMessageContent: null,
    ...overrides,
  };
}

describe('MentionsList (Step 6b)', () => {
  it('messages が空のとき「未読のメンションはありません」と表示される', () => {
    render(<MentionsList messages={[]} />);
    expect(screen.getByText('未読のメンションはありません')).toBeInTheDocument();
  });

  it('messages の本文 (Quill Delta JSON) をプレーンテキストに変換して表示する', () => {
    render(<MentionsList messages={[makeSearchResult()]} />);
    expect(screen.getByText(/@alice こんにちは/)).toBeInTheDocument();
  });

  it('チャンネル名と投稿者名が表示される', () => {
    render(
      <MentionsList
        messages={[makeSearchResult({ channelName: 'design-review', username: 'matsuda' })]}
      />,
    );
    // メタ情報行に「📨 #design-review · matsuda · ...」の形式で表示される
    expect(screen.getByText(/#design-review/)).toBeInTheDocument();
    expect(screen.getByText(/matsuda/)).toBeInTheDocument();
  });

  it('複数の messages が並んで表示される', () => {
    const messages = [
      makeSearchResult({ id: 1 }),
      makeSearchResult({ id: 2, content: 'プレーンテキスト本文' }),
    ];
    render(<MentionsList messages={messages} />);
    expect(screen.getAllByTestId('mention-card')).toHaveLength(2);
  });

  // Step 8c: カードクリック遷移 (TODO #15 解消)
  describe('Step 8c: カードクリック遷移', () => {
    beforeEach(() => {
      mockNavigate.mockReset();
    });

    it('カードクリックで /chat?channel=X#message-Y に navigate される', async () => {
      render(
        <MemoryRouter>
          <MentionsList messages={[makeSearchResult({ id: 42, channelId: 7 })]} />
        </MemoryRouter>,
      );
      await userEvent.click(screen.getByTestId('mention-card'));
      expect(mockNavigate).toHaveBeenCalledWith('/chat?channel=7#message-42');
    });

    it('Enter キー押下でも navigate される (a11y)', async () => {
      render(
        <MemoryRouter>
          <MentionsList messages={[makeSearchResult({ id: 42, channelId: 7 })]} />
        </MemoryRouter>,
      );
      const card = screen.getByTestId('mention-card');
      card.focus();
      await userEvent.keyboard('{Enter}');
      expect(mockNavigate).toHaveBeenCalledWith('/chat?channel=7#message-42');
    });

    it('カードに role="button" / cursor: pointer が設定されている', () => {
      render(
        <MemoryRouter>
          <MentionsList messages={[makeSearchResult()]} />
        </MemoryRouter>,
      );
      const card = screen.getByTestId('mention-card');
      expect(card).toHaveAttribute('role', 'button');
      expect(card).toHaveAttribute('tabindex', '0');
    });
  });
});
