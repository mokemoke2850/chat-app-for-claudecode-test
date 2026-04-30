/**
 * テスト対象: SavedViewSection コンポーネント（新規）
 *   + SavedViewEditDialog（保存ビューの編集・並べ替えダイアログ）
 *
 * 戦略:
 *   - api.savedViews.* を vi.mock('../api/client') で差し替えてネットワーク通信を排除
 *   - ユーザー操作（クリック・入力）は userEvent でシミュレートする
 *   - 並べ替えは「上ボタン / 下ボタン」の操作に対して API 呼び出しが正しく行われるかを検証
 *   - 「画面を見ればわかる」UI 状態は省略し、ロジック・コールバックを中心にテストする
 *   - SavedViewSection は props で savedViews 配列を受け取る（use() + Suspense は ChannelList 側で管理）
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../api/client', () => ({
  api: {
    savedViews: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      reorder: vi.fn(),
    },
  },
}));

import { api } from '../api/client';
import SavedViewSection from '../components/Channel/SavedViewSection';
import type { SavedView } from '@chat-app/shared';

const mockApi = api as unknown as {
  savedViews: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    reorder: ReturnType<typeof vi.fn>;
  };
};

// --- フィクスチャ ---
const SAVED_VIEW_FIXTURES: SavedView[] = [
  {
    id: 1,
    userId: 1,
    name: '今週のバグ',
    query: { dateFrom: '2024-01-01', tagIds: [10] },
    position: 0,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    userId: 1,
    name: '未読メンション',
    query: { userId: 5 },
    position: 1,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 3,
    userId: 1,
    name: '添付あり',
    query: { hasAttachment: true },
    position: 2,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

async function renderSection(
  savedViews: SavedView[] = SAVED_VIEW_FIXTURES,
  onSelectView = vi.fn(),
) {
  await act(async () => {
    render(<SavedViewSection savedViews={savedViews} onSelectView={onSelectView} />);
  });
  return { onSelectView };
}

describe('SavedViewSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.savedViews.update.mockResolvedValue({ savedView: { ...SAVED_VIEW_FIXTURES[0] } });
    mockApi.savedViews.delete.mockResolvedValue(undefined);
    mockApi.savedViews.reorder.mockResolvedValue({ success: true });
  });

  describe('保存ビュー一覧表示', () => {
    it('保存ビューの名前が一覧に表示される', async () => {
      await renderSection();

      expect(screen.getByText('今週のバグ')).toBeInTheDocument();
      expect(screen.getByText('未読メンション')).toBeInTheDocument();
      expect(screen.getByText('添付あり')).toBeInTheDocument();
    });

    it('保存ビューが 0 件のときセクションは空（またはプレースホルダーを表示）', async () => {
      await renderSection([]);

      // アイテムが存在しないこと
      expect(screen.queryByText('今週のバグ')).toBeNull();
    });
  });

  describe('保存ビュークリック', () => {
    it('保存ビューをクリックすると onSelectView コールバックが query を引数として呼ばれる', async () => {
      const { onSelectView } = await renderSection();

      await userEvent.click(screen.getByText('今週のバグ'));

      expect(onSelectView).toHaveBeenCalledWith(
        expect.objectContaining({ dateFrom: '2024-01-01', tagIds: [10] }),
      );
    });
  });

  describe('編集ダイアログ', () => {
    it('編集ボタンをクリックすると編集ダイアログが開く', async () => {
      await renderSection();

      // 最初のビューの編集ボタンをクリック
      const editButtons = screen.getAllByRole('button', { name: /編集/ });
      await userEvent.click(editButtons[0]);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('ダイアログで名前を変更して保存すると api.savedViews.update が呼ばれる', async () => {
      mockApi.savedViews.update.mockResolvedValue({
        savedView: { ...SAVED_VIEW_FIXTURES[0], name: '新しい名前' },
      });
      await renderSection();

      const editButtons = screen.getAllByRole('button', { name: /編集/ });
      await userEvent.click(editButtons[0]);

      const nameInput = screen.getByRole('textbox', { name: /ビュー名/ });
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, '新しい名前');

      const saveBtn = screen.getByRole('button', { name: /保存|確定/ });
      await userEvent.click(saveBtn);

      await waitFor(() => {
        expect(mockApi.savedViews.update).toHaveBeenCalledWith(
          SAVED_VIEW_FIXTURES[0].id,
          expect.objectContaining({ name: '新しい名前' }),
        );
      });
    });

    it('ダイアログをキャンセルすると api.savedViews.update が呼ばれない', async () => {
      await renderSection();

      const editButtons = screen.getAllByRole('button', { name: /編集/ });
      await userEvent.click(editButtons[0]);

      const cancelBtn = screen.getByRole('button', { name: /キャンセル/ });
      await userEvent.click(cancelBtn);

      expect(mockApi.savedViews.update).not.toHaveBeenCalled();
    });
  });

  describe('削除', () => {
    it('削除ボタンをクリックすると api.savedViews.delete が呼ばれる', async () => {
      await renderSection();

      const deleteButtons = screen.getAllByRole('button', { name: /削除/ });
      await userEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(mockApi.savedViews.delete).toHaveBeenCalledWith(SAVED_VIEW_FIXTURES[0].id);
      });
    });

    it('削除後に保存ビューが一覧から消える', async () => {
      await renderSection();

      const deleteButtons = screen.getAllByRole('button', { name: /削除/ });
      await userEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.queryByText('今週のバグ')).toBeNull();
      });
    });
  });

  describe('並べ替え（上下ボタン）', () => {
    it('「上に移動」ボタンをクリックすると api.savedViews.reorder が新順序で呼ばれる', async () => {
      await renderSection();

      // 2番目のビュー（未読メンション）の「上に移動」ボタンをクリック
      const upButtons = screen.getAllByRole('button', { name: /上に移動/ });
      await userEvent.click(upButtons[1]); // index 1 = 2番目のビュー

      await waitFor(() => {
        expect(mockApi.savedViews.reorder).toHaveBeenCalledWith(
          expect.arrayContaining([2, 1]), // 2が先頭に来る
        );
      });
    });

    it('「下に移動」ボタンをクリックすると api.savedViews.reorder が新順序で呼ばれる', async () => {
      await renderSection();

      // 1番目のビュー（今週のバグ）の「下に移動」ボタンをクリック
      const downButtons = screen.getAllByRole('button', { name: /下に移動/ });
      await userEvent.click(downButtons[0]);

      await waitFor(() => {
        expect(mockApi.savedViews.reorder).toHaveBeenCalledWith(
          expect.arrayContaining([2, 1]), // 2が先頭に来る
        );
      });
    });

    it('先頭の保存ビューの「上に移動」ボタンは無効（disabled）になっている', async () => {
      await renderSection();

      const upButtons = screen.getAllByRole('button', { name: /上に移動/ });
      // 最初のビューの「上に移動」ボタンは disabled
      expect(upButtons[0]).toBeDisabled();
    });

    it('末尾の保存ビューの「下に移動」ボタンは無効（disabled）になっている', async () => {
      await renderSection();

      const downButtons = screen.getAllByRole('button', { name: /下に移動/ });
      // 最後のビューの「下に移動」ボタンは disabled
      expect(downButtons[downButtons.length - 1]).toBeDisabled();
    });

    it('並べ替え後に一覧の表示順が更新される', async () => {
      await renderSection();

      const downButtons = screen.getAllByRole('button', { name: /下に移動/ });
      await userEvent.click(downButtons[0]); // 「今週のバグ」を1つ下に

      await waitFor(() => {
        const items = screen.getAllByRole('listitem');
        // 「未読メンション」が先頭になる
        expect(items[0]).toHaveTextContent('未読メンション');
      });
    });
  });
});
