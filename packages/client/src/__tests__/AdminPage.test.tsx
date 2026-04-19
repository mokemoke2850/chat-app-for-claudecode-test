/**
 * AdminPage のテスト
 *
 * テスト対象: packages/client/src/pages/AdminPage.tsx
 * 戦略: vi.mock('../api/client') でAPIをモック化し、
 * 統計・ユーザー管理・チャンネル管理の各タブの動作を検証する。
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import AdminPage from '../pages/AdminPage';
import type { AdminUser, AdminChannel, AdminStats } from '../types/admin';

const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

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
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    name: 'secret',
    description: 'private channel',
    isPrivate: true,
    memberCount: 1,
    isArchived: true,
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
  mockedUseAuth.mockReturnValue({
    user: { id: 1, username: 'alice', role: 'admin', isActive: true },
  });
  mockedApi.admin.getStats.mockResolvedValue(mockStats);
  mockedApi.admin.getUsers.mockResolvedValue({ users: mockAdminUsers });
  mockedApi.admin.getChannels.mockResolvedValue({ channels: mockAdminChannels });
  mockedApi.admin.updateUserRole.mockResolvedValue({ success: true });
  mockedApi.admin.updateUserStatus.mockResolvedValue({ success: true });
  mockedApi.admin.deleteUser.mockResolvedValue(undefined);
  mockedApi.admin.deleteChannel.mockResolvedValue(undefined);
  mockedApi.admin.unarchiveChannel.mockResolvedValue({
    channel: { id: 2, name: 'secret', isArchived: false },
  });
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
    await userEvent.click(screen.getByRole('tab', { name: 'ユーザー管理' }));
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
    await userEvent.click(roleButtons[0]);
    expect(mockedApi.admin.updateUserRole).toHaveBeenCalledWith(2, 'admin');
  });

  it('停止ボタンを押すと updateUserStatus が bob (id=2) を対象に呼ばれる', async () => {
    await openUsersTab();
    // alice は自分自身のため停止ボタンが最初に出るのは bob (id=2)
    const suspendButtons = screen.getAllByRole('button', { name: '停止' });
    await userEvent.click(suspendButtons[0]);
    expect(mockedApi.admin.updateUserStatus).toHaveBeenCalledWith(2, false);
  });

  it('削除ボタンを押すと確認ダイアログが表示される', async () => {
    await openUsersTab();
    const deleteButtons = screen.getAllByRole('button', { name: '削除' });
    await userEvent.click(deleteButtons[0]);
    expect(screen.getByText('ユーザーを削除しますか？')).toBeInTheDocument();
  });

  it('確認ダイアログで「削除」を押すと deleteUser が呼ばれる', async () => {
    await openUsersTab();
    const deleteButtons = screen.getAllByRole('button', { name: '削除' });
    await userEvent.click(deleteButtons[0]);
    // ダイアログ内の「削除」ボタンをクリック
    const confirmButtons = screen.getAllByRole('button', { name: '削除' });
    await userEvent.click(confirmButtons[confirmButtons.length - 1]);
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
    await userEvent.click(screen.getByRole('tab', { name: 'チャンネル管理' }));
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
    await userEvent.click(unarchiveButton);
    expect(mockedApi.admin.unarchiveChannel).toHaveBeenCalledWith(2);
  });

  it('削除ボタンを押すと確認ダイアログ → deleteChannel が呼ばれる', async () => {
    await openChannelsTab();
    const deleteButtons = screen.getAllByRole('button', { name: '削除' });
    await userEvent.click(deleteButtons[0]);
    expect(screen.getByText('チャンネルを削除しますか？')).toBeInTheDocument();
    const confirmButtons = screen.getAllByRole('button', { name: '削除' });
    await userEvent.click(confirmButtons[confirmButtons.length - 1]);
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
    await userEvent.click(screen.getByRole('tab', { name: 'ユーザー管理' }));
    await act(async () => {});
    await waitFor(() => expect(screen.getByText('bob')).toBeInTheDocument());

    // bob のロール変更を試みる（API は reject）
    const roleButtons = screen.getAllByRole('button', { name: 'admin に変更' });
    await userEvent.click(roleButtons[0]);

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
  it('チャンネル管理タブの各行に isRecommended のチェックボックス（または切替ボタン）が表示される', () => {
    // TODO
  });

  it('チェックボックスを ON にすると admin.setChannelRecommended が true で呼ばれる', () => {
    // TODO
  });

  it('チェックボックスを OFF にすると admin.setChannelRecommended が false で呼ばれる', () => {
    // TODO
  });

  it('API 成功後に一覧の表示が更新される（楽観的更新 or 再取得）', () => {
    // TODO
  });

  it('API 失敗時はスナックバーでエラー通知し、チェック状態は元に戻る', () => {
    // TODO
  });
});
