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

async function renderPanel(
  searchResults?: MessageSearchResult[],
  onSaveView?: ReturnType<typeof vi.fn>,
  initialFilters?: SearchFilters,
) {
  const onFilterChange = vi.fn() as FilterChangeMock;
  await act(async () => {
    render(
      <ReactSuspense fallback={<div>loading...</div>}>
        <SearchFilterPanel
          onFilterChange={onFilterChange}
          searchResults={searchResults}
          filters={initialFilters}
          onSaveView={
            onSaveView as ((params: { name: string; filters: SearchFilters }) => void) | undefined
          }
        />
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

  // #150 保存ビュー — 「現在の条件を保存」ボタン
  describe('保存ビューへの保存 (#150)', () => {
    it('フィルタ条件が 1 つ以上設定されているとき「保存」ボタンが有効になる', async () => {
      const onSaveView = vi.fn();
      const { onFilterChange } = await renderPanel(undefined, onSaveView);

      // 開始日を設定するとフィルタ条件が1つ以上になる
      const dateFromInput = screen.getByLabelText(/開始日/);
      await userEvent.type(dateFromInput, '2024-01-01');
      onFilterChange({ dateFrom: '2024-01-01' });

      // 保存ボタンが有効になる（disabled でない）
      const saveBtn = await screen.findByRole('button', { name: /保存/ });
      expect(saveBtn).not.toBeDisabled();
    });

    it('フィルタ条件が何も設定されていないとき「保存」ボタンは無効（disabled）', async () => {
      const onSaveView = vi.fn();
      await renderPanel(undefined, onSaveView);

      const saveBtn = await screen.findByRole('button', { name: /保存/ });
      expect(saveBtn).toBeDisabled();
    });

    it('「保存」ボタンをクリックすると名前入力ダイアログが開く', async () => {
      const onSaveView = vi.fn();
      const { onFilterChange } = await renderPanel(undefined, onSaveView);

      // フィルタ条件を設定
      const select = screen.getByLabelText(/添付ファイル/);
      await userEvent.selectOptions(select, 'true');
      onFilterChange({ hasAttachment: true });

      const saveBtn = await screen.findByRole('button', { name: /保存/ });
      await userEvent.click(saveBtn);

      // ダイアログが開く
      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /ビュー名/ })).toBeInTheDocument();
    });

    it('名前を入力して確定すると onSaveView コールバックが { name, filters } で呼ばれる', async () => {
      const onSaveView = vi.fn();
      await renderPanel(undefined, onSaveView);

      // 添付ありフィルタを設定
      const select = screen.getByLabelText(/添付ファイル/);
      await userEvent.selectOptions(select, 'true');

      const saveBtn = await screen.findByRole('button', { name: /保存/ });
      await userEvent.click(saveBtn);

      const nameInput = screen.getByRole('textbox', { name: /ビュー名/ });
      await userEvent.type(nameInput, '添付あり検索');

      const confirmBtn = screen.getByRole('button', { name: /確定|保存/ });
      await userEvent.click(confirmBtn);

      await waitFor(() => {
        expect(onSaveView).toHaveBeenCalledWith(
          expect.objectContaining({
            name: '添付あり検索',
            filters: expect.objectContaining({ hasAttachment: true }),
          }),
        );
      });
    });

    it('名前入力ダイアログをキャンセルすると onSaveView は呼ばれない', async () => {
      const onSaveView = vi.fn();
      await renderPanel(undefined, onSaveView);

      const select = screen.getByLabelText(/添付ファイル/);
      await userEvent.selectOptions(select, 'true');

      const saveBtn = await screen.findByRole('button', { name: /保存/ });
      await userEvent.click(saveBtn);

      const cancelBtn = screen.getByRole('button', { name: /キャンセル/ });
      await userEvent.click(cancelBtn);

      expect(onSaveView).not.toHaveBeenCalled();
    });
  });

  // #166 保存ビュークリック時の結線 — 外部 filters props が UI に反映される
  describe('外部 filters props による初期値反映 (#166)', () => {
    it('dateFrom を含む filters を渡すと開始日入力欄に値が反映される', async () => {
      await renderPanel(undefined, undefined, { dateFrom: '2024-03-01' });
      const input = screen.getByLabelText(/開始日/) as HTMLInputElement;
      expect(input.value).toBe('2024-03-01');
    });

    it('dateTo を含む filters を渡すと終了日入力欄に値が反映される', async () => {
      await renderPanel(undefined, undefined, { dateTo: '2024-03-31' });
      const input = screen.getByLabelText(/終了日/) as HTMLInputElement;
      expect(input.value).toBe('2024-03-31');
    });

    it('userId を含む filters を渡すと送信者 Select に値が反映される', async () => {
      await renderPanel(undefined, undefined, { userId: 2 });
      const select = screen.getByLabelText(/送信者/) as HTMLSelectElement;
      expect(select.value).toBe('2');
    });

    it('hasAttachment=true を含む filters を渡すと添付ファイル Select に値が反映される', async () => {
      await renderPanel(undefined, undefined, { hasAttachment: true });
      const select = screen.getByLabelText(/添付ファイル/) as HTMLSelectElement;
      expect(select.value).toBe('true');
    });

    it('hasAttachment=false を含む filters を渡すと添付ファイル Select に値が反映される', async () => {
      await renderPanel(undefined, undefined, { hasAttachment: false });
      const select = screen.getByLabelText(/添付ファイル/) as HTMLSelectElement;
      expect(select.value).toBe('false');
    });

    it('tagIds を含む filters を渡すと対応するタグが選択済み状態で表示される', async () => {
      await renderPanel(undefined, undefined, { tagIds: [10, 11] });
      // 選択済みチップとして bug と urgent が表示される
      await waitFor(() => {
        expect(screen.getByText('bug')).toBeInTheDocument();
        expect(screen.getByText('urgent')).toBeInTheDocument();
      });
    });

    it('filters を渡さない場合は各入力欄が空の初期状態になる', async () => {
      await renderPanel();
      const fromInput = screen.getByLabelText(/開始日/) as HTMLInputElement;
      const toInput = screen.getByLabelText(/終了日/) as HTMLInputElement;
      const senderSelect = screen.getByLabelText(/送信者/) as HTMLSelectElement;
      const attachSelect = screen.getByLabelText(/添付ファイル/) as HTMLSelectElement;
      expect(fromInput.value).toBe('');
      expect(toInput.value).toBe('');
      expect(senderSelect.value).toBe('');
      expect(attachSelect.value).toBe('');
    });
  });
});
