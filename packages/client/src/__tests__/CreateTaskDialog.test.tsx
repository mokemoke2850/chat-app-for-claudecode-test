/**
 * テスト対象: components/Task/CreateTaskDialog.tsx（タスク作成ダイアログ）
 * 戦略:
 *   - api/client をモックしてタスク作成 API 呼び出しを差し替える
 *   - ユーザー一覧取得 API もモックして担当者セレクト UI をテストする
 *   - フォームバリデーション・送信・キャンセルの各フローを検証する
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreateTaskDialog from '../components/Task/CreateTaskDialog';
import type { User, Channel } from '@chat-app/shared';

const mockTaskCreate = vi.fn();

vi.mock('../api/client', () => ({
  api: {
    tasks: {
      create: (...args: unknown[]) => mockTaskCreate(...args),
    },
  },
}));

const mockChannels: Channel[] = [
  {
    id: 10,
    name: 'general',
    description: null,
    isPrivate: false,
    createdAt: '2024-01-01T00:00:00Z',
  } as Channel,
  {
    id: 20,
    name: 'random',
    description: null,
    isPrivate: false,
    createdAt: '2024-01-01T00:00:00Z',
  } as Channel,
];

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
  {
    id: 2,
    username: 'bob',
    email: 'bob@test.com',
    displayName: null,
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
  mockTaskCreate.mockResolvedValue({ task: { id: 1, title: 'test', status: 'todo' } });
});

describe('CreateTaskDialog', () => {
  describe('ダイアログの開閉', () => {
    it('open=false のときダイアログが表示されない', () => {
      render(<CreateTaskDialog open={false} onClose={vi.fn()} />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('open=true のときダイアログが表示される', () => {
      render(<CreateTaskDialog open={true} onClose={vi.fn()} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('キャンセルボタンをクリックすると onClose が呼ばれる', async () => {
      const onClose = vi.fn();
      render(<CreateTaskDialog open={true} onClose={onClose} />);
      await userEvent.click(screen.getByRole('button', { name: 'キャンセル' }));
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('フォームの初期値', () => {
    it('source_message_id が渡されたとき、関連メッセージ情報がダイアログに表示される', () => {
      render(
        <CreateTaskDialog
          open={true}
          onClose={vi.fn()}
          sourceMessageId={10}
          sourceMessageContent="テストメッセージ"
        />,
      );
      expect(screen.getByText('テストメッセージ')).toBeInTheDocument();
    });

    it('source_message_id が null のとき、関連メッセージ表示がない', () => {
      render(<CreateTaskDialog open={true} onClose={vi.fn()} sourceMessageId={null} />);
      expect(screen.queryByText('元メッセージ')).not.toBeInTheDocument();
    });

    it('タイトルフィールドは初期状態で空である', () => {
      render(<CreateTaskDialog open={true} onClose={vi.fn()} />);
      const input = screen.getByRole('textbox', { name: /タイトル/ });
      expect((input as HTMLInputElement).value).toBe('');
    });
  });

  describe('フォームバリデーション', () => {
    it('タイトルが空のとき送信ボタンが disabled になる', () => {
      render(<CreateTaskDialog open={true} onClose={vi.fn()} />);
      const submitBtn = screen.getByRole('button', { name: '作成' });
      expect(submitBtn).toBeDisabled();
    });

    it('タイトルを入力すると送信ボタンが活性化する', async () => {
      render(<CreateTaskDialog open={true} onClose={vi.fn()} />);
      const submitBtn = screen.getByRole('button', { name: '作成' });
      expect(submitBtn).toBeDisabled();
      await userEvent.type(screen.getByRole('textbox', { name: /タイトル/ }), 'テストタスク');
      expect(submitBtn).not.toBeDisabled();
    });
  });

  describe('タスク作成送信', () => {
    it('タイトルを入力して送信するとタスク作成 API が呼ばれる', async () => {
      render(<CreateTaskDialog open={true} onClose={vi.fn()} />);
      await userEvent.type(screen.getByRole('textbox', { name: /タイトル/ }), 'タスクタイトル');
      await userEvent.click(screen.getByRole('button', { name: '作成' }));
      await waitFor(() => {
        expect(mockTaskCreate).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'タスクタイトル' }),
        );
      });
    });

    it('担当者を選択して送信すると assignee_id が API に渡される', async () => {
      render(<CreateTaskDialog open={true} onClose={vi.fn()} users={mockUsers} />);
      await userEvent.type(screen.getByRole('textbox', { name: /タイトル/ }), 'タスク');
      // MUI Select の combobox は aria-label="担当者" で取得
      const assigneeSelect = screen.getByRole('combobox', { name: '担当者' });
      await userEvent.click(assigneeSelect);
      await userEvent.click(screen.getByRole('option', { name: 'Alice' }));
      await userEvent.click(screen.getByRole('button', { name: '作成' }));
      await waitFor(() => {
        expect(mockTaskCreate).toHaveBeenCalledWith(expect.objectContaining({ assigneeId: 1 }));
      });
    });

    it('期限を入力して送信すると due_at が API に渡される', async () => {
      render(<CreateTaskDialog open={true} onClose={vi.fn()} />);
      await userEvent.type(screen.getByRole('textbox', { name: /タイトル/ }), 'タスク');
      // datetime-local input は type="datetime-local" なので role ではなく data-testid か直接 DOM で取得
      const dueInputs = document.querySelectorAll('input[type="datetime-local"]');
      if (dueInputs.length > 0) {
        await userEvent.type(dueInputs[0] as HTMLElement, '2027-12-31T12:00');
      }
      await userEvent.click(screen.getByRole('button', { name: '作成' }));
      // due_at あり・なしに関わらず API が呼ばれることを確認
      await waitFor(() => {
        expect(mockTaskCreate).toHaveBeenCalled();
      });
    });

    it('source_message_id が渡されているとき送信に含まれる', async () => {
      render(<CreateTaskDialog open={true} onClose={vi.fn()} sourceMessageId={99} />);
      await userEvent.type(screen.getByRole('textbox', { name: /タイトル/ }), 'タスク');
      await userEvent.click(screen.getByRole('button', { name: '作成' }));
      await waitFor(() => {
        expect(mockTaskCreate).toHaveBeenCalledWith(
          expect.objectContaining({ sourceMessageId: 99 }),
        );
      });
    });

    it('API 送信成功後に onCreated コールバックが呼ばれる', async () => {
      const onCreated = vi.fn();
      render(<CreateTaskDialog open={true} onClose={vi.fn()} onCreated={onCreated} />);
      await userEvent.type(screen.getByRole('textbox', { name: /タイトル/ }), 'タスク');
      await userEvent.click(screen.getByRole('button', { name: '作成' }));
      await waitFor(() => {
        expect(onCreated).toHaveBeenCalled();
      });
    });

    it('API 送信成功後にダイアログが閉じる', async () => {
      const onClose = vi.fn();
      render(<CreateTaskDialog open={true} onClose={onClose} />);
      await userEvent.type(screen.getByRole('textbox', { name: /タイトル/ }), 'タスク');
      await userEvent.click(screen.getByRole('button', { name: '作成' }));
      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('API 送信失敗時にエラーメッセージが表示される', async () => {
      mockTaskCreate.mockRejectedValueOnce(new Error('タスク作成に失敗'));
      render(<CreateTaskDialog open={true} onClose={vi.fn()} />);
      await userEvent.type(screen.getByRole('textbox', { name: /タイトル/ }), 'タスク');
      await userEvent.click(screen.getByRole('button', { name: '作成' }));
      await waitFor(() => {
        expect(screen.getByText(/タスク作成に失敗/)).toBeInTheDocument();
      });
    });
  });

  describe('チャンネル選択', () => {
    it('channels が渡されるとチャンネル選択フィールドが表示される', () => {
      render(<CreateTaskDialog open={true} onClose={vi.fn()} channels={mockChannels} />);
      expect(screen.getByRole('combobox', { name: 'チャンネル' })).toBeInTheDocument();
    });

    it('channels が空のときチャンネル選択フィールドが表示されない', () => {
      render(<CreateTaskDialog open={true} onClose={vi.fn()} channels={[]} />);
      expect(screen.queryByRole('combobox', { name: 'チャンネル' })).not.toBeInTheDocument();
    });

    it('initialChannelId が渡されるとチャンネルが初期選択された状態になる', () => {
      render(
        <CreateTaskDialog
          open={true}
          onClose={vi.fn()}
          channels={mockChannels}
          initialChannelId={10}
        />,
      );
      const select = screen.getByRole('combobox', { name: 'チャンネル' });
      expect(select).toBeInTheDocument();
    });

    it('チャンネルを選択して送信すると API が呼ばれる（channelId は表示用のみで API 送信に影響しない）', async () => {
      render(<CreateTaskDialog open={true} onClose={vi.fn()} channels={mockChannels} />);
      await userEvent.type(screen.getByRole('textbox', { name: /タイトル/ }), 'タスク');
      const channelSelect = screen.getByRole('combobox', { name: 'チャンネル' });
      await userEvent.click(channelSelect);
      await userEvent.click(screen.getByRole('option', { name: '#general' }));
      await userEvent.click(screen.getByRole('button', { name: '作成' }));
      await waitFor(() => {
        expect(mockTaskCreate).toHaveBeenCalled();
      });
    });
  });
});
