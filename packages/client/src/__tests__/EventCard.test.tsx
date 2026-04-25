/**
 * components/Chat/EventCard.tsx のユニットテスト (#108)
 *
 * テスト対象:
 *   - タイトル / 日時 / RSVP ボタン / 集計の表示
 *   - RSVP ボタン押下で api.events.setRsvp が呼ばれカウントが更新される
 *   - Socket 経由 `event:rsvp_updated` イベントで集計がリアルタイム更新される
 * 戦略:
 *   - api/client は vi.mock() でスタブ化
 *   - SocketContext / SnackbarContext もモック化
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ChatEvent } from '@chat-app/shared';
import EventCard from '../components/Chat/EventCard';

const mockSocketHandlers: Record<string, (...args: unknown[]) => void> = {};
const mockSocket = {
  emit: vi.fn(),
  on: vi.fn((ev: string, handler: (...args: unknown[]) => void) => {
    mockSocketHandlers[ev] = handler;
  }),
  off: vi.fn(),
};

vi.mock('../contexts/SocketContext', () => ({
  useSocket: () => mockSocket,
}));

vi.mock('../contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showSuccess: vi.fn(), showError: vi.fn(), showInfo: vi.fn() }),
}));

const setRsvpMock = vi.fn();
vi.mock('../api/client', () => ({
  api: {
    events: {
      setRsvp: (...args: unknown[]) => setRsvpMock(...args),
    },
  },
}));

function makeEvent(overrides: Partial<ChatEvent> = {}): ChatEvent {
  return {
    id: 11,
    messageId: 100,
    title: 'チームランチ',
    description: '社食 1F',
    startsAt: '2030-06-01T12:00:00Z',
    endsAt: '2030-06-01T13:00:00Z',
    createdBy: 1,
    createdAt: '2030-05-01T00:00:00Z',
    updatedAt: '2030-05-01T00:00:00Z',
    rsvpCounts: { going: 2, notGoing: 1, maybe: 0 },
    myRsvp: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Object.keys(mockSocketHandlers)) delete mockSocketHandlers[k];
});

describe('EventCard', () => {
  describe('表示', () => {
    it('タイトル / 説明 / 集計が表示される', () => {
      render(<EventCard event={makeEvent()} />);
      expect(screen.getByText('チームランチ')).toBeInTheDocument();
      expect(screen.getByText('社食 1F')).toBeInTheDocument();
      expect(screen.getByTestId('event-summary').textContent).toMatch(/参加 2.*不参加 1.*未定 0/);
    });

    it('myRsvp に対応するボタンが押下状態（aria-pressed=true）で表示される', () => {
      render(<EventCard event={makeEvent({ myRsvp: 'going' })} />);
      const goingBtn = screen.getByLabelText('rsvp-going');
      expect(goingBtn.getAttribute('aria-pressed')).toBe('true');
      expect(screen.getByLabelText('rsvp-not_going').getAttribute('aria-pressed')).toBe('false');
    });
  });

  describe('RSVP 操作', () => {
    it('参加ボタン押下で api.events.setRsvp が "going" で呼ばれる', async () => {
      setRsvpMock.mockResolvedValue({
        event: makeEvent({
          myRsvp: 'going',
          rsvpCounts: { going: 3, notGoing: 1, maybe: 0 },
        }),
      });
      render(<EventCard event={makeEvent()} />);
      await userEvent.click(screen.getByLabelText('rsvp-going'));
      expect(setRsvpMock).toHaveBeenCalledWith(11, 'going');
      await waitFor(() =>
        expect(screen.getByLabelText('rsvp-going').getAttribute('aria-pressed')).toBe('true'),
      );
    });

    it('RSVP 成功後にカウントが更新される', async () => {
      setRsvpMock.mockResolvedValue({
        event: makeEvent({
          myRsvp: 'maybe',
          rsvpCounts: { going: 2, notGoing: 1, maybe: 5 },
        }),
      });
      render(<EventCard event={makeEvent()} />);
      await userEvent.click(screen.getByLabelText('rsvp-maybe'));
      await waitFor(() =>
        expect(screen.getByTestId('event-summary').textContent).toMatch(/参加 2.*不参加 1.*未定 5/),
      );
    });
  });

  describe('Socket 経由のリアルタイム更新', () => {
    it('event:rsvp_updated を受信したら集計がリアクティブに更新される', async () => {
      render(<EventCard event={makeEvent()} />);

      // 別ユーザーが RSVP した想定の Socket イベント
      mockSocketHandlers['event:rsvp_updated']({
        eventId: 11,
        messageId: 100,
        channelId: 1,
        rsvpCounts: { going: 7, notGoing: 1, maybe: 2 },
      });

      await waitFor(() =>
        expect(screen.getByTestId('event-summary').textContent).toMatch(/参加 7.*不参加 1.*未定 2/),
      );
    });

    it('別 eventId の Socket イベントは無視される', async () => {
      render(<EventCard event={makeEvent()} />);
      mockSocketHandlers['event:rsvp_updated']({
        eventId: 999,
        messageId: 9999,
        channelId: 1,
        rsvpCounts: { going: 99, notGoing: 99, maybe: 99 },
      });
      // 元の集計のままであること
      expect(screen.getByTestId('event-summary').textContent).toMatch(/参加 2.*不参加 1.*未定 0/);
    });
  });
});
