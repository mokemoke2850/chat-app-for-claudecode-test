/**
 * components/Inbox/MentionsList.tsx のユニットテスト (Step 6b)
 *
 * 純粋コンポーネントとして messages 配列を直接渡してテストする。
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MentionsList from '../components/Inbox/MentionsList';
import type { MessageSearchResult } from '@chat-app/shared';

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
});
