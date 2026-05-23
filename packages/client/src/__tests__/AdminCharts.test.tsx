/**
 * テスト対象: 管理ダッシュボードの時系列グラフ（Issue #271）
 * 戦略: vi.mock('../api/client') で時系列集計 API をモックし、
 *   - 折れ線グラフ（投稿数・アクティブユーザー）の描画
 *   - 期間フィルタ（PeriodFilterBar）と連動して時系列 API が再呼び出しされること
 *   - データ空・ローディング時のフォールバック表示
 * を検証する。
 *
 * 注意: Recharts は ResponsiveContainer 配下で width/height を取得するため、
 * jsdom 環境では幅 0 でレンダリングされ得る。data-testid を持つラッパーの存在確認、
 * API 呼び出し回数・引数を主に検証する。
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import AdminPage from '../pages/AdminPage';
import type { AdminStats } from '../types/admin';

const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../components/Layout/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout-stub">{children}</div>
  ),
}));

// Recharts の ResponsiveContainer は jsdom で 0x0 になるためスタブする
vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="recharts-responsive-container" style={{ width: 600, height: 300 }}>
        {children}
      </div>
    ),
  };
});

const mockStats: AdminStats = {
  totalUsers: 10,
  totalChannels: 5,
  totalMessages: 100,
  activeUsersLast24h: 3,
  activeUsersLast7d: 8,
};

const mockTimeseries = {
  messages: [
    { timestamp: '2024-06-07T00:00:00.000Z', count: 1 },
    { timestamp: '2024-06-08T00:00:00.000Z', count: 5 },
    { timestamp: '2024-06-09T00:00:00.000Z', count: 3 },
  ],
  activeUsers: [
    { timestamp: '2024-06-07T00:00:00.000Z', count: 1 },
    { timestamp: '2024-06-08T00:00:00.000Z', count: 2 },
    { timestamp: '2024-06-09T00:00:00.000Z', count: 2 },
  ],
};

vi.mock('../api/client', () => ({
  api: {
    admin: {
      getStats: vi.fn(),
      getTimeseries: vi.fn(),
      getUsers: vi.fn(),
      getChannels: vi.fn(),
      updateUserRole: vi.fn(),
      updateUserStatus: vi.fn(),
      deleteUser: vi.fn(),
      deleteChannel: vi.fn(),
      unarchiveChannel: vi.fn(),
      setChannelRecommended: vi.fn(),
      getAuditLogs: vi.fn(),
      ngWords: { list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
      blockedExtensions: { list: vi.fn(), create: vi.fn(), delete: vi.fn() },
      reports: { list: vi.fn(), dismiss: vi.fn(), action: vi.fn() },
    },
  },
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../contexts/SnackbarContext', () => ({
  useSnackbar: () => ({
    showError: vi.fn(),
    showSuccess: vi.fn(),
    showInfo: vi.fn(),
  }),
}));

vi.mock('../components/AuditLogView', () => ({
  default: () => <div data-testid="audit-log-stub" />,
}));
vi.mock('../components/Admin/ModerationContent', () => ({
  default: () => <div data-testid="moderation-content-stub" />,
}));
vi.mock('../components/Admin/ModerationQueue', () => ({
  default: () => <div data-testid="moderation-queue-stub" />,
}));

import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

const mockedApi = api as unknown as {
  admin: {
    getStats: ReturnType<typeof vi.fn>;
    getTimeseries: ReturnType<typeof vi.fn>;
    getUsers: ReturnType<typeof vi.fn>;
    getChannels: ReturnType<typeof vi.fn>;
    ngWords: { list: ReturnType<typeof vi.fn> };
    blockedExtensions: { list: ReturnType<typeof vi.fn> };
    reports: { list: ReturnType<typeof vi.fn> };
  };
};
const mockedUseAuth = useAuth as ReturnType<typeof vi.fn>;

async function renderAdminPage(initialPath = '/') {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={[initialPath]}>
        <AdminPage />
      </MemoryRouter>,
    );
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseAuth.mockReturnValue({
    user: { id: 1, username: 'alice', role: 'admin', isActive: true },
  });
  mockedApi.admin.getStats.mockResolvedValue(mockStats);
  mockedApi.admin.getTimeseries.mockResolvedValue(mockTimeseries);
  mockedApi.admin.getUsers.mockResolvedValue({ users: [] });
  mockedApi.admin.getChannels.mockResolvedValue({ channels: [] });
  mockedApi.admin.ngWords.list.mockResolvedValue({ ngWords: [] });
  mockedApi.admin.blockedExtensions.list.mockResolvedValue({ blockedExtensions: [] });
  mockedApi.admin.reports.list.mockResolvedValue({ reports: [] });
});

describe('AdminCharts: 管理ダッシュボードのグラフ表示（Issue #271）', () => {
  describe('時系列グラフの描画', () => {
    it('期間 7d で投稿数の折れ線グラフが描画される', async () => {
      await renderAdminPage('/?period=7d');

      await waitFor(() => {
        expect(screen.getByTestId('admin-chart-messages')).toBeInTheDocument();
      });
    });

    it('期間 7d でアクティブユーザー数の折れ線グラフが描画される', async () => {
      await renderAdminPage('/?period=7d');

      await waitFor(() => {
        expect(screen.getByTestId('admin-chart-active-users')).toBeInTheDocument();
      });
    });

    it('時系列 API が呼ばれる', async () => {
      await renderAdminPage('/?period=7d');

      await waitFor(() => {
        expect(mockedApi.admin.getTimeseries).toHaveBeenCalledWith(
          expect.objectContaining({ period: '7d' }),
        );
      });
    });

    it('時系列データが空配列の場合は「データがありません」のフォールバックを表示する', async () => {
      mockedApi.admin.getTimeseries.mockResolvedValue({ messages: [], activeUsers: [] });
      await renderAdminPage('/?period=7d');

      await waitFor(() => {
        expect(screen.getAllByText(/データがありません/).length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('期間フィルタとの連動', () => {
    it('PeriodFilterBar で 24h を選択すると時系列 API が period=24h で再呼び出しされる', async () => {
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      await renderAdminPage('/?period=7d');

      mockedApi.admin.getTimeseries.mockClear();
      await user.click(screen.getByRole('button', { name: '24h' }));

      await waitFor(() => {
        expect(mockedApi.admin.getTimeseries).toHaveBeenCalledWith(
          expect.objectContaining({ period: '24h' }),
        );
      });
    });

    it('PeriodFilterBar で 30d を選択すると時系列 API が period=30d で再呼び出しされる', async () => {
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      await renderAdminPage('/?period=7d');

      mockedApi.admin.getTimeseries.mockClear();
      await user.click(screen.getByRole('button', { name: '30d' }));

      await waitFor(() => {
        expect(mockedApi.admin.getTimeseries).toHaveBeenCalledWith(
          expect.objectContaining({ period: '30d' }),
        );
      });
    });
  });

  // ── 次フェーズで実装する項目 ───────────────────────────────────────
  describe('チャンネル別投稿ボリューム（次フェーズ）', () => {
    it.skip('チャンネル別の時系列を取得して同一グラフ上に複数系列で表示する', () => { /* see #341 */ });
    it.skip('チャンネル数が多い場合でも凡例（legend）が表示される', () => { /* see #341 */ });
    it.skip('対象チャンネルが 0 件の場合は空状態フォールバックを表示する', () => { /* see #341 */ });
  });

  describe('チャンネル別 Top N 横棒グラフ（次フェーズ）', () => {
    it.skip('上位 N チャンネルの投稿数が降順で横棒グラフに描画される', () => { /* see #341 */ });
    it.skip('チャンネル名と件数が読み取り可能な形でラベル表示される', () => { /* see #341 */ });
    it.skip('Top N の件数（N=10 など）が API 呼び出しの limit と一致する', () => { /* see #341 */ });
    it.skip('期間内に投稿が無い場合は空状態フォールバックを表示する', () => { /* see #341 */ });
  });

  describe('レイアウト・アクセシビリティ', () => {
    it('各グラフカードに見出し（タイトル）が付与される', async () => {
      await renderAdminPage('/?period=7d');

      await waitFor(() => {
        expect(screen.getByText(/投稿数/)).toBeInTheDocument();
        expect(screen.getByText(/アクティブユーザー/)).toBeInTheDocument();
      });
    });

    it.skip('期間フィルタは統計タブ全体（数値カード・グラフ）で共有される（次フェーズで強化）', () => { /* see #341 */ });
  });

  describe('Promise の安定化（React 19）', () => {
    it.skip('期間フィルタが変わらない限り時系列 API は再呼び出しされない（useMemo で安定化）', () => { /* see #341 */ });
    it.skip('タブ切替で再マウントされても同じ期間なら追加の API 呼び出しは発生しない', () => { /* see #341 */ });
  });
});
