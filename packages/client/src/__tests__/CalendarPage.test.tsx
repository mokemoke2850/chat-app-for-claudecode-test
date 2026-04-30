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
import { MemoryRouter } from 'react-router-dom';

import type { CalendarEvent, Channel } from '@chat-app/shared';

const eventsListMock = vi.fn();
const channelsListMock = vi.fn();

vi.mock('../api/client', () => ({
  api: {
    calendar: {
      events: { list: eventsListMock },
      polls: { list: vi.fn() },
    },
    channels: { list: channelsListMock },
  },
}));

vi.mock('../components/Layout/AppLayout', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
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
    startsAt,
    endsAt: new Date(new Date(startsAt).getTime() + 60 * 60 * 1000).toISOString(),
    organizerId: 1,
    createdAt: '2026-04-30T00:00:00Z',
    updatedAt: '2026-04-30T00:00:00Z',
    attendees: [],
    reminderOffsetMinutes: null,
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
        <CalendarPage />
      </MemoryRouter>,
    );
  });
  return result!;
};

beforeEach(() => {
  vi.resetModules();
  eventsListMock.mockReset();
  channelsListMock.mockReset();
  // 当月+前後で何回呼ばれても返せるようにデフォルトで空 events / channels を返す
  eventsListMock.mockResolvedValue({ events: [] });
  channelsListMock.mockResolvedValue({
    channels: [makeChannel(10, 'general'), makeChannel(11, 'design')],
  });
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
      // Phase F 未実装の placeholder が出る
      expect(screen.getByTestId('calendar-view-placeholder')).toBeInTheDocument();
      // agenda に切り替え
      await userEvent.click(screen.getByLabelText('agenda'));
      await act(async () => {
        await Promise.resolve();
      });
      expect(screen.getByTestId('calendar-view-placeholder')).toBeInTheDocument();
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

  // Phase G/H で実装予定
  describe('イベント作成', () => {
    it.todo('日付セルをクリックすると EventDialog が開き、その日付がデフォルトの startsAt に入る');
    it.todo('TopBar の「新しい予定」ボタンで EventDialog が日付未指定で開く');
    it.todo('EventDialog で作成成功するとカレンダーにイベントが反映される');
  });

  describe('イベント詳細', () => {
    it.todo('イベントクリックで EventDetailDrawer が開き、対応イベントが渡される');
    it.todo('Drawer 内の RSVP ボタンで api.calendar.events.rsvp が呼ばれる');
  });

  describe('日程調整', () => {
    it.todo('チャンネルを選んで「日程調整」タブを開くと polls 一覧が PollHeatmap で表示される');
    it.todo('confirm すると新規イベントがカレンダーに反映される');
  });
});
