/**
 * components/Chat/CreateEventDialog.tsx のユニットテスト (#108)
 *
 * テスト対象:
 *   - フォーム入力 → 作成ボタンで api.events.create が呼ばれる
 *   - タイトル空 / 終了 <= 開始 のバリデーション
 *   - 成功時に onCreated と onClose が呼ばれる
 * 戦略:
 *   - api/client は vi.mock() でスタブ化
 *   - SnackbarContext もモック化
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import CreateEventDialog from '../components/Chat/CreateEventDialog';

vi.mock('../contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showSuccess: vi.fn(), showError: vi.fn(), showInfo: vi.fn() }),
}));

const createMock = vi.fn();
vi.mock('../api/client', () => ({
  api: {
    events: {
      create: (...args: unknown[]) => createMock(...args),
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CreateEventDialog', () => {
  describe('バリデーション', () => {
    it('タイトル未入力で送信するとエラーメッセージが表示される', async () => {
      render(<CreateEventDialog open channelId={1} onClose={() => {}} />);
      // 開始日時のみ入力
      await userEvent.type(screen.getByLabelText('event-starts-at'), '2030-01-01T10:00');
      await userEvent.click(screen.getByRole('button', { name: '作成' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('タイトル');
      expect(createMock).not.toHaveBeenCalled();
    });

    it('終了日時が開始日時以前のときエラーメッセージが表示される', async () => {
      render(<CreateEventDialog open channelId={1} onClose={() => {}} />);
      await userEvent.type(screen.getByLabelText('event-title'), 'Test');
      await userEvent.type(screen.getByLabelText('event-starts-at'), '2030-01-01T10:00');
      await userEvent.type(screen.getByLabelText('event-ends-at'), '2030-01-01T09:00');
      await userEvent.click(screen.getByRole('button', { name: '作成' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('終了日時');
      expect(createMock).not.toHaveBeenCalled();
    });
  });

  describe('作成', () => {
    it('正常入力で api.events.create が呼ばれ onCreated/onClose が呼ばれる', async () => {
      createMock.mockResolvedValue({
        event: {
          id: 1,
          messageId: 99,
          title: 'テスト',
          description: null,
          startsAt: '2030-01-01T10:00:00.000Z',
          endsAt: null,
          createdBy: 1,
          createdAt: '2030-01-01T00:00:00Z',
          updatedAt: '2030-01-01T00:00:00Z',
          rsvpCounts: { going: 0, notGoing: 0, maybe: 0 },
          myRsvp: null,
        },
      });
      const onCreated = vi.fn();
      const onClose = vi.fn();
      render(<CreateEventDialog open channelId={42} onClose={onClose} onCreated={onCreated} />);
      await userEvent.type(screen.getByLabelText('event-title'), 'テスト');
      await userEvent.type(screen.getByLabelText('event-starts-at'), '2030-01-01T10:00');
      await userEvent.click(screen.getByRole('button', { name: '作成' }));

      await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
      const callArg = createMock.mock.calls[0][0] as {
        channelId: number;
        title: string;
        startsAt: string;
      };
      expect(callArg.channelId).toBe(42);
      expect(callArg.title).toBe('テスト');
      expect(typeof callArg.startsAt).toBe('string');
      expect(onCreated).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
