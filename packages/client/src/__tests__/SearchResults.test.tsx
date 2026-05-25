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

  describe('検索結果ゼロ件時の「条件を広げる」セクション (#327)', () => {
    const baseFilters = [{ type: 'keyword' as const, label: 'キーワード: hello' }];

    it('結果 0 件かつ適用中フィルタが 1 つ以上あるとき「条件を広げる」セクションが表示される', () => {
      render(
        <SearchResults
          results={[]}
          onNavigate={vi.fn()}
          appliedFilters={baseFilters}
          onRemoveFilter={vi.fn()}
          onResetAll={vi.fn()}
        />,
      );

      expect(screen.getByTestId('search-zero-suggestions')).toBeInTheDocument();
      expect(screen.getByText('条件を広げる')).toBeInTheDocument();
    });

    it('結果 0 件でも適用中フィルタが 1 つも無いときはセクションを表示しない', () => {
      render(
        <SearchResults
          results={[]}
          onNavigate={vi.fn()}
          appliedFilters={[]}
          onRemoveFilter={vi.fn()}
          onResetAll={vi.fn()}
        />,
      );

      expect(screen.queryByTestId('search-zero-suggestions')).not.toBeInTheDocument();
    });

    it('適用中の各フィルタが解除チップとしてラベル付きで並ぶ（キーワード）', () => {
      render(
        <SearchResults
          results={[]}
          onNavigate={vi.fn()}
          appliedFilters={[{ type: 'keyword', label: 'キーワード: hello' }]}
          onRemoveFilter={vi.fn()}
          onResetAll={vi.fn()}
        />,
      );

      const chip = screen.getByTestId('applied-filter-keyword');
      expect(chip).toBeInTheDocument();
      expect(chip).toHaveTextContent('キーワード: hello');
    });

    it('適用中の各フィルタが解除チップとして並ぶ（送信者・添付・日付・タグ・チャンネル）', () => {
      render(
        <SearchResults
          results={[]}
          onNavigate={vi.fn()}
          appliedFilters={[
            { type: 'sender', label: '送信者: alice' },
            { type: 'attachment', label: '添付ファイル: あり' },
            { type: 'dateFrom', label: '開始日: 2024-01-01' },
            { type: 'dateTo', label: '終了日: 2024-12-31' },
            { type: 'tag', label: 'タグ: feature', value: 1 },
            { type: 'channel', label: 'チャンネル: general' },
          ]}
          onRemoveFilter={vi.fn()}
          onResetAll={vi.fn()}
        />,
      );

      expect(screen.getByTestId('applied-filter-sender')).toHaveTextContent('送信者: alice');
      expect(screen.getByTestId('applied-filter-attachment')).toHaveTextContent(
        '添付ファイル: あり',
      );
      expect(screen.getByTestId('applied-filter-dateFrom')).toHaveTextContent('開始日: 2024-01-01');
      expect(screen.getByTestId('applied-filter-dateTo')).toHaveTextContent('終了日: 2024-12-31');
      expect(screen.getByTestId('applied-filter-tag-1')).toHaveTextContent('タグ: feature');
      expect(screen.getByTestId('applied-filter-channel')).toHaveTextContent('チャンネル: general');
    });

    it('チップの削除アイコン押下で onRemoveFilter が該当フィルタ種別を引数に呼ばれる', async () => {
      const onRemoveFilter = vi.fn();
      const tagFilter = { type: 'tag' as const, label: 'タグ: feature', value: 1 };
      render(
        <SearchResults
          results={[]}
          onNavigate={vi.fn()}
          appliedFilters={[tagFilter]}
          onRemoveFilter={onRemoveFilter}
          onResetAll={vi.fn()}
        />,
      );

      await userEvent.click(screen.getByTestId('remove-filter-tag-1'));

      expect(onRemoveFilter).toHaveBeenCalledTimes(1);
      expect(onRemoveFilter).toHaveBeenCalledWith(tagFilter);
    });

    it('「すべての条件をリセット」ボタンが表示される', () => {
      render(
        <SearchResults
          results={[]}
          onNavigate={vi.fn()}
          appliedFilters={baseFilters}
          onRemoveFilter={vi.fn()}
          onResetAll={vi.fn()}
        />,
      );

      expect(screen.getByRole('button', { name: 'すべての条件をリセット' })).toBeInTheDocument();
    });

    it('「すべての条件をリセット」ボタン押下で onResetAll が呼ばれる', async () => {
      const onResetAll = vi.fn();
      render(
        <SearchResults
          results={[]}
          onNavigate={vi.fn()}
          appliedFilters={baseFilters}
          onRemoveFilter={vi.fn()}
          onResetAll={onResetAll}
        />,
      );

      await userEvent.click(screen.getByRole('button', { name: 'すべての条件をリセット' }));

      expect(onResetAll).toHaveBeenCalledTimes(1);
    });

    it('hasSearched=false のときは「条件を広げる」セクションも表示しない', () => {
      render(
        <SearchResults
          results={[]}
          onNavigate={vi.fn()}
          hasSearched={false}
          appliedFilters={baseFilters}
          onRemoveFilter={vi.fn()}
          onResetAll={vi.fn()}
        />,
      );

      expect(screen.queryByTestId('search-zero-suggestions')).not.toBeInTheDocument();
    });
  });

  describe('スニペット + ハイライト (Step 7c-2)', () => {
    it('keyword props 指定時、マッチ部分が <mark> でハイライト表示される', () => {
      const result = makeResult({
        content: JSON.stringify({ ops: [{ insert: '今夜のリリース計画について\n' }] }),
      });
      const { container } = render(
        <SearchResults results={[result]} onNavigate={vi.fn()} keyword="リリース" />,
      );
      const mark = container.querySelector('mark');
      expect(mark).not.toBeNull();
      expect(mark?.textContent).toBe('リリース');
    });

    it('keyword 未指定（または空）のとき、ハイライトなしで本文先頭抜粋が表示される', () => {
      const result = makeResult({
        content: JSON.stringify({ ops: [{ insert: '今夜のリリース計画について\n' }] }),
      });
      const { container } = render(<SearchResults results={[result]} onNavigate={vi.fn()} />);
      expect(container.querySelector('mark')).toBeNull();
      expect(screen.getByTestId('search-result-snippet')).toHaveTextContent(
        '今夜のリリース計画について',
      );
    });

    it('keyword は大文字小文字を無視してマッチする', () => {
      const result = makeResult({
        content: JSON.stringify({ ops: [{ insert: 'Hello World\n' }] }),
      });
      const { container } = render(
        <SearchResults results={[result]} onNavigate={vi.fn()} keyword="hello" />,
      );
      const mark = container.querySelector('mark');
      expect(mark?.textContent).toBe('Hello'); // 元のケース保持
    });

    it('マッチがない場合は本文先頭抜粋を表示する（<mark> なし）', () => {
      const result = makeResult({
        content: JSON.stringify({ ops: [{ insert: 'テスト投稿\n' }] }),
      });
      const { container } = render(
        <SearchResults results={[result]} onNavigate={vi.fn()} keyword="存在しない単語" />,
      );
      expect(container.querySelector('mark')).toBeNull();
      expect(screen.getByTestId('search-result-snippet')).toHaveTextContent('テスト投稿');
    });
  });
});
