/**
 * テスト対象: pages/TemplatesPage.tsx
 * 戦略:
 *   - ネットワーク通信は vi.mock('../api/client') で差し替える
 *   - React 19 の use() + Suspense パターンを考慮し、await act(async () => render(...)) でデータを解決する
 *   - テンプレートの CRUD 操作と並び替えを重点的に検証する
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../api/client', () => ({
  api: {
    templates: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      reorder: vi.fn(),
    },
  },
}));

import { api } from '../api/client';
import TemplatesPage, { resetTemplatesCache } from '../pages/TemplatesPage';

const mockApi = api as unknown as {
  templates: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    reorder: ReturnType<typeof vi.fn>;
  };
};

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
];

async function renderPage() {
  await act(async () => {
    render(
      <MemoryRouter>
        <TemplatesPage />
      </MemoryRouter>,
    );
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetTemplatesCache();
  mockApi.templates.list.mockResolvedValue({ templates: mockTemplates });
  mockApi.templates.create.mockResolvedValue({
    template: {
      id: 3,
      userId: 1,
      title: '新しいテンプレート',
      body: '新しい本文',
      position: 2,
      createdAt: '',
      updatedAt: '',
    },
  });
  mockApi.templates.update.mockResolvedValue({
    template: { ...mockTemplates[0], title: '更新済みタイトル' },
  });
  mockApi.templates.remove.mockResolvedValue(undefined);
  mockApi.templates.reorder.mockResolvedValue({ success: true });
});

describe('TemplatesPage', () => {
  describe('テンプレート一覧', () => {
    it('テンプレート一覧がタイトル・本文とともに表示される', async () => {
      await renderPage();
      expect(screen.getByText('挨拶テンプレート')).toBeInTheDocument();
      expect(screen.getByText('締めの言葉')).toBeInTheDocument();
      expect(screen.getByText('こんにちは！')).toBeInTheDocument();
      expect(screen.getByText('よろしくお願いします。')).toBeInTheDocument();
    });

    it('テンプレートが 0 件のときに「テンプレートがありません」旨が表示される', async () => {
      mockApi.templates.list.mockResolvedValue({ templates: [] });
      await renderPage();
      expect(screen.getByText(/テンプレートがありません/)).toBeInTheDocument();
    });
  });

  describe('テンプレート作成', () => {
    it('タイトルと本文を入力して保存するとテンプレートが追加される', async () => {
      const user = userEvent.setup();
      await renderPage();

      const titleInput = screen.getByPlaceholderText('タイトルを入力');
      const bodyInput = screen.getByPlaceholderText('本文を入力');
      await user.type(titleInput, '新しいテンプレート');
      await user.type(bodyInput, '新しい本文');

      const saveButton = screen.getByRole('button', { name: '追加' });
      await user.click(saveButton);

      expect(mockApi.templates.create).toHaveBeenCalledWith({
        title: '新しいテンプレート',
        body: '新しい本文',
      });
    });

    it('タイトルが空の状態では保存ボタンが無効化される', async () => {
      const user = userEvent.setup();
      await renderPage();

      const bodyInput = screen.getByPlaceholderText('本文を入力');
      await user.type(bodyInput, '本文のみ入力');

      const saveButton = screen.getByRole('button', { name: '追加' });
      expect(saveButton).toBeDisabled();
    });

    it('本文が空の状態では保存ボタンが無効化される', async () => {
      const user = userEvent.setup();
      await renderPage();

      const titleInput = screen.getByPlaceholderText('タイトルを入力');
      await user.type(titleInput, 'タイトルのみ入力');

      const saveButton = screen.getByRole('button', { name: '追加' });
      expect(saveButton).toBeDisabled();
    });

    it('作成 API 呼び出し後に一覧がリフレッシュされる', async () => {
      const user = userEvent.setup();
      await renderPage();

      const titleInput = screen.getByPlaceholderText('タイトルを入力');
      const bodyInput = screen.getByPlaceholderText('本文を入力');
      await user.type(titleInput, '新しいテンプレート');
      await user.type(bodyInput, '新しい本文');

      await user.click(screen.getByRole('button', { name: '追加' }));

      await waitFor(() => {
        expect(screen.getByText('新しいテンプレート')).toBeInTheDocument();
      });
    });
  });

  describe('テンプレート編集', () => {
    it('編集ボタンを押すとタイトル・本文の編集フォームが表示される', async () => {
      const user = userEvent.setup();
      await renderPage();

      const editButtons = screen.getAllByRole('button', { name: '編集' });
      await user.click(editButtons[0]);

      expect(screen.getByDisplayValue('挨拶テンプレート')).toBeInTheDocument();
      expect(screen.getByDisplayValue('こんにちは！')).toBeInTheDocument();
    });

    it('内容を変更して保存すると update API が呼ばれる', async () => {
      const user = userEvent.setup();
      await renderPage();

      const editButtons = screen.getAllByRole('button', { name: '編集' });
      await user.click(editButtons[0]);

      const titleInput = screen.getByDisplayValue('挨拶テンプレート');
      await user.clear(titleInput);
      await user.type(titleInput, '更新済みタイトル');

      await user.click(screen.getByRole('button', { name: '保存' }));

      expect(mockApi.templates.update).toHaveBeenCalledWith(
        mockTemplates[0].id,
        expect.objectContaining({ title: '更新済みタイトル' }),
      );
    });

    it('キャンセルすると変更が破棄される', async () => {
      const user = userEvent.setup();
      await renderPage();

      const editButtons = screen.getAllByRole('button', { name: '編集' });
      await user.click(editButtons[0]);

      const titleInput = screen.getByDisplayValue('挨拶テンプレート');
      await user.clear(titleInput);
      await user.type(titleInput, '変更中...');

      await user.click(screen.getByRole('button', { name: 'キャンセル' }));

      expect(screen.getByText('挨拶テンプレート')).toBeInTheDocument();
      expect(mockApi.templates.update).not.toHaveBeenCalled();
    });
  });

  describe('テンプレート削除', () => {
    it('削除ボタンを押すと確認なしに即時削除 API が呼ばれる', async () => {
      const user = userEvent.setup();
      await renderPage();

      const deleteButtons = screen.getAllByRole('button', { name: '削除' });
      await user.click(deleteButtons[0]);

      expect(mockApi.templates.remove).toHaveBeenCalledWith(mockTemplates[0].id);
    });

    it('削除後に一覧からそのテンプレートが消える', async () => {
      const user = userEvent.setup();
      await renderPage();

      const deleteButtons = screen.getAllByRole('button', { name: '削除' });
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.queryByText('挨拶テンプレート')).not.toBeInTheDocument();
      });
    });
  });

  describe('並び替え', () => {
    it('↑ボタンを押すと対象テンプレートの position が1つ前に移動し reorder API が呼ばれる', async () => {
      const user = userEvent.setup();
      await renderPage();

      // 2番目のテンプレートの ↑ボタンをクリック（index 1 が最初の enabled なボタン）
      const upButtons = screen.getAllByRole('button', { name: '上に移動' });
      await user.click(upButtons[1]);

      expect(mockApi.templates.reorder).toHaveBeenCalledWith([
        mockTemplates[1].id,
        mockTemplates[0].id,
      ]);
    });

    it('↓ボタンを押すと対象テンプレートの position が1つ後に移動し reorder API が呼ばれる', async () => {
      const user = userEvent.setup();
      await renderPage();

      const downButtons = screen.getAllByRole('button', { name: '下に移動' });
      await user.click(downButtons[0]);

      expect(mockApi.templates.reorder).toHaveBeenCalledWith([
        mockTemplates[1].id,
        mockTemplates[0].id,
      ]);
    });

    it('先頭テンプレートの ↑ ボタンは無効化されている', async () => {
      await renderPage();

      const upButtons = screen.getAllByRole('button', { name: '上に移動' });
      expect(upButtons[0]).toBeDisabled();
    });

    it('末尾テンプレートの ↓ ボタンは無効化されている', async () => {
      await renderPage();

      const downButtons = screen.getAllByRole('button', { name: '下に移動' });
      expect(downButtons[downButtons.length - 1]).toBeDisabled();
    });
  });
});
