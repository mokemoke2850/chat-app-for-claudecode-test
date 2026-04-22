/**
 * 監査ログビュー（管理画面タブ）のテスト
 *
 * Issue: #85 https://github.com/mokemoke2850/coralzen/issues/85
 *
 * === 仕様 ===
 * - AdminPage の Tabs に「監査ログ」タブを1つ追加
 * - 一覧カラム: 日時 / 操作種別 / 実行者 / 対象 / 詳細
 * - フィルタ: action_type, actor_user_id, from / to
 * - ページネーション: limit=50 固定、前/次ボタンで offset を更新
 *
 * 戦略: vi.mock('../api/client') でAPIをモック化し、動作を検証する。
 */

import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import AdminPage from '../pages/AdminPage';
import AuditLogView from '../components/AuditLogView';
import type { AuditLog, AdminUser, AdminChannel, AdminStats } from '../types/admin';

const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../api/client', () => ({
  api: {
    admin: {
      getStats: vi.fn(),
      getUsers: vi.fn(),
      getChannels: vi.fn(),
      updateUserRole: vi.fn(),
      updateUserStatus: vi.fn(),
      deleteUser: vi.fn(),
      deleteChannel: vi.fn(),
      unarchiveChannel: vi.fn(),
      getAuditLogs: vi.fn(),
      exportAuditLogsUrl: vi.fn(
        (params?: { actionType?: string; actorUserId?: number; from?: string; to?: string }) => {
          const q = new URLSearchParams();
          if (params?.actionType) q.set('action_type', params.actionType);
          if (params?.actorUserId !== undefined) q.set('actor_user_id', String(params.actorUserId));
          if (params?.from) q.set('from', params.from);
          if (params?.to) q.set('to', params.to);
          const qs = q.toString();
          return `/api/admin/audit-logs/export${qs ? `?${qs}` : ''}`;
        },
      ),
    },
  },
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

const mockedApi = api as unknown as {
  admin: {
    getStats: ReturnType<typeof vi.fn>;
    getUsers: ReturnType<typeof vi.fn>;
    getChannels: ReturnType<typeof vi.fn>;
    updateUserRole: ReturnType<typeof vi.fn>;
    updateUserStatus: ReturnType<typeof vi.fn>;
    deleteUser: ReturnType<typeof vi.fn>;
    deleteChannel: ReturnType<typeof vi.fn>;
    unarchiveChannel: ReturnType<typeof vi.fn>;
    getAuditLogs: ReturnType<typeof vi.fn>;
  };
};
const mockedUseAuth = useAuth as ReturnType<typeof vi.fn>;

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
];

const mockAdminChannels: AdminChannel[] = [];
const mockStats: AdminStats = {
  totalUsers: 2,
  totalChannels: 0,
  totalMessages: 0,
  activeUsersLast24h: 0,
  activeUsersLast7d: 0,
};

const mockAuditLogs: AuditLog[] = [
  {
    id: 1,
    actorUserId: 1,
    actorUsername: 'alice',
    actionType: 'channel.create',
    targetType: 'channel',
    targetId: 12,
    metadata: { name: 'general', isPrivate: false },
    createdAt: '2025-01-10T01:23:45Z',
  },
  {
    id: 2,
    actorUserId: null,
    actorUsername: null,
    actionType: 'auth.login',
    targetType: 'user',
    targetId: 99,
    metadata: null,
    createdAt: '2025-01-09T10:00:00Z',
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseAuth.mockReturnValue({
    user: { id: 1, username: 'alice', role: 'admin', isActive: true },
  });
  mockedApi.admin.getStats.mockResolvedValue(mockStats);
  mockedApi.admin.getUsers.mockResolvedValue({ users: mockAdminUsers });
  mockedApi.admin.getChannels.mockResolvedValue({ channels: mockAdminChannels });
  mockedApi.admin.getAuditLogs.mockResolvedValue({ logs: mockAuditLogs, total: 2 });
});

async function renderAdminPage(): Promise<void> {
  await act(async () => {
    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>,
    );
  });
}

async function renderAuditLogView(
  props: { actors?: { id: number; username: string }[] } = {},
): Promise<void> {
  await act(async () => {
    render(<AuditLogView actors={props.actors ?? []} />);
  });
}

describe('AdminPage の監査ログタブ', () => {
  describe('タブ表示', () => {
    it('管理画面に「監査ログ」タブが表示される', async () => {
      await renderAdminPage();
      expect(screen.getByRole('tab', { name: '監査ログ' })).toBeInTheDocument();
    });

    it('監査ログタブをクリックすると AuditLogView がレンダリングされる', async () => {
      await renderAdminPage();
      await userEvent.click(screen.getByRole('tab', { name: '監査ログ' }));
      await act(async () => {});
      await waitFor(() => expect(mockedApi.admin.getAuditLogs).toHaveBeenCalled());
    });
  });

  describe('非管理者の動線', () => {
    it('user.role !== "admin" のユーザーがページにアクセスすると / にリダイレクトされる', async () => {
      mockedUseAuth.mockReturnValue({
        user: { id: 2, username: 'bob', role: 'user', isActive: true },
      });
      await renderAdminPage();
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });
  });
});

describe('AuditLogView', () => {
  describe('一覧表示', () => {
    it('マウント時に api.admin.getAuditLogs が呼ばれる', async () => {
      await renderAuditLogView();
      await waitFor(() => expect(mockedApi.admin.getAuditLogs).toHaveBeenCalled());
    });

    it('取得したログを「日時 / 操作 / 実行者 / 対象 / 詳細」のカラム構成でテーブル表示する', async () => {
      await renderAuditLogView();
      await waitFor(() => expect(screen.getByText('alice')).toBeInTheDocument());
      const headers = screen.getAllByRole('columnheader').map((el) => el.textContent);
      expect(headers).toEqual(['日時', '操作', '実行者', '対象', '詳細']);
    });

    it('action_type は日本語ラベルに変換して表示される（例: channel.create → 「チャンネル作成」）', async () => {
      await renderAuditLogView();
      await waitFor(() => expect(screen.getByText('チャンネル作成')).toBeInTheDocument());
    });

    it('実行者が削除済み（actorUserId=null）の場合は「（削除済みユーザー）」と表示される', async () => {
      await renderAuditLogView();
      await waitFor(() => expect(screen.getByText('（削除済みユーザー）')).toBeInTheDocument());
    });

    it('対象カラムは target_type と target_id を組み合わせて表示される（例: channel #12）', async () => {
      await renderAuditLogView();
      await waitFor(() => expect(screen.getByText('channel #12')).toBeInTheDocument());
    });

    it('ログが 0 件の場合は「監査ログがありません」と表示される', async () => {
      mockedApi.admin.getAuditLogs.mockResolvedValue({ logs: [], total: 0 });
      await renderAuditLogView();
      await waitFor(() => expect(screen.getByText('監査ログがありません')).toBeInTheDocument());
    });

    it('取得でエラーが発生した場合は ErrorBoundary で捕捉されエラーメッセージが表示される', async () => {
      mockedApi.admin.getAuditLogs.mockRejectedValue(new Error('サーバーエラー'));
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      await renderAuditLogView();
      await waitFor(() => expect(screen.getByText(/エラーが発生しました/)).toBeInTheDocument());
      spy.mockRestore();
    });
  });

  describe('フィルタ操作', () => {
    it('action_type セレクトを変更すると api.admin.getAuditLogs が actionType 付きで再呼び出しされる', async () => {
      await renderAuditLogView();
      await waitFor(() => expect(mockedApi.admin.getAuditLogs).toHaveBeenCalled());

      // MUI Select は button-like: role='combobox'
      const combobox = screen.getByLabelText('操作');
      await userEvent.click(combobox);
      // メニューから「チャンネル作成」を選ぶ
      const options = await screen.findAllByRole('option', { name: 'チャンネル作成' });
      await userEvent.click(options[0]);
      await waitFor(() => {
        const calls = mockedApi.admin.getAuditLogs.mock.calls;
        const hit = calls.find(
          ([arg]) => (arg as { actionType?: string })?.actionType === 'channel.create',
        );
        expect(hit).toBeDefined();
      });
    });

    it('actor セレクトを変更すると api.admin.getAuditLogs が actorUserId 付きで再呼び出しされる', async () => {
      await renderAuditLogView({ actors: [{ id: 2, username: 'bob' }] });
      await waitFor(() => expect(mockedApi.admin.getAuditLogs).toHaveBeenCalled());
      const combobox = screen.getByLabelText('実行者');
      await userEvent.click(combobox);
      const options = await screen.findAllByRole('option', { name: 'bob' });
      await userEvent.click(options[0]);
      await waitFor(() => {
        const hit = mockedApi.admin.getAuditLogs.mock.calls.find(
          ([arg]) => (arg as { actorUserId?: number })?.actorUserId === 2,
        );
        expect(hit).toBeDefined();
      });
    });

    it('from 日付を変更すると api.admin.getAuditLogs が from 付きで再呼び出しされる', async () => {
      await renderAuditLogView();
      await waitFor(() => expect(mockedApi.admin.getAuditLogs).toHaveBeenCalled());
      const input = screen.getByLabelText('開始日');
      await userEvent.type(input, '2025-01-01');
      await waitFor(() => {
        const hit = mockedApi.admin.getAuditLogs.mock.calls.find(
          ([arg]) => (arg as { from?: string })?.from === '2025-01-01',
        );
        expect(hit).toBeDefined();
      });
    });

    it('to 日付を変更すると api.admin.getAuditLogs が to 付きで再呼び出しされる', async () => {
      await renderAuditLogView();
      await waitFor(() => expect(mockedApi.admin.getAuditLogs).toHaveBeenCalled());
      const input = screen.getByLabelText('終了日');
      await userEvent.type(input, '2025-01-31');
      await waitFor(() => {
        const hit = mockedApi.admin.getAuditLogs.mock.calls.find(
          ([arg]) => (arg as { to?: string })?.to === '2025-01-31',
        );
        expect(hit).toBeDefined();
      });
    });

    it('フィルタをリセットするとパラメータなしで再呼び出しされる', async () => {
      await renderAuditLogView();
      await waitFor(() => expect(mockedApi.admin.getAuditLogs).toHaveBeenCalled());
      // いったん action_type を設定
      const combobox = screen.getByLabelText('操作');
      await userEvent.click(combobox);
      const options = await screen.findAllByRole('option', { name: 'チャンネル作成' });
      await userEvent.click(options[0]);
      // リセット
      const resetButton = screen.getByRole('button', { name: 'リセット' });
      await userEvent.click(resetButton);
      await waitFor(() => {
        const calls = mockedApi.admin.getAuditLogs.mock.calls;
        const lastCall = calls[calls.length - 1];
        expect((lastCall?.[0] as { actionType?: string })?.actionType).toBeUndefined();
      });
    });
  });

  describe('ページネーション', () => {
    it('total > limit のとき「次へ」ボタンが活性になる', async () => {
      mockedApi.admin.getAuditLogs.mockResolvedValue({ logs: mockAuditLogs, total: 100 });
      await renderAuditLogView();
      await waitFor(() => expect(screen.getByText('alice')).toBeInTheDocument());
      expect(screen.getByRole('button', { name: '次へ' })).not.toBeDisabled();
    });

    it('1ページ目では「前へ」ボタンが非活性になる', async () => {
      await renderAuditLogView();
      await waitFor(() => expect(screen.getByText('alice')).toBeInTheDocument());
      expect(screen.getByRole('button', { name: '前へ' })).toBeDisabled();
    });

    it('「次へ」をクリックすると offset が +limit されて再フェッチされる', async () => {
      mockedApi.admin.getAuditLogs.mockResolvedValue({ logs: mockAuditLogs, total: 200 });
      await renderAuditLogView();
      await waitFor(() => expect(screen.getByText('alice')).toBeInTheDocument());
      await userEvent.click(screen.getByRole('button', { name: '次へ' }));
      await waitFor(() => {
        const hit = mockedApi.admin.getAuditLogs.mock.calls.find(
          ([arg]) => (arg as { offset?: number })?.offset === 50,
        );
        expect(hit).toBeDefined();
      });
    });

    it('最終ページでは「次へ」ボタンが非活性になる', async () => {
      mockedApi.admin.getAuditLogs.mockResolvedValue({ logs: mockAuditLogs, total: 2 });
      await renderAuditLogView();
      await waitFor(() => expect(screen.getByText('alice')).toBeInTheDocument());
      expect(screen.getByRole('button', { name: '次へ' })).toBeDisabled();
    });
  });
});

describe('AuditLogView エクスポートボタン', () => {
  describe('ボタン表示', () => {
    it('「CSV エクスポート」ボタンが表示される', async () => {
      await renderAuditLogView();
      await waitFor(() => expect(screen.getByText('alice')).toBeInTheDocument());
      expect(screen.getByRole('button', { name: 'CSV エクスポート' })).toBeInTheDocument();
    });
  });

  describe('ダウンロード URL 生成', () => {
    it('エクスポートボタン押下でダウンロード用 URL が生成される', async () => {
      // window.open をスパイ
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      await renderAuditLogView();
      await waitFor(() => expect(screen.getByText('alice')).toBeInTheDocument());

      await userEvent.click(screen.getByRole('button', { name: 'CSV エクスポート' }));

      expect(openSpy).toHaveBeenCalledTimes(1);
      const url = openSpy.mock.calls[0][0] as string;
      expect(url).toContain('/api/admin/audit-logs/export');
      openSpy.mockRestore();
    });

    it('現在の actionType フィルタが URL のクエリパラメータに反映される', async () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      await renderAuditLogView();
      await waitFor(() => expect(mockedApi.admin.getAuditLogs).toHaveBeenCalled());

      // action_type を選択
      const combobox = screen.getByLabelText('操作');
      await userEvent.click(combobox);
      const options = await screen.findAllByRole('option', { name: 'チャンネル作成' });
      await userEvent.click(options[0]);
      await waitFor(() => expect(screen.getByText('alice')).toBeInTheDocument());

      await userEvent.click(screen.getByRole('button', { name: 'CSV エクスポート' }));

      const url = openSpy.mock.calls[0][0] as string;
      expect(url).toContain('action_type=channel.create');
      openSpy.mockRestore();
    });

    it('現在の from フィルタが URL のクエリパラメータに反映される', async () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      await renderAuditLogView();
      await waitFor(() => expect(mockedApi.admin.getAuditLogs).toHaveBeenCalled());

      const input = screen.getByLabelText('開始日');
      await userEvent.type(input, '2025-01-01');
      await waitFor(() => expect(screen.getByText('alice')).toBeInTheDocument());

      await userEvent.click(screen.getByRole('button', { name: 'CSV エクスポート' }));

      const url = openSpy.mock.calls[0][0] as string;
      expect(url).toContain('from=2025-01-01');
      openSpy.mockRestore();
    });

    it('現在の to フィルタが URL のクエリパラメータに反映される', async () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      await renderAuditLogView();
      await waitFor(() => expect(mockedApi.admin.getAuditLogs).toHaveBeenCalled());

      const input = screen.getByLabelText('終了日');
      await userEvent.type(input, '2025-01-31');
      await waitFor(() => expect(screen.getByText('alice')).toBeInTheDocument());

      await userEvent.click(screen.getByRole('button', { name: 'CSV エクスポート' }));

      const url = openSpy.mock.calls[0][0] as string;
      expect(url).toContain('to=2025-01-31');
      openSpy.mockRestore();
    });

    it('フィルタが未設定の場合はクエリパラメータなしの URL が生成される', async () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      await renderAuditLogView();
      await waitFor(() => expect(screen.getByText('alice')).toBeInTheDocument());

      await userEvent.click(screen.getByRole('button', { name: 'CSV エクスポート' }));

      const url = openSpy.mock.calls[0][0] as string;
      // フィルタなしなのでクエリパラメータなし
      expect(url).toBe('/api/admin/audit-logs/export');
      openSpy.mockRestore();
    });
  });
});

// within の未使用警告回避（TypeScript のツリーシェイク対策）
void within;
