/**
 * SearchFilterPanel コンポーネントのユニットテスト
 *
 * テスト対象: 検索フィルタパネル（日付範囲・ユーザー絞り込み・添付ファイルフィルタ・タグ絞り込み）
 * 戦略:
 *   - フィルタ値の変更時に onFilterChange コールバックが正しい値で呼ばれることを検証する
 *   - APIモックは vi.mock('../api/client') で差し替える
 *   - useTagSuggestions フックはモック化して即時に suggestions を返す（デバウンス排除）
 *   - 「画面を見ればわかる」UI状態の確認は省略し、ロジック・コールバックを中心にテストする
 */

import { render, screen, waitFor, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Suspense as ReactSuspense } from 'react';
import type { MessageSearchResult, TagSuggestion } from '@chat-app/shared';
import type { SearchFilters } from '../components/Chat/SearchFilterPanel';
import SearchFilterPanel from '../components/Chat/SearchFilterPanel';

vi.mock('../api/client', () => ({
  api: {
    auth: {
      users: vi.fn().mockResolvedValue({
        users: [
          { id: 1, username: 'alice', email: 'a@t.com', avatarUrl: null },
          { id: 2, username: 'bob', email: 'b@t.com', avatarUrl: null },
        ],
      }),
    },
    tags: {
      suggestions: vi.fn().mockResolvedValue({
        suggestions: [
          { id: 10, name: 'bug', useCount: 5 },
          { id: 11, name: 'urgent', useCount: 3 },
          { id: 12, name: 'backend', useCount: 2 },
        ],
      }),
    },
  },
}));

// useTagSuggestions: prefix に依らず常に固定候補を返すモック
const SUGGESTIONS_FIXTURE: TagSuggestion[] = [
  { id: 10, name: 'bug', useCount: 5 },
  { id: 11, name: 'urgent', useCount: 3 },
  { id: 12, name: 'backend', useCount: 2 },
];
vi.mock('../hooks/useTagSuggestions', () => ({
  useTagSuggestions: () => SUGGESTIONS_FIXTURE,
}));

type FilterChangeMock = ReturnType<typeof vi.fn> & ((filters: SearchFilters) => void);

async function renderPanel(searchResults?: MessageSearchResult[]) {
  const onFilterChange = vi.fn() as FilterChangeMock;
  await act(async () => {
    render(
      <ReactSuspense fallback={<div>loading...</div>}>
        <SearchFilterPanel onFilterChange={onFilterChange} searchResults={searchResults} />
      </ReactSuspense>,
    );
  });
  return { onFilterChange };
}

/**
 * MessageSearchResult のミニマル fixture を作るヘルパー（タグ件数集計テスト用）。
 * 必須プロパティはダミー値で埋め、関心のある tags のみ指定可能にする。
 */
function makeResult(id: number, tagIds: number[]): MessageSearchResult {
  return {
    id,
    channelId: 1,
    userId: 1,
    username: 'u',
    avatarUrl: null,
    content: '',
    isEdited: false,
    isDeleted: false,
    createdAt: '',
    updatedAt: '',
    mentions: [],
    reactions: [],
    parentMessageId: null,
    rootMessageId: null,
    replyCount: 0,
    quotedMessageId: null,
    quotedMessage: null,
    tags: tagIds.map((tid) => ({
      id: tid,
      name: `t${tid}`,
      useCount: 0,
      createdAt: '',
    })),
    channelName: 'general',
    rootMessageContent: null,
  };
}

/**
 * Autocomplete を開いてオプションをクリックするヘルパー。
 * - 入力欄にフォーカスして 1 文字入力 → 候補リストが開く
 * - listbox 内から指定 name のオプションをクリック
 */
async function selectTagOption(tagName: string) {
  const input = screen.getByTestId('tag-filter-input') as HTMLInputElement;
  await userEvent.click(input);
  // 何か入力して候補リストを開く（filterOptions=識別関数なので prefix の中身は無関係）
  await userEvent.type(input, tagName[0]);
  const listbox = await screen.findByRole('listbox');
  const option = within(listbox).getByText(`#${tagName}`);
  await userEvent.click(option);
}

describe('SearchFilterPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('日付範囲入力', () => {
    it('開始日を入力すると onFilterChange に dateFrom が渡される', async () => {
      const { onFilterChange } = await renderPanel();
      const input = screen.getByLabelText(/開始日/);
      await userEvent.type(input, '2024-01-01');
      await waitFor(() => {
        expect(onFilterChange).toHaveBeenCalledWith(
          expect.objectContaining({ dateFrom: '2024-01-01' }),
        );
      });
    });

    it('終了日を入力すると onFilterChange に dateTo が渡される', async () => {
      const { onFilterChange } = await renderPanel();
      const input = screen.getByLabelText(/終了日/);
      await userEvent.type(input, '2024-12-31');
      await waitFor(() => {
        expect(onFilterChange).toHaveBeenCalledWith(
          expect.objectContaining({ dateTo: '2024-12-31' }),
        );
      });
    });

    it('開始日 > 終了日のときバリデーションエラーメッセージが表示される', async () => {
      await renderPanel();
      const fromInput = screen.getByLabelText(/開始日/);
      const toInput = screen.getByLabelText(/終了日/);
      await userEvent.type(fromInput, '2024-12-31');
      await userEvent.type(toInput, '2024-01-01');
      await waitFor(() => {
        expect(screen.getByText(/開始日は終了日より前/)).toBeInTheDocument();
      });
    });

    it('日付をクリアすると onFilterChange の dateFrom/dateTo が undefined になる', async () => {
      const { onFilterChange } = await renderPanel();
      const fromInput = screen.getByLabelText(/開始日/);
      await userEvent.type(fromInput, '2024-01-01');
      await userEvent.clear(fromInput);
      await waitFor(() => {
        const lastCall = onFilterChange.mock.calls[
          onFilterChange.mock.calls.length - 1
        ][0] as SearchFilters;
        expect(lastCall.dateFrom).toBeUndefined();
      });
    });
  });

  describe('ユーザー絞り込み', () => {
    it('ユーザーを選択すると onFilterChange に userId が渡される', async () => {
      const { onFilterChange } = await renderPanel();
      const select = screen.getByLabelText(/送信者/);
      await userEvent.selectOptions(select, '1');
      await waitFor(() => {
        expect(onFilterChange).toHaveBeenCalledWith(expect.objectContaining({ userId: 1 }));
      });
    });

    it('選択をクリアすると onFilterChange の userId が undefined になる', async () => {
      const { onFilterChange } = await renderPanel();
      const select = screen.getByLabelText(/送信者/);
      await userEvent.selectOptions(select, '1');
      await userEvent.selectOptions(select, '');
      await waitFor(() => {
        const lastCall = onFilterChange.mock.calls[
          onFilterChange.mock.calls.length - 1
        ][0] as SearchFilters;
        expect(lastCall.userId).toBeUndefined();
      });
    });
  });

  describe('添付ファイルフィルタ', () => {
    it('「添付ファイルあり」を選択すると onFilterChange に hasAttachment=true が渡される', async () => {
      const { onFilterChange } = await renderPanel();
      const select = screen.getByLabelText(/添付ファイル/);
      await userEvent.selectOptions(select, 'true');
      await waitFor(() => {
        expect(onFilterChange).toHaveBeenCalledWith(
          expect.objectContaining({ hasAttachment: true }),
        );
      });
    });

    it('「添付ファイルなし」を選択すると onFilterChange に hasAttachment=false が渡される', async () => {
      const { onFilterChange } = await renderPanel();
      const select = screen.getByLabelText(/添付ファイル/);
      await userEvent.selectOptions(select, 'false');
      await waitFor(() => {
        expect(onFilterChange).toHaveBeenCalledWith(
          expect.objectContaining({ hasAttachment: false }),
        );
      });
    });

    it('「すべて」を選択すると onFilterChange の hasAttachment が undefined になる', async () => {
      const { onFilterChange } = await renderPanel();
      const select = screen.getByLabelText(/添付ファイル/);
      await userEvent.selectOptions(select, 'true');
      await userEvent.selectOptions(select, '');
      await waitFor(() => {
        const lastCall = onFilterChange.mock.calls[
          onFilterChange.mock.calls.length - 1
        ][0] as SearchFilters;
        expect(lastCall.hasAttachment).toBeUndefined();
      });
    });
  });

  describe('フィルタリセット', () => {
    it('リセットボタンを押すとすべてのフィルタ値がクリアされ onFilterChange が空オブジェクトで呼ばれる', async () => {
      const { onFilterChange } = await renderPanel();
      const select = screen.getByLabelText(/添付ファイル/);
      await userEvent.selectOptions(select, 'true');

      const resetBtn = screen.getByRole('button', { name: /リセット/ });
      await userEvent.click(resetBtn);

      await waitFor(() => {
        const lastCall = onFilterChange.mock.calls[
          onFilterChange.mock.calls.length - 1
        ][0] as SearchFilters;
        expect(lastCall.dateFrom).toBeUndefined();
        expect(lastCall.dateTo).toBeUndefined();
        expect(lastCall.userId).toBeUndefined();
        expect(lastCall.hasAttachment).toBeUndefined();
      });
    });
  });

  // #115 タグ機能 — タグフィルタ (Autocomplete 化)
  describe('タグフィルタ (#115 / Autocomplete)', () => {
    it('Autocomplete でタグ候補から選択すると onFilterChange に tagIds が渡される', async () => {
      const { onFilterChange } = await renderPanel();
      await selectTagOption('bug');

      await waitFor(() => {
        expect(onFilterChange).toHaveBeenCalledWith(expect.objectContaining({ tagIds: [10] }));
      });
    });

    it('既存タグからのみ選択でき、自由入力（新規作成）は許可されない', async () => {
      const { onFilterChange } = await renderPanel();
      const input = screen.getByTestId('tag-filter-input') as HTMLInputElement;
      await userEvent.click(input);
      // 候補に存在しない名前を打って Enter — Autocomplete は freeSolo=false なので新規追加されない
      await userEvent.type(input, 'nosuchtag{Enter}');

      // tagIds を含むコールが一切無いことを検証
      const tagCalls = onFilterChange.mock.calls.filter(
        (c) => (c[0] as SearchFilters).tagIds !== undefined,
      );
      expect(tagCalls).toHaveLength(0);
    });

    it('選択済みタグの×ボタンでタグを除去すると onFilterChange の tagIds から該当 ID が除かれる', async () => {
      const { onFilterChange } = await renderPanel();
      await selectTagOption('bug');
      await waitFor(() => {
        expect(onFilterChange).toHaveBeenCalledWith(expect.objectContaining({ tagIds: [10] }));
      });

      // MUI Autocomplete の選択済み chip の削除ボタン (aria-label 含む 'Remove' or aria-label が無い場合は CancelIcon)
      // MUI 5/6 では Chip の deleteIcon は data-testid="CancelIcon" として描画される
      const cancelIcon = document.querySelector('[data-testid="CancelIcon"]');
      expect(cancelIcon).not.toBeNull();
      await userEvent.click(cancelIcon as Element);

      await waitFor(() => {
        const lastCall = onFilterChange.mock.calls[
          onFilterChange.mock.calls.length - 1
        ][0] as SearchFilters;
        expect(lastCall.tagIds).toBeUndefined();
      });
    });

    it('複数タグを選択すると tagIds が配列として複数 ID を含む (AND 条件)', async () => {
      const { onFilterChange } = await renderPanel();

      await selectTagOption('bug');
      await waitFor(() => {
        expect(onFilterChange).toHaveBeenCalledWith(expect.objectContaining({ tagIds: [10] }));
      });

      await selectTagOption('urgent');
      await waitFor(() => {
        expect(onFilterChange).toHaveBeenCalledWith(
          expect.objectContaining({ tagIds: expect.arrayContaining([10, 11]) }),
        );
      });
    });

    it('リセットボタンを押すと選択済みタグもクリアされ tagIds が undefined になる', async () => {
      const { onFilterChange } = await renderPanel();
      await selectTagOption('bug');
      await waitFor(() => {
        expect(onFilterChange).toHaveBeenCalledWith(expect.objectContaining({ tagIds: [10] }));
      });

      const resetBtn = screen.getByRole('button', { name: /リセット/ });
      await userEvent.click(resetBtn);

      await waitFor(() => {
        const lastCall = onFilterChange.mock.calls[
          onFilterChange.mock.calls.length - 1
        ][0] as SearchFilters;
        expect(lastCall.tagIds).toBeUndefined();
      });
    });
  });

  // 現在の検索結果に対するタグ件数表示
  describe('Autocomplete 候補のタグ件数表示 (現クエリ内集計)', () => {
    it('searchResults が渡されたとき、各タグ候補の右側に「現在の検索結果でそのタグが付いている件数」が表示される', async () => {
      // bug が 2 件、urgent が 1 件、backend は 0 件のメッセージで使われている検索結果
      const results = [
        makeResult(1, [10, 11]), // bug + urgent
        makeResult(2, [10]), // bug のみ
      ];
      await renderPanel(results);

      const input = screen.getByTestId('tag-filter-input') as HTMLInputElement;
      await userEvent.click(input);
      await userEvent.type(input, 'b');

      const listbox = await screen.findByRole('listbox');
      // bug 候補の周辺に "2 件" が表示されること
      const bugOption = within(listbox).getByText('#bug').closest('li')!;
      expect(within(bugOption as HTMLElement).getByText(/2\s*件/)).toBeInTheDocument();
      // urgent は 1 件
      const urgentOption = within(listbox).getByText('#urgent').closest('li')!;
      expect(within(urgentOption as HTMLElement).getByText(/1\s*件/)).toBeInTheDocument();
      // backend は検索結果に存在しない（0 件） — "0 件" でも "—" でも非表示でも許容
      // 少なくとも全体使用回数の "2 件" がそのまま漏れていないこと（backend.useCount=2 だが現クエリでは 0）
      const backendOption = within(listbox).getByText('#backend').closest('li')!;
      const backendText = (backendOption as HTMLElement).textContent ?? '';
      expect(backendText).not.toMatch(/(^|[^0-9])2\s*件/);
    });

    it('searchResults が空（または未指定）のとき、件数欄にはダッシュ "—" を表示する', async () => {
      await renderPanel([]);

      const input = screen.getByTestId('tag-filter-input') as HTMLInputElement;
      await userEvent.click(input);
      await userEvent.type(input, 'b');

      const listbox = await screen.findByRole('listbox');
      const bugOption = within(listbox).getByText('#bug').closest('li')!;
      // ダッシュが表示される（U+2014 EM DASH）
      expect(within(bugOption as HTMLElement).getByText('—')).toBeInTheDocument();
      // 全体 useCount の "5 件" 表示にフォールバックしていないこと
      expect(within(bugOption as HTMLElement).queryByText(/5\s*件/)).toBeNull();
    });
  });
});
