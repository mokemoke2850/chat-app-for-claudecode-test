/**
 * components/Channel/ContextRail.tsx のユニットテスト (Step 5a)
 *
 * テスト対象:
 *   - 概要 / ピン留め / メンバーの 3 タブ表示と切替
 *   - close (×) ボタンによる onClose 呼び出し
 *   - 各タブで対応するコンテンツが描画されること
 *
 * 戦略:
 *   - 内部で利用する ChannelTopicBar / PinnedMessages / MembersContent は API 依存があるため
 *     vi.mock でスタブ化し、ContextRail のタブ切替ロジックのみを検証する
 *   - MUI Tabs の `role="tab"` / `aria-selected` を利用してタブ状態を確認
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Channel } from '@chat-app/shared';
import ContextRail from '../components/Channel/ContextRail';
import { makeChannel } from './__fixtures__/channels';

vi.mock('../components/Channel/ChannelTopicBar', () => ({
  default: ({ channel }: { channel: Channel }) => (
    <div data-testid="channel-topic-bar-stub">topic-bar:{channel.id}</div>
  ),
}));

vi.mock('../components/Channel/PinnedMessages', () => ({
  default: ({ channelId }: { channelId: number }) => (
    <div data-testid="pinned-messages-stub">pinned:{channelId}</div>
  ),
}));

vi.mock('../components/Channel/ChannelMembersDialog', () => ({
  MembersContent: ({ channelId }: { channelId: number }) => (
    <div data-testid="members-content-stub">members:{channelId}</div>
  ),
}));

// Step 5c-1: ChannelSettingsForm を概要タブで使う。テストではスタブ化する
vi.mock('../components/Channel/ChannelSettingsForm', () => ({
  default: ({ channel }: { channel: Channel }) => (
    <div data-testid="channel-settings-form-stub">settings:{channel.id}</div>
  ),
}));

// Step 5c-1: 予定タブで使う api.calendar.events.list を hoisted な vi.fn にして
// テストごとに mockResolvedValue を差し替え可能にする
const mockCalendarEventsList = vi.hoisted(() =>
  vi.fn<(params: { from?: string; to?: string; channelIds?: number[] }) => Promise<unknown>>(),
);

// ContextRail は内部で api.auth.users() / api.channels.getMembers() を呼んで Promise を生成する。
// jsdom 環境では fetch が解決できず unhandled rejection になるため、api を stub にする
vi.mock('../api/client', () => ({
  api: {
    auth: { users: vi.fn().mockResolvedValue({ users: [] }) },
    channels: { getMembers: vi.fn().mockResolvedValue({ members: [] }) },
    calendar: { events: { list: mockCalendarEventsList } },
  },
}));

beforeEach(() => {
  // 既定では空のイベント配列を返す。各テストで上書き可能
  mockCalendarEventsList.mockReset();
  mockCalendarEventsList.mockResolvedValue({ events: [] });
});

// Step 5b: ファイルタブで ChannelFilesTab を再利用する。テストではスタブ化する
vi.mock('../pages/FilesPage', () => ({
  ChannelFilesTab: ({ channelId }: { channelId: number }) => (
    <div data-testid="channel-files-tab-stub">files:{channelId}</div>
  ),
}));

interface RenderOpts {
  topic?: string | null;
  description?: string | null;
  onClose?: () => void;
}

function renderRail(opts: RenderOpts = {}) {
  const channel = makeChannel(42, 'design-review');
  channel.topic = opts.topic === undefined ? 'プロダクトデザインのレビュー' : opts.topic;
  channel.description =
    opts.description === undefined ? 'レビュー依頼は火・木の朝に投稿' : opts.description;

  return render(
    <ContextRail
      channel={channel}
      currentUserId={1}
      userRole="user"
      onClose={opts.onClose ?? vi.fn()}
      onTopicUpdated={vi.fn()}
      onUnpin={vi.fn()}
    />,
  );
}

describe('ContextRail (Step 5a)', () => {
  describe('初期表示', () => {
    it('概要 / ピン留め / メンバーの 3 つのタブボタンが表示される', () => {
      renderRail();
      expect(screen.getByRole('tab', { name: '概要' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'ピン留め' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'メンバー' })).toBeInTheDocument();
    });

    it('初期表示時は概要タブが選択されている (aria-selected="true")', () => {
      renderRail();
      expect(screen.getByRole('tab', { name: '概要' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tab', { name: 'ピン留め' })).toHaveAttribute(
        'aria-selected',
        'false',
      );
      expect(screen.getByRole('tab', { name: 'メンバー' })).toHaveAttribute(
        'aria-selected',
        'false',
      );
    });

    it('チャンネル名 (#xxx) がヘッダに表示される', () => {
      renderRail();
      expect(screen.getByText('#design-review')).toBeInTheDocument();
    });

    it('close (×) ボタンが表示される', () => {
      renderRail();
      expect(screen.getByRole('button', { name: '閉じる' })).toBeInTheDocument();
    });
  });

  describe('タブ切替', () => {
    it('ピン留めタブをクリックすると PinnedMessages 領域が描画される', async () => {
      renderRail();
      await userEvent.click(screen.getByRole('tab', { name: 'ピン留め' }));
      expect(screen.getByTestId('pinned-messages-stub')).toBeInTheDocument();
    });

    it('メンバータブをクリックするとメンバー一覧領域が描画される', async () => {
      renderRail();
      await userEvent.click(screen.getByRole('tab', { name: 'メンバー' }));
      expect(screen.getByTestId('members-content-stub')).toBeInTheDocument();
    });

    it('概要タブに戻ると channel の topic / description が描画される', async () => {
      renderRail({ topic: 'プロダクトデザインのレビュー', description: '火・木に投稿' });
      // 一度ピン留めタブに切替
      await userEvent.click(screen.getByRole('tab', { name: 'ピン留め' }));
      expect(screen.queryByText('プロダクトデザインのレビュー')).not.toBeInTheDocument();
      // 概要タブに戻る
      await userEvent.click(screen.getByRole('tab', { name: '概要' }));
      expect(screen.getByText('プロダクトデザインのレビュー')).toBeInTheDocument();
      expect(screen.getByText('火・木に投稿')).toBeInTheDocument();
    });
  });

  describe('close ボタン', () => {
    it('× ボタンをクリックすると onClose が呼ばれる', async () => {
      const onClose = vi.fn();
      renderRail({ onClose });
      await userEvent.click(screen.getByRole('button', { name: '閉じる' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('タブ拡張 (Step 5b)', () => {
    it('ファイルタブが「ファイル」というラベルで表示される', () => {
      renderRail();
      expect(screen.getByRole('tab', { name: 'ファイル' })).toBeInTheDocument();
    });

    it('ファイルタブをクリックすると ChannelFilesTab 領域が描画される', async () => {
      renderRail();
      await userEvent.click(screen.getByRole('tab', { name: 'ファイル' }));
      expect(screen.getByTestId('channel-files-tab-stub')).toBeInTheDocument();
    });

    it('予定タブが「予定」というラベルで表示される', () => {
      renderRail();
      expect(screen.getByRole('tab', { name: '予定' })).toBeInTheDocument();
    });
  });

  describe('概要タブの ChannelSettingsForm (Step 5c-1)', () => {
    it('概要タブで ChannelSettingsForm が描画される (編集ボタン群を含む)', () => {
      renderRail();
      expect(screen.getByTestId('channel-settings-form-stub')).toBeInTheDocument();
    });
  });

  describe('予定タブの実機データ化 (Step 5c-1)', () => {
    it('予定タブをクリックすると api.calendar.events.list が channelIds=[channel.id] で呼ばれる', async () => {
      renderRail();
      await userEvent.click(screen.getByRole('tab', { name: '予定' }));
      // Suspense 解決を待つため findBy* を使う
      await screen.findByText('予定はありません');
      expect(mockCalendarEventsList).toHaveBeenCalled();
      const calls = mockCalendarEventsList.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall?.[0]).toEqual(expect.objectContaining({ channelIds: [42] }));
    });

    it('取得した CalendarEvent のタイトルが描画される', async () => {
      mockCalendarEventsList.mockResolvedValue({
        events: [
          {
            id: 1,
            channelId: 42,
            title: 'スプリントレビュー',
            description: null,
            location: null,
            meetingUrl: null,
            startsAt: '2026-05-10T09:00:00Z',
            endsAt: '2026-05-10T10:00:00Z',
            organizerId: 1,
            createdAt: '2026-05-01T00:00:00Z',
            updatedAt: '2026-05-01T00:00:00Z',
            attendees: [],
            reminderOffsetMinutes: null,
            recurrenceRule: null,
            recurrenceInterval: 1,
            recurrenceDaysOfWeek: null,
            recurrenceEndDate: null,
            recurrenceCount: null,
            recurrenceMasterId: null,
          },
        ],
      });
      renderRail();
      await userEvent.click(screen.getByRole('tab', { name: '予定' }));
      expect(await screen.findByText('スプリントレビュー')).toBeInTheDocument();
    });

    it('取得した CalendarEvent の開始日時 (📅 マーカー付き) が描画される', async () => {
      mockCalendarEventsList.mockResolvedValue({
        events: [
          {
            id: 1,
            channelId: 42,
            title: 'スプリントレビュー',
            description: null,
            location: null,
            meetingUrl: null,
            startsAt: '2026-05-10T09:00:00Z',
            endsAt: '2026-05-10T10:00:00Z',
            organizerId: 1,
            createdAt: '2026-05-01T00:00:00Z',
            updatedAt: '2026-05-01T00:00:00Z',
            attendees: [],
            reminderOffsetMinutes: null,
            recurrenceRule: null,
            recurrenceInterval: 1,
            recurrenceDaysOfWeek: null,
            recurrenceEndDate: null,
            recurrenceCount: null,
            recurrenceMasterId: null,
          },
        ],
      });
      renderRail();
      await userEvent.click(screen.getByRole('tab', { name: '予定' }));
      // 📅 マーカーを含むテキストノードが表示される (時刻の正規表現は環境依存を避けて一般化)
      expect(await screen.findByText(/📅/)).toBeInTheDocument();
    });

    it('予定が 0 件のとき「予定はありません」プレースホルダが表示される', async () => {
      mockCalendarEventsList.mockResolvedValue({ events: [] });
      renderRail();
      await userEvent.click(screen.getByRole('tab', { name: '予定' }));
      expect(await screen.findByText('予定はありません')).toBeInTheDocument();
    });
  });
});
