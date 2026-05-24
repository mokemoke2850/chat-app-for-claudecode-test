/**
 * テスト対象: components/Chat/EventCard.tsx（会話イベント投稿 #108）
 * 戦略:
 *   - api.events は vi.mock で差し替え、RSVP API 呼び出しを検証する
 *   - Socket.IO は SocketContext をモックして event:rsvp_updated を擬似発火する
 *   - 集計表示・RSVP ボタン操作・リアルタイム更新を中心に検証する
 *   - #179: 参加者一覧パネル（event-summary クリック）・作成者向け操作（編集・削除）を追加
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import type { ChatEvent, RsvpUser } from '@chat-app/shared';
import EventCard from '../EventCard';

const mockSocket = { emit: vi.fn(), on: vi.fn(), off: vi.fn() };
vi.mock('../../../contexts/SocketContext', () => ({
  useSocket: () => mockSocket,
}));

const showError = vi.fn();
vi.mock('../../../contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showSuccess: vi.fn(), showError, showInfo: vi.fn() }),
}));

const setRsvpMock = vi.fn();
const getRsvpsMock = vi.fn();
const deleteEventMock = vi.fn();
vi.mock('../../../api/client', () => ({
  api: {
    events: {
      setRsvp: (id: number, status: string) => setRsvpMock(id, status),
      getRsvps: (id: number) => getRsvpsMock(id),
      delete: (id: number) => deleteEventMock(id),
    },
  },
}));

beforeEach(() => {
  mockSocket.emit.mockClear();
  mockSocket.on.mockClear();
  mockSocket.off.mockClear();
  showError.mockClear();
  setRsvpMock.mockReset();
  getRsvpsMock.mockReset();
  deleteEventMock.mockReset();
});

const sampleEvent: ChatEvent = {
  id: 42,
  messageId: 1,
  title: 'テスト',
  description: null,
  startsAt: '2030-01-01T10:00:00Z',
  endsAt: null,
  createdBy: 1,
  createdAt: '2030-01-01T00:00:00Z',
  updatedAt: '2030-01-01T00:00:00Z',
  rsvpCounts: { going: 0, notGoing: 0, maybe: 0 },
  myRsvp: null,
};

function eventWith(overrides: Partial<ChatEvent>): ChatEvent {
  return { ...sampleEvent, ...overrides };
}

// #107 — event-id ベースのルームに join/leave するため、転送先からも RSVP 集計を受信できる
describe('EventCard - event ルーム購読 (#107)', () => {
  it('マウント時に socket.emit("event:join_room", eventId) を呼ぶ', () => {
    render(<EventCard event={sampleEvent} />);
    expect(mockSocket.emit).toHaveBeenCalledWith('event:join_room', 42);
  });

  it('アンマウント時に socket.emit("event:leave_room", eventId) を呼ぶ', () => {
    const { unmount } = render(<EventCard event={sampleEvent} />);
    mockSocket.emit.mockClear();
    unmount();
    expect(mockSocket.emit).toHaveBeenCalledWith('event:leave_room', 42);
  });

  it('event:rsvp_updated ハンドラを Socket に登録する', () => {
    render(<EventCard event={sampleEvent} />);
    expect(mockSocket.on).toHaveBeenCalledWith('event:rsvp_updated', expect.any(Function));
  });
});

describe('EventCard - 会話イベント投稿 (#108)', () => {
  describe('表示', () => {
    it('イベントタイトル・開始日時・説明文が表示される', () => {
      render(
        <EventCard event={eventWith({ title: '社内勉強会', description: 'React 19 について' })} />,
      );
      expect(screen.getByText('社内勉強会')).toBeInTheDocument();
      expect(screen.getByText('React 19 について')).toBeInTheDocument();
      // 開始日時には 2030 年が含まれる
      expect(screen.getByText(/2030/)).toBeInTheDocument();
    });

    it('ends_at が設定されている場合は終了日時も表示される', () => {
      render(
        <EventCard
          event={eventWith({
            startsAt: '2030-01-01T10:00:00Z',
            endsAt: '2030-01-01T12:00:00Z',
          })}
        />,
      );
      // formatRange の結果に en dash が含まれる
      expect(screen.getByText(/–/)).toBeInTheDocument();
    });

    it('ends_at が null の場合は終了日時を表示しない', () => {
      render(<EventCard event={eventWith({ startsAt: '2030-01-01T10:00:00Z', endsAt: null })} />);
      expect(screen.queryByText(/–/)).toBeNull();
    });

    it('description が null の場合は説明エリアを表示しない', () => {
      render(<EventCard event={eventWith({ description: null })} />);
      // 説明用のテキストは描画されない（タイトル「テスト」は出る）
      // 任意の長文を期待するわけではないので、サマリ Box にのみ参加 N が表示されることをサニティ確認
      expect(screen.getByTestId('event-summary')).toBeInTheDocument();
    });

    it('rsvpCounts に基づき "参加 N 名 / 不参加 N 名 / 未定 N 名" の集計が表示される', () => {
      render(<EventCard event={eventWith({ rsvpCounts: { going: 3, notGoing: 1, maybe: 2 } })} />);
      const summary = screen.getByTestId('event-summary');
      expect(summary.textContent).toContain('参加 3');
      expect(summary.textContent).toContain('不参加 1');
      expect(summary.textContent).toContain('未定 2');
    });

    it('myRsvp が "going" のとき「参加する」ボタンが選択状態になる', () => {
      render(<EventCard event={eventWith({ myRsvp: 'going' })} />);
      expect(screen.getByLabelText('rsvp-going')).toHaveAttribute('aria-pressed', 'true');
    });

    it('myRsvp が "not_going" のとき「不参加」ボタンが選択状態になる', () => {
      render(<EventCard event={eventWith({ myRsvp: 'not_going' })} />);
      expect(screen.getByLabelText('rsvp-not_going')).toHaveAttribute('aria-pressed', 'true');
    });

    it('myRsvp が "maybe" のとき「未定」ボタンが選択状態になる', () => {
      render(<EventCard event={eventWith({ myRsvp: 'maybe' })} />);
      expect(screen.getByLabelText('rsvp-maybe')).toHaveAttribute('aria-pressed', 'true');
    });

    it('myRsvp が null のときどのボタンも選択状態にならない', () => {
      render(<EventCard event={eventWith({ myRsvp: null })} />);
      expect(screen.getByLabelText('rsvp-going')).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByLabelText('rsvp-not_going')).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByLabelText('rsvp-maybe')).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('RSVP 操作', () => {
    it('「参加する」ボタンをクリックすると api.events.setRsvp が status="going" で呼ばれる', () => {
      setRsvpMock.mockResolvedValue({
        event: eventWith({ myRsvp: 'going', rsvpCounts: { going: 1, notGoing: 0, maybe: 0 } }),
      });
      render(<EventCard event={sampleEvent} />);
      fireEvent.click(screen.getByLabelText('rsvp-going'));
      expect(setRsvpMock).toHaveBeenCalledWith(42, 'going');
    });

    it('「不参加」ボタンをクリックすると api.events.setRsvp が status="not_going" で呼ばれる', () => {
      setRsvpMock.mockResolvedValue({ event: sampleEvent });
      render(<EventCard event={sampleEvent} />);
      fireEvent.click(screen.getByLabelText('rsvp-not_going'));
      expect(setRsvpMock).toHaveBeenCalledWith(42, 'not_going');
    });

    it('「未定」ボタンをクリックすると api.events.setRsvp が status="maybe" で呼ばれる', () => {
      setRsvpMock.mockResolvedValue({ event: sampleEvent });
      render(<EventCard event={sampleEvent} />);
      fireEvent.click(screen.getByLabelText('rsvp-maybe'));
      expect(setRsvpMock).toHaveBeenCalledWith(42, 'maybe');
    });

    it('RSVP 更新成功後にローカル集計とボタン選択状態が反映される', async () => {
      setRsvpMock.mockResolvedValue({
        event: eventWith({ myRsvp: 'going', rsvpCounts: { going: 5, notGoing: 0, maybe: 0 } }),
      });
      render(<EventCard event={sampleEvent} />);
      await act(async () => {
        fireEvent.click(screen.getByLabelText('rsvp-going'));
      });
      expect(screen.getByLabelText('rsvp-going')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('event-summary').textContent).toContain('参加 5');
    });

    it('RSVP 更新失敗時はスナックバーでエラー通知され、ボタン状態はロールバックされる', async () => {
      setRsvpMock.mockRejectedValue(new Error('Network error'));
      render(<EventCard event={eventWith({ myRsvp: null })} />);
      await act(async () => {
        fireEvent.click(screen.getByLabelText('rsvp-going'));
      });
      expect(showError).toHaveBeenCalled();
      // ロールバック: 失敗時は myRsvp は更新されない（null のまま）
      expect(screen.getByLabelText('rsvp-going')).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('Socket リアルタイム更新', () => {
    it('event:rsvp_updated を受信すると rsvpCounts が再描画される', () => {
      render(<EventCard event={sampleEvent} />);
      const onCall = mockSocket.on.mock.calls.find((c) => c[0] === 'event:rsvp_updated');
      const handler = onCall![1] as (data: {
        eventId: number;
        messageId: number;
        channelId: number;
        rsvpCounts: { going: number; notGoing: number; maybe: number };
      }) => void;
      act(() => {
        handler({
          eventId: 42,
          messageId: 1,
          channelId: 1,
          rsvpCounts: { going: 7, notGoing: 0, maybe: 0 },
        });
      });
      expect(screen.getByTestId('event-summary').textContent).toContain('参加 7');
    });

    it('別イベントの event:rsvp_updated は無視される', () => {
      render(<EventCard event={sampleEvent} />);
      const onCall = mockSocket.on.mock.calls.find((c) => c[0] === 'event:rsvp_updated');
      const handler = onCall![1] as (data: {
        eventId: number;
        messageId: number;
        channelId: number;
        rsvpCounts: { going: number; notGoing: number; maybe: number };
      }) => void;
      act(() => {
        handler({
          eventId: 999,
          messageId: 1,
          channelId: 1,
          rsvpCounts: { going: 99, notGoing: 0, maybe: 0 },
        });
      });
      // 別イベントなので集計は変化しない（元の 0 のまま）
      expect(screen.getByTestId('event-summary').textContent).toContain('参加 0');
    });
  });

  describe('参加者一覧表示', () => {
    it('集計をクリックすると参加者一覧パネル（going/not_going/maybe）が開く', async () => {
      const rsvpUsers: RsvpUser[] = [
        {
          userId: 10,
          username: 'alice',
          displayName: 'Alice',
          avatarUrl: null,
          status: 'going',
          updatedAt: '2030-01-01T00:00:00Z',
        },
        {
          userId: 11,
          username: 'bob',
          displayName: 'Bob',
          avatarUrl: null,
          status: 'not_going',
          updatedAt: '2030-01-01T00:00:00Z',
        },
        {
          userId: 12,
          username: 'carol',
          displayName: null,
          avatarUrl: null,
          status: 'maybe',
          updatedAt: '2030-01-01T00:00:00Z',
        },
      ];
      getRsvpsMock.mockResolvedValue({ users: rsvpUsers });

      render(<EventCard event={eventWith({ rsvpCounts: { going: 1, notGoing: 1, maybe: 1 } })} />);

      // パネルは最初非表示
      expect(screen.queryByTestId('rsvp-panel')).toBeNull();

      // event-summary をクリックするとパネルが開く
      await act(async () => {
        fireEvent.click(screen.getByTestId('event-summary'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('rsvp-panel')).toBeInTheDocument();
      });

      // 3 グループのセクションが表示される
      const panel = screen.getByTestId('rsvp-panel');
      expect(panel.textContent).toMatch(/参加する|参加/);
      expect(panel.textContent).toMatch(/不参加/);
      expect(panel.textContent).toMatch(/未定/);
    });

    it('参加者一覧には各ユーザーの表示名とアバターが並ぶ', async () => {
      const rsvpUsers: RsvpUser[] = [
        {
          userId: 10,
          username: 'alice',
          displayName: 'Alice 山田',
          avatarUrl: null,
          status: 'going',
          updatedAt: '2030-01-01T00:00:00Z',
        },
        {
          userId: 11,
          username: 'bob',
          displayName: null,
          avatarUrl: null,
          status: 'going',
          updatedAt: '2030-01-01T00:00:00Z',
        },
      ];
      getRsvpsMock.mockResolvedValue({ users: rsvpUsers });

      render(<EventCard event={eventWith({ rsvpCounts: { going: 2, notGoing: 0, maybe: 0 } })} />);

      await act(async () => {
        fireEvent.click(screen.getByTestId('event-summary'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('rsvp-panel')).toBeInTheDocument();
      });

      // displayName がある場合は displayName を、ない場合は username を表示する
      expect(screen.getByText('Alice 山田')).toBeInTheDocument();
      expect(screen.getByText('bob')).toBeInTheDocument();
    });
  });

  describe('作成者向け操作', () => {
    it('作成者のときのみ編集・削除メニューが表示される', () => {
      // currentUserId === event.createdBy (1) のとき、操作メニューボタンが表示される
      render(<EventCard event={sampleEvent} currentUserId={1} />);
      expect(screen.getByLabelText('event-actions-menu')).toBeInTheDocument();
    });

    it('作成者以外のときは編集・削除メニューが表示されない', () => {
      // currentUserId !== event.createdBy のときはメニューボタン自体が存在しない
      render(<EventCard event={sampleEvent} currentUserId={99} />);
      expect(screen.queryByLabelText('event-actions-menu')).toBeNull();
    });
  });
});

// #324 RSVP 視覚化強化
describe('EventCard - RSVP 視覚化強化 (#324)', () => {
  // アバタープレビュー用のテストヘルパー
  type GoingUser = Pick<RsvpUser, 'userId' | 'displayName' | 'avatarUrl'>;

  function makeGoingUser(userId: number, displayName: string | null = null): GoingUser {
    return { userId, displayName, avatarUrl: null };
  }

  describe('未回答プロンプト', () => {
    it('myRsvp が null のとき「あなたの回答は？」などの回答促しメッセージが表示される', () => {
      render(<EventCard event={eventWith({ myRsvp: null })} />);
      // data-testid="rsvp-prompt" の要素が表示される
      expect(screen.getByTestId('rsvp-prompt')).toBeInTheDocument();
    });

    it('myRsvp が null でないときは回答促しメッセージが表示されない', () => {
      render(<EventCard event={eventWith({ myRsvp: 'going' })} />);
      expect(screen.queryByTestId('rsvp-prompt')).toBeNull();
    });
  });

  describe('選択済みボタンの強調', () => {
    it('myRsvp が "going" のとき参加ボタンにチェックマーク等の強調インジケーターが表示される', () => {
      render(<EventCard event={eventWith({ myRsvp: 'going' })} />);
      // rsvp-going ボタン配下に rsvp-selected-indicator が存在する
      const goingButton = screen.getByLabelText('rsvp-going');
      expect(goingButton.querySelector('[data-testid="rsvp-selected-indicator"]')).not.toBeNull();
    });

    it('myRsvp が "not_going" のとき不参加ボタンに強調インジケーターが表示される', () => {
      render(<EventCard event={eventWith({ myRsvp: 'not_going' })} />);
      const notGoingButton = screen.getByLabelText('rsvp-not_going');
      expect(
        notGoingButton.querySelector('[data-testid="rsvp-selected-indicator"]'),
      ).not.toBeNull();
    });

    it('myRsvp が "maybe" のとき未定ボタンに強調インジケーターが表示される', () => {
      render(<EventCard event={eventWith({ myRsvp: 'maybe' })} />);
      const maybeButton = screen.getByLabelText('rsvp-maybe');
      expect(maybeButton.querySelector('[data-testid="rsvp-selected-indicator"]')).not.toBeNull();
    });

    it('myRsvp が null のときどのボタンにも強調インジケーターが表示されない', () => {
      render(<EventCard event={eventWith({ myRsvp: null })} />);
      expect(screen.queryAllByTestId('rsvp-selected-indicator')).toHaveLength(0);
    });
  });

  describe('参加者アバタープレビュー', () => {
    it('going が 1 名以上のとき参加者アバタープレビュー領域（rsvp-avatar-preview）がカード内に表示される', () => {
      const goingUsers = [makeGoingUser(1, 'Alice')];
      render(<EventCard event={sampleEvent} goingUsers={goingUsers} />);
      expect(screen.getByTestId('rsvp-avatar-preview')).toBeInTheDocument();
    });

    it('参加者が 3 名以下のときアバター 3 個がすべて表示される', () => {
      const goingUsers = [
        makeGoingUser(1, 'Alice'),
        makeGoingUser(2, 'Bob'),
        makeGoingUser(3, 'Carol'),
      ];
      render(<EventCard event={sampleEvent} goingUsers={goingUsers} />);
      const preview = screen.getByTestId('rsvp-avatar-preview');
      // アバター要素（data-testid="rsvp-avatar"）が 3 個表示される
      expect(preview.querySelectorAll('[data-testid="rsvp-avatar"]')).toHaveLength(3);
      // 残り人数バッジは表示されない
      expect(preview.querySelector('[data-testid="rsvp-avatar-overflow"]')).toBeNull();
    });

    it('参加者が 4 名以上のとき先頭 3 名のアバターと残り人数（+N）が表示される', () => {
      const goingUsers = [
        makeGoingUser(1, 'Alice'),
        makeGoingUser(2, 'Bob'),
        makeGoingUser(3, 'Carol'),
        makeGoingUser(4, 'Dave'),
        makeGoingUser(5, 'Eve'),
      ];
      render(<EventCard event={sampleEvent} goingUsers={goingUsers} />);
      const preview = screen.getByTestId('rsvp-avatar-preview');
      // 先頭 3 名分のアバターのみ表示
      expect(preview.querySelectorAll('[data-testid="rsvp-avatar"]')).toHaveLength(3);
      // 残り 2 名分のオーバーフローバッジが表示される
      const overflow = preview.querySelector('[data-testid="rsvp-avatar-overflow"]');
      expect(overflow).not.toBeNull();
      expect(overflow!.textContent).toContain('+2');
    });

    it('going が 0 名のときアバタープレビュー領域は表示されない', () => {
      render(<EventCard event={sampleEvent} goingUsers={[]} />);
      expect(screen.queryByTestId('rsvp-avatar-preview')).toBeNull();
    });

    it('Socket 経由で going 人数が増えたときアバタープレビューは更新されない（プレビューは初期 prop のみ反映）', () => {
      const goingUsers = [makeGoingUser(1, 'Alice')];
      render(<EventCard event={sampleEvent} goingUsers={goingUsers} />);
      // 初期状態でプレビューが表示されている
      expect(screen.getByTestId('rsvp-avatar-preview')).toBeInTheDocument();

      // Socket 経由で RSVP が更新されても goingUsers prop は変わらないためプレビューは変化しない
      const onCall = mockSocket.on.mock.calls.find((c) => c[0] === 'event:rsvp_updated');
      const handler = onCall![1] as (data: {
        eventId: number;
        messageId: number;
        channelId: number;
        rsvpCounts: { going: number; notGoing: number; maybe: number };
      }) => void;
      act(() => {
        handler({
          eventId: 42,
          messageId: 1,
          channelId: 1,
          rsvpCounts: { going: 10, notGoing: 0, maybe: 0 },
        });
      });
      // アバタープレビューは初期 prop（1 名）のままで変化しない
      const preview = screen.getByTestId('rsvp-avatar-preview');
      expect(preview.querySelectorAll('[data-testid="rsvp-avatar"]')).toHaveLength(1);
    });
  });
});
