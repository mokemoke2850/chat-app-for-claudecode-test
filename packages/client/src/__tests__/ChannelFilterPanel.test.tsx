/**
 * テスト対象: components/Calendar/ChannelFilterPanel.tsx
 *
 * 戦略:
 *   - 純粋なプロップス駆動コンポーネントとして検証（API モックなし）
 *   - Issue #331 で追加した一括操作（全選択 / 全解除 / 未読関連のみ / 自分の参加予定のみ）
 *     のプリセット計算ロジックを中心にテストする
 *   - 既存の個別チェックボックス挙動は親 (CalendarPage) との結合確認に委ね、ここでは省略
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CalendarEvent, Channel } from '@chat-app/shared';
import { ChannelFilterPanel } from '../components/Calendar/ChannelFilterPanel';

function makeChannel(id: number, name: string, unreadCount = 0): Channel {
  return {
    id,
    name,
    description: null,
    topic: null,
    createdBy: 1,
    createdAt: '2026-04-30T00:00:00Z',
    isPrivate: false,
    postingPermission: 'everyone',
    unreadCount,
  };
}

function makeEvent(
  id: number,
  channelId: number | null,
  attendeeUserIds: Array<{ userId: number; status: 'accepted' | 'maybe' | 'declined' | 'pending' }>,
): CalendarEvent {
  return {
    id,
    channelId,
    title: `Ev${id}`,
    description: null,
    location: null,
    meetingUrl: null,
    startsAt: '2026-05-15T10:00:00Z',
    endsAt: '2026-05-15T11:00:00Z',
    organizerId: 1,
    createdAt: '2026-04-30T00:00:00Z',
    updatedAt: '2026-04-30T00:00:00Z',
    attendees: attendeeUserIds.map((a) => ({
      userId: a.userId,
      status: a.status,
      respondedAt: '2026-04-30T00:00:00Z',
    })),
    reminderOffsetMinutes: null,
    recurrenceRule: null,
    recurrenceInterval: 1,
    recurrenceDaysOfWeek: null,
    recurrenceEndDate: null,
    recurrenceCount: null,
    recurrenceMasterId: null,
  };
}

const TODAY = new Date(2026, 4, 15);
const CURRENT_USER_ID = 100;

interface RenderOpts {
  channels?: Channel[];
  channelFilter?: Set<number>;
  events?: CalendarEvent[];
  onChannelFilterChange?: (next: Set<number>) => void;
  onToggleChannel?: (id: number) => void;
  currentUserId?: number;
}

function renderPanel(opts: RenderOpts = {}) {
  const onChannelFilterChange = opts.onChannelFilterChange ?? vi.fn();
  const onToggleChannel = opts.onToggleChannel ?? vi.fn();
  const channels = opts.channels ?? [makeChannel(1, 'general'), makeChannel(2, 'random')];
  const channelColors = new Map<number, string>(channels.map((c) => [c.id, '#1976d2']));
  const utils = render(
    <ChannelFilterPanel
      channels={channels}
      channelColors={channelColors}
      channelFilter={opts.channelFilter ?? new Set(channels.map((c) => c.id))}
      onToggleChannel={onToggleChannel}
      onChannelFilterChange={onChannelFilterChange}
      events={opts.events ?? []}
      today={TODAY}
      currentUserId={opts.currentUserId ?? CURRENT_USER_ID}
      onEventClick={vi.fn()}
    />,
  );
  return { ...utils, onChannelFilterChange, onToggleChannel };
}

describe('ChannelFilterPanel — 一括操作 (Issue #331)', () => {
  describe('全選択 / 全解除ボタン', () => {
    it('「全選択」ボタンクリックで onChannelFilterChange が全チャンネル ID の Set で呼ばれる', async () => {
      const onChannelFilterChange = vi.fn();
      renderPanel({
        channels: [makeChannel(1, 'a'), makeChannel(2, 'b'), makeChannel(3, 'c')],
        channelFilter: new Set([1]),
        onChannelFilterChange,
      });
      await userEvent.click(screen.getByRole('button', { name: '全選択' }));
      expect(onChannelFilterChange).toHaveBeenCalledTimes(1);
      const arg = onChannelFilterChange.mock.calls[0][0] as Set<number>;
      expect(Array.from(arg).sort()).toEqual([1, 2, 3]);
    });

    it('「全解除」ボタンクリックで onChannelFilterChange が空 Set で呼ばれる', async () => {
      const onChannelFilterChange = vi.fn();
      renderPanel({
        channels: [makeChannel(1, 'a'), makeChannel(2, 'b')],
        onChannelFilterChange,
      });
      await userEvent.click(screen.getByRole('button', { name: '全解除' }));
      expect(onChannelFilterChange).toHaveBeenCalledTimes(1);
      const arg = onChannelFilterChange.mock.calls[0][0] as Set<number>;
      expect(arg.size).toBe(0);
    });
  });

  describe('プリセット「未読関連のみ」', () => {
    it('「未読関連のみ」クリックで unreadCount>0 のチャンネルだけが含まれる Set で呼ばれる', async () => {
      const onChannelFilterChange = vi.fn();
      renderPanel({
        channels: [
          makeChannel(1, 'a', 0),
          makeChannel(2, 'b', 3),
          makeChannel(3, 'c', 0),
          makeChannel(4, 'd', 1),
        ],
        onChannelFilterChange,
      });
      await userEvent.click(screen.getByRole('button', { name: '未読関連のみ' }));
      const arg = onChannelFilterChange.mock.calls[0][0] as Set<number>;
      expect(Array.from(arg).sort()).toEqual([2, 4]);
    });

    it('未読チャンネルが 0 件のとき、空 Set で呼ばれる', async () => {
      const onChannelFilterChange = vi.fn();
      renderPanel({
        channels: [makeChannel(1, 'a', 0), makeChannel(2, 'b', 0)],
        onChannelFilterChange,
      });
      await userEvent.click(screen.getByRole('button', { name: '未読関連のみ' }));
      const arg = onChannelFilterChange.mock.calls[0][0] as Set<number>;
      expect(arg.size).toBe(0);
    });
  });

  describe('プリセット「自分の参加予定のみ」', () => {
    it('「自分の参加予定のみ」クリックで、自分が attendees に含まれるイベントの channelId 集合で呼ばれる', async () => {
      const onChannelFilterChange = vi.fn();
      renderPanel({
        channels: [makeChannel(10, 'team-a'), makeChannel(20, 'team-b'), makeChannel(30, 'team-c')],
        events: [
          makeEvent(1, 10, [{ userId: CURRENT_USER_ID, status: 'accepted' }]),
          makeEvent(2, 20, [{ userId: 999, status: 'accepted' }]), // 他人だけ
          makeEvent(3, 30, [{ userId: CURRENT_USER_ID, status: 'maybe' }]),
        ],
        onChannelFilterChange,
      });
      await userEvent.click(screen.getByRole('button', { name: '自分の参加予定のみ' }));
      const arg = onChannelFilterChange.mock.calls[0][0] as Set<number>;
      expect(Array.from(arg).sort((a, b) => a - b)).toEqual([10, 30]);
    });

    it('RSVP=declined の参加は除外される', async () => {
      const onChannelFilterChange = vi.fn();
      renderPanel({
        channels: [makeChannel(10, 'team-a'), makeChannel(20, 'team-b')],
        events: [
          makeEvent(1, 10, [{ userId: CURRENT_USER_ID, status: 'declined' }]),
          makeEvent(2, 20, [{ userId: CURRENT_USER_ID, status: 'accepted' }]),
        ],
        onChannelFilterChange,
      });
      await userEvent.click(screen.getByRole('button', { name: '自分の参加予定のみ' }));
      const arg = onChannelFilterChange.mock.calls[0][0] as Set<number>;
      expect(Array.from(arg)).toEqual([20]);
    });

    it('channelId=null のイベントは除外される', async () => {
      const onChannelFilterChange = vi.fn();
      renderPanel({
        channels: [makeChannel(10, 'team-a')],
        events: [
          makeEvent(1, null, [{ userId: CURRENT_USER_ID, status: 'accepted' }]),
          makeEvent(2, 10, [{ userId: CURRENT_USER_ID, status: 'accepted' }]),
        ],
        onChannelFilterChange,
      });
      await userEvent.click(screen.getByRole('button', { name: '自分の参加予定のみ' }));
      const arg = onChannelFilterChange.mock.calls[0][0] as Set<number>;
      expect(Array.from(arg)).toEqual([10]);
    });

    it('同じチャンネルの複数イベントは重複なく 1 回だけ含まれる', async () => {
      const onChannelFilterChange = vi.fn();
      renderPanel({
        channels: [makeChannel(10, 'team-a')],
        events: [
          makeEvent(1, 10, [{ userId: CURRENT_USER_ID, status: 'accepted' }]),
          makeEvent(2, 10, [{ userId: CURRENT_USER_ID, status: 'maybe' }]),
          makeEvent(3, 10, [{ userId: CURRENT_USER_ID, status: 'pending' }]),
        ],
        onChannelFilterChange,
      });
      await userEvent.click(screen.getByRole('button', { name: '自分の参加予定のみ' }));
      const arg = onChannelFilterChange.mock.calls[0][0] as Set<number>;
      expect(arg.size).toBe(1);
      expect(arg.has(10)).toBe(true);
    });
  });

  describe('プリセット適用後の個別操作', () => {
    it('プリセット適用後にチェックボックス操作で onToggleChannel が呼ばれる', async () => {
      const onToggleChannel = vi.fn();
      const onChannelFilterChange = vi.fn();
      renderPanel({
        channels: [makeChannel(1, 'a', 0), makeChannel(2, 'b', 3)],
        channelFilter: new Set([2]),
        onChannelFilterChange,
        onToggleChannel,
      });
      // プリセット押下
      await userEvent.click(screen.getByRole('button', { name: '未読関連のみ' }));
      // 続いて個別チェックボックス操作（チャンネル 1 のチェックボックス）
      await userEvent.click(screen.getByRole('checkbox', { name: /channel-filter-a/ }));
      expect(onToggleChannel).toHaveBeenCalledWith(1);
    });
  });
});
