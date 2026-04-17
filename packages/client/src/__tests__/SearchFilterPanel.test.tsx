/**
 * SearchFilterPanel コンポーネントのユニットテスト
 *
 * テスト対象: 検索フィルタパネル（日付範囲・ユーザー絞り込み・添付ファイルフィルタ）
 * 戦略:
 *   - フィルタ値の変更時に onFilterChange コールバックが正しい値で呼ばれることを検証する
 *   - APIモックは vi.mock('../api/client') で差し替える
 *   - 「画面を見ればわかる」UI状態の確認は省略し、ロジック・コールバックを中心にテストする
 */

import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Suspense as ReactSuspense } from 'react';
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
  },
}));

type FilterChangeMock = ReturnType<typeof vi.fn> & ((filters: SearchFilters) => void);

async function renderPanel() {
  const onFilterChange = vi.fn() as FilterChangeMock;
  await act(async () => {
    render(
      <ReactSuspense fallback={<div>loading...</div>}>
        <SearchFilterPanel onFilterChange={onFilterChange} />
      </ReactSuspense>,
    );
  });
  return { onFilterChange };
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
        const lastCall = onFilterChange.mock.calls[onFilterChange.mock.calls.length - 1][0] as SearchFilters;
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
        expect(onFilterChange).toHaveBeenCalledWith(
          expect.objectContaining({ userId: 1 }),
        );
      });
    });

    it('選択をクリアすると onFilterChange の userId が undefined になる', async () => {
      const { onFilterChange } = await renderPanel();
      const select = screen.getByLabelText(/送信者/);
      await userEvent.selectOptions(select, '1');
      await userEvent.selectOptions(select, '');
      await waitFor(() => {
        const lastCall = onFilterChange.mock.calls[onFilterChange.mock.calls.length - 1][0] as SearchFilters;
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
        const lastCall = onFilterChange.mock.calls[onFilterChange.mock.calls.length - 1][0] as SearchFilters;
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
        const lastCall = onFilterChange.mock.calls[onFilterChange.mock.calls.length - 1][0] as SearchFilters;
        expect(lastCall.dateFrom).toBeUndefined();
        expect(lastCall.dateTo).toBeUndefined();
        expect(lastCall.userId).toBeUndefined();
        expect(lastCall.hasAttachment).toBeUndefined();
      });
    });
  });
});
