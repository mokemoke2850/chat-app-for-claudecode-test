/**
 * テスト対象: components/Task/EditTaskDialog.tsx（タスク編集ダイアログ）
 * 戦略:
 *   - api/client をモックしてタスク更新 API 呼び出しを差し替える
 *   - 各フィールドの初期値・編集・保存フローを検証する
 *   - API 失敗時のエラー表示・キャンセル動作も確認する
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EditTaskDialog from '../components/Task/EditTaskDialog';
import type { Task, User } from '@chat-app/shared';

const mockTaskUpdate = vi.fn();

vi.mock('../api/client', () => ({
  api: {
    tasks: {
      update: (...args: unknown[]) => mockTaskUpdate(...args),
    },
  },
}));

const mockTask: Task = {
  id: 1,
  title: '既存タスク',
  description: '詳細テキスト',
  status: 'todo',
  assigneeId: null,
  assigneeUsername: null,
  dueAt: null,
  sourceMessageId: null,
  sourceChannelId: null,
  createdBy: 1,
  position: 0,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const mockUsers: User[] = [
  {
    id: 1,
    username: 'alice',
    email: 'alice@test.com',
    displayName: 'Alice',
    location: null,
    avatarUrl: null,
    createdAt: '2024-01-01T00:00:00Z',
    role: 'user',
    isActive: true,
    onboardingCompletedAt: null,
  },
];

beforeEach(() => {
  vi.resetAllMocks();
  mockTaskUpdate.mockResolvedValue({ task: { ...mockTask, title: '更新済みタスク' } });
});

describe('EditTaskDialog', () => {
  describe('ダイアログの開閉', () => {
    it('open=false のときダイアログが表示されない', () => {
      render(<EditTaskDialog open={false} task={mockTask} onClose={vi.fn()} />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('open=true のときダイアログが表示される', () => {
      render(<EditTaskDialog open={true} task={mockTask} onClose={vi.fn()} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('キャンセルボタンをクリックすると onClose が呼ばれる', async () => {
      const onClose = vi.fn();
      render(<EditTaskDialog open={true} task={mockTask} onClose={onClose} />);
      await userEvent.click(screen.getByRole('button', { name: 'キャンセル' }));
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('フォームの初期値', () => {
    it('タスクのタイトルが初期値としてセットされている', () => {
      render(<EditTaskDialog open={true} task={mockTask} onClose={vi.fn()} />);
      const input = screen.getByRole('textbox', { name: /タイトル/ });
      expect((input as HTMLInputElement).value).toBe('既存タスク');
    });

    it('タスクの説明が初期値としてセットされている', () => {
      render(<EditTaskDialog open={true} task={mockTask} onClose={vi.fn()} />);
      const textarea = screen.getByRole('textbox', { name: /説明/ });
      expect((textarea as HTMLTextAreaElement).value).toBe('詳細テキスト');
    });

    it('タスクのステータスが初期値としてセットされている', () => {
      render(<EditTaskDialog open={true} task={mockTask} onClose={vi.fn()} />);
      expect(screen.getByRole('combobox', { name: 'ステータス' })).toBeInTheDocument();
    });
  });

  describe('フォームバリデーション', () => {
    it('タイトルが空のとき保存ボタンが disabled になる', async () => {
      render(<EditTaskDialog open={true} task={mockTask} onClose={vi.fn()} />);
      const titleInput = screen.getByRole('textbox', { name: /タイトル/ });
      await userEvent.clear(titleInput);
      const saveBtn = screen.getByRole('button', { name: '保存' });
      expect(saveBtn).toBeDisabled();
    });
  });

  describe('タスク更新送信', () => {
    it('タイトルを変更して保存すると api.tasks.update が呼ばれる', async () => {
      render(<EditTaskDialog open={true} task={mockTask} onClose={vi.fn()} />);
      const titleInput = screen.getByRole('textbox', { name: /タイトル/ });
      await userEvent.clear(titleInput);
      await userEvent.type(titleInput, '更新タイトル');
      await userEvent.click(screen.getByRole('button', { name: '保存' }));
      await waitFor(() => {
        expect(mockTaskUpdate).toHaveBeenCalledWith(
          1,
          expect.objectContaining({ title: '更新タイトル' }),
        );
      });
    });

    it('担当者を選択して保存すると assigneeId が API に渡される', async () => {
      render(<EditTaskDialog open={true} task={mockTask} users={mockUsers} onClose={vi.fn()} />);
      const assigneeSelect = screen.getByRole('combobox', { name: '担当者' });
      await userEvent.click(assigneeSelect);
      await userEvent.click(screen.getByRole('option', { name: 'Alice' }));
      await userEvent.click(screen.getByRole('button', { name: '保存' }));
      await waitFor(() => {
        expect(mockTaskUpdate).toHaveBeenCalledWith(1, expect.objectContaining({ assigneeId: 1 }));
      });
    });

    it('API 送信成功後に onUpdated コールバックが呼ばれる', async () => {
      const onUpdated = vi.fn();
      render(
        <EditTaskDialog open={true} task={mockTask} onClose={vi.fn()} onUpdated={onUpdated} />,
      );
      await userEvent.click(screen.getByRole('button', { name: '保存' }));
      await waitFor(() => {
        expect(onUpdated).toHaveBeenCalled();
      });
    });

    it('API 送信成功後にダイアログが閉じる', async () => {
      const onClose = vi.fn();
      render(<EditTaskDialog open={true} task={mockTask} onClose={onClose} />);
      await userEvent.click(screen.getByRole('button', { name: '保存' }));
      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('API 送信失敗時にエラーメッセージが表示される', async () => {
      mockTaskUpdate.mockRejectedValueOnce(new Error('タスク更新に失敗'));
      render(<EditTaskDialog open={true} task={mockTask} onClose={vi.fn()} />);
      await userEvent.click(screen.getByRole('button', { name: '保存' }));
      await waitFor(() => {
        expect(screen.getByText(/タスク更新に失敗/)).toBeInTheDocument();
      });
    });
  });
});
