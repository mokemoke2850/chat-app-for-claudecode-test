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
import { describe, it, expect, vi } from 'vitest';
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

// ContextRail は内部で api.auth.users() / api.channels.getMembers() を呼んで Promise を生成する。
// jsdom 環境では fetch が解決できず unhandled rejection になるため、api を stub にする
vi.mock('../api/client', () => ({
  api: {
    auth: { users: vi.fn().mockResolvedValue({ users: [] }) },
    channels: { getMembers: vi.fn().mockResolvedValue({ members: [] }) },
  },
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
});
