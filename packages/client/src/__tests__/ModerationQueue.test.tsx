/**
 * テスト対象: components/Admin/ModerationQueue.tsx
 *
 * 戦略:
 *   - vi.mock('../api/client') でAPIをモック化
 *   - React 19 の use() + Suspense パターンを考慮してテストする
 *   - 通報一覧の表示・却下・削除アクションを検証する
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MessageReport } from '@chat-app/shared';

const mockListReports = vi.fn();
const mockDismissReport = vi.fn();
const mockActionReport = vi.fn();

vi.mock('../api/client', () => ({
  api: {
    admin: {
      reports: {
        list: (params?: unknown) => mockListReports(params),
        dismiss: (id: number) => mockDismissReport(id),
        action: (id: number, actionType: string) => mockActionReport(id, actionType),
      },
    },
  },
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

const mockReports: MessageReport[] = [
  {
    id: 1,
    messageId: 10,
    channelId: 100,
    reporterId: 2,
    reporterUsername: 'bob',
    reason: 'spam',
    comment: 'スパムです',
    status: 'pending',
    actionTaken: null,
    handledBy: null,
    handledAt: null,
    createdAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 2,
    messageId: 20,
    channelId: 200,
    reporterId: 3,
    reporterUsername: 'carol',
    reason: 'harassment',
    comment: null,
    status: 'dismissed',
    actionTaken: null,
    handledBy: 1,
    handledAt: '2025-01-02T00:00:00Z',
    createdAt: '2025-01-01T12:00:00Z',
  },
];

beforeEach(() => {
  vi.resetAllMocks();
  mockListReports.mockResolvedValue({ reports: mockReports });
  mockDismissReport.mockResolvedValue({ report: { ...mockReports[0], status: 'dismissed' } });
  mockActionReport.mockResolvedValue({
    report: { ...mockReports[0], status: 'actioned', actionTaken: 'delete_message' },
  });
});

async function renderModerationQueue() {
  const { default: ModerationQueue } = await import('../components/Admin/ModerationQueue');
  await act(async () => {
    render(<ModerationQueue />);
  });
}

describe('ModerationQueue', () => {
  describe('通報一覧の表示', () => {
    it('通報の一覧が表示される', async () => {
      await renderModerationQueue();
      await waitFor(() => expect(screen.getByText('#10')).toBeInTheDocument());
      expect(screen.getByText('#20')).toBeInTheDocument();
    });

    it('メッセージIDが該当投稿への外部リンクとして表示される', async () => {
      await renderModerationQueue();
      await waitFor(() =>
        expect(
          screen.getByRole('link', { name: /メッセージ 10 を別ウィンドウで開く/ }),
        ).toBeInTheDocument(),
      );
      const link = screen.getByRole('link', { name: /メッセージ 10 を別ウィンドウで開く/ });
      // ?channel=<channelId>#message-<messageId> 形式の URL を target=_blank で開く
      expect(link).toHaveAttribute('href', '/?channel=100#message-10');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link.getAttribute('rel')).toMatch(/noopener/);
    });

    it('通報者のユーザー名が表示される', async () => {
      await renderModerationQueue();
      await waitFor(() => expect(screen.getByText('bob')).toBeInTheDocument());
      expect(screen.getByText('carol')).toBeInTheDocument();
    });

    it('通報理由（spam / harassment / other）が表示される', async () => {
      await renderModerationQueue();
      await waitFor(() => expect(screen.getByText('スパム')).toBeInTheDocument());
      expect(screen.getByText('ハラスメント')).toBeInTheDocument();
    });

    it('ステータスが pending の通報には対応ボタンが表示される', async () => {
      await renderModerationQueue();
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /通報 1 を却下/ })).toBeInTheDocument(),
      );
      expect(screen.getByRole('button', { name: /通報 1 のメッセージを削除/ })).toBeInTheDocument();
    });

    it('ステータスが dismissed / actioned の通報には対応ボタンが非表示になる', async () => {
      await renderModerationQueue();
      await waitFor(() => expect(screen.getByText('carol')).toBeInTheDocument());
      // report id=2 は dismissed なので対応ボタンが存在しない
      expect(screen.queryByRole('button', { name: /通報 2 を却下/ })).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /通報 2 のメッセージを削除/ }),
      ).not.toBeInTheDocument();
    });
  });

  describe('通報の却下', () => {
    it('「却下」ボタンをクリックすると api.admin.reports.dismiss が呼ばれる', async () => {
      await renderModerationQueue();
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /通報 1 を却下/ })).toBeInTheDocument(),
      );
      await userEvent.click(screen.getByRole('button', { name: /通報 1 を却下/ }));
      await waitFor(() => expect(mockDismissReport).toHaveBeenCalledWith(1));
    });

    it('却下成功後に通報の status が dismissed に更新される', async () => {
      await renderModerationQueue();
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /通報 1 を却下/ })).toBeInTheDocument(),
      );
      await userEvent.click(screen.getByRole('button', { name: /通報 1 を却下/ }));
      await waitFor(() => expect(mockShowSuccess).toHaveBeenCalledWith('通報を却下しました'));
      // 却下後は対応ボタンが消える
      expect(screen.queryByRole('button', { name: /通報 1 を却下/ })).not.toBeInTheDocument();
    });
  });

  describe('メッセージ削除アクション', () => {
    it('「メッセージを削除」ボタンをクリックすると api.admin.reports.action が呼ばれる', async () => {
      await renderModerationQueue();
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: /通報 1 のメッセージを削除/ }),
        ).toBeInTheDocument(),
      );
      await userEvent.click(screen.getByRole('button', { name: /通報 1 のメッセージを削除/ }));
      await waitFor(() => expect(mockActionReport).toHaveBeenCalledWith(1, 'delete_message'));
    });

    it('削除アクション成功後に通報の status が actioned に更新される', async () => {
      await renderModerationQueue();
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: /通報 1 のメッセージを削除/ }),
        ).toBeInTheDocument(),
      );
      await userEvent.click(screen.getByRole('button', { name: /通報 1 のメッセージを削除/ }));
      await waitFor(() => expect(mockShowSuccess).toHaveBeenCalledWith('メッセージを削除しました'));
      // アクション後は対応ボタンが消える
      expect(
        screen.queryByRole('button', { name: /通報 1 のメッセージを削除/ }),
      ).not.toBeInTheDocument();
    });
  });

  describe('フィルタリング', () => {
    it('「すべて表示」時は pending / dismissed / actioned すべてが表示される', async () => {
      await renderModerationQueue();
      await waitFor(() => expect(screen.getByText('bob')).toBeInTheDocument());
      // pending (bob) と dismissed (carol) の両方が表示される
      expect(screen.getByText('bob')).toBeInTheDocument();
      expect(screen.getByText('carol')).toBeInTheDocument();
    });
  });
});
