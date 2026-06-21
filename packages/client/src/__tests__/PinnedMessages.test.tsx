/**
 * テスト対象: components/Channel/PinnedMessages.tsx のカテゴリ分類機能
 * テスト戦略: API をモックし、カテゴリタブによる絞り込み、未分類、後付け変更、
 * 任意カテゴリ追加という複数状態をまたぐ振る舞いを検証する。
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PinnedMessages from '../components/Channel/PinnedMessages';
import { makeMessage } from './__fixtures__/messages';

const mockList = vi.fn();
const mockListCategories = vi.fn();
const mockUpdateCategory = vi.fn();
const mockCreateCategory = vi.fn();
const mockShowError = vi.fn();

vi.mock('../api/client', () => ({
  api: {
    pins: {
      list: (channelId: number) => mockList(channelId),
      listCategories: (channelId: number) => mockListCategories(channelId),
      updateCategory: (channelId: number, messageId: number, categoryId: number | null) =>
        mockUpdateCategory(channelId, messageId, categoryId),
      createCategory: (channelId: number, name: string) => mockCreateCategory(channelId, name),
    },
  },
}));

vi.mock('../contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showError: mockShowError }),
}));

const categories = [
  { id: 1, channelId: 1, name: '決定事項', isDefault: true, position: 0 },
  { id: 2, channelId: 1, name: 'FAQ', isDefault: true, position: 1 },
  { id: 3, channelId: 1, name: '重要', isDefault: false, position: 2 },
];

const pins = [
  {
    id: 1,
    messageId: 1,
    channelId: 1,
    pinnedBy: 1,
    pinnedAt: '2024-01-01',
    categoryId: 1,
    category: categories[0],
    message: makeMessage({ id: 1, content: '決定メッセージ' }),
  },
  {
    id: 2,
    messageId: 2,
    channelId: 1,
    pinnedBy: 1,
    pinnedAt: '2024-01-02',
    categoryId: null,
    category: null,
    message: makeMessage({ id: 2, content: '未分類メッセージ' }),
  },
];

function renderSubject() {
  return render(<PinnedMessages channelId={1} currentUserId={1} onUnpin={vi.fn()} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockList.mockResolvedValue({ pinnedMessages: pins });
  mockListCategories.mockResolvedValue({ categories });
  mockUpdateCategory.mockResolvedValue({ pinnedMessage: pins[0] });
  mockCreateCategory.mockResolvedValue({
    category: { id: 4, channelId: 1, name: '新規', isDefault: false, position: 3 },
  });
});

describe('PinnedMessages', () => {
  it('チャンネル切替後に旧チャンネルの応答が返っても新チャンネルの表示を上書きしない', async () => {
    let resolveOldPins!: (value: { pinnedMessages: typeof pins }) => void;
    let resolveOldCategories!: (value: { categories: typeof categories }) => void;
    mockList.mockImplementation((channelId: number) =>
      channelId === 1
        ? new Promise((resolve) => {
            resolveOldPins = resolve;
          })
        : Promise.resolve({
            pinnedMessages: [
              {
                ...pins[0],
                id: 20,
                messageId: 20,
                channelId: 2,
                message: makeMessage({ id: 20, content: '新チャンネル' }),
              },
            ],
          }),
    );
    mockListCategories.mockImplementation((channelId: number) =>
      channelId === 1
        ? new Promise((resolve) => {
            resolveOldCategories = resolve;
          })
        : Promise.resolve({ categories: [] }),
    );
    const { rerender } = renderSubject();
    rerender(<PinnedMessages channelId={2} currentUserId={1} onUnpin={vi.fn()} />);
    expect(await screen.findByText('新チャンネル')).toBeInTheDocument();
    resolveOldPins({ pinnedMessages: pins });
    resolveOldCategories({ categories });
    await Promise.resolve();
    expect(screen.getByText('新チャンネル')).toBeInTheDocument();
    expect(screen.queryByText('決定メッセージ')).not.toBeInTheDocument();
  });

  it('チャンネル切替時に選択タブと開いているダイアログを初期化する', async () => {
    const { rerender } = renderSubject();
    await userEvent.click(await screen.findByRole('tab', { name: '決定事項' }));
    const row = screen.getByText('決定メッセージ').closest('[data-pin-id]') as HTMLElement;
    await userEvent.click(within(row).getByRole('button', { name: 'カテゴリを変更' }));
    rerender(<PinnedMessages channelId={2} currentUserId={1} onUnpin={vi.fn()} />);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('tab', { name: 'すべて' })).toHaveAttribute('aria-selected', 'true');
  });

  describe('カテゴリタブによる絞り込み', () => {
    it('すべて・未分類・デフォルトカテゴリ・任意カテゴリのタブを表示する', async () => {
      renderSubject();
      for (const name of ['すべて', '未分類', '決定事項', 'FAQ', '重要']) {
        expect(await screen.findByRole('tab', { name })).toBeInTheDocument();
      }
    });

    it('すべてタブでは分類済みと未分類の両方のピンを表示する', async () => {
      renderSubject();
      expect(await screen.findByText('決定メッセージ')).toBeInTheDocument();
      expect(screen.getByText('未分類メッセージ')).toBeInTheDocument();
    });

    it('カテゴリタブを選ぶと該当カテゴリのピンだけを表示する', async () => {
      renderSubject();
      await userEvent.click(await screen.findByRole('tab', { name: '決定事項' }));
      expect(screen.getByText('決定メッセージ')).toBeInTheDocument();
      expect(screen.queryByText('未分類メッセージ')).not.toBeInTheDocument();
    });

    it('未分類タブを選ぶとカテゴリ未設定のピンだけを表示する', async () => {
      renderSubject();
      await userEvent.click(await screen.findByRole('tab', { name: '未分類' }));
      expect(screen.getByText('未分類メッセージ')).toBeInTheDocument();
      expect(screen.queryByText('決定メッセージ')).not.toBeInTheDocument();
    });

    it('該当するピンがないカテゴリでは空状態を表示する', async () => {
      renderSubject();
      await userEvent.click(await screen.findByRole('tab', { name: 'FAQ' }));
      expect(screen.getByText('このカテゴリにピンはありません')).toBeInTheDocument();
    });
  });

  describe('ピン留め後のカテゴリ変更', () => {
    it('ピンのカテゴリ変更を確定するとAPIを呼び表示を再取得する', async () => {
      renderSubject();
      const row = (await screen.findByText('決定メッセージ')).closest(
        '[data-pin-id]',
      ) as HTMLElement;
      await userEvent.click(within(row).getByRole('button', { name: 'カテゴリを変更' }));
      await userEvent.click(screen.getByRole('radio', { name: 'FAQ' }));
      await userEvent.click(screen.getByRole('button', { name: '変更する' }));
      await waitFor(() => expect(mockUpdateCategory).toHaveBeenCalledWith(1, 1, 2));
      expect(mockList).toHaveBeenCalledTimes(2);
    });

    it('カテゴリ変更中にチャンネルを切り替えると旧チャンネルの完了後に再読込しない', async () => {
      let resolveUpdate!: (value: { pinnedMessage: (typeof pins)[number] }) => void;
      mockUpdateCategory.mockImplementationOnce(
        () => new Promise((resolve) => {
          resolveUpdate = resolve;
        }),
      );
      const { rerender } = renderSubject();
      const row = (await screen.findByText('決定メッセージ')).closest(
        '[data-pin-id]',
      ) as HTMLElement;
      await userEvent.click(within(row).getByRole('button', { name: 'カテゴリを変更' }));
      await userEvent.click(screen.getByRole('button', { name: '変更する' }));
      await waitFor(() => expect(mockUpdateCategory).toHaveBeenCalled());
      rerender(<PinnedMessages channelId={2} currentUserId={1} onUnpin={vi.fn()} />);
      await waitFor(() => expect(mockList).toHaveBeenCalledWith(2));
      resolveUpdate({ pinnedMessage: pins[0] });
      await Promise.resolve();
      expect(mockList).toHaveBeenCalledTimes(2);
    });

    it('カテゴリを未分類へ変更できる', async () => {
      renderSubject();
      const row = (await screen.findByText('決定メッセージ')).closest(
        '[data-pin-id]',
      ) as HTMLElement;
      await userEvent.click(within(row).getByRole('button', { name: 'カテゴリを変更' }));
      await userEvent.click(screen.getByRole('radio', { name: '未分類' }));
      await userEvent.click(screen.getByRole('button', { name: '変更する' }));
      expect(mockUpdateCategory).toHaveBeenCalledWith(1, 1, null);
    });

    it('カテゴリ変更APIが失敗した場合は元カテゴリ・選択タブ・一覧を維持する', async () => {
      mockUpdateCategory.mockRejectedValueOnce(new Error('failed'));
      renderSubject();
      await userEvent.click(await screen.findByRole('tab', { name: '決定事項' }));
      const row = screen.getByText('決定メッセージ').closest('[data-pin-id]') as HTMLElement;
      await userEvent.click(within(row).getByRole('button', { name: 'カテゴリを変更' }));
      await userEvent.click(screen.getByRole('radio', { name: 'FAQ' }));
      await userEvent.click(screen.getByRole('button', { name: '変更する' }));
      await waitFor(() => expect(mockShowError).toHaveBeenCalled());
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(screen.getByRole('tab', { name: '決定事項' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      expect(screen.getByText('決定メッセージ')).toBeInTheDocument();
    });
  });

  describe('任意カテゴリ追加', () => {
    it('新しいカテゴリを追加するとタブとカテゴリ選択肢へ反映する', async () => {
      renderSubject();
      await userEvent.click(await screen.findByRole('button', { name: 'カテゴリを追加' }));
      await userEvent.type(screen.getByRole('textbox', { name: 'カテゴリ名' }), '新規');
      await userEvent.click(screen.getByRole('button', { name: '追加する' }));
      expect(await screen.findByRole('tab', { name: '新規' })).toBeInTheDocument();
    });

    it('カテゴリ追加中にチャンネルを切り替えると旧チャンネルのカテゴリを追加しない', async () => {
      let resolveCreate!: (value: { category: (typeof categories)[number] }) => void;
      mockCreateCategory.mockImplementationOnce(
        () => new Promise((resolve) => {
          resolveCreate = resolve;
        }),
      );
      const { rerender } = renderSubject();
      await userEvent.click(await screen.findByRole('button', { name: 'カテゴリを追加' }));
      await userEvent.type(screen.getByRole('textbox', { name: 'カテゴリ名' }), '旧カテゴリ');
      await userEvent.click(screen.getByRole('button', { name: '追加する' }));
      await waitFor(() => expect(mockCreateCategory).toHaveBeenCalled());
      rerender(<PinnedMessages channelId={2} currentUserId={1} onUnpin={vi.fn()} />);
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      resolveCreate({
        category: { id: 9, channelId: 1, name: '旧カテゴリ', isDefault: false, position: 9 },
      });
      await Promise.resolve();
      expect(screen.queryByRole('tab', { name: '旧カテゴリ' })).not.toBeInTheDocument();
    });

    it('カテゴリ追加APIが失敗した場合はエラーを表示して現在の一覧を維持する', async () => {
      mockCreateCategory.mockRejectedValueOnce(new Error('failed'));
      renderSubject();
      await userEvent.click(await screen.findByRole('button', { name: 'カテゴリを追加' }));
      await userEvent.type(screen.getByRole('textbox', { name: 'カテゴリ名' }), '失敗');
      await userEvent.click(screen.getByRole('button', { name: '追加する' }));
      await waitFor(() => expect(mockShowError).toHaveBeenCalled());
      expect(screen.getByText('決定メッセージ')).toBeInTheDocument();
    });
  });

  describe('読込エラー', () => {
    it('カテゴリ一覧の取得に失敗した場合はエラー状態を表示する', async () => {
      mockListCategories.mockRejectedValueOnce(new Error('failed'));
      renderSubject();
      expect(await screen.findByText('ピン留めの読み込みに失敗しました')).toBeInTheDocument();
    });
  });
});
