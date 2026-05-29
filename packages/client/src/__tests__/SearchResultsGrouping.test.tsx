/**
 * テスト対象: components/Chat/SearchResults.tsx（グルーピング機能）
 * 戦略:
 *   - クライアント側の groupBy ロジックを検証する（フラット / チャンネル別 / 送信者別 / 日付別）
 *   - グループの折り畳み操作と件数バッジを検証する
 *   - グルーピング切替 UI の描画・切替動作を検証する
 *   - MessageSearchResult の既存フィールド（channelId, channelName, username, createdAt）を活用する
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SearchResults from '../components/Chat/SearchResults';
import { makeSearchResult as makeResult } from './__fixtures__/search';

beforeEach(() => {
  // localStorage 永続化が他テストに影響しないようリセット
  window.localStorage.clear();
});

const multiChannelResults = [
  makeResult({
    id: 1,
    channelId: 10,
    channelName: 'general',
    username: 'alice',
    createdAt: '2024-01-15T10:00:00Z',
  }),
  makeResult({
    id: 2,
    channelId: 10,
    channelName: 'general',
    username: 'bob',
    createdAt: '2024-01-15T11:00:00Z',
  }),
  makeResult({
    id: 3,
    channelId: 20,
    channelName: 'random',
    username: 'alice',
    createdAt: '2024-01-16T09:00:00Z',
  }),
  makeResult({
    id: 4,
    channelId: 20,
    channelName: 'random',
    username: 'carol',
    createdAt: '2024-01-16T10:00:00Z',
  }),
];

describe('検索結果グルーピング', () => {
  describe('グルーピング切替 UI', () => {
    it('グルーピング切替ボタン（フラット / チャンネル / 送信者 / 日付）が表示される', () => {
      render(<SearchResults results={multiChannelResults} onNavigate={vi.fn()} />);

      expect(screen.getByRole('button', { name: /フラット/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /チャンネル/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /送信者/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /日付/ })).toBeInTheDocument();
    });

    it('初期状態ではフラット表示が選択されている', () => {
      render(<SearchResults results={multiChannelResults} onNavigate={vi.fn()} />);

      const flatButton = screen.getByRole('button', { name: /フラット/ });
      // aria-pressed="true" またはクラスで選択状態を確認
      expect(flatButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('切替ボタンを押すとアクティブなグルーピングが変わる', async () => {
      render(<SearchResults results={multiChannelResults} onNavigate={vi.fn()} />);

      await userEvent.click(screen.getByRole('button', { name: /チャンネル/ }));

      expect(screen.getByRole('button', { name: /チャンネル/ })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(screen.getByRole('button', { name: /フラット/ })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    });
  });

  describe('フラット表示', () => {
    it('フラット選択時は結果がグループなしで一覧表示される', () => {
      render(<SearchResults results={multiChannelResults} onNavigate={vi.fn()} />);

      // グループヘッダーがないことを確認し、全件表示
      expect(screen.queryByTestId('group-header')).not.toBeInTheDocument();
      expect(screen.getAllByRole('listitem')).toHaveLength(multiChannelResults.length);
    });

    it('フラット選択時はグループヘッダーが表示されない', () => {
      render(<SearchResults results={multiChannelResults} onNavigate={vi.fn()} />);

      expect(screen.queryByTestId('group-header')).not.toBeInTheDocument();
    });
  });

  describe('チャンネル別グルーピング', () => {
    it('チャンネル別選択時、各チャンネルのヘッダーが表示される', async () => {
      render(<SearchResults results={multiChannelResults} onNavigate={vi.fn()} />);

      await userEvent.click(screen.getByRole('button', { name: /チャンネル/ }));

      const headers = screen.getAllByTestId('group-header');
      expect(headers).toHaveLength(2); // general と random
    });

    it('各グループのヘッダーにチャンネル名が表示される', async () => {
      render(<SearchResults results={multiChannelResults} onNavigate={vi.fn()} />);

      await userEvent.click(screen.getByRole('button', { name: /チャンネル/ }));

      const headers = screen.getAllByTestId('group-header');
      expect(within(headers[0]).getByText(/general/)).toBeInTheDocument();
      expect(within(headers[1]).getByText(/random/)).toBeInTheDocument();
    });

    it('各グループのヘッダーに件数バッジが表示される', async () => {
      render(<SearchResults results={multiChannelResults} onNavigate={vi.fn()} />);

      await userEvent.click(screen.getByRole('button', { name: /チャンネル/ }));

      const headers = screen.getAllByTestId('group-header');
      // general: 2件、random: 2件
      expect(within(headers[0]).getByTestId('group-count')).toHaveTextContent('2');
      expect(within(headers[1]).getByTestId('group-count')).toHaveTextContent('2');
    });

    it('複数チャンネルのメッセージがある場合、チャンネルごとにグループが作成される', async () => {
      render(<SearchResults results={multiChannelResults} onNavigate={vi.fn()} />);

      await userEvent.click(screen.getByRole('button', { name: /チャンネル/ }));

      expect(screen.getAllByTestId('group-header')).toHaveLength(2);
    });
  });

  describe('送信者別グルーピング', () => {
    it('送信者別選択時、各送信者のヘッダーが表示される', async () => {
      render(<SearchResults results={multiChannelResults} onNavigate={vi.fn()} />);

      await userEvent.click(screen.getByRole('button', { name: /送信者/ }));

      // alice, bob, carol の3グループ
      const headers = screen.getAllByTestId('group-header');
      expect(headers).toHaveLength(3);
    });

    it('各グループのヘッダーに送信者名が表示される', async () => {
      render(<SearchResults results={multiChannelResults} onNavigate={vi.fn()} />);

      await userEvent.click(screen.getByRole('button', { name: /送信者/ }));

      const headers = screen.getAllByTestId('group-header');
      const headerLabels = headers.map((h) => h.querySelector('h6')?.textContent ?? '');
      expect(headerLabels).toContain('alice');
      expect(headerLabels).toContain('bob');
      expect(headerLabels).toContain('carol');
    });

    it('各グループのヘッダーに件数バッジが表示される', async () => {
      render(<SearchResults results={multiChannelResults} onNavigate={vi.fn()} />);

      await userEvent.click(screen.getByRole('button', { name: /送信者/ }));

      const headers = screen.getAllByTestId('group-header');
      expect(headers.some((h) => within(h).getByTestId('group-count').textContent === '2')).toBe(
        true,
      ); // alice は2件
    });
  });

  describe('日付別グルーピング', () => {
    it('日付別選択時、各日付のヘッダーが表示される', async () => {
      render(<SearchResults results={multiChannelResults} onNavigate={vi.fn()} />);

      await userEvent.click(screen.getByRole('button', { name: /日付/ }));

      // 2024/01/15 と 2024/01/16 の2グループ
      const headers = screen.getAllByTestId('group-header');
      expect(headers).toHaveLength(2);
    });

    it('各グループのヘッダーに日付が表示される（YYYY/MM/DD形式）', async () => {
      render(<SearchResults results={multiChannelResults} onNavigate={vi.fn()} />);

      await userEvent.click(screen.getByRole('button', { name: /日付/ }));

      const headers = screen.getAllByTestId('group-header');
      const headerLabels = headers.map((h) => h.querySelector('h6')?.textContent ?? '');
      expect(headerLabels).toContain('2024/01/15');
      expect(headerLabels).toContain('2024/01/16');
    });

    it('各グループのヘッダーに件数バッジが表示される', async () => {
      render(<SearchResults results={multiChannelResults} onNavigate={vi.fn()} />);

      await userEvent.click(screen.getByRole('button', { name: /日付/ }));

      const headers = screen.getAllByTestId('group-header');
      expect(within(headers[0]).getByTestId('group-count')).toHaveTextContent('2');
      expect(within(headers[1]).getByTestId('group-count')).toHaveTextContent('2');
    });
  });

  describe('折り畳み操作', () => {
    it('グループヘッダーをクリックするとグループが折り畳まれる', async () => {
      render(<SearchResults results={multiChannelResults} onNavigate={vi.fn()} />);

      await userEvent.click(screen.getByRole('button', { name: /チャンネル/ }));

      const headers = screen.getAllByTestId('group-header');
      await userEvent.click(headers[0]);

      // 折り畳まれたグループのコンテンツが非表示
      expect(headers[0].closest('[data-testid="group-container"]')).toHaveAttribute(
        'data-collapsed',
        'true',
      );
    });

    it('折り畳まれたグループのヘッダーを再クリックすると展開される', async () => {
      render(<SearchResults results={multiChannelResults} onNavigate={vi.fn()} />);

      await userEvent.click(screen.getByRole('button', { name: /チャンネル/ }));

      const headers = screen.getAllByTestId('group-header');
      await userEvent.click(headers[0]); // 折り畳み
      await userEvent.click(headers[0]); // 展開

      expect(headers[0].closest('[data-testid="group-container"]')).toHaveAttribute(
        'data-collapsed',
        'false',
      );
    });

    it('他のグループの折り畳み状態は影響を受けない', async () => {
      render(<SearchResults results={multiChannelResults} onNavigate={vi.fn()} />);

      await userEvent.click(screen.getByRole('button', { name: /チャンネル/ }));

      const headers = screen.getAllByTestId('group-header');
      await userEvent.click(headers[0]); // 最初のグループを折り畳み

      // 2番目のグループは展開状態のまま
      expect(headers[1].closest('[data-testid="group-container"]')).toHaveAttribute(
        'data-collapsed',
        'false',
      );
    });
  });

  describe('グルーピング切替時の動作', () => {
    it('グルーピングを切り替えると全グループが展開状態にリセットされる', async () => {
      render(<SearchResults results={multiChannelResults} onNavigate={vi.fn()} />);

      // チャンネル別に切り替えて1グループ折り畳み
      await userEvent.click(screen.getByRole('button', { name: /チャンネル/ }));
      const headers = screen.getAllByTestId('group-header');
      await userEvent.click(headers[0]);

      // 送信者別に切り替え
      await userEvent.click(screen.getByRole('button', { name: /送信者/ }));

      // すべてのグループが展開状態
      const newHeaders = screen.getAllByTestId('group-header');
      newHeaders.forEach((h) => {
        expect(h.closest('[data-testid="group-container"]')).toHaveAttribute(
          'data-collapsed',
          'false',
        );
      });
    });
  });

  describe('エッジケース', () => {
    it('全メッセージが同一チャンネルの場合、チャンネル別でグループが1つになる', async () => {
      const singleChannelResults = [
        makeResult({ id: 1, channelId: 10, channelName: 'general' }),
        makeResult({ id: 2, channelId: 10, channelName: 'general' }),
      ];
      render(<SearchResults results={singleChannelResults} onNavigate={vi.fn()} />);

      await userEvent.click(screen.getByRole('button', { name: /チャンネル/ }));

      expect(screen.getAllByTestId('group-header')).toHaveLength(1);
    });

    it('検索結果が 0 件のときグルーピング切替 UI は表示されない', () => {
      // 仕様確定（#344）: 0 件時は「見つかりませんでした」のみ表示し、
      // グルーピング切替ボタンは描画しない（ボタンを押す対象が無いため）。
      render(<SearchResults results={[]} onNavigate={vi.fn()} />);

      expect(screen.getByText('見つかりませんでした')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /フラット/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /チャンネル/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /送信者/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /日付/ })).not.toBeInTheDocument();
    });

    it('グルーピング状態が localStorage に保存されて次回も維持される', async () => {
      const { unmount } = render(
        <SearchResults results={multiChannelResults} onNavigate={vi.fn()} />,
      );
      await userEvent.click(screen.getByRole('button', { name: /送信者/ }));
      unmount();

      // 再マウント時に localStorage から状態が復元される
      render(<SearchResults results={multiChannelResults} onNavigate={vi.fn()} />);

      expect(screen.getByRole('button', { name: /送信者/ })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(screen.getByRole('button', { name: /フラット/ })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    });

    it('全メッセージが同一送信者の場合、送信者別でグループが1つになる', async () => {
      const singleSenderResults = [
        makeResult({ id: 1, userId: 1, username: 'alice' }),
        makeResult({ id: 2, userId: 1, username: 'alice' }),
      ];
      render(<SearchResults results={singleSenderResults} onNavigate={vi.fn()} />);

      await userEvent.click(screen.getByRole('button', { name: /送信者/ }));

      expect(screen.getAllByTestId('group-header')).toHaveLength(1);
    });

    it('全メッセージが同一日付の場合、日付別でグループが1つになる', async () => {
      // formatDateOnly はローカル時刻ベースで判定するため、JST(+09:00)・UTC のどちらでも
      // 同一日付になる時刻帯（UTC 朝〜昼）を選んで日付境界をまたがないようにする
      const sameDateResults = [
        makeResult({ id: 1, createdAt: '2024-01-15T01:00:00Z', username: 'alice' }),
        makeResult({ id: 2, createdAt: '2024-01-15T03:00:00Z', username: 'bob' }),
        makeResult({ id: 3, createdAt: '2024-01-15T05:00:00Z', username: 'carol' }),
      ];
      render(<SearchResults results={sameDateResults} onNavigate={vi.fn()} />);

      await userEvent.click(screen.getByRole('button', { name: /日付/ }));

      expect(screen.getAllByTestId('group-header')).toHaveLength(1);
    });
  });
});
