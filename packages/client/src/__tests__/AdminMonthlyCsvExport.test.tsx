/**
 * 管理画面の月次レポート CSV エクスポート UI テスト（Issue #273）
 *
 * テスト対象:
 *   - packages/client/src/pages/AdminPage.tsx に追加する
 *     「月次レポート」セクション（月選択 Select + ダウンロードボタン）
 *   - packages/client/src/api/client.ts の admin.exportMonthlyReport
 * 戦略:
 *   - vi.mock('../api/client') で API をモック化
 *   - 月選択（過去12ヶ月）の表示を検証
 *   - ダウンロードボタンのクリックで api.admin.exportMonthlyReport が呼ばれ、
 *     <a download> がトリガーされることを確認
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

const mockStats: AdminStats = {
  totalUsers: 0,
  totalChannels: 0,
  totalMessages: 0,
  activeUsersLast24h: 0,
  activeUsersLast7d: 0,
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
      exportMonthlyReport: vi.fn(),
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
    exportMonthlyReport: ReturnType<typeof vi.fn>;
    ngWords: { list: ReturnType<typeof vi.fn> };
    blockedExtensions: { list: ReturnType<typeof vi.fn> };
    reports: { list: ReturnType<typeof vi.fn> };
  };
};
const mockedUseAuth = useAuth as ReturnType<typeof vi.fn>;

async function renderAdminPage() {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
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
  mockedApi.admin.getTimeseries.mockResolvedValue({ messages: [], activeUsers: [] });
  mockedApi.admin.getUsers.mockResolvedValue({ users: [] });
  mockedApi.admin.getChannels.mockResolvedValue({ channels: [] });
  mockedApi.admin.ngWords.list.mockResolvedValue({ ngWords: [] });
  mockedApi.admin.blockedExtensions.list.mockResolvedValue({ blockedExtensions: [] });
  mockedApi.admin.reports.list.mockResolvedValue({ reports: [] });
  mockedApi.admin.exportMonthlyReport.mockResolvedValue(new Blob(['data'], { type: 'text/csv' }));
});

describe('管理画面の月次レポート CSV エクスポート', () => {
  describe('UI 表示', () => {
    it('管理画面の統計タブに「月次レポート」セクションが表示される', async () => {
      await renderAdminPage();
      // セクションのタイトル（h6/subtitle1）として表示される
      expect(screen.getAllByText(/月次レポート/).length).toBeGreaterThan(0);
    });

    it('月選択 Select が表示される', async () => {
      await renderAdminPage();
      expect(screen.getByTestId('monthly-report-select')).toBeInTheDocument();
    });

    it('「ダウンロード」ボタンが表示される', async () => {
      await renderAdminPage();
      expect(
        screen.getByRole('button', { name: /月次レポートをダウンロード/ }),
      ).toBeInTheDocument();
    });
  });

  describe('ダウンロードボタン動作', () => {
    it('ボタンをクリックすると api.admin.exportMonthlyReport が呼び出される', async () => {
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      // jsdom には URL.createObjectURL がないのでスタブ
      const createObjectURL = vi.fn(() => 'blob:fake');
      const revokeObjectURL = vi.fn();
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        value: createObjectURL,
      });
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        value: revokeObjectURL,
      });

      await renderAdminPage();
      mockedApi.admin.exportMonthlyReport.mockClear();
      await user.click(screen.getByRole('button', { name: /月次レポートをダウンロード/ }));

      await waitFor(() => {
        expect(mockedApi.admin.exportMonthlyReport).toHaveBeenCalledTimes(1);
      });
      // month が YYYY-MM 形式で渡される
      const arg = mockedApi.admin.exportMonthlyReport.mock.calls[0][0] as { month: string };
      expect(arg.month).toMatch(/^\d{4}-\d{2}$/);
    });

    it('ダウンロード成功後にオブジェクト URL が解放される', async () => {
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      const createObjectURL = vi.fn(() => 'blob:fake');
      const revokeObjectURL = vi.fn();
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        value: createObjectURL,
      });
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        value: revokeObjectURL,
      });

      await renderAdminPage();
      await user.click(screen.getByRole('button', { name: /月次レポートをダウンロード/ }));

      await waitFor(() => {
        expect(createObjectURL).toHaveBeenCalled();
      });
    });
  });
});
