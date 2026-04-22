/**
 * テスト対象: components/Chat/TemplatePicker.tsx
 * 戦略:
 *   - ネットワーク通信は vi.mock('../api/client') で差し替える
 *   - テンプレート一覧の表示・絞り込み・キーボード操作・選択後コールバックを検証する
 *   - jsdom で動作しない部分はスタブで代替する
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Suspense } from 'react';

vi.mock('../api/client', () => ({
  api: {
    templates: {
      list: vi.fn(),
    },
  },
}));

import { api } from '../api/client';
import TemplatePicker from '../components/Chat/TemplatePicker';

const mockTemplates = [
  {
    id: 1,
    userId: 1,
    title: '挨拶テンプレート',
    body: 'こんにちは！',
    position: 0,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 2,
    userId: 1,
    title: '締めの言葉',
    body: 'よろしくお願いします。',
    position: 1,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 3,
    userId: 1,
    title: 'ありがとう',
    body: 'ありがとうございました！',
    position: 2,
    createdAt: '',
    updatedAt: '',
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  (api.templates.list as ReturnType<typeof vi.fn>).mockResolvedValue({ templates: mockTemplates });
});

function renderWithSuspense(ui: React.ReactElement) {
  return render(<Suspense fallback={<div>Loading...</div>}>{ui}</Suspense>);
}

describe('TemplatePicker', () => {
  describe('テンプレート一覧表示', () => {
    it('テンプレート一覧がタイトルと本文プレビューで表示される', async () => {
      const onSelect = vi.fn();
      const onClose = vi.fn();
      renderWithSuspense(<TemplatePicker onSelect={onSelect} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('挨拶テンプレート')).toBeInTheDocument();
        expect(screen.getByText('締めの言葉')).toBeInTheDocument();
        expect(screen.getByText('ありがとう')).toBeInTheDocument();
      });
    });

    it('テンプレートが存在しない場合に空の旨のメッセージが表示される', async () => {
      (api.templates.list as ReturnType<typeof vi.fn>).mockResolvedValue({ templates: [] });
      const onSelect = vi.fn();
      const onClose = vi.fn();
      renderWithSuspense(<TemplatePicker onSelect={onSelect} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText(/テンプレートがありません/)).toBeInTheDocument();
      });
    });
  });

  describe('テキスト絞り込み', () => {
    it('検索ボックスに入力するとタイトルに前方一致するテンプレートのみ表示される', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onClose = vi.fn();
      renderWithSuspense(<TemplatePicker onSelect={onSelect} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('挨拶テンプレート')).toBeInTheDocument();
      });

      const searchInput = screen.getByRole('textbox');
      await user.type(searchInput, '挨拶');

      expect(screen.getByText('挨拶テンプレート')).toBeInTheDocument();
      expect(screen.queryByText('締めの言葉')).not.toBeInTheDocument();
      expect(screen.queryByText('ありがとう')).not.toBeInTheDocument();
    });

    it('検索テキストをクリアすると全テンプレートが再表示される', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onClose = vi.fn();
      renderWithSuspense(<TemplatePicker onSelect={onSelect} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('挨拶テンプレート')).toBeInTheDocument();
      });

      const searchInput = screen.getByRole('textbox');
      await user.type(searchInput, '挨拶');
      await user.clear(searchInput);

      expect(screen.getByText('挨拶テンプレート')).toBeInTheDocument();
      expect(screen.getByText('締めの言葉')).toBeInTheDocument();
      expect(screen.getByText('ありがとう')).toBeInTheDocument();
    });

    it('どのテンプレートにも一致しない場合に「該当なし」の旨が表示される', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onClose = vi.fn();
      renderWithSuspense(<TemplatePicker onSelect={onSelect} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('挨拶テンプレート')).toBeInTheDocument();
      });

      const searchInput = screen.getByRole('textbox');
      await user.type(searchInput, 'xxxxxxx');

      expect(screen.getByText(/該当なし|見つかりません/)).toBeInTheDocument();
    });
  });

  describe('キーボード操作', () => {
    it('↓キーで次の候補にフォーカスが移る', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onClose = vi.fn();
      renderWithSuspense(<TemplatePicker onSelect={onSelect} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('挨拶テンプレート')).toBeInTheDocument();
      });

      const searchInput = screen.getByRole('textbox');
      await user.click(searchInput);
      await user.keyboard('{ArrowDown}');

      // 2番目の項目がハイライトされていること
      const items = screen.getAllByRole('option');
      expect(items[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('↑キーで前の候補にフォーカスが移る', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onClose = vi.fn();
      renderWithSuspense(<TemplatePicker onSelect={onSelect} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('挨拶テンプレート')).toBeInTheDocument();
      });

      const searchInput = screen.getByRole('textbox');
      await user.click(searchInput);
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowUp}');

      const items = screen.getAllByRole('option');
      expect(items[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('Enterキーでフォーカス中のテンプレートが選択される', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onClose = vi.fn();
      renderWithSuspense(<TemplatePicker onSelect={onSelect} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('挨拶テンプレート')).toBeInTheDocument();
      });

      const searchInput = screen.getByRole('textbox');
      await user.click(searchInput);
      await user.keyboard('{Enter}');

      expect(onSelect).toHaveBeenCalledWith(mockTemplates[0].body);
    });

    it('Escapeキーでピッカーが閉じる', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onClose = vi.fn();
      renderWithSuspense(<TemplatePicker onSelect={onSelect} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('挨拶テンプレート')).toBeInTheDocument();
      });

      await user.keyboard('{Escape}');

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('テンプレート選択', () => {
    it('テンプレートをクリックすると onSelect コールバックが本文を引数で呼ばれる', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onClose = vi.fn();
      renderWithSuspense(<TemplatePicker onSelect={onSelect} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('挨拶テンプレート')).toBeInTheDocument();
      });

      await user.click(screen.getByText('挨拶テンプレート'));

      expect(onSelect).toHaveBeenCalledWith(mockTemplates[0].body);
    });

    it('onSelect 呼び出し後にピッカーが閉じる', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onClose = vi.fn();
      renderWithSuspense(<TemplatePicker onSelect={onSelect} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('挨拶テンプレート')).toBeInTheDocument();
      });

      await user.click(screen.getByText('挨拶テンプレート'));

      expect(onClose).toHaveBeenCalled();
    });
  });
});
