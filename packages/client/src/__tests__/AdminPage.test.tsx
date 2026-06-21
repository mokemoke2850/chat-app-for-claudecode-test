/**
 * AdminPage のテスト
 *
 * テスト対象: packages/client/src/pages/AdminPage.tsx
 * 戦略: vi.mock('../api/client') でAPIをモック化し、
 * 統計・ユーザー管理・チャンネル管理の各タブの動作を検証する。
 */

import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

let user: ReturnType<typeof userEvent.setup>;
import { MemoryRouter } from 'react-router-dom';
import AdminPage from '../pages/AdminPage';
import type {
  AdminUser,
  AdminChannel,
  AdminStats,
  AdminHealthDetails,
  OrphanFile,
} from '../types/admin';

const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

// Step 8a: AppLayout を最小スタブ化
vi.mock('../components/Layout/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout-stub">{children}</div>
  ),
}));

const mockAdminUsers: AdminUser[] = [
  {
    id: 1,
    username: 'alice',
    email: 'alice@example.com',
    role: 'admin',
    isActive: true,
    lastLoginAt: '2025-01-10T00:00:00Z',
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    username: 'bob',
    email: 'bob@example.com',
    role: 'user',
    isActive: true,
    lastLoginAt: '2025-01-09T00:00:00Z',
    createdAt: '2024-01-02T00:00:00Z',
  },
  {
    id: 3,
    username: 'carol',
    email: 'carol@example.com',
    role: 'user',
    isActive: false,
    lastLoginAt: null,
    createdAt: '2024-01-03T00:00:00Z',
  },
];

const mockAdminChannels: AdminChannel[] = [
  {
    id: 1,
    name: 'general',
    description: null,
    isPrivate: false,
    memberCount: 3,
    isArchived: false,
    isRecommended: false,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    name: 'secret',
    description: 'private channel',
    isPrivate: true,
    memberCount: 1,
    isArchived: true,
    isRecommended: true,
    createdAt: '2024-01-02T00:00:00Z',
  },
];

const mockStats: AdminStats = {
  totalUsers: 42,
  totalChannels: 12,
  totalMessages: 1840,
  activeUsersLast24h: 5,
  activeUsersLast7d: 20,
};

const mockHealthDetails: AdminHealthDetails = {
  checkedAt: '2026-01-01T00:00:00.000Z',
  overallStatus: 'warning',
  components: {
    database: {
      status: 'normal',
      reachable: true,
      latencyMs: 12,
      message: 'DB は応答しています',
    },
    socket: {
      status: 'normal',
      running: true,
      connectionCount: 3,
      message: 'Socket サーバーは稼働しています',
    },
    jobs: {
      status: 'warning',
      workers: [
        {
          key: 'scheduledMessages',
          label: '予約送信',
          status: 'normal',
          running: true,
          intervalMs: 30000,
        },
        {
          key: 'calendarReminders',
          label: 'カレンダーリマインダー',
          status: 'warning',
          running: false,
          intervalMs: 30000,
        },
      ],
      message: '停止中のジョブがあります',
    },
    storage: {
      status: 'error',
      writable: false,
      totalBytes: 2048,
      fileCount: 4,
      path: '/tmp/uploads',
      message: 'ストレージへ書き込めません',
    },
  },
};

const mockJobMonitoring = { jobs: [
  { key: 'scheduledMessages' as const, label: '予約送信', intervalMs: 30000, status: 'normal' as const,
    lastRunAt: '2030-01-01T00:00:00.000Z', nextRunAt: '2030-01-01T00:00:30.000Z',
    successCount: 5, failureCount: 1, lastFailure: { message: '送信失敗', at: '2029-12-31T23:59:00.000Z' } },
  { key: 'calendarReminders' as const, label: 'カレンダーリマインダー', intervalMs: 30000,
    status: 'warning' as const, lastRunAt: null, nextRunAt: null, successCount: 0, failureCount: 0, lastFailure: null },
] };

vi.mock('../api/client', () => ({
  api: {
    admin: {
      getStats: vi.fn(),
      getTimeseries: vi.fn(),
      getChannelTimeseries: vi.fn(),
      getTopChannels: vi.fn(),
      getHealthDetails: vi.fn(),
      getJobMonitoring: vi.fn(),
      getUsers: vi.fn(),
      getChannels: vi.fn(),
      getOrphanFiles: vi.fn(),
      deleteOrphanFiles: vi.fn(),
      updateUserRole: vi.fn(),
      updateUserStatus: vi.fn(),
      deleteUser: vi.fn(),
      deleteChannel: vi.fn(),
      unarchiveChannel: vi.fn(),
      setChannelRecommended: vi.fn(),
      maintenance: {
        get: vi.fn(),
        update: vi.fn(),
      },
      settings: {
        export: vi.fn(),
        previewImport: vi.fn(),
        import: vi.fn(),
      },
      ngWords: {
        list: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      blockedExtensions: {
        list: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
      },
      reports: {
        list: vi.fn(),
        dismiss: vi.fn(),
        action: vi.fn(),
      },
    },
  },
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const mockShowError = vi.hoisted(() => vi.fn());
const mockShowSuccess = vi.hoisted(() => vi.fn());

vi.mock('../contexts/SnackbarContext', () => ({
  useSnackbar: () => ({
    showError: mockShowError,
    showSuccess: mockShowSuccess,
    showInfo: vi.fn(),
  }),
}));

import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

const mockedApi = api as unknown as {
  admin: {
    getStats: ReturnType<typeof vi.fn>;
    getTimeseries: ReturnType<typeof vi.fn>;
    getChannelTimeseries: ReturnType<typeof vi.fn>;
    getTopChannels: ReturnType<typeof vi.fn>;
    getHealthDetails: ReturnType<typeof vi.fn>;
    getJobMonitoring: ReturnType<typeof vi.fn>;
    getUsers: ReturnType<typeof vi.fn>;
    getChannels: ReturnType<typeof vi.fn>;
    getOrphanFiles: ReturnType<typeof vi.fn>;
    deleteOrphanFiles: ReturnType<typeof vi.fn>;
    updateUserRole: ReturnType<typeof vi.fn>;
    updateUserStatus: ReturnType<typeof vi.fn>;
    deleteUser: ReturnType<typeof vi.fn>;
    deleteChannel: ReturnType<typeof vi.fn>;
    unarchiveChannel: ReturnType<typeof vi.fn>;
    setChannelRecommended: ReturnType<typeof vi.fn>;
    maintenance: {
      get: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    settings: {
      export: ReturnType<typeof vi.fn>;
      previewImport: ReturnType<typeof vi.fn>;
      import: ReturnType<typeof vi.fn>;
    };
    ngWords: {
      list: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    blockedExtensions: {
      list: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    reports: {
      list: ReturnType<typeof vi.fn>;
      dismiss: ReturnType<typeof vi.fn>;
      action: ReturnType<typeof vi.fn>;
    };
  };
};
const mockedUseAuth = useAuth as ReturnType<typeof vi.fn>;

/** use() + Suspense をフラッシュするため await act でラップする */
async function renderAdminPage() {
  await act(async () => {
    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>,
    );
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
  mockedUseAuth.mockReturnValue({
    user: { id: 1, username: 'alice', role: 'admin', isActive: true },
  });
  mockedApi.admin.getStats.mockResolvedValue(mockStats);
  mockedApi.admin.getTimeseries.mockResolvedValue({ messages: [], activeUsers: [] });
  mockedApi.admin.getChannelTimeseries.mockResolvedValue({ messagesByChannel: [] });
  mockedApi.admin.getTopChannels.mockResolvedValue({ channels: [] });
  mockedApi.admin.getHealthDetails.mockResolvedValue(mockHealthDetails);
  mockedApi.admin.getJobMonitoring.mockResolvedValue(mockJobMonitoring);
  mockedApi.admin.getUsers.mockResolvedValue({ users: mockAdminUsers });
  mockedApi.admin.getChannels.mockResolvedValue({ channels: mockAdminChannels });
  mockedApi.admin.getOrphanFiles.mockResolvedValue({ files: [] });
  mockedApi.admin.deleteOrphanFiles.mockResolvedValue({
    deletedCount: 0,
    deletedIds: [],
    skippedIds: [],
    failed: [],
  });
  mockedApi.admin.updateUserRole.mockResolvedValue({ success: true });
  mockedApi.admin.updateUserStatus.mockResolvedValue({ success: true });
  mockedApi.admin.deleteUser.mockResolvedValue(undefined);
  mockedApi.admin.deleteChannel.mockResolvedValue(undefined);
  mockedApi.admin.unarchiveChannel.mockResolvedValue({
    channel: { id: 2, name: 'secret', isArchived: false },
  });
  mockedApi.admin.setChannelRecommended.mockResolvedValue({
    channel: { id: 1, isRecommended: true },
  });
  mockedApi.admin.maintenance.get.mockResolvedValue({
    settings: {
      enabled: false,
      message: '',
      restrictedOperations: [],
      updatedAt: null,
    },
  });
  mockedApi.admin.maintenance.update.mockResolvedValue({
    settings: {
      enabled: true,
      message: 'メンテナンス中です',
      restrictedOperations: ['posting'],
      updatedAt: '2026-01-01T00:00:00Z',
    },
  });
  mockedApi.admin.settings.export.mockResolvedValue({
    schemaVersion: 1,
    exportedAt: '2026-01-01T00:00:00.000Z',
    channels: [],
    notifications: [],
    ngWords: [],
    permissions: [],
  });
  mockedApi.admin.settings.previewImport.mockResolvedValue({
    valid: true,
    diff: {
      channels: { added: 1, updated: 0, removed: 0 },
      notifications: { added: 0, updated: 0, removed: 0 },
      ngWords: { added: 0, updated: 0, removed: 0 },
      permissions: { updated: 0 },
    },
  });
  mockedApi.admin.settings.import.mockResolvedValue({
    valid: true,
    diff: {
      channels: { added: 1, updated: 0, removed: 0 },
      notifications: { added: 0, updated: 0, removed: 0 },
      ngWords: { added: 0, updated: 0, removed: 0 },
      permissions: { updated: 0 },
    },
  });
  mockedApi.admin.ngWords.list.mockResolvedValue({ ngWords: [] });
  mockedApi.admin.ngWords.create.mockResolvedValue({
    ngWord: {
      id: 1,
      pattern: 'foo',
      isRegex: false,
      action: 'block',
      isActive: true,
      createdBy: 1,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
  });
  mockedApi.admin.ngWords.update.mockResolvedValue({
    ngWord: {
      id: 1,
      pattern: 'foo',
      isRegex: false,
      action: 'warn',
      isActive: true,
      createdBy: 1,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
  });
  mockedApi.admin.ngWords.delete.mockResolvedValue(undefined);
  mockedApi.admin.blockedExtensions.list.mockResolvedValue({ blockedExtensions: [] });
  mockedApi.admin.blockedExtensions.create.mockResolvedValue({
    blockedExtension: {
      id: 1,
      extension: 'exe',
      reason: null,
      createdBy: 1,
      createdAt: '2024-01-01T00:00:00Z',
    },
  });
  mockedApi.admin.blockedExtensions.delete.mockResolvedValue(undefined);
  mockedApi.admin.reports.list.mockResolvedValue({
    reports: [
      {
        id: 1,
        messageId: 10,
        channelId: 100,
        reporterId: 2,
        reporterUsername: 'bob',
        reason: 'spam',
        comment: null,
        status: 'pending',
        actionTaken: null,
        handledBy: null,
        handledAt: null,
        createdAt: '2025-01-01T00:00:00Z',
      },
    ],
  });
  mockedApi.admin.reports.dismiss.mockResolvedValue({ report: {} });
  mockedApi.admin.reports.action.mockResolvedValue({ report: {} });
});

describe('AdminPage: 統計タブ', () => {
  it('統計カード（ユーザー数・チャンネル数・総メッセージ数）が表示される', async () => {
    await renderAdminPage();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('1,840')).toBeInTheDocument();
  });
});

describe('AdminPage: ユーザー管理タブ', () => {
  async function openUsersTab() {
    await renderAdminPage();
    await user.click(screen.getByRole('tab', { name: 'ユーザー管理' }));
    await act(async () => {});
    await waitFor(() => expect(screen.getByText('bob')).toBeInTheDocument());
  }

  it('ユーザー一覧テーブルが表示される', async () => {
    await openUsersTab();
    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText('bob')).toBeInTheDocument();
    expect(screen.getByText('carol')).toBeInTheDocument();
  });

  it('ロール変更ボタンを押すと updateUserRole が呼ばれる', async () => {
    await openUsersTab();
    // bob (id=2, role='user') の「admin に変更」ボタン
    const roleButtons = screen.getAllByRole('button', { name: 'admin に変更' });
    await user.click(roleButtons[0]);
    expect(mockedApi.admin.updateUserRole).toHaveBeenCalledWith(2, 'admin');
  });

  it('停止ボタンを押すと updateUserStatus が bob (id=2) を対象に呼ばれる', async () => {
    await openUsersTab();
    // alice は自分自身のため停止ボタンが最初に出るのは bob (id=2)
    const suspendButtons = screen.getAllByRole('button', { name: '停止' });
    await user.click(suspendButtons[0]);
    expect(mockedApi.admin.updateUserStatus).toHaveBeenCalledWith(2, false);
  });

  it('削除ボタンを押すと確認ダイアログが表示される', async () => {
    await openUsersTab();
    const deleteButtons = screen.getAllByRole('button', { name: '削除' });
    await user.click(deleteButtons[0]);
    expect(screen.getByText('ユーザーを削除しますか？')).toBeInTheDocument();
  });

  it('確認ダイアログで「削除」を押すと deleteUser が呼ばれる', async () => {
    await openUsersTab();
    const deleteButtons = screen.getAllByRole('button', { name: '削除' });
    await user.click(deleteButtons[0]);
    // ダイアログ内の「削除」ボタンをクリック
    const confirmButtons = screen.getAllByRole('button', { name: '削除' });
    await user.click(confirmButtons[confirmButtons.length - 1]);
    expect(mockedApi.admin.deleteUser).toHaveBeenCalled();
  });

  it('自分自身（alice, id=1）の行にはロール変更・削除ボタンが非表示', async () => {
    await openUsersTab();
    // alice 行のセルを探す（1行目 = alice）
    const rows = screen.getAllByRole('row');
    const aliceRow = rows.find((r) => r.textContent?.includes('alice'));
    expect(aliceRow).toBeDefined();
    // alice 行内に「admin に変更」「user に変更」「削除」ボタンがないこと
    const buttonsInRow = aliceRow!.querySelectorAll('button');
    const labels = Array.from(buttonsInRow).map((b) => b.textContent);
    expect(labels).not.toContain('admin に変更');
    expect(labels).not.toContain('user に変更');
    expect(labels).not.toContain('削除');
  });
});

describe('AdminPage: チャンネル管理タブ', () => {
  async function openChannelsTab() {
    await renderAdminPage();
    await user.click(screen.getByRole('tab', { name: 'チャンネル管理' }));
    await act(async () => {});
    await waitFor(() => expect(screen.getByText('general')).toBeInTheDocument());
  }

  it('チャンネル一覧テーブルが表示される', async () => {
    await openChannelsTab();
    expect(screen.getByText('general')).toBeInTheDocument();
    expect(screen.getByText('secret')).toBeInTheDocument();
  });

  it('アーカイブ済みチャンネルにはアーカイブ済みChipが表示される', async () => {
    await openChannelsTab();
    expect(screen.getByText('アーカイブ済み')).toBeInTheDocument();
  });

  it('アーカイブ済みチャンネルの「アーカイブ解除」ボタンを押すと unarchiveChannel が呼ばれる', async () => {
    await openChannelsTab();
    const unarchiveButton = screen.getByRole('button', { name: 'アーカイブ解除' });
    await user.click(unarchiveButton);
    expect(mockedApi.admin.unarchiveChannel).toHaveBeenCalledWith(2);
  });

  it('削除ボタンを押すと確認ダイアログ → deleteChannel が呼ばれる', async () => {
    await openChannelsTab();
    const deleteButtons = screen.getAllByRole('button', { name: '削除' });
    await user.click(deleteButtons[0]);
    expect(screen.getByText('チャンネルを削除しますか？')).toBeInTheDocument();
    const confirmButtons = screen.getAllByRole('button', { name: '削除' });
    await user.click(confirmButtons[confirmButtons.length - 1]);
    expect(mockedApi.admin.deleteChannel).toHaveBeenCalled();
  });
});

describe('AdminPage: エラーハンドリング', () => {
  it('getStats が reject するとエラーメッセージが表示される', async () => {
    mockedApi.admin.getStats.mockRejectedValue(new Error('サーバーエラー'));
    // ErrorBoundary がエラーをキャッチするため console.error を抑制
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await renderAdminPage();
    expect(screen.getByText(/エラーが発生しました/)).toBeInTheDocument();
    spy.mockRestore();
  });

  it('updateUserRole が reject してもユーザーリストの状態は変化しない', async () => {
    mockedApi.admin.updateUserRole.mockRejectedValue(new Error('権限エラー'));
    await renderAdminPage();
    await user.click(screen.getByRole('tab', { name: 'ユーザー管理' }));
    await act(async () => {});
    await waitFor(() => expect(screen.getByText('bob')).toBeInTheDocument());

    // bob のロール変更を試みる（API は reject）
    const roleButtons = screen.getAllByRole('button', { name: 'admin に変更' });
    await user.click(roleButtons[0]);

    // setUsers が呼ばれないため bob のロールは 'user' のまま
    await waitFor(() => {
      const chips = screen.getAllByText('user');
      // bob と carol の user ロールチップが残っていること
      expect(chips.length).toBeGreaterThanOrEqual(2);
    });
  });
});

describe('AdminPage: 非管理者アクセス', () => {
  it('非管理者ユーザーはトップページにリダイレクトされる', async () => {
    mockedUseAuth.mockReturnValue({
      user: { id: 2, username: 'bob', role: 'user', isActive: true },
    });
    await renderAdminPage();
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });
});

/**
 * おすすめチャンネル設定 UI のテスト（Issue #114）
 */
describe('AdminPage: おすすめチャンネル設定', () => {
  async function openChannelsTabForRecommend() {
    await renderAdminPage();
    await user.click(screen.getByRole('tab', { name: 'チャンネル管理' }));
    await act(async () => {});
    await waitFor(() => expect(screen.getByText('general')).toBeInTheDocument());
  }

  it('チャンネル管理タブの各行に isRecommended のチェックボックス（または切替ボタン）が表示される', async () => {
    await openChannelsTabForRecommend();
    // おすすめチェックボックスが各行に存在する（aria-label="おすすめ" などで識別）
    const checkboxes = screen.getAllByRole('checkbox', { name: /おすすめ/ });
    expect(checkboxes.length).toBeGreaterThan(0);
  });

  it('チェックボックスを ON にすると admin.setChannelRecommended が true で呼ばれる', async () => {
    // general (id=1) は isRecommended=false なので ON にする
    mockedApi.admin.setChannelRecommended.mockResolvedValue({
      channel: { id: 1, name: 'general', isRecommended: true },
    });
    await openChannelsTabForRecommend();
    const unchecked = screen
      .getAllByRole('checkbox', { name: /おすすめ/ })
      .filter((el) => !(el as HTMLInputElement).checked);
    await user.click(unchecked[0]);
    await waitFor(() =>
      expect(mockedApi.admin.setChannelRecommended).toHaveBeenCalledWith(1, true),
    );
  });

  it('チェックボックスを OFF にすると admin.setChannelRecommended が false で呼ばれる', async () => {
    // secret (id=2) は isRecommended=true なので OFF にする
    mockedApi.admin.setChannelRecommended.mockResolvedValue({
      channel: { id: 2, name: 'secret', isRecommended: false },
    });
    await openChannelsTabForRecommend();
    const checked = screen
      .getAllByRole('checkbox', { name: /おすすめ/ })
      .filter((el) => (el as HTMLInputElement).checked);
    await user.click(checked[0]);
    await waitFor(() =>
      expect(mockedApi.admin.setChannelRecommended).toHaveBeenCalledWith(2, false),
    );
  });

  it('API 成功後に一覧の表示が更新される（楽観的更新 or 再取得）', async () => {
    mockedApi.admin.setChannelRecommended.mockResolvedValue({
      channel: { id: 1, name: 'general', isRecommended: true },
    });
    await openChannelsTabForRecommend();
    const unchecked = screen
      .getAllByRole('checkbox', { name: /おすすめ/ })
      .filter((el) => !(el as HTMLInputElement).checked);
    await user.click(unchecked[0]);
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox', { name: /おすすめ/ });
      const checkedCount = checkboxes.filter((el) => (el as HTMLInputElement).checked).length;
      // 楽観的更新で general も checked になる
      expect(checkedCount).toBeGreaterThan(0);
    });
  });

  it('API 失敗時はスナックバーでエラー通知し、チェック状態は元に戻る', async () => {
    mockedApi.admin.setChannelRecommended.mockRejectedValue(new Error('server error'));
    await openChannelsTabForRecommend();
    const unchecked = screen
      .getAllByRole('checkbox', { name: /おすすめ/ })
      .filter((el) => !(el as HTMLInputElement).checked);
    await user.click(unchecked[0]);
    await waitFor(() => expect(mockShowError).toHaveBeenCalled());
  });
});

// #117 NG ワード / 添付制限 — モデレーション設定タブ
describe('AdminPage: モデレーション設定タブ (#117)', () => {
  /** モデレーションタブを開くヘルパー */
  async function openModerationTab() {
    await renderAdminPage();
    await user.click(screen.getByRole('tab', { name: /モデレーション設定/ }));
  }

  describe('NG ワード管理', () => {
    it('モデレーションタブを開くと NG ワード一覧が表示される', async () => {
      mockedApi.admin.ngWords.list.mockResolvedValue({
        ngWords: [
          {
            id: 1,
            pattern: 'evil',
            isRegex: false,
            action: 'block',
            isActive: true,
            createdBy: 1,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ],
      });
      await openModerationTab();
      await waitFor(() => expect(screen.getByText('evil')).toBeInTheDocument());
    });

    it('「NGワード追加」ボタン → 入力 → 保存で api.admin.ngWords.create が呼ばれる', async () => {
      await openModerationTab();
      await waitFor(() => expect(mockedApi.admin.ngWords.list).toHaveBeenCalled());

      await user.click(screen.getByRole('button', { name: /NG ワードを追加/ }));
      await user.type(screen.getByLabelText('NG ワードのパターン'), 'badword');
      await user.click(screen.getByRole('button', { name: /^追加$/ }));

      await waitFor(() =>
        expect(mockedApi.admin.ngWords.create).toHaveBeenCalledWith(
          expect.objectContaining({ pattern: 'badword' }),
        ),
      );
    });

    it('追加成功後、一覧に新しい NG ワードが表示される', async () => {
      mockedApi.admin.ngWords.list.mockResolvedValueOnce({ ngWords: [] }).mockResolvedValue({
        ngWords: [
          {
            id: 1,
            pattern: 'fresh',
            isRegex: false,
            action: 'block',
            isActive: true,
            createdBy: 1,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ],
      });
      await openModerationTab();
      await user.click(screen.getByRole('button', { name: /NG ワードを追加/ }));
      await user.type(screen.getByLabelText('NG ワードのパターン'), 'fresh');
      await user.click(screen.getByRole('button', { name: /^追加$/ }));

      await waitFor(() => expect(screen.getByText('fresh')).toBeInTheDocument());
    });

    it('行のアクション（block/warn）切替で api.admin.ngWords.update が呼ばれる', async () => {
      mockedApi.admin.ngWords.list.mockResolvedValue({
        ngWords: [
          {
            id: 7,
            pattern: 'sw',
            isRegex: false,
            action: 'block',
            isActive: true,
            createdBy: 1,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ],
      });
      await openModerationTab();
      await waitFor(() => screen.getByText('sw'));

      // テーブル行内のアクション select を変更
      const select = screen.getByLabelText('sw の動作');
      await user.click(select);
      await user.click(await screen.findByRole('option', { name: /warn/ }));

      await waitFor(() =>
        expect(mockedApi.admin.ngWords.update).toHaveBeenCalledWith(
          7,
          expect.objectContaining({ action: 'warn' }),
        ),
      );
    });

    it('行の有効/無効切替で api.admin.ngWords.update が呼ばれる', async () => {
      mockedApi.admin.ngWords.list.mockResolvedValue({
        ngWords: [
          {
            id: 8,
            pattern: 'tg',
            isRegex: false,
            action: 'block',
            isActive: true,
            createdBy: 1,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ],
      });
      await openModerationTab();
      await waitFor(() => screen.getByText('tg'));

      const switchEl = screen.getByLabelText('tg を有効化');
      await user.click(switchEl);

      await waitFor(() =>
        expect(mockedApi.admin.ngWords.update).toHaveBeenCalledWith(
          8,
          expect.objectContaining({ isActive: false }),
        ),
      );
    });

    it('削除ボタンで api.admin.ngWords.delete が呼ばれる', async () => {
      mockedApi.admin.ngWords.list.mockResolvedValue({
        ngWords: [
          {
            id: 9,
            pattern: 'rm',
            isRegex: false,
            action: 'block',
            isActive: true,
            createdBy: 1,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ],
      });
      await openModerationTab();
      await waitFor(() => screen.getByText('rm'));

      await user.click(screen.getByRole('button', { name: 'rm を削除' }));

      await waitFor(() => expect(mockedApi.admin.ngWords.delete).toHaveBeenCalledWith(9));
    });

    it('API 失敗時はスナックバーでエラー通知が出る', async () => {
      mockedApi.admin.ngWords.list.mockRejectedValue(new Error('boom'));
      await openModerationTab();
      await waitFor(() => expect(mockShowError).toHaveBeenCalled());
    });
  });

  describe('添付拡張子ブロックリスト', () => {
    it('登録済みの拡張子一覧が表示される', async () => {
      mockedApi.admin.blockedExtensions.list.mockResolvedValue({
        blockedExtensions: [
          {
            id: 1,
            extension: 'exe',
            reason: 'security',
            createdBy: 1,
            createdAt: '2024-01-01T00:00:00Z',
          },
        ],
      });
      await openModerationTab();
      await waitFor(() => expect(screen.getByText('.exe')).toBeInTheDocument());
    });

    it('「拡張子追加」ボタン → 入力 → 保存で api.admin.blockedExtensions.create が呼ばれる', async () => {
      await openModerationTab();
      await waitFor(() => expect(mockedApi.admin.blockedExtensions.list).toHaveBeenCalled());

      await user.click(screen.getByRole('button', { name: /拡張子を追加/ }));
      await user.type(screen.getByLabelText('拡張子'), 'bat');
      await user.click(screen.getByRole('button', { name: /^追加$/ }));

      await waitFor(() =>
        expect(mockedApi.admin.blockedExtensions.create).toHaveBeenCalledWith(
          expect.objectContaining({ extension: 'bat' }),
        ),
      );
    });

    it('削除ボタンで api.admin.blockedExtensions.delete が呼ばれる', async () => {
      mockedApi.admin.blockedExtensions.list.mockResolvedValue({
        blockedExtensions: [
          {
            id: 5,
            extension: 'cmd',
            reason: null,
            createdBy: 1,
            createdAt: '2024-01-01T00:00:00Z',
          },
        ],
      });
      await openModerationTab();
      await waitFor(() => screen.getByText('.cmd'));

      await user.click(screen.getByRole('button', { name: '.cmd を削除' }));

      await waitFor(() => expect(mockedApi.admin.blockedExtensions.delete).toHaveBeenCalledWith(5));
    });
  });

  describe('権限', () => {
    it('非管理者ユーザーがアクセスするとモデレーションタブが見えない（既存の admin ガード仕様）', async () => {
      mockedUseAuth.mockReturnValue({
        user: { id: 2, username: 'bob', role: 'user', isActive: true },
      });
      await renderAdminPage();
      // 既存仕様: 非管理者は「Forbidden」表示（タブ全体が非表示）
      expect(screen.queryByRole('tab', { name: /モデレーション設定/ })).not.toBeInTheDocument();
    });
  });
});

// #116 通報キュータブ
describe('AdminPage: 通報キュータブ (#116)', () => {
  async function openReportQueueTab() {
    await renderAdminPage();
    await user.click(screen.getByRole('tab', { name: /通報キュー/ }));
    await act(async () => {});
  }

  it('「通報キュー」タブが存在する', async () => {
    await renderAdminPage();
    expect(screen.getByRole('tab', { name: /通報キュー/ })).toBeInTheDocument();
  });

  it('通報キュータブを開くと通報一覧が表示される', async () => {
    await openReportQueueTab();
    await waitFor(() => expect(screen.getByText('bob')).toBeInTheDocument());
    expect(mockedApi.admin.reports.list).toHaveBeenCalled();
  });
});

// Step 8a: AppLayout 適用拡大
describe('AdminPage: Step 8a: AppLayout 化', () => {
  it('admin ユーザーで AppLayout 内にレンダリングされる', async () => {
    await renderAdminPage();
    expect(screen.getByTestId('app-layout-stub')).toBeInTheDocument();
  });

  it('独自 AppBar (position="fixed") が撤去されている', async () => {
    await renderAdminPage();
    expect(document.querySelector('.MuiAppBar-positionFixed')).toBeNull();
  });

  it('AppLayout 内に統一見出し行「管理画面」が表示される', async () => {
    await renderAdminPage();
    const layout = screen.getByTestId('app-layout-stub');
    expect(within(layout).getByRole('heading', { name: '管理画面' })).toBeInTheDocument();
  });

  it('非管理者はトップにリダイレクトされる (既存挙動維持)', async () => {
    mockedUseAuth.mockReturnValue({
      user: { id: 2, username: 'bob', role: 'user', isActive: true },
    });
    await renderAdminPage();
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('8 つのタブが AppLayout 内に表示される', async () => {
    await renderAdminPage();
    const layout = screen.getByTestId('app-layout-stub');
    expect(within(layout).getByRole('tab', { name: '統計' })).toBeInTheDocument();
    expect(within(layout).getByRole('tab', { name: 'ユーザー管理' })).toBeInTheDocument();
    expect(within(layout).getByRole('tab', { name: 'チャンネル管理' })).toBeInTheDocument();
    expect(within(layout).getByRole('tab', { name: '監査ログ' })).toBeInTheDocument();
    expect(within(layout).getByRole('tab', { name: /モデレーション設定/ })).toBeInTheDocument();
    expect(within(layout).getByRole('tab', { name: /通報キュー/ })).toBeInTheDocument();
    expect(within(layout).getByRole('tab', { name: /メンテナンスモード/ })).toBeInTheDocument();
    expect(within(layout).getByRole('tab', { name: /設定入出力/ })).toBeInTheDocument();
  });
});

// #392 管理者向けメンテナンスモード
describe('AdminPage: メンテナンスモード設定 (#392)', () => {
  async function openMaintenanceTab() {
    await renderAdminPage();
    await user.click(screen.getByRole('tab', { name: /メンテナンスモード/ }));
    await waitFor(() => expect(screen.getByLabelText('告知メッセージ')).toBeInTheDocument());
  }

  it('管理画面にメンテナンスモード設定タブが表示される', async () => {
    await renderAdminPage();
    expect(screen.getByRole('tab', { name: /メンテナンスモード/ })).toBeInTheDocument();
  });

  it('現在のメンテナンスモード状態と告知メッセージが表示される', async () => {
    mockedApi.admin.maintenance.get.mockResolvedValue({
      settings: {
        enabled: true,
        message: '停止中です',
        restrictedOperations: ['posting'],
        updatedAt: '2026-01-01T00:00:00Z',
      },
    });
    await openMaintenanceTab();
    expect(screen.getByRole('checkbox', { name: 'メンテナンスモード' })).toBeChecked();
    expect(screen.getByLabelText('告知メッセージ')).toHaveValue('停止中です');
  });

  it('制限対象として投稿・アップロード・ログインを個別に選択できる', async () => {
    await openMaintenanceTab();
    expect(screen.getByRole('checkbox', { name: '投稿' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'アップロード' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'ログイン' })).toBeInTheDocument();
  });

  it('ON/OFF と制限対象を保存すると api.admin.maintenance.update が呼ばれる', async () => {
    await openMaintenanceTab();
    await user.click(screen.getByRole('checkbox', { name: 'メンテナンスモード' }));
    await user.click(screen.getByRole('checkbox', { name: '投稿' }));
    await user.clear(screen.getByLabelText('告知メッセージ'));
    await user.type(screen.getByLabelText('告知メッセージ'), '作業中です');
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() =>
      expect(mockedApi.admin.maintenance.update).toHaveBeenCalledWith({
        enabled: true,
        message: '作業中です',
        restrictedOperations: ['posting'],
      }),
    );
  });

  it('保存成功時はスナックバーで成功通知が表示される', async () => {
    await openMaintenanceTab();
    await user.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mockShowSuccess).toHaveBeenCalled());
  });

  it('保存失敗時はスナックバーでエラー通知が表示される', async () => {
    mockedApi.admin.maintenance.update.mockRejectedValue(new Error('failed'));
    await openMaintenanceTab();
    await user.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mockShowError).toHaveBeenCalledWith('failed'));
  });
});

// #394 設定エクスポート / インポート
describe('AdminPage: 設定エクスポート / インポート (#394)', () => {
  async function openSettingsTab() {
    await renderAdminPage();
    await user.click(screen.getByRole('tab', { name: /設定入出力/ }));
  }

  function stubDownloadApis() {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:settings');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  }

  it('管理画面に設定エクスポート / インポートタブが表示される', async () => {
    await renderAdminPage();
    expect(screen.getByRole('tab', { name: /設定入出力/ })).toBeInTheDocument();
  });

  it('チャンネル・通知・NG ワード・権限を含む JSON をエクスポートできる', async () => {
    stubDownloadApis();
    await openSettingsTab();
    await user.click(screen.getByRole('button', { name: 'JSON をエクスポート' }));

    await waitFor(() => expect(mockedApi.admin.settings.export).toHaveBeenCalled());
    expect(mockShowSuccess).toHaveBeenCalledWith('設定をエクスポートしました');
  });

  it('JSON ファイルを選択するとインポート前の差分プレビューが表示される', async () => {
    await openSettingsTab();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(
      [
        JSON.stringify({
          schemaVersion: 1,
          exportedAt: '2026-01-01T00:00:00.000Z',
          channels: [],
          notifications: [],
          ngWords: [],
          permissions: [],
        }),
      ],
      'settings.json',
      { type: 'application/json' },
    );
    await user.upload(input, file);

    await waitFor(() => expect(mockedApi.admin.settings.previewImport).toHaveBeenCalled());
    expect(await screen.findByText(/差分プレビュー/)).toBeInTheDocument();
  });

  it('差分プレビュー確認後にインポートを実行できる', async () => {
    await openSettingsTab();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(
      [
        JSON.stringify({
          schemaVersion: 1,
          exportedAt: '2026-01-01T00:00:00.000Z',
          channels: [],
          notifications: [],
          ngWords: [],
          permissions: [],
        }),
      ],
      'settings.json',
      { type: 'application/json' },
    );
    await user.upload(input, file);
    await screen.findByText(/差分プレビュー/);
    await user.click(screen.getByRole('button', { name: 'インポート実行' }));

    await waitFor(() => expect(mockedApi.admin.settings.import).toHaveBeenCalled());
  });

  it('不正な JSON を選択した場合はスナックバーでエラー通知が表示される', async () => {
    await openSettingsTab();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File(['not json'], 'settings.json', { type: 'application/json' }));

    await waitFor(() => expect(mockShowError).toHaveBeenCalled());
  });

  it('スキーマ不一致の JSON を選択した場合はスナックバーでエラー通知が表示される', async () => {
    mockedApi.admin.settings.previewImport.mockRejectedValue(new Error('schema error'));
    await openSettingsTab();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(
      input,
      new File([JSON.stringify({ schemaVersion: 2 })], 'settings.json', {
        type: 'application/json',
      }),
    );

    await waitFor(() => expect(mockShowError).toHaveBeenCalledWith('schema error'));
  });
});

// #390 ヘルスチェック詳細ページ
describe('AdminPage: ヘルスチェック詳細 (#390)', () => {
  async function openHealthTab() {
    await renderAdminPage();
    await user.click(screen.getByRole('tab', { name: /ヘルスチェック/ }));
  }

  it('管理画面にヘルスチェック詳細タブが表示される', async () => {
    await renderAdminPage();
    expect(screen.getByRole('tab', { name: /ヘルスチェック/ })).toBeInTheDocument();
  });

  it('ヘルスチェック詳細タブを開くと詳細取得 API が呼び出される', async () => {
    await openHealthTab();
    await waitFor(() => expect(mockedApi.admin.getHealthDetails).toHaveBeenCalled());
  });

  it('DB 接続状態の応答可否とレイテンシが表示される', async () => {
    await openHealthTab();
    expect(await screen.findByText('DB 接続')).toBeInTheDocument();
    expect(screen.getByText('応答可')).toBeInTheDocument();
    expect(screen.getByText(/12 ms/)).toBeInTheDocument();
  });

  it('Socket サーバーの稼働状態と接続数が表示される', async () => {
    await openHealthTab();
    expect(await screen.findByText('Socket サーバー')).toBeInTheDocument();
    expect(screen.getAllByText('稼働中').length).toBeGreaterThan(0);
    expect(screen.getByText('3 接続')).toBeInTheDocument();
  });

  it('予約送信・リマインダーのジョブ稼働状態が表示される', async () => {
    await openHealthTab();
    expect(await screen.findByText('バックグラウンドジョブ')).toBeInTheDocument();
    expect(screen.getByText('予約送信')).toBeInTheDocument();
    expect(screen.getByText('カレンダーリマインダー')).toBeInTheDocument();
    expect(screen.getByText('停止中')).toBeInTheDocument();
  });

  it('ストレージの利用状況と書き込み可否が表示される', async () => {
    await openHealthTab();
    expect(await screen.findByText('ストレージ')).toBeInTheDocument();
    expect(screen.getByText('書き込み不可')).toBeInTheDocument();
    expect(screen.getByText('2 KB')).toBeInTheDocument();
    expect(screen.getByText('4 ファイル')).toBeInTheDocument();
  });

  it('normal・warning・error のステータスごとに色分けされた Chip が表示される', async () => {
    await openHealthTab();
    expect(await screen.findByText('ヘルスチェック詳細')).toBeInTheDocument();
    expect(screen.getAllByText('正常').length).toBeGreaterThan(0);
    expect(screen.getAllByText('警告').length).toBeGreaterThan(0);
    expect(screen.getAllByText('異常').length).toBeGreaterThan(0);
  });
});

// #391 バックグラウンドジョブ監視
describe('AdminPage: バックグラウンドジョブ監視 (#391)', () => {
  async function openJobMonitoringTab() {
    await renderAdminPage();
    await user.click(screen.getByRole('tab', { name: /ジョブ監視/ }));
    await screen.findByText('バックグラウンドジョブ監視');
  }
  it('予約送信・カレンダーリマインダーの最終実行時刻・次回予定・成功失敗回数を表示する', async () => {
    await openJobMonitoringTab();
    expect(screen.getByText('予約送信')).toBeInTheDocument();
    expect(screen.getByText('カレンダーリマインダー')).toBeInTheDocument();
    expect(screen.getByText('5 回')).toBeInTheDocument();
    expect(screen.getByText('1 回')).toBeInTheDocument();
    expect(screen.getAllByText(/2030/).length).toBeGreaterThanOrEqual(2);
  });
  it('直近の失敗内容を表示する', async () => {
    await openJobMonitoringTab();
    expect(screen.getByText('送信失敗')).toBeInTheDocument();
  });
  it('一定時間実行されていないジョブを警告表示する', async () => {
    await openJobMonitoringTab();
    expect(screen.getByText('警告')).toBeInTheDocument();
  });
  it('未実行ジョブの欠損した時刻と失敗内容をプレースホルダーで表示する', async () => {
    await openJobMonitoringTab();
    expect(screen.getAllByText('未実行')).toHaveLength(2);
    expect(screen.getByText('なし')).toBeInTheDocument();
  });
});
describe('孤立ファイル管理', () => {
  const orphanFiles: OrphanFile[] = [
    {
      id: 101,
      originalName: '古い資料.pdf',
      size: 2048,
      createdAt: '2026-06-20T00:00:00.000Z',
      uploader: { id: 2, username: 'bob' },
    },
    {
      id: 102,
      originalName: 'unused.png',
      size: 1024,
      createdAt: '2026-06-19T00:00:00.000Z',
      uploader: null,
    },
  ];

  async function openOrphanFilesTab() {
    mockedApi.admin.getOrphanFiles.mockResolvedValue({ files: orphanFiles });
    await renderAdminPage();
    await user.click(screen.getByRole('tab', { name: '孤立ファイル' }));
    await screen.findByText('古い資料.pdf');
  }

  it('孤立ファイル一覧にファイル名・サイズ・アップロード日時・アップロード者を表示する', async () => {
    await openOrphanFilesTab();
    expect(screen.getByText('古い資料.pdf')).toBeInTheDocument();
    expect(screen.getByText('2 KB')).toBeInTheDocument();
    expect(
      screen.getByText(new Date(orphanFiles[0].createdAt).toLocaleString('ja-JP')),
    ).toBeInTheDocument();
    expect(screen.getByText('bob')).toBeInTheDocument();
    expect(screen.getByText('不明なユーザー')).toBeInTheDocument();
  });

  it('個別削除の確認をキャンセルすると削除APIを呼ばず対象行を維持する', async () => {
    await openOrphanFilesTab();
    await user.click(screen.getByRole('button', { name: '削除: 古い資料.pdf' }));
    await user.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(mockedApi.admin.deleteOrphanFiles).not.toHaveBeenCalled();
    expect(screen.getByText('古い資料.pdf')).toBeInTheDocument();
  });

  it('個別削除を確認すると対象IDで削除APIを呼び対象行だけを一覧から除く', async () => {
    mockedApi.admin.deleteOrphanFiles.mockResolvedValue({
      deletedCount: 1,
      deletedIds: [101],
      skippedIds: [],
      failed: [],
    });
    await openOrphanFilesTab();
    await user.click(screen.getByRole('button', { name: '削除: 古い資料.pdf' }));
    await user.click(screen.getByRole('button', { name: '削除する' }));
    await waitFor(() => expect(screen.queryByText('古い資料.pdf')).not.toBeInTheDocument());
    expect(mockedApi.admin.deleteOrphanFiles).toHaveBeenCalledWith([101]);
    expect(screen.getByText('unused.png')).toBeInTheDocument();
  });

  it('選択した複数ファイルの一括削除を確認すると選択IDで削除APIを呼び対象行を一覧から除く', async () => {
    mockedApi.admin.deleteOrphanFiles.mockResolvedValue({
      deletedCount: 2,
      deletedIds: [101, 102],
      skippedIds: [],
      failed: [],
    });
    await openOrphanFilesTab();
    await user.click(screen.getByRole('checkbox', { name: '選択: 古い資料.pdf' }));
    await user.click(screen.getByRole('checkbox', { name: '選択: unused.png' }));
    await user.click(screen.getByRole('button', { name: '選択した2件を削除' }));
    await user.click(screen.getByRole('button', { name: '削除する' }));
    await waitFor(() => expect(screen.queryByText('古い資料.pdf')).not.toBeInTheDocument());
    expect(mockedApi.admin.deleteOrphanFiles).toHaveBeenCalledWith([101, 102]);
    expect(screen.queryByText('unused.png')).not.toBeInTheDocument();
  });

  it('個別削除に失敗するとエラー通知を表示して対象行を維持する', async () => {
    mockedApi.admin.deleteOrphanFiles.mockRejectedValue(new Error('削除失敗'));
    await openOrphanFilesTab();
    await user.click(screen.getByRole('button', { name: '削除: 古い資料.pdf' }));
    await user.click(screen.getByRole('button', { name: '削除する' }));
    await waitFor(() => expect(mockShowError).toHaveBeenCalledWith('ファイルの削除に失敗しました'));
    expect(screen.getByText('古い資料.pdf')).toBeInTheDocument();
  });

  it('一括削除に失敗するとエラー通知を表示して対象行を維持する', async () => {
    mockedApi.admin.deleteOrphanFiles.mockRejectedValue(new Error('削除失敗'));
    await openOrphanFilesTab();
    await user.click(screen.getByRole('checkbox', { name: '選択: 古い資料.pdf' }));
    await user.click(screen.getByRole('checkbox', { name: '選択: unused.png' }));
    await user.click(screen.getByRole('button', { name: '選択した2件を削除' }));
    await user.click(screen.getByRole('button', { name: '削除する' }));
    await waitFor(() => expect(mockShowError).toHaveBeenCalledWith('ファイルの削除に失敗しました'));
    expect(screen.getByText('古い資料.pdf')).toBeInTheDocument();
    expect(screen.getByText('unused.png')).toBeInTheDocument();
  });
});
