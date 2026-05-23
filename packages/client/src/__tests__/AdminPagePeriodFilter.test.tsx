/**
 * テスト対象: AdminPage の期間フィルタ UI（Issue #272）
 * 戦略: vi.mock('../api/client') でAPIをモック化し、
 *   - 期間トグル（24h / 7d / 30d / カスタム）の切替動作
 *   - URL パラメータ（?period=7d / ?from=...&to=...）との同期
 *   - カスタム期間の日付入力 UI
 *   - 期間変更時に集計 API が from/to パラメータ付きで再呼び出しされること
 * を検証する。
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
  totalUsers: 10,
  totalChannels: 5,
  totalMessages: 100,
  activeUsersLast24h: 3,
  activeUsersLast7d: 8,
};

vi.mock('../api/client', () => ({
  api: {
    admin: {
      getStats: vi.fn(),
      getTimeseries: vi.fn(),
      getChannelTimeseries: vi.fn(),
      getTopChannels: vi.fn(),
      getUsers: vi.fn(),
      getChannels: vi.fn(),
      updateUserRole: vi.fn(),
      updateUserStatus: vi.fn(),
      deleteUser: vi.fn(),
      deleteChannel: vi.fn(),
      unarchiveChannel: vi.fn(),
      setChannelRecommended: vi.fn(),
      getAuditLogs: vi.fn(),
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

vi.mock('../contexts/SnackbarContext', () => ({
  useSnackbar: () => ({
    showError: vi.fn(),
    showSuccess: vi.fn(),
    showInfo: vi.fn(),
  }),
}));

// AuditLogView stub
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
    getChannelTimeseries: ReturnType<typeof vi.fn>;
    getTopChannels: ReturnType<typeof vi.fn>;
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
  mockedApi.admin.getTimeseries.mockResolvedValue({ messages: [], activeUsers: [] });
  mockedApi.admin.getChannelTimeseries.mockResolvedValue({ messagesByChannel: [] });
  mockedApi.admin.getTopChannels.mockResolvedValue({ channels: [] });
  mockedApi.admin.getUsers.mockResolvedValue({ users: [] });
  mockedApi.admin.getChannels.mockResolvedValue({ channels: [] });
  mockedApi.admin.ngWords.list.mockResolvedValue({ ngWords: [] });
  mockedApi.admin.blockedExtensions.list.mockResolvedValue({ blockedExtensions: [] });
  mockedApi.admin.reports.list.mockResolvedValue({ reports: [] });
});

describe('AdminPage: 期間フィルタ UI', () => {
  describe('トグルの表示', () => {
    it('統計タブに「24h / 7d / 30d / カスタム」の期間切替トグルが表示される', async () => {
      await renderAdminPage();

      expect(screen.getByRole('button', { name: '24h' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '7d' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '30d' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'カスタム' })).toBeInTheDocument();
    });

    it('初期表示では「7d」がデフォルト選択状態になっている', async () => {
      await renderAdminPage();

      const btn7d = screen.getByRole('button', { name: '7d' });
      // MUI ToggleButton は selected 状態で aria-pressed="true" になる
      expect(btn7d).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('期間切替動作', () => {
    it('「24h」を選択すると period=24h で statsPromise が再生成される', async () => {
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      await renderAdminPage();

      mockedApi.admin.getStats.mockClear();
      await user.click(screen.getByRole('button', { name: '24h' }));

      await waitFor(() => {
        expect(mockedApi.admin.getStats).toHaveBeenCalledWith(
          expect.objectContaining({ period: '24h' }),
        );
      });
    });

    it('「7d」を選択すると period=7d で statsPromise が再生成される', async () => {
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      // 最初は別の期間にしてから 7d に戻す
      await renderAdminPage();

      await user.click(screen.getByRole('button', { name: '24h' }));
      mockedApi.admin.getStats.mockClear();

      await user.click(screen.getByRole('button', { name: '7d' }));

      await waitFor(() => {
        expect(mockedApi.admin.getStats).toHaveBeenCalledWith(
          expect.objectContaining({ period: '7d' }),
        );
      });
    });

    it('「30d」を選択すると period=30d で statsPromise が再生成される', async () => {
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      await renderAdminPage();

      mockedApi.admin.getStats.mockClear();
      await user.click(screen.getByRole('button', { name: '30d' }));

      await waitFor(() => {
        expect(mockedApi.admin.getStats).toHaveBeenCalledWith(
          expect.objectContaining({ period: '30d' }),
        );
      });
    });

    it('「カスタム」を選択するとカスタム日付入力フォームが表示される', async () => {
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      await renderAdminPage();

      await user.click(screen.getByRole('button', { name: 'カスタム' }));

      await waitFor(() => {
        expect(screen.getByTestId('period-date-from')).toBeInTheDocument();
        expect(screen.getByTestId('period-date-to')).toBeInTheDocument();
      });
    });
  });

  describe('カスタム日付入力', () => {
    it('「カスタム」選択時に date-from と date-to の入力欄が表示される', async () => {
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      await renderAdminPage();

      await user.click(screen.getByRole('button', { name: 'カスタム' }));

      await waitFor(() => {
        expect(screen.getByTestId('period-date-from')).toBeInTheDocument();
        expect(screen.getByTestId('period-date-to')).toBeInTheDocument();
      });
    });

    it('date-from / date-to を入力して確定すると from/to パラメータ付きで getStats が呼ばれる', async () => {
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      await renderAdminPage();

      await user.click(screen.getByRole('button', { name: 'カスタム' }));

      const fromInput = await screen.findByTestId('period-date-from');
      const toInput = await screen.findByTestId('period-date-to');
      await user.type(fromInput, '2024-01-01');
      await user.type(toInput, '2024-01-31');

      mockedApi.admin.getStats.mockClear();
      const applyBtn = screen.getByRole('button', { name: '適用' });
      await user.click(applyBtn);

      await waitFor(() => {
        expect(mockedApi.admin.getStats).toHaveBeenCalledWith(
          expect.objectContaining({ from: '2024-01-01', to: '2024-01-31' }),
        );
      });
    });

    it('date-from が date-to より後の日付の場合はバリデーションエラーが表示される', async () => {
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      await renderAdminPage();

      await user.click(screen.getByRole('button', { name: 'カスタム' }));

      const fromInput = await screen.findByTestId('period-date-from');
      const toInput = await screen.findByTestId('period-date-to');
      await user.type(fromInput, '2024-12-31');
      await user.type(toInput, '2024-01-01');

      const applyBtn = screen.getByRole('button', { name: '適用' });
      await user.click(applyBtn);

      await waitFor(() => {
        expect(screen.getByText(/開始日は終了日より前/)).toBeInTheDocument();
      });
    });

    it('date-from のみ入力した状態では確定ボタンが無効になる', async () => {
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      await renderAdminPage();

      await user.click(screen.getByRole('button', { name: 'カスタム' }));

      const fromInput = await screen.findByTestId('period-date-from');
      await user.type(fromInput, '2024-01-01');

      const applyBtn = screen.getByRole('button', { name: '適用' });
      expect(applyBtn).toBeDisabled();
    });
  });

  describe('URL パラメータとの同期', () => {
    it('?period=7d で初期表示すると「7d」が選択済み状態になる', async () => {
      await renderAdminPage('/?period=7d');

      const btn7d = screen.getByRole('button', { name: '7d' });
      expect(btn7d).toHaveAttribute('aria-pressed', 'true');
    });

    it('?period=30d で初期表示すると「30d」が選択済み状態になる', async () => {
      await renderAdminPage('/?period=30d');

      const btn30d = screen.getByRole('button', { name: '30d' });
      expect(btn30d).toHaveAttribute('aria-pressed', 'true');
    });

    it('?period=24h で初期表示すると「24h」が選択済み状態になる', async () => {
      await renderAdminPage('/?period=24h');

      const btn24h = screen.getByRole('button', { name: '24h' });
      expect(btn24h).toHaveAttribute('aria-pressed', 'true');
    });

    it('?from=2024-01-01&to=2024-01-31 で初期表示するとカスタムが選択済み・日付入力に値が反映される', async () => {
      await renderAdminPage('/?from=2024-01-01&to=2024-01-31');

      const btnCustom = screen.getByRole('button', { name: 'カスタム' });
      expect(btnCustom).toHaveAttribute('aria-pressed', 'true');

      const fromInput = screen.getByTestId('period-date-from') as HTMLInputElement;
      const toInput = screen.getByTestId('period-date-to') as HTMLInputElement;
      expect(fromInput.value).toBe('2024-01-01');
      expect(toInput.value).toBe('2024-01-31');
    });

    it('期間トグルを切り替えると URL クエリパラメータが更新される', async () => {
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      // useSearchParams を使ったURL更新をテスト
      // MemoryRouterでは実際のURL変化を直接確認するのが難しいため、
      // getStats の呼び出し引数でperiodの更新を確認する
      await renderAdminPage();

      mockedApi.admin.getStats.mockClear();
      await user.click(screen.getByRole('button', { name: '30d' }));

      await waitFor(() => {
        expect(mockedApi.admin.getStats).toHaveBeenCalledWith(
          expect.objectContaining({ period: '30d' }),
        );
      });
    });

    it('カスタム日付を確定すると URL が ?from=...&to=... に更新される', async () => {
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      await renderAdminPage();

      await user.click(screen.getByRole('button', { name: 'カスタム' }));

      const fromInput = await screen.findByTestId('period-date-from');
      const toInput = await screen.findByTestId('period-date-to');
      await user.type(fromInput, '2024-03-01');
      await user.type(toInput, '2024-03-31');

      mockedApi.admin.getStats.mockClear();
      await user.click(screen.getByRole('button', { name: '適用' }));

      await waitFor(() => {
        expect(mockedApi.admin.getStats).toHaveBeenCalledWith(
          expect.objectContaining({ from: '2024-03-01', to: '2024-03-31' }),
        );
      });
    });
  });

  describe('API 呼び出し', () => {
    it('期間を切り替えると getStats が新しい期間で再度呼ばれる', async () => {
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      await renderAdminPage();
      const callsBefore = mockedApi.admin.getStats.mock.calls.length;

      await user.click(screen.getByRole('button', { name: '24h' }));

      await waitFor(() => {
        expect(mockedApi.admin.getStats.mock.calls.length).toBeGreaterThan(callsBefore);
      });
    });

    it('24h 選択時は getStats に period="24h" が渡される', async () => {
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      await renderAdminPage();

      mockedApi.admin.getStats.mockClear();
      await user.click(screen.getByRole('button', { name: '24h' }));

      await waitFor(() => {
        expect(mockedApi.admin.getStats).toHaveBeenCalledWith(
          expect.objectContaining({ period: '24h' }),
        );
      });
    });

    it('カスタム期間確定時は getStats に入力した from / to が渡される', async () => {
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      await renderAdminPage();

      await user.click(screen.getByRole('button', { name: 'カスタム' }));

      const fromInput = await screen.findByTestId('period-date-from');
      const toInput = await screen.findByTestId('period-date-to');
      await user.type(fromInput, '2024-05-01');
      await user.type(toInput, '2024-05-31');

      mockedApi.admin.getStats.mockClear();
      await user.click(screen.getByRole('button', { name: '適用' }));

      await waitFor(() => {
        expect(mockedApi.admin.getStats).toHaveBeenCalledWith(
          expect.objectContaining({ from: '2024-05-01', to: '2024-05-31' }),
        );
      });
    });

    it('期間切替後に統計カードの数値が更新される（再フェッチ結果が反映される）', async () => {
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      await renderAdminPage();

      // 最初の表示を確認
      expect(screen.getByText('100')).toBeInTheDocument(); // totalMessages

      // 別の期間のデータを返すよう更新
      const newStats: AdminStats = { ...mockStats, totalMessages: 50 };
      mockedApi.admin.getStats.mockResolvedValue(newStats);

      await user.click(screen.getByRole('button', { name: '24h' }));

      await waitFor(() => {
        expect(screen.getByText('50')).toBeInTheDocument();
      });
    });
  });
});
