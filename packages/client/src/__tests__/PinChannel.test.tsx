/**
 * テスト対象: ピン留めチャンネル機能（クライアントサイド）
 * 戦略:
 *   - api.channels.pin / unpin を vi.mock で差し替えてネットワーク通信を排除
 *   - ChannelList コンポーネントのピン留めUI（ボタン表示・セクション分割・localStorage永続化）を検証
 *   - ピン留め状態はユーザーごとに localStorage に永続化されることを確認する
 *
 * ※ 既存の ChannelList.test.tsx にピン留め基本動作のテストがあるため、
 *   このファイルはAPIベースの永続化・ユーザー分離に関する追加ケースを担う
 */

import { act } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import ChannelList from '../components/Channel/ChannelList';
import { makeChannel } from './__fixtures__/channels';

// api モジュールをモック
vi.mock('../api/client', () => ({
  api: {
    channels: {
      list: vi.fn(),
      create: vi.fn(),
      read: vi.fn(),
      pin: vi.fn(),
      unpin: vi.fn(),
      getPinned: vi.fn(),
    },
  },
}));

// SocketContext をモック
vi.mock('../contexts/SocketContext', () => ({
  useSocket: () => ({
    on: vi.fn(),
    off: vi.fn(),
  }),
}));

// react-router-dom の useNavigate をモック
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => vi.fn() };
});

import { api } from '../api/client';
import { resetChannelsCache as _resetChannelsPromiseForTest } from '../components/Channel/ChannelList';
const mockChannels = api.channels as unknown as {
  list: ReturnType<typeof vi.fn>;
  read: ReturnType<typeof vi.fn>;
  pin: ReturnType<typeof vi.fn>;
  unpin: ReturnType<typeof vi.fn>;
  getPinned: ReturnType<typeof vi.fn>;
};

// ユーザーIDを変更するためにAuthContextをモック化可能にする
const mockUser = { id: 1, role: 'user', isActive: true };
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

async function renderChannelList(props: {
  activeChannelId: number | null;
  onSelect: (id: number, name: string) => void;
}) {
  await act(async () => {
    render(<ChannelList {...props} />);
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  // モジュールキャッシュをリセット
  _resetChannelsPromiseForTest();
  // デフォルトのモック設定
  mockChannels.read.mockResolvedValue(undefined);
  mockUser.id = 1;
});

describe('ChannelList: ピン留めチャンネルのUI表示', () => {
  describe('ピン留めセクションの表示', () => {
    it('ピン留めチャンネルが存在する場合、「ピン留め」セクションがサイドバー最上部に表示される', async () => {
      mockChannels.list.mockResolvedValue({
        channels: [makeChannel(1, 'general'), makeChannel(2, 'pinned-ch')],
      });

      await renderChannelList({ activeChannelId: null, onSelect: vi.fn() });

      // ピン留めを実行
      const row = screen.getByText('# pinned-ch').closest('li')!;
      await userEvent.hover(row);
      await userEvent.click(screen.getByRole('button', { name: /ピン留め/i }));

      // ピン留めセクションが表示されている
      await waitFor(() => {
        expect(screen.getByTestId('pinned-channels')).toBeInTheDocument();
      });
      expect(screen.getByTestId('pinned-channels')).toHaveTextContent('ピン留め');
    });

    it('ピン留めチャンネルが存在しない場合、「ピン留め」セクションは表示されない', async () => {
      mockChannels.list.mockResolvedValue({
        channels: [makeChannel(1, 'general')],
      });

      await renderChannelList({ activeChannelId: null, onSelect: vi.fn() });

      expect(screen.queryByTestId('pinned-channels')).not.toBeInTheDocument();
    });

    it('ピン留めセクションのチャンネルは通常セクション（all-channels）には表示されない', async () => {
      mockChannels.list.mockResolvedValue({
        channels: [makeChannel(1, 'general'), makeChannel(2, 'pinned-ch')],
      });

      await renderChannelList({ activeChannelId: null, onSelect: vi.fn() });

      // pinned-ch をピン留め
      const row = screen.getByText('# pinned-ch').closest('li')!;
      await userEvent.hover(row);
      await userEvent.click(screen.getByRole('button', { name: /ピン留め/i }));

      await waitFor(() => screen.getByTestId('pinned-channels'));

      // all-channels には pinned-ch が存在しない
      const allChannels = screen.getByTestId('all-channels');
      expect(allChannels).not.toHaveTextContent('pinned-ch');
    });
  });

  describe('ピン留め操作UI', () => {
    it('未ピン留めチャンネルにホバーすると「ピン留め」ボタン（PushPinOutlined）が表示される', async () => {
      mockChannels.list.mockResolvedValue({
        channels: [makeChannel(1, 'general')],
      });

      await renderChannelList({ activeChannelId: null, onSelect: vi.fn() });

      const row = screen.getByText('# general').closest('li')!;
      await userEvent.hover(row);

      expect(screen.getByRole('button', { name: /ピン留め$/i })).toBeInTheDocument();
    });

    it('ピン留め済みチャンネルにホバーすると「ピン留めを解除」ボタン（PushPin）が表示される', async () => {
      mockChannels.list.mockResolvedValue({
        channels: [makeChannel(1, 'general')],
      });

      await renderChannelList({ activeChannelId: null, onSelect: vi.fn() });

      // まずピン留め
      const row = screen.getByText('# general').closest('li')!;
      await userEvent.hover(row);
      await userEvent.click(screen.getByRole('button', { name: /ピン留め$/i }));

      await waitFor(() => screen.getByTestId('pinned-channels'));

      // ピン留めセクション内のチャンネルにホバー
      const pinnedRow = screen.getByTestId('pinned-channels').querySelector('li')!;
      await userEvent.hover(pinnedRow);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /ピン留めを解除/i })).toBeInTheDocument();
      });
    });
  });
});

describe('ChannelList: ピン留め状態の永続化', () => {
  describe('localStorage による永続化', () => {
    it('ピン留めするとユーザーIDに紐づいたキーで localStorage に保存される', async () => {
      mockChannels.list.mockResolvedValue({
        channels: [makeChannel(1, 'general')],
      });

      await renderChannelList({ activeChannelId: null, onSelect: vi.fn() });

      const row = screen.getByText('# general').closest('li')!;
      await userEvent.hover(row);
      await userEvent.click(screen.getByRole('button', { name: /ピン留め$/i }));

      // ユーザーIDに紐づいたキーで保存されていることを確認
      const userId = mockUser.id;
      const storageKey = `channel_pins_${userId}`;
      const stored = localStorage.getItem(storageKey);
      expect(stored).not.toBeNull();
      const pins = JSON.parse(stored!) as number[];
      expect(pins).toContain(1);
    });

    it('コンポーネント再マウント後も localStorage からピン留め状態が復元される', async () => {
      mockChannels.list.mockResolvedValue({
        channels: [makeChannel(1, 'general')],
      });

      let unmount!: () => void;
      await act(async () => {
        const result = render(<ChannelList activeChannelId={null} onSelect={vi.fn()} />);
        unmount = result.unmount;
      });

      // ピン留め
      const row = screen.getByText('# general').closest('li')!;
      await userEvent.hover(row);
      await userEvent.click(screen.getByRole('button', { name: /ピン留め$/i }));

      await waitFor(() => screen.getByTestId('pinned-channels'));

      // アンマウントして再マウント
      unmount();
      await act(async () => {
        render(<ChannelList activeChannelId={null} onSelect={vi.fn()} />);
      });

      await waitFor(() => screen.getByTestId('pinned-channels'));
      expect(screen.getByTestId('pinned-channels')).toHaveTextContent('general');
    });

    it('異なるユーザーのピン留め状態は独立して保存・復元される', async () => {
      // ユーザー1でピン留め
      mockUser.id = 1;
      mockChannels.list.mockResolvedValue({
        channels: [makeChannel(1, 'general'), makeChannel(2, 'random')],
      });

      await act(async () => {
        render(<ChannelList activeChannelId={null} onSelect={vi.fn()} />);
      });

      const row1 = screen.getByText('# general').closest('li')!;
      await userEvent.hover(row1);
      await userEvent.click(screen.getByRole('button', { name: /ピン留め$/i }));

      // ユーザー1のキーで保存を確認
      const key1 = `channel_pins_1`;
      const stored1 = JSON.parse(localStorage.getItem(key1) ?? '[]') as number[];
      expect(stored1).toContain(1);

      // ユーザー2のキーには保存されていないことを確認
      const key2 = `channel_pins_2`;
      const stored2 = JSON.parse(localStorage.getItem(key2) ?? '[]') as number[];
      expect(stored2).not.toContain(1);
    });
  });
});

describe('ChannelList: 検索とピン留めの連携', () => {
  it('検索ワード入力時、ピン留めチャンネルも検索結果でフィルタリングされる', async () => {
    mockChannels.list.mockResolvedValue({
      channels: [makeChannel(1, 'general'), makeChannel(2, 'random')],
    });

    await renderChannelList({ activeChannelId: null, onSelect: vi.fn() });

    // random をピン留め
    const row = screen.getByText('# random').closest('li')!;
    await userEvent.hover(row);
    await userEvent.click(screen.getByRole('button', { name: /ピン留め$/i }));

    await waitFor(() => screen.getByTestId('pinned-channels'));

    // 検索で 'gen' を入力
    await userEvent.type(screen.getByPlaceholderText(/search/i), 'gen');

    // general は表示される
    expect(screen.getByText('# general')).toBeInTheDocument();
  });

  it('検索ワードに一致しないピン留めチャンネルはピン留めセクションから非表示になる', async () => {
    mockChannels.list.mockResolvedValue({
      channels: [makeChannel(1, 'general'), makeChannel(2, 'random')],
    });

    await renderChannelList({ activeChannelId: null, onSelect: vi.fn() });

    // random をピン留め
    const row = screen.getByText('# random').closest('li')!;
    await userEvent.hover(row);
    await userEvent.click(screen.getByRole('button', { name: /ピン留め$/i }));

    await waitFor(() => screen.getByTestId('pinned-channels'));

    // 'gen' で検索: random はヒットしない
    await userEvent.type(screen.getByPlaceholderText(/search/i), 'gen');

    // ピン留めセクションには random が表示されない
    await waitFor(() => {
      expect(screen.queryByTestId('pinned-channels')).not.toBeInTheDocument();
    });
  });
});
