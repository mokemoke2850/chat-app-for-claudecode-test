/**
 * components/Chat/SearchResults.tsx のユニットテスト
 *
 * テスト対象: 検索結果の表示・リンクコピー・メッセージへの遷移
 * 戦略:
 *   - MessageSearchResult の配列を props として渡してレンダリングを検証する
 *   - navigator.clipboard をモックしてリンクコピーを検証する
 *   - onNavigate コールバックで遷移を検証する
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { MessageSearchResult } from '@chat-app/shared';
import SearchResults from '../components/Chat/SearchResults';

function makeResult(overrides: Partial<MessageSearchResult> = {}): MessageSearchResult {
  return {
    id: 1,
    channelId: 10,
    channelName: 'general',
    userId: 1,
    username: 'alice',
    avatarUrl: null,
    content: JSON.stringify({ ops: [{ insert: 'テスト投稿\n' }] }),
    isEdited: false,
    isDeleted: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    mentions: [],
    reactions: [],
    parentMessageId: null,
    rootMessageId: null,
    replyCount: 0,
    rootMessageContent: null,
    quotedMessageId: null,
    quotedMessage: null,
    ...overrides,
  };
}

beforeEach(() => {
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

describe('SearchResults', () => {
  describe('表示', () => {
    it('検索結果が一覧表示される', () => {
      const results = [
        makeResult({ id: 1 }),
        makeResult({ id: 2, content: JSON.stringify({ ops: [{ insert: '別の投稿\n' }] }) }),
      ];
      render(<SearchResults results={results} onNavigate={vi.fn()} />);

      expect(screen.getAllByRole('listitem')).toHaveLength(2);
    });

    it('各結果にチャンネル名・投稿者名・投稿日時が表示される', () => {
      render(<SearchResults results={[makeResult()]} onNavigate={vi.fn()} />);

      expect(screen.getByText(/general/)).toBeInTheDocument();
      expect(screen.getByText(/alice/)).toBeInTheDocument();
      // 日時が何らかの形式で表示されること
      expect(screen.getByText(/2024/)).toBeInTheDocument();
    });

    it('検索結果が 0 件のとき「見つかりませんでした」が表示される', () => {
      render(<SearchResults results={[]} onNavigate={vi.fn()} />);

      expect(screen.getByText(/見つかりませんでした/)).toBeInTheDocument();
    });
  });

  describe('リンクコピー', () => {
    it('コピーボタンを押すと当該メッセージへのリンクがクリップボードにコピーされる', async () => {
      render(
        <SearchResults results={[makeResult({ id: 42, channelId: 10 })]} onNavigate={vi.fn()} />,
      );

      await userEvent.click(screen.getByRole('button', { name: /コピー|copy/i }));

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('channel=10'),
      );
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('message-42'),
      );
    });
  });

  describe('投稿への遷移', () => {
    it('遷移ボタンを押すと onNavigate が channelId と messageId を引数に呼ばれる', async () => {
      const onNavigate = vi.fn();
      render(
        <SearchResults results={[makeResult({ id: 42, channelId: 10 })]} onNavigate={onNavigate} />,
      );

      await userEvent.click(screen.getByRole('button', { name: /遷移|移動|jump/i }));

      expect(onNavigate).toHaveBeenCalledWith(10, 42);
    });
  });

  describe('タグ表示 (#115)', () => {
    it('タグが付いたメッセージではタグチップが表示される', () => {
      const result = makeResult({
        tags: [
          { id: 1, name: 'bug', useCount: 5, createdAt: '2024-01-01T00:00:00Z' },
          { id: 2, name: 'urgent', useCount: 3, createdAt: '2024-01-01T00:00:00Z' },
        ],
      });
      render(<SearchResults results={[result]} onNavigate={vi.fn()} />);

      expect(screen.getByText('#bug')).toBeInTheDocument();
      expect(screen.getByText('#urgent')).toBeInTheDocument();
    });

    it('タグが付いていないメッセージではタグチップが表示されない', () => {
      const result = makeResult({ tags: [] });
      render(<SearchResults results={[result]} onNavigate={vi.fn()} />);

      expect(screen.queryByTestId('search-result-tags')).not.toBeInTheDocument();
    });

    it('tags フィールドが undefined のメッセージでもエラーなく表示される', () => {
      const result = makeResult({ tags: undefined });
      render(<SearchResults results={[result]} onNavigate={vi.fn()} />);

      expect(screen.queryByTestId('search-result-tags')).not.toBeInTheDocument();
    });

    it('複数メッセージを表示するとき、それぞれのタグが正しく表示される', () => {
      const results = [
        makeResult({
          id: 1,
          tags: [{ id: 1, name: 'feature', useCount: 2, createdAt: '2024-01-01T00:00:00Z' }],
        }),
        makeResult({
          id: 2,
          content: JSON.stringify({ ops: [{ insert: '別の投稿\n' }] }),
          tags: [{ id: 2, name: 'bug', useCount: 1, createdAt: '2024-01-01T00:00:00Z' }],
        }),
      ];
      render(<SearchResults results={results} onNavigate={vi.fn()} />);

      expect(screen.getByText('#feature')).toBeInTheDocument();
      expect(screen.getByText('#bug')).toBeInTheDocument();
    });
  });
});
