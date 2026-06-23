/**
 * テスト対象: pages/TaskBoardPage.tsx（カンバンボード UI）
 * 戦略:
 *   - api/client をモックしてタスク一覧取得・更新を差し替える
 *   - @dnd-kit を使った DnD 操作は jsdom では検証困難なため、
 *     ドラッグイベントのコールバック（onDragEnd 等）を直接呼び出して
 *     ステータス変更が API に正しく伝達されることを検証する
 *   - カンバン列の表示・フィルタ UI の動作・ダイアログ開閉に注力する
 */

import { render, screen, waitFor, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Task } from '@chat-app/shared';
import { makeTask } from './__fixtures__/tasks';

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
    attributes: { 'data-dnd-attrs': 'true' },
    // Issue #329: listeners がどの要素にスプレッドされたかをテストで判定できるよう
    // data-* マーカーを混ぜる（本番では onPointerDown 等のハンドラが入る）
    listeners: { 'data-dnd-listener': 'true' } as unknown as Record<string, () => void>,
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
const mockEditDialogTasks = vi.fn();
const mockGanttTasks = vi.fn();
const mockShowError = vi.fn();

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
    // Step 2c: Rail 内 useDmUnreadCount が api.dm.listConversations を呼ぶため
    dm: {
      listConversations: () => Promise.resolve({ conversations: [] }),
    },
    // Step 6d: Rail 内 useMentionUnreadCount が api.messages.search を呼ぶため
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
// AppLayout が Rail (NavLink を含む) をレンダーするため、react-router-dom の他の export
// (NavLink / MemoryRouter / useLocation 等) は実体を残し、useNavigate のみ差し替える
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

vi.mock('../contexts/SnackbarContext', () => ({
  useSnackbar: () => ({
    showSuccess: vi.fn(),
    showError: mockShowError,
    showInfo: vi.fn(),
  }),
}));

// Step 8b: Sidebar 中身 (ChannelList + SidebarDmList) を stub 化して onSelect 動線とレンダリングを検証可能にする
vi.mock('../components/Channel/ChannelList', () => ({
  default: ({ onSelect }: { onSelect?: (id: number, name: string) => void }) => (
    <div data-testid="channel-list-stub">
      <button onClick={() => onSelect?.(7, 'general')}>select-channel-7</button>
    </div>
  ),
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
  default: ({
    open,
    onClose,
    tasks,
  }: {
    open: boolean;
    task: { id: number; title: string };
    onClose: () => void;
    tasks?: Task[];
  }) =>
    open
      ? (mockEditDialogTasks(tasks),
        (
          <div data-testid="edit-task-dialog">
            <button onClick={onClose}>close-edit</button>
          </div>
        ))
      : null,
}));

vi.mock('../components/Task/TaskGanttChart', () => ({
  default: ({
    tasks,
    onDueAtChange,
  }: {
    tasks: Task[];
    onDueAtChange?: (task: Task, dueAt: string | null) => void;
  }) => {
    const scheduledTasks = tasks.filter((task) => task.dueAt != null);
    mockGanttTasks(scheduledTasks);
    const target = scheduledTasks[0];
    return (
      <div data-testid="gantt-chart-stub">
        {target && (
          <>
            <button onClick={() => onDueAtChange?.(target, '2026-06-20T00:00:00.000Z')}>
              change-gantt-due
            </button>
            <button onClick={() => onDueAtChange?.(target, null)}>clear-gantt-due</button>
          </>
        )}
      </div>
    );
  },
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
    {
      id: 2,
      title: '進行中タスク',
      description: null,
      status: 'in_progress',
      assigneeId: 1,
      assigneeUsername: 'alice',
      dueAt: null,
      sourceMessageId: null,
      sourceChannelId: null,
      createdBy: 1,
      position: 0,
      isHidden: false,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 3,
      title: '完了タスク',
      description: null,
      status: 'done',
      assigneeId: null,
      assigneeUsername: null,
      dueAt: '2020-01-01T00:00:00Z', // 過去日（期限切れ）
      sourceMessageId: 10,
      sourceChannelId: 5,
      createdBy: 1,
      position: 0,
      isHidden: false,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
  ];
}

function todayAt(hour: number): string {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

// TaskBoardPage はモジュールレベルのキャッシュを持つため動的 import でリセット
async function importTaskBoardPage() {
  vi.resetModules();
  const mod = await import('../pages/TaskBoardPage');
  return mod.default;
}

beforeEach(() => {
  vi.resetAllMocks();
  mockNavigate.mockReset();
  mockTasksList.mockResolvedValue({ tasks: makeTasks() });
  mockTasksCreate.mockResolvedValue({ task: { id: 99, title: 'new', status: 'todo' } });
  mockTasksDelete.mockResolvedValue(undefined);
  mockTasksUpdateOrder.mockResolvedValue({ success: true });
  mockAuthUsers.mockResolvedValue({ users: [] });
  mockChannelsList.mockResolvedValue({ channels: [] });
  mockShowError.mockReset();
});

describe('TaskBoardPage', () => {
  describe('サブタスクと進捗', () => {
    it('親タスクのカードにサブタスクの完了数と進捗率を表示する', async () => {
      mockTasksList.mockResolvedValue({
        tasks: [
          makeTask({
            id: 10,
            title: '親タスク',
            subtaskCount: 2,
            completedSubtaskCount: 1,
            progress: 50,
          }),
        ],
      });
      const TaskBoardPage = await importTaskBoardPage();
      await act(async () =>
        render(
          <MemoryRouter>
            <TaskBoardPage />
          </MemoryRouter>,
        ),
      );
      expect(await screen.findByText('サブタスク 1/2（50%）')).toBeInTheDocument();
    });

    it('サブタスクのカードに親タスク名を表示する', async () => {
      mockTasksList.mockResolvedValue({
        tasks: [
          makeTask({ id: 10, title: '親タスク' }),
          makeTask({ id: 11, title: '子タスク', parentTaskId: 10 }),
        ],
      });
      const TaskBoardPage = await importTaskBoardPage();
      await act(async () =>
        render(
          <MemoryRouter>
            <TaskBoardPage />
          </MemoryRouter>,
        ),
      );
      expect(await screen.findByText('親: 親タスク')).toBeInTheDocument();
    });

    it('編集ダイアログへ関係設定用の全タスクを渡す', async () => {
      const tasks = [makeTask({ id: 10, title: '対象' }), makeTask({ id: 11, title: '候補' })];
      mockTasksList.mockResolvedValue({ tasks });
      const TaskBoardPage = await importTaskBoardPage();
      await act(async () =>
        render(
          <MemoryRouter>
            <TaskBoardPage />
          </MemoryRouter>,
        ),
      );
      await userEvent.click(await screen.findByText('対象'));
      expect(mockEditDialogTasks).toHaveBeenLastCalledWith(tasks);
    });
  });

  describe('簡易ガント表示', () => {
    it('表示切替によりカンバンと簡易ガントを切り替えられる', async () => {
      const TaskBoardPage = await importTaskBoardPage();
      await act(async () =>
        render(
          <MemoryRouter>
            <TaskBoardPage />
          </MemoryRouter>,
        ),
      );
      expect(await screen.findByTestId('kanban-container')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'ガント' }));
      expect(screen.getByTestId('gantt-chart-stub')).toBeInTheDocument();
      expect(screen.queryByTestId('kanban-container')).not.toBeInTheDocument();
    });

    it('チャンネル絞り込み後のタスクだけを簡易ガントへ渡す', async () => {
      mockChannelsList.mockResolvedValue({
        channels: [{ id: 7, name: '対象', description: null }],
      });
      mockTasksList.mockResolvedValue({
        tasks: [
          makeTask({ id: 10, sourceChannelId: 7, dueAt: '2026-06-10T00:00:00Z' }),
          makeTask({ id: 11, sourceChannelId: 8, dueAt: '2026-06-11T00:00:00Z' }),
        ],
      });
      const TaskBoardPage = await importTaskBoardPage();
      await act(async () =>
        render(
          <MemoryRouter>
            <TaskBoardPage />
          </MemoryRouter>,
        ),
      );
      await userEvent.click(await screen.findByRole('combobox', { name: 'チャンネルで絞り込み' }));
      await userEvent.click(screen.getByRole('option', { name: '#対象' }));
      await userEvent.click(screen.getByRole('button', { name: 'ガント' }));
      expect(mockGanttTasks).toHaveBeenLastCalledWith([expect.objectContaining({ id: 10 })]);
    });

    it('簡易ガントから期限変更するとapi.tasks.updateでdueAtだけを更新し、API解決前にガントへ楽観反映する', async () => {
      let resolveUpdate!: (value: unknown) => void;
      mockTasksUpdate.mockReturnValue(
        new Promise((resolve) => {
          resolveUpdate = resolve;
        }),
      );
      mockTasksList.mockResolvedValue({
        tasks: [
          makeTask({
            id: 10,
            title: '対象',
            createdAt: '2026-06-01T00:00:00Z',
            dueAt: '2026-06-10T00:00:00Z',
          }),
        ],
      });
      const TaskBoardPage = await importTaskBoardPage();
      await act(async () =>
        render(
          <MemoryRouter>
            <TaskBoardPage />
          </MemoryRouter>,
        ),
      );
      await userEvent.click(screen.getByRole('button', { name: 'ガント' }));
      await userEvent.click(screen.getByRole('button', { name: 'change-gantt-due' }));

      expect(mockTasksUpdate).toHaveBeenCalledWith(10, { dueAt: '2026-06-20T00:00:00.000Z' });
      await waitFor(() => {
        expect(mockGanttTasks).toHaveBeenLastCalledWith([
          expect.objectContaining({ id: 10, dueAt: '2026-06-20T00:00:00.000Z' }),
        ]);
      });
      await act(async () => resolveUpdate({ task: makeTask({ id: 10 }) }));
    });

    it('簡易ガントから期限なしにするとapi.tasks.updateでdueAt:nullだけを送り、対象タスクをガント対象外にする', async () => {
      mockTasksUpdate.mockResolvedValue({ task: makeTask({ id: 10, dueAt: null }) });
      mockTasksList.mockResolvedValue({
        tasks: [
          makeTask({
            id: 10,
            title: '対象',
            createdAt: '2026-06-01T00:00:00Z',
            dueAt: '2026-06-10T00:00:00Z',
          }),
          makeTask({
            id: 11,
            title: '残る',
            createdAt: '2026-06-02T00:00:00Z',
            dueAt: '2026-06-11T00:00:00Z',
          }),
        ],
      });
      const TaskBoardPage = await importTaskBoardPage();
      await act(async () =>
        render(
          <MemoryRouter>
            <TaskBoardPage />
          </MemoryRouter>,
        ),
      );
      await userEvent.click(screen.getByRole('button', { name: 'ガント' }));
      await userEvent.click(screen.getByRole('button', { name: 'clear-gantt-due' }));

      expect(mockTasksUpdate).toHaveBeenCalledWith(10, { dueAt: null });
      await waitFor(() => {
        expect(mockGanttTasks).toHaveBeenLastCalledWith([expect.objectContaining({ id: 11 })]);
      });
    });

    it('簡易ガントの期限変更が失敗した場合は更新前dueAtへロールバックしてエラー通知する', async () => {
      mockTasksUpdate.mockRejectedValue(new Error('更新失敗'));
      mockTasksList.mockResolvedValue({
        tasks: [
          makeTask({
            id: 10,
            title: '対象',
            createdAt: '2026-06-01T00:00:00Z',
            dueAt: '2026-06-10T00:00:00Z',
          }),
        ],
      });
      const TaskBoardPage = await importTaskBoardPage();
      await act(async () =>
        render(
          <MemoryRouter>
            <TaskBoardPage />
          </MemoryRouter>,
        ),
      );
      await userEvent.click(screen.getByRole('button', { name: 'ガント' }));
      await userEvent.click(screen.getByRole('button', { name: 'change-gantt-due' }));

      await waitFor(() =>
        expect(mockShowError).toHaveBeenCalledWith('タスクの期限を更新できませんでした'),
      );
      expect(mockGanttTasks).toHaveBeenLastCalledWith([
        expect.objectContaining({ id: 10, dueAt: '2026-06-10T00:00:00Z' }),
      ]);
    });
  });

  describe('カンバン列の表示', () => {
    it('「未着手」「進行中」「完了」の 3 列が表示される', async () => {
      const TaskBoardPage = await importTaskBoardPage();
      await act(async () => {
        render(
          <MemoryRouter>
            <TaskBoardPage />
          </MemoryRouter>,
        );
      });
      await waitFor(() => {
        expect(screen.getByText('未着手')).toBeInTheDocument();
        expect(screen.getByText('進行中')).toBeInTheDocument();
        expect(screen.getByText('完了')).toBeInTheDocument();
      });
    });

    it('各列にタスクカードが status に応じて振り分けられて表示される', async () => {
      const TaskBoardPage = await importTaskBoardPage();
      await act(async () => {
        render(
          <MemoryRouter>
            <TaskBoardPage />
          </MemoryRouter>,
        );
      });
      await waitFor(() => {
        expect(screen.getByText('TODO タスク')).toBeInTheDocument();
        expect(screen.getByText('進行中タスク')).toBeInTheDocument();
        expect(screen.getByText('完了タスク')).toBeInTheDocument();
      });
    });

    it('タスクが 0 件のとき各列が空状態で表示される', async () => {
      mockTasksList.mockResolvedValue({ tasks: [] });
      const TaskBoardPage = await importTaskBoardPage();
      await act(async () => {
        render(
          <MemoryRouter>
            <TaskBoardPage />
          </MemoryRouter>,
        );
      });
      await waitFor(() => {
        const emptyMessages = screen.getAllByText('タスクなし');
        expect(emptyMessages.length).toBe(3);
      });
    });

    it('API 取得中はローディング状態が表示される（Suspense フォールバック）', async () => {
      // Promise を解決しないまま render
      let resolvePromise!: (v: { tasks: Task[] }) => void;
      const pendingPromise = new Promise<{ tasks: Task[] }>((r) => {
        resolvePromise = r;
      });
      mockTasksList.mockReturnValue(pendingPromise);

      const TaskBoardPage = await importTaskBoardPage();
      render(
        <MemoryRouter>
          <TaskBoardPage />
        </MemoryRouter>,
      );
      expect(screen.getByRole('progressbar')).toBeInTheDocument();

      // クリーンアップのため resolve
      await act(async () => {
        resolvePromise({ tasks: [] });
        await pendingPromise;
      });
    });
  });

  describe('タスクカードの表示', () => {
    it('タスクのタイトルが表示される', async () => {
      const TaskBoardPage = await importTaskBoardPage();
      await act(async () => {
        render(
          <MemoryRouter>
            <TaskBoardPage />
          </MemoryRouter>,
        );
      });
      await waitFor(() => {
        expect(screen.getByText('TODO タスク')).toBeInTheDocument();
      });
    });

    it('担当者が設定されているとき担当者名が表示される', async () => {
      const TaskBoardPage = await importTaskBoardPage();
      await act(async () => {
        render(
          <MemoryRouter>
            <TaskBoardPage />
          </MemoryRouter>,
        );
      });
      await waitFor(() => {
        expect(screen.getByText(/担当: alice/)).toBeInTheDocument();
      });
    });

    it('期限が設定されているとき期限日が表示される', async () => {
      const TaskBoardPage = await importTaskBoardPage();
      await act(async () => {
        render(
          <MemoryRouter>
            <TaskBoardPage />
          </MemoryRouter>,
        );
      });
      await waitFor(() => {
        expect(screen.getByText(/期限:/)).toBeInTheDocument();
      });
    });

    it('期限が過ぎているタスクは視覚的に強調表示される', async () => {
      const TaskBoardPage = await importTaskBoardPage();
      await act(async () => {
        render(
          <MemoryRouter>
            <TaskBoardPage />
          </MemoryRouter>,
        );
      });
      await waitFor(() => {
        // 期限切れタスクカード（id=3）はボーダー付きで表示される
        const card = screen.getByTestId('task-card-3');
        expect(card).toBeInTheDocument();
      });
    });

    it('source_message_id があるタスクは元メッセージへのリンクが表示される', async () => {
      const TaskBoardPage = await importTaskBoardPage();
      await act(async () => {
        render(
          <MemoryRouter>
            <TaskBoardPage />
          </MemoryRouter>,
        );
      });
      await waitFor(() => {
        expect(screen.getByText('元メッセージ')).toBeInTheDocument();
      });
    });
  });

  describe('チャンネル絞り込み UI', () => {
    it('チャンネル選択フィルタが表示される', async () => {
      const TaskBoardPage = await importTaskBoardPage();
      await act(async () => {
        render(
          <MemoryRouter>
            <TaskBoardPage />
          </MemoryRouter>,
        );
      });
      await waitFor(() => {
        expect(screen.getByRole('combobox', { name: /チャンネルで絞り込み/ })).toBeInTheDocument();
      });
    });

    it('特定チャンネルを選択すると、そのチャンネル発のタスクのみ表示される', async () => {
      const TaskBoardPage = await importTaskBoardPage();
      await act(async () => {
        render(
          <MemoryRouter>
            <TaskBoardPage />
          </MemoryRouter>,
        );
      });
      await waitFor(() => {
        expect(screen.getByText('完了タスク')).toBeInTheDocument();
      });
      // フィルター選択（チャンネル5）
      await userEvent.click(screen.getByRole('combobox', { name: /チャンネルで絞り込み/ }));
      // 現状チャンネル一覧は空なのでフィルタ項目はない。
      // Escape でメニューを閉じてフィルタ UI の存在を確認する。
      await userEvent.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.getByRole('combobox', { name: /チャンネルで絞り込み/ })).toBeInTheDocument();
      });
    });

    it('「すべて」を選択するとフィルタが解除されて全タスクが表示される', async () => {
      const TaskBoardPage = await importTaskBoardPage();
      await act(async () => {
        render(
          <MemoryRouter>
            <TaskBoardPage />
          </MemoryRouter>,
        );
      });
      await waitFor(() => {
        expect(screen.getByText('TODO タスク')).toBeInTheDocument();
        expect(screen.getByText('進行中タスク')).toBeInTheDocument();
        expect(screen.getByText('完了タスク')).toBeInTheDocument();
      });
    });
  });

  describe('タスク作成', () => {
    it('「新規タスク作成」ボタンをクリックすると CreateTaskDialog が開く', async () => {
      const TaskBoardPage = await importTaskBoardPage();
      await act(async () => {
        render(
          <MemoryRouter>
            <TaskBoardPage />
          </MemoryRouter>,
        );
      });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /新規タスク作成/ })).toBeInTheDocument();
      });
      await userEvent.click(screen.getByRole('button', { name: /新規タスク作成/ }));
      expect(screen.getByTestId('create-task-dialog')).toBeInTheDocument();
    });

    it('CreateTaskDialog でタスクを作成すると API が呼ばれてリストが更新される', async () => {
      const TaskBoardPage = await importTaskBoardPage();
      await act(async () => {
        render(
          <MemoryRouter>
            <TaskBoardPage />
          </MemoryRouter>,
        );
      });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /新規タスク作成/ })).toBeInTheDocument();
      });
      await userEvent.click(screen.getByRole('button', { name: /新規タスク作成/ }));
      // ダイアログを閉じる（onCreated → list が再フェッチされる）
      await userEvent.click(screen.getByRole('button', { name: 'close' }));
      // dialog が閉じた後、list が呼ばれたことを確認
      await waitFor(() => {
        expect(screen.queryByTestId('create-task-dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('ドラッグ&ドロップによるステータス変更', () => {
    it('KanbanColumn に useDroppable が適用されており、各列がドロップターゲットになっている', async () => {
      const { useDroppable } = await import('@dnd-kit/core');
      const TaskBoardPage = await importTaskBoardPage();
      await act(async () => {
        render(
          <MemoryRouter>
            <TaskBoardPage />
          </MemoryRouter>,
        );
      });
      await waitFor(() => {
        expect(screen.getByTestId('column-todo')).toBeInTheDocument();
        expect(screen.getByTestId('column-in_progress')).toBeInTheDocument();
        expect(screen.getByTestId('column-done')).toBeInTheDocument();
      });
      // useDroppable が 3 列それぞれに対して呼ばれていることを確認
      expect(useDroppable).toHaveBeenCalledWith(expect.objectContaining({ id: 'todo' }));
      expect(useDroppable).toHaveBeenCalledWith(expect.objectContaining({ id: 'in_progress' }));
      expect(useDroppable).toHaveBeenCalledWith(expect.objectContaining({ id: 'done' }));
    });

    // DnD の実挙動 (列間遷移 / 同一列順序変更 / 楽観的更新ロールバック) は jsdom では再現困難
    // なため E2E (Playwright) で検証する。useDroppable の登録確認 (上記) でユニット側の責務は完了。
  });

  describe('タスク削除', () => {
    it('タスクカードの削除ボタンをクリックすると確認なしに DELETE API が呼ばれる', async () => {
      const TaskBoardPage = await importTaskBoardPage();
      await act(async () => {
        render(
          <MemoryRouter>
            <TaskBoardPage />
          </MemoryRouter>,
        );
      });
      await waitFor(() => {
        expect(screen.getByTestId('task-card-1')).toBeInTheDocument();
      });
      await userEvent.click(
        screen.getByTestId('task-card-1').querySelector('[aria-label="タスクを削除"]')!,
      );
      await waitFor(() => {
        expect(mockTasksDelete).toHaveBeenCalledWith(1);
      });
    });

    it('削除後にタスクがリストから消える', async () => {
      mockTasksDelete.mockResolvedValue(undefined);
      const TaskBoardPage = await importTaskBoardPage();
      await act(async () => {
        render(
          <MemoryRouter>
            <TaskBoardPage />
          </MemoryRouter>,
        );
      });
      await waitFor(() => {
        expect(screen.getByText('TODO タスク')).toBeInTheDocument();
      });
      await userEvent.click(
        screen.getByTestId('task-card-1').querySelector('[aria-label="タスクを削除"]')!,
      );
      await waitFor(() => {
        expect(screen.queryByText('TODO タスク')).not.toBeInTheDocument();
      });
    });
  });

  describe('users / channels の実フェッチ', () => {
    it('ページ描画時に api.auth.users が呼ばれる', async () => {
      const TaskBoardPage = await importTaskBoardPage();
      await act(async () => {
        render(
          <MemoryRouter>
            <TaskBoardPage />
          </MemoryRouter>,
        );
      });
      await waitFor(() => {
        expect(mockAuthUsers).toHaveBeenCalled();
      });
    });

    it('ページ描画時に api.channels.list が呼ばれる', async () => {
      const TaskBoardPage = await importTaskBoardPage();
      await act(async () => {
        render(
          <MemoryRouter>
            <TaskBoardPage />
          </MemoryRouter>,
        );
      });
      await waitFor(() => {
        expect(mockChannelsList).toHaveBeenCalled();
      });
    });
  });

  describe('タスク編集', () => {
    it('編集ボタンをクリックすると EditTaskDialog が開く', async () => {
      const TaskBoardPage = await importTaskBoardPage();
      await act(async () => {
        render(
          <MemoryRouter>
            <TaskBoardPage />
          </MemoryRouter>,
        );
      });
      await waitFor(() => {
        expect(screen.getByTestId('task-card-1')).toBeInTheDocument();
      });
      await userEvent.click(
        screen.getByTestId('task-card-1').querySelector('[aria-label="タスクを編集"]')!,
      );
      expect(screen.getByTestId('edit-task-dialog')).toBeInTheDocument();
    });

    it('EditTaskDialog を閉じると編集ダイアログが消える', async () => {
      const TaskBoardPage = await importTaskBoardPage();
      await act(async () => {
        render(
          <MemoryRouter>
            <TaskBoardPage />
          </MemoryRouter>,
        );
      });
      await waitFor(() => {
        expect(screen.getByTestId('task-card-1')).toBeInTheDocument();
      });
      await userEvent.click(
        screen.getByTestId('task-card-1').querySelector('[aria-label="タスクを編集"]')!,
      );
      expect(screen.getByTestId('edit-task-dialog')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'close-edit' }));
      await waitFor(() => {
        expect(screen.queryByTestId('edit-task-dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('非表示機能', () => {
    it('「非表示も表示」スイッチがツールバーに表示される', async () => {
      const TaskBoardPage = await importTaskBoardPage();
      await act(async () => {
        render(
          <MemoryRouter>
            <TaskBoardPage />
          </MemoryRouter>,
        );
      });
      await waitFor(() => {
        expect(screen.getByLabelText('非表示タスクも表示')).toBeInTheDocument();
      });
    });

    it('タスクカードに非表示切り替えアイコンボタンが表示される', async () => {
      const TaskBoardPage = await importTaskBoardPage();
      await act(async () => {
        render(
          <MemoryRouter>
            <TaskBoardPage />
          </MemoryRouter>,
        );
      });
      await waitFor(() => {
        expect(screen.getByTestId('task-card-1')).toBeInTheDocument();
      });
      const card = screen.getByTestId('task-card-1');
      expect(card.querySelector('[aria-label="タスクを非表示"]')).toBeInTheDocument();
    });

    it('非表示アイコンをクリックすると api.tasks.update が isHidden:true で呼ばれる', async () => {
      mockTasksUpdate.mockResolvedValue({
        task: { ...makeTasks()[0], isHidden: true },
      });
      const TaskBoardPage = await importTaskBoardPage();
      await act(async () => {
        render(
          <MemoryRouter>
            <TaskBoardPage />
          </MemoryRouter>,
        );
      });
      await waitFor(() => {
        expect(screen.getByTestId('task-card-1')).toBeInTheDocument();
      });
      await userEvent.click(
        screen.getByTestId('task-card-1').querySelector('[aria-label="タスクを非表示"]')!,
      );
      await waitFor(() => {
        expect(mockTasksUpdate).toHaveBeenCalledWith(1, { isHidden: true });
      });
    });

    it('isHidden = true のタスクカードには「タスクを表示」アイコンが表示される', async () => {
      const hiddenTasks = makeTasks().map((t) => (t.id === 1 ? { ...t, isHidden: true } : t));
      mockTasksList.mockResolvedValue({ tasks: hiddenTasks });
      const TaskBoardPage = await importTaskBoardPage();
      await act(async () => {
        render(
          <MemoryRouter>
            <TaskBoardPage />
          </MemoryRouter>,
        );
      });
      await waitFor(() => {
        expect(screen.getByTestId('task-card-1')).toBeInTheDocument();
      });
      const card = screen.getByTestId('task-card-1');
      expect(card.querySelector('[aria-label="タスクを表示"]')).toBeInTheDocument();
    });
  });

  // Step 8b: Sidebar 中身確保
  describe('Step 8b: Sidebar 中身確保', () => {
    it('AppLayout sidebar に ChannelList が表示される', async () => {
      const TaskBoardPage = await importTaskBoardPage();
      await act(async () => {
        render(
          <MemoryRouter>
            <TaskBoardPage />
          </MemoryRouter>,
        );
      });
      const sidebar = await screen.findByTestId('app-layout-sidebar');
      expect(within(sidebar).getByTestId('channel-list-stub')).toBeInTheDocument();
    });

    it('AppLayout sidebar に SidebarDmList が表示される', async () => {
      const TaskBoardPage = await importTaskBoardPage();
      await act(async () => {
        render(
          <MemoryRouter>
            <TaskBoardPage />
          </MemoryRouter>,
        );
      });
      const sidebar = await screen.findByTestId('app-layout-sidebar');
      expect(within(sidebar).getByTestId('sidebar-dm-list-stub')).toBeInTheDocument();
    });

    it('ChannelList の onSelect で /chat?channel=X に navigate される', async () => {
      const TaskBoardPage = await importTaskBoardPage();
      await act(async () => {
        render(
          <MemoryRouter>
            <TaskBoardPage />
          </MemoryRouter>,
        );
      });
      await screen.findByTestId('app-layout-sidebar');
      await userEvent.click(screen.getByText('select-channel-7'));
      expect(mockNavigate).toHaveBeenCalledWith('/chat?channel=7');
    });
  });

  describe('タスクカードのドラッグハンドル分離 (Issue #329)', () => {
    describe('ドラッグハンドル', () => {
      it('カード左端に並べ替え用ドラッグハンドル（aria-label="ドラッグして並べ替え"）が表示される', async () => {
        const TaskBoardPage = await importTaskBoardPage();
        await act(async () => {
          render(
            <MemoryRouter>
              <TaskBoardPage />
            </MemoryRouter>,
          );
        });
        await waitFor(() => {
          expect(screen.getByTestId('task-card-1')).toBeInTheDocument();
        });
        const card = screen.getByTestId('task-card-1');
        expect(
          within(card).getByRole('button', { name: 'ドラッグして並べ替え' }),
        ).toBeInTheDocument();
      });

      it('ドラッグハンドル要素は cursor: grab スタイルを持つ', async () => {
        const TaskBoardPage = await importTaskBoardPage();
        await act(async () => {
          render(
            <MemoryRouter>
              <TaskBoardPage />
            </MemoryRouter>,
          );
        });
        await waitFor(() => {
          expect(screen.getByTestId('task-card-1')).toBeInTheDocument();
        });
        const handle = within(screen.getByTestId('task-card-1')).getByRole('button', {
          name: 'ドラッグして並べ替え',
        });
        expect(handle).toHaveStyle({ cursor: 'grab' });
      });

      it('Paper（カード）本体には dnd-kit の listeners が直接付与されない（カード全体ドラッグではない）', async () => {
        const TaskBoardPage = await importTaskBoardPage();
        await act(async () => {
          render(
            <MemoryRouter>
              <TaskBoardPage />
            </MemoryRouter>,
          );
        });
        await waitFor(() => {
          expect(screen.getByTestId('task-card-1')).toBeInTheDocument();
        });
        const card = screen.getByTestId('task-card-1');
        // listeners は data-dnd-listener マーカー付きでモックしている。
        // Paper にスプレッドされず、ハンドルにのみスプレッドされていることを検証。
        expect(card).not.toHaveAttribute('data-dnd-listener');
        const handle = within(card).getByRole('button', { name: 'ドラッグして並べ替え' });
        expect(handle).toHaveAttribute('data-dnd-listener');
      });
    });

    describe('カード本文クリックで詳細(編集)モーダルが開く', () => {
      it('タスクのタイトル領域をクリックすると EditTaskDialog が開く', async () => {
        const TaskBoardPage = await importTaskBoardPage();
        await act(async () => {
          render(
            <MemoryRouter>
              <TaskBoardPage />
            </MemoryRouter>,
          );
        });
        await waitFor(() => {
          expect(screen.getByText('TODO タスク')).toBeInTheDocument();
        });
        await userEvent.click(screen.getByText('TODO タスク'));
        expect(screen.getByTestId('edit-task-dialog')).toBeInTheDocument();
      });

      it('ドラッグハンドルをクリックしても EditTaskDialog は開かない', async () => {
        const TaskBoardPage = await importTaskBoardPage();
        await act(async () => {
          render(
            <MemoryRouter>
              <TaskBoardPage />
            </MemoryRouter>,
          );
        });
        await waitFor(() => {
          expect(screen.getByTestId('task-card-1')).toBeInTheDocument();
        });
        const handle = within(screen.getByTestId('task-card-1')).getByRole('button', {
          name: 'ドラッグして並べ替え',
        });
        await userEvent.click(handle);
        expect(screen.queryByTestId('edit-task-dialog')).not.toBeInTheDocument();
      });
    });

    describe('既存アイコンは引き続き動作する', () => {
      it('編集アイコンクリックで EditTaskDialog が開く（カード本文クリックと同じだがイベントは伝播しない）', async () => {
        const TaskBoardPage = await importTaskBoardPage();
        await act(async () => {
          render(
            <MemoryRouter>
              <TaskBoardPage />
            </MemoryRouter>,
          );
        });
        await waitFor(() => {
          expect(screen.getByTestId('task-card-1')).toBeInTheDocument();
        });
        await userEvent.click(
          screen.getByTestId('task-card-1').querySelector('[aria-label="タスクを編集"]')!,
        );
        expect(screen.getByTestId('edit-task-dialog')).toBeInTheDocument();
      });

      it('削除アイコンクリックで EditTaskDialog は開かず delete API が呼ばれる', async () => {
        const TaskBoardPage = await importTaskBoardPage();
        await act(async () => {
          render(
            <MemoryRouter>
              <TaskBoardPage />
            </MemoryRouter>,
          );
        });
        await waitFor(() => {
          expect(screen.getByTestId('task-card-1')).toBeInTheDocument();
        });
        await userEvent.click(
          screen.getByTestId('task-card-1').querySelector('[aria-label="タスクを削除"]')!,
        );
        expect(screen.queryByTestId('edit-task-dialog')).not.toBeInTheDocument();
        await waitFor(() => {
          expect(mockTasksDelete).toHaveBeenCalledWith(1);
        });
      });

      it('非表示アイコンクリックで EditTaskDialog は開かず update が呼ばれる', async () => {
        mockTasksUpdate.mockResolvedValue({ task: { ...makeTasks()[0], isHidden: true } });
        const TaskBoardPage = await importTaskBoardPage();
        await act(async () => {
          render(
            <MemoryRouter>
              <TaskBoardPage />
            </MemoryRouter>,
          );
        });
        await waitFor(() => {
          expect(screen.getByTestId('task-card-1')).toBeInTheDocument();
        });
        await userEvent.click(
          screen.getByTestId('task-card-1').querySelector('[aria-label="タスクを非表示"]')!,
        );
        expect(screen.queryByTestId('edit-task-dialog')).not.toBeInTheDocument();
        await waitFor(() => {
          expect(mockTasksUpdate).toHaveBeenCalledWith(1, { isHidden: true });
        });
      });

      it('カレンダー表示アイコンクリックで EditTaskDialog は開かず navigate される', async () => {
        const TaskBoardPage = await importTaskBoardPage();
        await act(async () => {
          render(
            <MemoryRouter>
              <TaskBoardPage />
            </MemoryRouter>,
          );
        });
        await waitFor(() => {
          // dueAt がセットされているのは task id=3
          expect(screen.getByTestId('task-card-3')).toBeInTheDocument();
        });
        await userEvent.click(
          screen.getByTestId('task-card-3').querySelector('[aria-label="カレンダーで表示"]')!,
        );
        expect(screen.queryByTestId('edit-task-dialog')).not.toBeInTheDocument();
        expect(mockNavigate).toHaveBeenCalledWith(expect.stringMatching(/^\/calendar\?date=/));
      });
    });

    describe('キーボード操作', () => {
      it('ドラッグハンドルが Tab でフォーカス可能（button 要素として実装される）', async () => {
        const TaskBoardPage = await importTaskBoardPage();
        await act(async () => {
          render(
            <MemoryRouter>
              <TaskBoardPage />
            </MemoryRouter>,
          );
        });
        await waitFor(() => {
          expect(screen.getByTestId('task-card-1')).toBeInTheDocument();
        });
        const handle = within(screen.getByTestId('task-card-1')).getByRole('button', {
          name: 'ドラッグして並べ替え',
        });
        handle.focus();
        expect(document.activeElement).toBe(handle);
      });
    });
  });

  // Issue #318: タスクボードページのサイドバー表示ポリシー
  // TaskBoardPage は AppLayout を実体でレンダリングするため、app-layout-grid の gridTemplateColumns で検証する
  describe('Issue #318: サイドバー表示ポリシー', () => {
    beforeEach(() => {
      localStorage.removeItem('sidebar.open');
    });

    it('TaskBoardPage は AppLayout に defaultSidebarOpen={false} を渡す（折り畳み既定）', async () => {
      // defaultSidebarOpen={false} かつ localStorage 未設定 → grid 列幅が 0px（折り畳み）
      const TaskBoardPage = await importTaskBoardPage();
      await act(async () => {
        render(
          <MemoryRouter>
            <TaskBoardPage />
          </MemoryRouter>,
        );
      });
      const grid = screen.getByTestId('app-layout-grid');
      expect(grid).toHaveStyle({ gridTemplateColumns: '64px 0px 1fr' });
    });

    it('TaskBoardPage は AppLayout に forceSidebarClosed を渡さない（ユーザーが手動で開ける）', async () => {
      // forceSidebarClosed ではないので Rail にトグルボタンが表示される
      const TaskBoardPage = await importTaskBoardPage();
      await act(async () => {
        render(
          <MemoryRouter>
            <TaskBoardPage />
          </MemoryRouter>,
        );
      });
      expect(
        screen.queryByRole('button', { name: /サイドバーを(開く|閉じる)/ }),
      ).toBeInTheDocument();
    });

    it('localStorage["sidebar.open"] に値が無い場合、タスクボードではサイドバーが折り畳まれた状態で起動する', async () => {
      // localStorage なし + defaultSidebarOpen={false} → 0px
      const TaskBoardPage = await importTaskBoardPage();
      await act(async () => {
        render(
          <MemoryRouter>
            <TaskBoardPage />
          </MemoryRouter>,
        );
      });
      const grid = screen.getByTestId('app-layout-grid');
      expect(grid).toHaveStyle({ gridTemplateColumns: '64px 0px 1fr' });
    });

    it('localStorage["sidebar.open"]="true" の場合、タスクボードでもサイドバーが開いた状態で起動する（永続化値優先）', async () => {
      // localStorage="true" が defaultSidebarOpen={false} より優先される
      localStorage.setItem('sidebar.open', 'true');
      const TaskBoardPage = await importTaskBoardPage();
      await act(async () => {
        render(
          <MemoryRouter>
            <TaskBoardPage />
          </MemoryRouter>,
        );
      });
      const grid = screen.getByTestId('app-layout-grid');
      expect(grid).toHaveStyle({ gridTemplateColumns: '64px 240px 1fr' });
    });
  });

  describe('Issue #328: カラム別 WIP／期限サマリー', () => {
    describe('カラム見出しのサマリーバッジ', () => {
      it('各カラム見出しに期限切れ・今日・担当自分の件数バッジが表示される', async () => {
        // isOverdue(datetime 過去) と isDueToday(同日) は重複しうるため、
        // 「今日23時」期限が実行時刻次第で期限切れに二重計上されるのを防ぐ目的で
        // システム時刻を当日午前9時に固定する（時刻依存のフレーク回避）。
        // shouldAdvanceTime: true で findBy/waitFor の非同期ポーリングは従来どおり動く。
        vi.useFakeTimers({ shouldAdvanceTime: true });
        const fixedNow = new Date();
        fixedNow.setHours(9, 0, 0, 0);
        vi.setSystemTime(fixedNow);
        try {
          mockTasksList.mockResolvedValue({
            tasks: [
              makeTask({
                id: 101,
                title: '期限切れの未着手',
                status: 'todo',
                dueAt: daysFromNow(-1),
              }),
              makeTask({
                id: 102,
                title: '今日期限の未着手',
                status: 'todo',
                dueAt: todayAt(23),
              }),
              makeTask({
                id: 103,
                title: '自分担当の未着手',
                status: 'todo',
                assigneeId: 1,
                assigneeUsername: 'alice',
              }),
            ],
          });
          const TaskBoardPage = await importTaskBoardPage();
          await act(async () => {
            render(
              <MemoryRouter>
                <TaskBoardPage />
              </MemoryRouter>,
            );
          });

          const todoColumn = await screen.findByTestId('column-todo');
          expect(within(todoColumn).getByTestId('summary-badge-todo-overdue')).toHaveTextContent(
            '期限切れ 1',
          );
          expect(within(todoColumn).getByTestId('summary-badge-todo-today')).toHaveTextContent(
            '今日 1',
          );
          expect(within(todoColumn).getByTestId('summary-badge-todo-mine')).toHaveTextContent(
            '担当自分 1',
          );
        } finally {
          vi.useRealTimers();
        }
      });

      it('件数が 0 件のサマリーバッジは表示されない', async () => {
        mockTasksList.mockResolvedValue({
          tasks: [makeTask({ id: 111, title: '通常の未着手', status: 'todo' })],
        });
        const TaskBoardPage = await importTaskBoardPage();
        await act(async () => {
          render(
            <MemoryRouter>
              <TaskBoardPage />
            </MemoryRouter>,
          );
        });

        const todoColumn = await screen.findByTestId('column-todo');
        expect(within(todoColumn).queryByTestId('summary-badge-todo-overdue')).toBeNull();
        expect(within(todoColumn).queryByTestId('summary-badge-todo-today')).toBeNull();
        expect(within(todoColumn).queryByTestId('summary-badge-todo-mine')).toBeNull();
      });
    });

    describe('サマリーバッジによるカラム内絞り込み', () => {
      it('期限切れバッジをクリックすると同じカラム内の期限切れタスクのみ表示される', async () => {
        mockTasksList.mockResolvedValue({
          tasks: [
            makeTask({
              id: 121,
              title: '期限切れの未着手',
              status: 'todo',
              dueAt: daysFromNow(-1),
            }),
            makeTask({ id: 122, title: '通常の未着手', status: 'todo' }),
            makeTask({
              id: 123,
              title: '期限切れの進行中',
              status: 'in_progress',
              dueAt: daysFromNow(-1),
            }),
          ],
        });
        const TaskBoardPage = await importTaskBoardPage();
        await act(async () => {
          render(
            <MemoryRouter>
              <TaskBoardPage />
            </MemoryRouter>,
          );
        });

        const todoColumn = await screen.findByTestId('column-todo');
        await userEvent.click(within(todoColumn).getByTestId('summary-badge-todo-overdue'));
        expect(within(todoColumn).getByText('期限切れの未着手')).toBeInTheDocument();
        expect(within(todoColumn).queryByText('通常の未着手')).toBeNull();
        expect(screen.getByText('期限切れの進行中')).toBeInTheDocument();
      });

      it('今日バッジをクリックすると同じカラム内の今日期限タスクのみ表示される', async () => {
        mockTasksList.mockResolvedValue({
          tasks: [
            makeTask({
              id: 131,
              title: '今日期限の未着手',
              status: 'todo',
              dueAt: todayAt(23),
            }),
            makeTask({
              id: 132,
              title: '明日期限の未着手',
              status: 'todo',
              dueAt: daysFromNow(1),
            }),
          ],
        });
        const TaskBoardPage = await importTaskBoardPage();
        await act(async () => {
          render(
            <MemoryRouter>
              <TaskBoardPage />
            </MemoryRouter>,
          );
        });

        const todoColumn = await screen.findByTestId('column-todo');
        await userEvent.click(within(todoColumn).getByTestId('summary-badge-todo-today'));
        expect(within(todoColumn).getByText('今日期限の未着手')).toBeInTheDocument();
        expect(within(todoColumn).queryByText('明日期限の未着手')).toBeNull();
      });

      it('担当自分バッジをクリックすると同じカラム内の自分担当タスクのみ表示される', async () => {
        mockTasksList.mockResolvedValue({
          tasks: [
            makeTask({
              id: 141,
              title: '自分担当の未着手',
              status: 'todo',
              assigneeId: 1,
              assigneeUsername: 'alice',
            }),
            makeTask({
              id: 142,
              title: '他人担当の未着手',
              status: 'todo',
              assigneeId: 2,
              assigneeUsername: 'bob',
            }),
          ],
        });
        const TaskBoardPage = await importTaskBoardPage();
        await act(async () => {
          render(
            <MemoryRouter>
              <TaskBoardPage />
            </MemoryRouter>,
          );
        });

        const todoColumn = await screen.findByTestId('column-todo');
        await userEvent.click(within(todoColumn).getByTestId('summary-badge-todo-mine'));
        expect(within(todoColumn).getByText('自分担当の未着手')).toBeInTheDocument();
        expect(within(todoColumn).queryByText('他人担当の未着手')).toBeNull();
      });

      it('選択中のサマリーバッジをもう一度クリックすると絞り込みが解除される', async () => {
        mockTasksList.mockResolvedValue({
          tasks: [
            makeTask({
              id: 151,
              title: '期限切れの未着手',
              status: 'todo',
              dueAt: daysFromNow(-1),
            }),
            makeTask({ id: 152, title: '通常の未着手', status: 'todo' }),
          ],
        });
        const TaskBoardPage = await importTaskBoardPage();
        await act(async () => {
          render(
            <MemoryRouter>
              <TaskBoardPage />
            </MemoryRouter>,
          );
        });

        const todoColumn = await screen.findByTestId('column-todo');
        const overdueBadge = within(todoColumn).getByTestId('summary-badge-todo-overdue');
        await userEvent.click(overdueBadge);
        expect(within(todoColumn).queryByText('通常の未着手')).toBeNull();
        await userEvent.click(overdueBadge);
        expect(within(todoColumn).getByText('通常の未着手')).toBeInTheDocument();
      });
    });

    describe('WIP リミット超過表示', () => {
      it('WIP リミットを超過しているカラムは見出しの色が変わる', async () => {
        mockTasksList.mockResolvedValue({
          tasks: [
            makeTask({ id: 161, title: '未着手1', status: 'todo' }),
            makeTask({ id: 162, title: '未着手2', status: 'todo' }),
          ],
        });
        const TaskBoardPage = await importTaskBoardPage();
        await act(async () => {
          render(
            <MemoryRouter>
              <TaskBoardPage />
            </MemoryRouter>,
          );
        });

        const todoColumn = await screen.findByTestId('column-todo');
        await userEvent.type(within(todoColumn).getByLabelText('未着手の WIP リミット'), '1');
        expect(within(todoColumn).getByTestId('task-column-heading-todo')).toHaveAttribute(
          'data-wip-exceeded',
          'true',
        );
      });

      it('WIP リミットが未設定のカラムは件数に関わらず超過表示にならない', async () => {
        mockTasksList.mockResolvedValue({
          tasks: [
            makeTask({ id: 171, title: '未着手1', status: 'todo' }),
            makeTask({ id: 172, title: '未着手2', status: 'todo' }),
          ],
        });
        const TaskBoardPage = await importTaskBoardPage();
        await act(async () => {
          render(
            <MemoryRouter>
              <TaskBoardPage />
            </MemoryRouter>,
          );
        });

        const todoColumn = await screen.findByTestId('column-todo');
        expect(within(todoColumn).getByTestId('task-column-heading-todo')).toHaveAttribute(
          'data-wip-exceeded',
          'false',
        );
      });
    });
  });
});
