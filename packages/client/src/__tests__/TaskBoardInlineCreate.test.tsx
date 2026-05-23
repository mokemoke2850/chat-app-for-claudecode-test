/**
 * テスト対象: pages/TaskBoardPage.tsx に追加するインライン作成機能（Issue #268）
 * 戦略:
 *   - 各カラム下部の「+ タスク追加」ボタン → 入力フィールド表示 → Enter で作成 / Esc でキャンセルの
 *     インライン作成 UX を検証する
 *   - api.tasks.create を vi.mock で差し替え、status を含む作成パラメータが正しく渡されるかを確認する
 *   - 詳細編集は引き続きモーダル経由のため、インライン作成の責務はタイトルのみの軽量作成に限定する
 *   - 既存 TaskBoardPage.test.tsx の DnD / モック構成を踏襲する
 *
 * 注意: 必須スコープに該当する項目のみ it() で実装。それ以外は it.skip + Issue #338 参照に
 *       変換して残課題として追跡する（フォーカス喪失時の挙動・エラー時 UX 等）。
 */

import { render, screen, waitFor, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Task } from '@chat-app/shared';

// DnD Kit モック（jsdom 非対応のため）
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  closestCorners: vi.fn(),
  PointerSensor: class {},
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn((...args: unknown[]) => args),
  useDroppable: vi.fn(() => ({ setNodeRef: vi.fn(), isOver: false })),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  verticalListSortingStrategy: vi.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
  arrayMove: vi.fn((arr: unknown[], from: number, to: number) => {
    const result = [...(arr as unknown[])];
    result.splice(to, 0, result.splice(from, 1)[0]);
    return result;
  }),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: vi.fn(() => '') } },
}));

const mockTasksList = vi.fn();
const mockTasksCreate = vi.fn();
const mockTasksUpdate = vi.fn();
const mockTasksDelete = vi.fn();
const mockTasksUpdateOrder = vi.fn();
const mockAuthUsers = vi.fn();
const mockChannelsList = vi.fn();

vi.mock('../api/client', () => ({
  api: {
    tasks: {
      list: (...args: unknown[]) => mockTasksList(...args),
      create: (...args: unknown[]) => mockTasksCreate(...args),
      update: (...args: unknown[]) => mockTasksUpdate(...args),
      delete: (...args: unknown[]) => mockTasksDelete(...args),
      updateOrder: (...args: unknown[]) => mockTasksUpdateOrder(...args),
    },
    auth: {
      users: (...args: unknown[]) => mockAuthUsers(...args),
    },
    channels: {
      list: (...args: unknown[]) => mockChannelsList(...args),
    },
    dm: {
      listConversations: () => Promise.resolve({ conversations: [] }),
    },
    messages: {
      search: () => Promise.resolve({ messages: [] }),
    },
  },
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, username: 'alice', email: 'a@test.com', displayName: null },
    logout: vi.fn(),
  }),
}));

vi.mock('../contexts/ThemeContext', () => ({
  useTheme: () => ({ mode: 'light', toggleTheme: vi.fn() }),
}));

vi.mock('../hooks/usePushNotifications', () => ({
  usePushNotifications: () => ({
    supported: false,
    subscribed: false,
    loading: false,
    error: null,
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  }),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../contexts/SocketContext', () => ({
  useSocket: () => null,
}));

vi.mock('../components/Channel/ChannelList', () => ({
  default: () => <div data-testid="channel-list-stub" />,
}));
vi.mock('../components/Layout/SidebarDmList', () => ({
  default: () => <div data-testid="sidebar-dm-list-stub" />,
}));

vi.mock('../components/Task/CreateTaskDialog', () => ({
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div data-testid="create-task-dialog">
        <button onClick={onClose}>close</button>
      </div>
    ) : null,
}));

vi.mock('../components/Task/EditTaskDialog', () => ({
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div data-testid="edit-task-dialog">
        <button onClick={onClose}>close-edit</button>
      </div>
    ) : null,
}));

function makeTasks(): Task[] {
  return [
    {
      id: 1,
      title: 'TODO タスク',
      description: null,
      status: 'todo',
      assigneeId: null,
      assigneeUsername: null,
      dueAt: null,
      sourceMessageId: null,
      sourceChannelId: null,
      createdBy: 1,
      position: 0,
      isHidden: false,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
  ];
}

async function importTaskBoardPage() {
  vi.resetModules();
  const mod = await import('../pages/TaskBoardPage');
  return mod.default;
}

beforeEach(() => {
  vi.resetAllMocks();
  mockNavigate.mockReset();
  mockTasksList.mockResolvedValue({ tasks: makeTasks() });
  mockTasksCreate.mockResolvedValue({
    task: {
      id: 99,
      title: 'new',
      description: null,
      status: 'todo',
      assigneeId: null,
      dueAt: null,
      sourceMessageId: null,
      sourceChannelId: null,
      createdBy: 1,
      position: 0,
      isHidden: false,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
  });
  mockTasksUpdate.mockResolvedValue({ task: makeTasks()[0] });
  mockTasksDelete.mockResolvedValue(undefined);
  mockTasksUpdateOrder.mockResolvedValue({ success: true });
  mockAuthUsers.mockResolvedValue({ users: [] });
  mockChannelsList.mockResolvedValue({ channels: [] });
});

async function renderBoard() {
  const TaskBoardPage = await importTaskBoardPage();
  await act(async () => {
    render(
      <MemoryRouter>
        <TaskBoardPage />
      </MemoryRouter>,
    );
  });
}

describe('TaskBoardPage インライン作成 (Issue #268)', () => {
  describe('「+ タスク追加」ボタンの表示', () => {
    it('未着手カラムの下部に「+ タスク追加」ボタンが表示される', async () => {
      await renderBoard();
      await waitFor(() => {
        const col = screen.getByTestId('column-todo');
        expect(within(col).getByRole('button', { name: /タスク追加/ })).toBeInTheDocument();
      });
    });

    it('進行中カラムの下部に「+ タスク追加」ボタンが表示される', async () => {
      await renderBoard();
      await waitFor(() => {
        const col = screen.getByTestId('column-in_progress');
        expect(within(col).getByRole('button', { name: /タスク追加/ })).toBeInTheDocument();
      });
    });

    it('完了カラムの下部に「+ タスク追加」ボタンが表示される', async () => {
      await renderBoard();
      await waitFor(() => {
        const col = screen.getByTestId('column-done');
        expect(within(col).getByRole('button', { name: /タスク追加/ })).toBeInTheDocument();
      });
    });

    it('初期表示時は入力フィールドではなくボタンとしてレンダーされる', async () => {
      await renderBoard();
      await waitFor(() => {
        expect(screen.getByTestId('column-todo')).toBeInTheDocument();
      });
      // 入力フィールドは出ていない
      expect(screen.queryByTestId('inline-create-input-todo')).not.toBeInTheDocument();
      expect(screen.queryByTestId('inline-create-input-in_progress')).not.toBeInTheDocument();
      expect(screen.queryByTestId('inline-create-input-done')).not.toBeInTheDocument();
    });
  });

  describe('入力フィールドの開閉', () => {
    it('「+ タスク追加」ボタンをクリックするとそのカラムだけ入力フィールドが表示される', async () => {
      await renderBoard();
      await waitFor(() => {
        expect(screen.getByTestId('column-todo')).toBeInTheDocument();
      });
      const col = screen.getByTestId('column-todo');
      await userEvent.click(within(col).getByRole('button', { name: /タスク追加/ }));
      expect(screen.getByTestId('inline-create-input-todo')).toBeInTheDocument();
      // 他カラムの入力フィールドは表示されない
      expect(screen.queryByTestId('inline-create-input-in_progress')).not.toBeInTheDocument();
      expect(screen.queryByTestId('inline-create-input-done')).not.toBeInTheDocument();
    });

    it.skip('入力フィールド表示中はそのカラムの「+ タスク追加」ボタンが非表示になる', () => {
      /* see #338 */
    });
    it.skip('別カラムの「+ タスク追加」ボタンをクリックしても他カラムの入力フィールドは閉じない（独立して開閉できる）', () => {
      /* see #338 */
    });
    it.skip('入力フィールドにオートフォーカスが当たる', () => {
      /* see #338 */
    });
  });

  describe('Enter による作成', () => {
    it('タイトルを入力して Enter を押すと api.tasks.create が呼ばれる', async () => {
      await renderBoard();
      await waitFor(() => {
        expect(screen.getByTestId('column-todo')).toBeInTheDocument();
      });
      const col = screen.getByTestId('column-todo');
      await userEvent.click(within(col).getByRole('button', { name: /タスク追加/ }));
      const input = screen.getByTestId('inline-create-input-todo').querySelector('input')!;
      await userEvent.type(input, '新タスク{Enter}');
      await waitFor(() => {
        expect(mockTasksCreate).toHaveBeenCalledWith(
          expect.objectContaining({ title: '新タスク' }),
        );
      });
    });

    it('未着手カラムで作成した場合、status 変更 API は呼ばれない（todo がデフォルト）', async () => {
      await renderBoard();
      await waitFor(() => {
        expect(screen.getByTestId('column-todo')).toBeInTheDocument();
      });
      const col = screen.getByTestId('column-todo');
      await userEvent.click(within(col).getByRole('button', { name: /タスク追加/ }));
      const input = screen.getByTestId('inline-create-input-todo').querySelector('input')!;
      await userEvent.type(input, 'タスクA{Enter}');
      await waitFor(() => {
        expect(mockTasksCreate).toHaveBeenCalled();
      });
      // todo カラムからの作成では update は呼ばれない
      expect(mockTasksUpdate).not.toHaveBeenCalled();
    });

    it('進行中カラムで作成した場合 status: "in_progress" に更新される', async () => {
      mockTasksCreate.mockResolvedValue({
        task: {
          id: 99,
          title: 'new',
          description: null,
          status: 'todo',
          assigneeId: null,
          dueAt: null,
          sourceMessageId: null,
          sourceChannelId: null,
          createdBy: 1,
          position: 0,
          isHidden: false,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      });
      await renderBoard();
      await waitFor(() => {
        expect(screen.getByTestId('column-in_progress')).toBeInTheDocument();
      });
      const col = screen.getByTestId('column-in_progress');
      await userEvent.click(within(col).getByRole('button', { name: /タスク追加/ }));
      const input = screen.getByTestId('inline-create-input-in_progress').querySelector('input')!;
      await userEvent.type(input, '進行中タスク{Enter}');
      await waitFor(() => {
        expect(mockTasksUpdate).toHaveBeenCalledWith(99, { status: 'in_progress' });
      });
    });

    it('完了カラムで作成した場合 status: "done" に更新される', async () => {
      mockTasksCreate.mockResolvedValue({
        task: {
          id: 99,
          title: 'new',
          description: null,
          status: 'todo',
          assigneeId: null,
          dueAt: null,
          sourceMessageId: null,
          sourceChannelId: null,
          createdBy: 1,
          position: 0,
          isHidden: false,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      });
      await renderBoard();
      await waitFor(() => {
        expect(screen.getByTestId('column-done')).toBeInTheDocument();
      });
      const col = screen.getByTestId('column-done');
      await userEvent.click(within(col).getByRole('button', { name: /タスク追加/ }));
      const input = screen.getByTestId('inline-create-input-done').querySelector('input')!;
      await userEvent.type(input, '完了タスク{Enter}');
      await waitFor(() => {
        expect(mockTasksUpdate).toHaveBeenCalledWith(99, { status: 'done' });
      });
    });

    it('作成成功後にタスク一覧が再フェッチされる', async () => {
      await renderBoard();
      await waitFor(() => {
        expect(screen.getByTestId('column-todo')).toBeInTheDocument();
      });
      const callsBefore = mockTasksList.mock.calls.length;
      const col = screen.getByTestId('column-todo');
      await userEvent.click(within(col).getByRole('button', { name: /タスク追加/ }));
      const input = screen.getByTestId('inline-create-input-todo').querySelector('input')!;
      await userEvent.type(input, '新タスク{Enter}');
      await waitFor(() => {
        expect(mockTasksList.mock.calls.length).toBeGreaterThan(callsBefore);
      });
    });

    it('作成成功後に入力フィールドの値がクリアされる', async () => {
      await renderBoard();
      await waitFor(() => {
        expect(screen.getByTestId('column-todo')).toBeInTheDocument();
      });
      const col = screen.getByTestId('column-todo');
      await userEvent.click(within(col).getByRole('button', { name: /タスク追加/ }));
      const input = screen
        .getByTestId('inline-create-input-todo')
        .querySelector('input') as HTMLInputElement;
      await userEvent.type(input, '新タスク{Enter}');
      await waitFor(() => {
        expect(mockTasksCreate).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(input.value).toBe('');
      });
    });

    it('作成成功後も入力フィールドは開いたままで連続入力できる', async () => {
      await renderBoard();
      await waitFor(() => {
        expect(screen.getByTestId('column-todo')).toBeInTheDocument();
      });
      const col = screen.getByTestId('column-todo');
      await userEvent.click(within(col).getByRole('button', { name: /タスク追加/ }));
      const input = screen.getByTestId('inline-create-input-todo').querySelector('input')!;
      await userEvent.type(input, '新タスク{Enter}');
      await waitFor(() => {
        expect(mockTasksCreate).toHaveBeenCalled();
      });
      // フィールドが残っている
      expect(screen.getByTestId('inline-create-input-todo')).toBeInTheDocument();
    });

    it('タイトルが空白のみの場合は Enter を押しても api.tasks.create が呼ばれない', async () => {
      await renderBoard();
      await waitFor(() => {
        expect(screen.getByTestId('column-todo')).toBeInTheDocument();
      });
      const col = screen.getByTestId('column-todo');
      await userEvent.click(within(col).getByRole('button', { name: /タスク追加/ }));
      const input = screen.getByTestId('inline-create-input-todo').querySelector('input')!;
      await userEvent.type(input, '   {Enter}');
      // 一定時間待っても呼ばれないことを確認
      await new Promise((r) => setTimeout(r, 50));
      expect(mockTasksCreate).not.toHaveBeenCalled();
    });

    it('タイトルの前後の空白はトリムされて送信される', async () => {
      await renderBoard();
      await waitFor(() => {
        expect(screen.getByTestId('column-todo')).toBeInTheDocument();
      });
      const col = screen.getByTestId('column-todo');
      await userEvent.click(within(col).getByRole('button', { name: /タスク追加/ }));
      const input = screen.getByTestId('inline-create-input-todo').querySelector('input')!;
      await userEvent.type(input, '  trimmed  {Enter}');
      await waitFor(() => {
        expect(mockTasksCreate).toHaveBeenCalledWith(expect.objectContaining({ title: 'trimmed' }));
      });
    });

    it.skip('IME 変換確定の Enter（isComposing: true）では作成が実行されない', () => {
      /* see #338 */
    });
  });

  describe('Esc によるキャンセル', () => {
    it('Esc キーを押すと入力フィールドが閉じる', async () => {
      await renderBoard();
      await waitFor(() => {
        expect(screen.getByTestId('column-todo')).toBeInTheDocument();
      });
      const col = screen.getByTestId('column-todo');
      await userEvent.click(within(col).getByRole('button', { name: /タスク追加/ }));
      expect(screen.getByTestId('inline-create-input-todo')).toBeInTheDocument();
      const input = screen.getByTestId('inline-create-input-todo').querySelector('input')!;
      input.focus();
      await userEvent.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.queryByTestId('inline-create-input-todo')).not.toBeInTheDocument();
      });
    });

    it('Esc キーを押しても api.tasks.create は呼ばれない', async () => {
      await renderBoard();
      await waitFor(() => {
        expect(screen.getByTestId('column-todo')).toBeInTheDocument();
      });
      const col = screen.getByTestId('column-todo');
      await userEvent.click(within(col).getByRole('button', { name: /タスク追加/ }));
      const input = screen.getByTestId('inline-create-input-todo').querySelector('input')!;
      await userEvent.type(input, '入力中');
      input.focus();
      await userEvent.keyboard('{Escape}');
      expect(mockTasksCreate).not.toHaveBeenCalled();
    });

    it.skip('Esc キーを押すと入力中のテキストが破棄される（再度開いたとき空になる）', () => {
      /* see #338 */
    });
  });

  describe('フォーカス喪失時の挙動', () => {
    it.skip('入力フィールドからフォーカスが外れたとき、空のままなら入力フィールドを閉じる', () => {
      /* see #338 */
    });
    it.skip('入力フィールドからフォーカスが外れても、入力テキストがあれば閉じずに残る', () => {
      /* see #338 */
    });
  });

  describe('エラー時の挙動', () => {
    it.skip('api.tasks.create が失敗してもクラッシュせずエラーが UI に表示される', () => {
      /* see #338 */
    });
    it.skip('作成失敗時は入力テキストがクリアされず、再 Enter で再送信できる', () => {
      /* see #338 */
    });
  });

  describe('既存モーダル作成との共存', () => {
    it('インライン作成と既存「新規タスク作成」ボタン（モーダル）の両方が同時に利用可能である', async () => {
      await renderBoard();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /新規タスク作成/ })).toBeInTheDocument();
      });
      const col = screen.getByTestId('column-todo');
      expect(within(col).getByRole('button', { name: /タスク追加/ })).toBeInTheDocument();
    });

    it('インライン作成は CreateTaskDialog を開かない（ダイアログが DOM に出現しない）', async () => {
      await renderBoard();
      await waitFor(() => {
        expect(screen.getByTestId('column-todo')).toBeInTheDocument();
      });
      const col = screen.getByTestId('column-todo');
      await userEvent.click(within(col).getByRole('button', { name: /タスク追加/ }));
      expect(screen.queryByTestId('create-task-dialog')).not.toBeInTheDocument();
    });
  });
});
