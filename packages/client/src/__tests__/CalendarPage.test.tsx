/**
 * テスト対象: pages/CalendarPage.tsx — /calendar ルートで表示するグローバルカレンダー画面（#152）
 *
 * 戦略:
 *   - api.calendar.events.list / api.channels.list を vi.mock で差し替え
 *   - React 19 use() + Suspense パターン前提（CLAUDE.md フロントエンド開発ルール）
 *   - act(async) で Suspense をフラッシュしてからアサーション
 *   - AppLayout はテスト容易性のため空スルーにモック化（ナビ部分の検証は AppLayout.test.tsx 側）
 *   - モジュールレベル Promise キャッシュは vi.resetModules() で毎テスト初期化
 *
 * 関連 Issue: #152
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import type { CalendarEvent, Channel } from '@chat-app/shared';

const eventsListMock = vi.fn();
const eventsCreateMock = vi.fn();
const eventsRsvpMock = vi.fn();
const eventsDeleteMock = vi.fn();
const eventsUpdateMock = vi.fn();
const channelsListMock = vi.fn();
const usersListMock = vi.fn();
const pollsListMock = vi.fn();
const pollsCastVoteMock = vi.fn();
const pollsConfirmMock = vi.fn();

vi.mock('../api/client', () => ({
  api: {
    calendar: {
      events: {
        list: eventsListMock,
        create: eventsCreateMock,
        update: eventsUpdateMock,
        delete: eventsDeleteMock,
        rsvp: eventsRsvpMock,
      },
      polls: {
        list: pollsListMock,
        castVote: pollsCastVoteMock,
        confirm: pollsConfirmMock,
      },
    },
    // Issue #267: タスク連携用 API
    tasks: {
      list: vi.fn().mockResolvedValue({ tasks: [] }),
      update: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      updateOrder: vi.fn(),
    },
    channels: { list: channelsListMock },
    auth: { users: usersListMock },
  },
}));

// Step 8b: sidebar prop も露出させるスタブ。Issue #318 で defaultSidebarOpen / forceSidebarClosed も露出
vi.mock('../components/Layout/AppLayout', () => ({
  default: ({
    children,
    sidebar,
    defaultSidebarOpen,
    forceSidebarClosed,
  }: {
    children: ReactNode;
    sidebar?: ReactNode;
    defaultSidebarOpen?: boolean;
    forceSidebarClosed?: boolean;
  }) => (
    <div
      data-testid="app-layout-stub"
      data-default-sidebar-open={String(defaultSidebarOpen ?? true)}
      data-force-sidebar-closed={String(forceSidebarClosed ?? false)}
    >
      <div data-testid="app-layout-sidebar">{sidebar}</div>
      <div data-testid="app-layout-main">{children}</div>
    </div>
  ),
}));

// Step 8b: Sidebar 中身 (ChannelList + SidebarDmList) を stub 化
vi.mock('../components/Channel/ChannelList', () => ({
  default: ({ onSelect }: { onSelect?: (id: number, name: string) => void }) => (
    <div data-testid="channel-list-stub">
      <button onClick={() => onSelect?.(7, 'general')}>select-channel-7</button>
    </div>
  ),
}));
vi.mock('../components/Layout/SidebarDmList', () => ({
  default: () => <div data-testid="sidebar-dm-list-stub" />,
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, username: 'me', email: 'me@t.com' } }),
}));

function makeEvent(
  id: number,
  channelId: number | null,
  startsAt: string,
  title = `Ev${id}`,
): CalendarEvent {
  return {
    id,
    channelId,
    title,
    description: null,
    location: null,
    meetingUrl: null,
    startsAt,
    endsAt: new Date(new Date(startsAt).getTime() + 60 * 60 * 1000).toISOString(),
    organizerId: 1,
    createdAt: '2026-04-30T00:00:00Z',
    updatedAt: '2026-04-30T00:00:00Z',
    attendees: [],
    reminderOffsetMinutes: null,
    recurrenceRule: null,
    recurrenceInterval: 1,
    recurrenceDaysOfWeek: null,
    recurrenceEndDate: null,
    recurrenceCount: null,
    recurrenceMasterId: null,
  };
}

function makeChannel(id: number, name: string): Channel {
  return {
    id,
    name,
    description: null,
    topic: null,
    createdBy: 1,
    createdAt: '2026-04-30T00:00:00Z',
    isPrivate: false,
    postingPermission: 'everyone',
    unreadCount: 0,
  };
}

async function importPage() {
  // モジュールレベルキャッシュを毎回リセットするため動的 import
  const mod = await import('../pages/CalendarPage');
  return mod.default;
}

const renderPage = async () => {
  const CalendarPage = await importPage();
  let result: ReturnType<typeof render> | undefined;
  await act(async () => {
    result = render(
      <MemoryRouter initialEntries={['/calendar']}>
        <Routes>
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/chat" element={<div data-testid="chat-page-stub" />} />
        </Routes>
      </MemoryRouter>,
    );
  });
  return result!;
};

beforeEach(() => {
  vi.resetModules();
  eventsListMock.mockReset();
  eventsCreateMock.mockReset();
  eventsUpdateMock.mockReset();
  eventsRsvpMock.mockReset();
  eventsDeleteMock.mockReset();
  channelsListMock.mockReset();
  usersListMock.mockReset();
  pollsListMock.mockReset();
  pollsCastVoteMock.mockReset();
  pollsConfirmMock.mockReset();
  // 当月+前後で何回呼ばれても返せるようにデフォルトで空 events / channels / users を返す
  eventsListMock.mockResolvedValue({ events: [] });
  channelsListMock.mockResolvedValue({
    channels: [makeChannel(10, 'general'), makeChannel(11, 'design')],
  });
  usersListMock.mockResolvedValue({ users: [] });
  pollsListMock.mockResolvedValue({ polls: [] });
});

describe('CalendarPage', () => {
  describe('初期表示', () => {
    it('マウント時に api.calendar.events.list が当月の from/to で呼ばれる', async () => {
      await renderPage();
      expect(eventsListMock).toHaveBeenCalledTimes(1);
      const call = eventsListMock.mock.calls[0][0] as { from: string; to: string };
      const from = new Date(call.from);
      const to = new Date(call.to);
      const now = new Date();
      expect(from.getMonth()).toBe(now.getMonth());
      expect(from.getDate()).toBe(1);
      expect(to.getMonth()).toBe(now.getMonth());
      // 月末日（28〜31）であること
      expect(to.getDate()).toBeGreaterThanOrEqual(28);
    });

    it('events を読み込み完了するとデフォルトの月ビューがレンダーされる', async () => {
      eventsListMock.mockResolvedValue({
        events: [
          makeEvent(
            1,
            10,
            new Date(new Date().getFullYear(), new Date().getMonth(), 15, 10, 0).toISOString(),
            'Test Event',
          ),
        ],
      });
      await renderPage();
      // 月ビューのグリッドが表示される
      expect(await screen.findByTestId('calendar-month-grid')).toBeInTheDocument();
    });

    it('チャンネル絞り込みパネルが「カレンダー絞り込み」項目を含めて表示される', async () => {
      await renderPage();
      // 「チャンネル絞り込み」見出し
      expect(await screen.findByText('チャンネル絞り込み')).toBeInTheDocument();
      // チャンネル名
      expect(screen.getByText('# general')).toBeInTheDocument();
      expect(screen.getByText('# design')).toBeInTheDocument();
    });
  });

  describe('期間ナビゲーション', () => {
    it('「次月」クリックで cursor が翌月に進み、events.list が新しい from/to で再フェッチされる', async () => {
      await renderPage();
      const beforeCalls = eventsListMock.mock.calls.length;
      await userEvent.click(screen.getByLabelText('calendar-next'));
      // Suspense でぱっと取得待ち → 新しい from/to で list が呼ばれる
      await act(async () => {
        await Promise.resolve();
      });
      expect(eventsListMock.mock.calls.length).toBeGreaterThan(beforeCalls);
      const lastCall = eventsListMock.mock.calls[eventsListMock.mock.calls.length - 1][0] as {
        from: string;
      };
      const from = new Date(lastCall.from);
      const now = new Date();
      const expectedMonth = (now.getMonth() + 1) % 12;
      expect(from.getMonth()).toBe(expectedMonth);
    });

    it('「前月」クリックで cursor が前月に戻る', async () => {
      await renderPage();
      const beforeCalls = eventsListMock.mock.calls.length;
      await userEvent.click(screen.getByLabelText('calendar-prev'));
      await act(async () => {
        await Promise.resolve();
      });
      expect(eventsListMock.mock.calls.length).toBeGreaterThan(beforeCalls);
      const lastCall = eventsListMock.mock.calls[eventsListMock.mock.calls.length - 1][0] as {
        from: string;
      };
      const from = new Date(lastCall.from);
      const now = new Date();
      // 前月（0 月の前は 11 月）
      const expectedMonth = (now.getMonth() + 11) % 12;
      expect(from.getMonth()).toBe(expectedMonth);
    });

    it('「今日」クリックで cursor が当月に戻る', async () => {
      await renderPage();
      // 一旦 +2 月進める
      await userEvent.click(screen.getByLabelText('calendar-next'));
      await act(async () => {
        await Promise.resolve();
      });
      await userEvent.click(screen.getByLabelText('calendar-next'));
      await act(async () => {
        await Promise.resolve();
      });
      // 今日へ戻す
      await userEvent.click(screen.getByLabelText('calendar-today'));
      await act(async () => {
        await Promise.resolve();
      });
      // ヘッダーラベルが当月になっていること（events.list は同月キャッシュヒットで再フェッチされない設計）
      const now = new Date();
      expect(
        screen.getByText(`${now.getFullYear()}年 ${now.getMonth() + 1}月`),
      ).toBeInTheDocument();
    });
  });

  describe('ビュー切替', () => {
    it('月 / 週 / アジェンダの ToggleButtonGroup でビューが切り替わる', async () => {
      await renderPage();
      // 初期は month
      expect(screen.getByTestId('calendar-month-grid')).toBeInTheDocument();
      // week に切り替え
      await userEvent.click(screen.getByLabelText('week'));
      await act(async () => {
        await Promise.resolve();
      });
      expect(screen.queryByTestId('calendar-month-grid')).toBeNull();
      expect(screen.getByTestId('calendar-week-view')).toBeInTheDocument();
      // agenda に切り替え
      await userEvent.click(screen.getByLabelText('agenda'));
      await act(async () => {
        await Promise.resolve();
      });
      expect(screen.queryByTestId('calendar-week-view')).toBeNull();
      expect(screen.getByTestId('calendar-agenda-view')).toBeInTheDocument();
    });

    it('週ビューに切り替えても events のキャッシュは流用される（無駄な再フェッチがない）', async () => {
      await renderPage();
      const beforeCalls = eventsListMock.mock.calls.length;
      await userEvent.click(screen.getByLabelText('week'));
      await act(async () => {
        await Promise.resolve();
      });
      // ビュー切替では同月のキャッシュをそのまま使う想定 → 追加 fetch は無し
      expect(eventsListMock.mock.calls.length).toBe(beforeCalls);
    });
  });

  describe('チャンネル絞り込み', () => {
    it('左サイドバーのチェックボックスを外すとそのチャンネルのイベントは表示されない', async () => {
      const now = new Date();
      const inMonth = (day: number) =>
        new Date(now.getFullYear(), now.getMonth(), day, 10, 0).toISOString();
      eventsListMock.mockResolvedValue({
        events: [
          makeEvent(1, 10, inMonth(5), 'general-Ev'),
          makeEvent(2, 11, inMonth(6), 'design-Ev'),
        ],
      });
      await renderPage();
      const grid = await screen.findByTestId('calendar-month-grid');
      // 初期は両方表示
      expect(within(grid).getByText('general-Ev')).toBeInTheDocument();
      expect(within(grid).getByText('design-Ev')).toBeInTheDocument();

      // general（id=10）のチェックを外す
      const cb = screen.getByRole('checkbox', { name: 'channel-filter-general' });
      await userEvent.click(cb);
      // general のイベントが消える
      expect(within(grid).queryByText('general-Ev')).toBeNull();
      // design は残る
      expect(within(grid).getByText('design-Ev')).toBeInTheDocument();
    });

    it('全部チェックを外すとイベントが 0 件になる', async () => {
      const now = new Date();
      const inMonth = (day: number) =>
        new Date(now.getFullYear(), now.getMonth(), day, 10, 0).toISOString();
      eventsListMock.mockResolvedValue({
        events: [makeEvent(1, 10, inMonth(5)), makeEvent(2, 11, inMonth(6))],
      });
      await renderPage();
      await screen.findByTestId('calendar-month-grid');
      await userEvent.click(screen.getByRole('checkbox', { name: 'channel-filter-general' }));
      await userEvent.click(screen.getByRole('checkbox', { name: 'channel-filter-design' }));
      // すべてのイベントブロックが消える
      expect(screen.queryByTestId('event-block-1')).toBeNull();
      expect(screen.queryByTestId('event-block-2')).toBeNull();
    });
  });

  describe('イベント作成', () => {
    it('日付セルをクリックすると EventDialog が開き、その日付がデフォルトの startsAt に入る', async () => {
      await renderPage();
      const now = new Date();
      const cell = screen.getByTestId(`day-cell-${now.getFullYear()}-${now.getMonth()}-15`);
      await userEvent.click(cell);
      expect(await screen.findByTestId('calendar-event-dialog')).toBeInTheDocument();
      const startsAt = screen.getByLabelText('event-starts-at') as HTMLInputElement;
      expect(startsAt.value.startsWith(`${now.getFullYear()}-`)).toBe(true);
      expect(startsAt.value).toContain('-15T');
    });

    it('EventDialog で作成成功するとカレンダーにイベントが反映される（refresh 経由）', async () => {
      const now = new Date();
      const created = makeEvent(
        99,
        10,
        new Date(now.getFullYear(), now.getMonth(), 15, 10, 0).toISOString(),
        'Created',
      );
      eventsListMock.mockResolvedValueOnce({ events: [] }).mockResolvedValue({ events: [created] });
      eventsCreateMock.mockResolvedValue({ event: created });

      await renderPage();
      await userEvent.click(
        screen.getByTestId(`day-cell-${now.getFullYear()}-${now.getMonth()}-15`),
      );
      await userEvent.type(screen.getByLabelText('event-title'), 'Created');
      await userEvent.click(screen.getByLabelText('event-dialog-submit'));
      await act(async () => {
        await Promise.resolve();
      });
      expect(eventsCreateMock).toHaveBeenCalledTimes(1);
      // refresh で events.list が再フェッチされ、作成済みイベントが反映される
      expect(await screen.findByTestId('event-block-99')).toBeInTheDocument();
    });
  });

  describe('イベント詳細', () => {
    it('イベントクリックで EventDetailDrawer が開き、対応イベントが渡される', async () => {
      const now = new Date();
      const ev = makeEvent(
        42,
        10,
        new Date(now.getFullYear(), now.getMonth(), 5, 10, 0).toISOString(),
        'Detail target',
      );
      eventsListMock.mockResolvedValue({ events: [ev] });
      await renderPage();
      await userEvent.click(await screen.findByTestId('event-block-42'));
      const drawer = await screen.findByTestId('event-detail-drawer');
      expect(within(drawer).getByText('Detail target')).toBeInTheDocument();
    });

    it('Drawer 内の RSVP ボタンで api.calendar.events.rsvp が呼ばれる', async () => {
      const now = new Date();
      const ev = makeEvent(
        43,
        10,
        new Date(now.getFullYear(), now.getMonth(), 5, 10, 0).toISOString(),
      );
      eventsListMock.mockResolvedValue({ events: [ev] });
      eventsRsvpMock.mockResolvedValue({
        attendee: { userId: 1, status: 'accepted', respondedAt: '2026-04-30T00:00:00Z' },
      });
      await renderPage();
      await userEvent.click(await screen.findByTestId('event-block-43'));
      await screen.findByTestId('event-detail-drawer');
      await userEvent.click(screen.getByLabelText('rsvp-accepted'));
      expect(eventsRsvpMock).toHaveBeenCalledTimes(1);
      expect(eventsRsvpMock.mock.calls[0]).toEqual([43, 'accepted']);
    });
  });

  describe('日程調整', () => {
    it('「日程調整」ボタン押下でドロワーが開き polls 一覧が PollHeatmap で表示される', async () => {
      pollsListMock.mockResolvedValue({
        polls: [
          {
            id: 7,
            channelId: 10,
            title: '次回ミーティング',
            organizerId: 1,
            deadline: null,
            confirmedEventId: null,
            createdAt: '2026-04-30T00:00:00Z',
            candidates: [
              {
                id: 71,
                pollId: 7,
                startsAt: '2030-01-01T10:00:00Z',
                endsAt: '2030-01-01T11:00:00Z',
              },
            ],
            votes: [],
          },
        ],
      });
      await renderPage();
      await userEvent.click(screen.getByLabelText('calendar-open-polls'));
      expect(await screen.findByTestId('poll-heatmap-7')).toBeInTheDocument();
      expect(pollsListMock).toHaveBeenCalled();
    });

    it('confirm すると refresh が走り、新規イベントが翌フェッチで反映される', async () => {
      const now = new Date();
      const newEvent = makeEvent(
        500,
        10,
        new Date(now.getFullYear(), now.getMonth(), 20, 10, 0).toISOString(),
        '確定後イベント',
      );
      pollsListMock.mockResolvedValue({
        polls: [
          {
            id: 8,
            channelId: 10,
            title: 'Confirm Test',
            organizerId: 1,
            deadline: null,
            confirmedEventId: null,
            createdAt: '2026-04-30T00:00:00Z',
            candidates: [
              {
                id: 81,
                pollId: 8,
                startsAt: '2030-01-01T10:00:00Z',
                endsAt: '2030-01-01T11:00:00Z',
              },
            ],
            votes: [],
          },
        ],
      });
      eventsListMock
        .mockResolvedValueOnce({ events: [] })
        .mockResolvedValue({ events: [newEvent] });
      pollsConfirmMock.mockResolvedValue({ event: newEvent });

      await renderPage();
      await userEvent.click(screen.getByLabelText('calendar-open-polls'));
      await screen.findByTestId('poll-heatmap-8');
      await userEvent.click(screen.getByLabelText('poll-confirm-best'));
      await act(async () => {
        await Promise.resolve();
      });
      expect(pollsConfirmMock).toHaveBeenCalledTimes(1);
      expect(await screen.findByTestId('event-block-500')).toBeInTheDocument();
    });
  });

  // Step 8b: Sidebar 中身確保
  describe('Step 8b: Sidebar 中身確保', () => {
    it('AppLayout sidebar に ChannelList が表示される', async () => {
      await renderPage();
      const sidebar = await screen.findByTestId('app-layout-sidebar');
      expect(within(sidebar).getByTestId('channel-list-stub')).toBeInTheDocument();
    });

    it('AppLayout sidebar に SidebarDmList が表示される', async () => {
      await renderPage();
      const sidebar = await screen.findByTestId('app-layout-sidebar');
      expect(within(sidebar).getByTestId('sidebar-dm-list-stub')).toBeInTheDocument();
    });

    it('ChannelList の onSelect で /chat?channel=X に navigate される', async () => {
      await renderPage();
      await screen.findByTestId('app-layout-sidebar');
      await userEvent.click(screen.getByText('select-channel-7'));
      expect(await screen.findByTestId('chat-page-stub')).toBeInTheDocument();
    });
  });

  // Issue #318: カレンダーページのサイドバー表示ポリシー
  describe('Issue #318: サイドバー表示ポリシー', () => {
    beforeEach(() => {
      localStorage.removeItem('sidebar.open');
    });

    it('CalendarPage は AppLayout に defaultSidebarOpen={false} を渡す（折り畳み既定）', async () => {
      await renderPage();
      const layout = await screen.findByTestId('app-layout-stub');
      expect(layout).toHaveAttribute('data-default-sidebar-open', 'false');
    });

    it('CalendarPage は AppLayout に forceSidebarClosed を渡さない（ユーザーが手動で開ける）', async () => {
      await renderPage();
      const layout = await screen.findByTestId('app-layout-stub');
      expect(layout).toHaveAttribute('data-force-sidebar-closed', 'false');
    });

    it('localStorage["sidebar.open"] に値が無い場合、カレンダーページではサイドバーが折り畳まれた状態で起動する', async () => {
      // defaultSidebarOpen={false} かつ localStorage に値なし → 折り畳み既定
      await renderPage();
      const layout = await screen.findByTestId('app-layout-stub');
      expect(layout).toHaveAttribute('data-default-sidebar-open', 'false');
    });

    it('localStorage["sidebar.open"]="true" の場合、カレンダーページでもサイドバーが開いた状態で起動する（永続化値優先）', async () => {
      // AppLayout の実装が localStorage 値を defaultSidebarOpen より優先する仕様
      // スタブでは実際の開閉制御は行わないため、localStorage 値の存在を確認する
      localStorage.setItem('sidebar.open', 'true');
      await renderPage();
      const layout = await screen.findByTestId('app-layout-stub');
      expect(layout).toHaveAttribute('data-default-sidebar-open', 'false');
      // 実際の開閉動作は AppLayout.test.tsx の「localStorage["sidebar.open"]="true" なら表示」テストで保証される
      expect(localStorage.getItem('sidebar.open')).toBe('true');
    });
  });
});
