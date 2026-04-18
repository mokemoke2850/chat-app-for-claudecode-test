/**
 * components/Channel/ChannelList.tsx のユニットテスト
 *
 * テスト対象: チャンネル一覧の表示・選択・チャンネル作成ダイアログ連携
 * 戦略:
 *   - api.channels.list を vi.mock で差し替えてネットワーク通信を排除
 *   - CreateChannelDialog は子コンポーネントごと描画する（統合寄りのユニットテスト）
 *   - userEvent でクリック操作をシミュレートする
 *
 * React 19 移行後の変更点:
 *   - ChannelList が use() + Suspense を使うため、render を
 *     await act(async () => { render(...) }) でラップして Suspense をフラッシュする
 *   - 初回チャンネル取得後の waitFor を削除し、直接 screen アサーションに変更した
 */

import { act } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import ChannelList, { resetChannelsCache } from '../components/Channel/ChannelList';
import { makeChannel, makeChannelMessage } from './__fixtures__/channels';

// api モジュールをモック
vi.mock('../api/client', () => ({
  api: {
    channels: {
      list: vi.fn(),
      create: vi.fn(),
      read: vi.fn(),
    },
  },
}));

// SocketContext をモック（new_message ハンドラを外部から注入できるよう管理する）
const capturedHandlers: Record<string, (data: unknown) => void> = {};
const mockSocket = {
  on: vi.fn((event: string, handler: (data: unknown) => void) => {
    capturedHandlers[event] = handler;
  }),
  off: vi.fn(),
};
vi.mock('../contexts/SocketContext', () => ({
  useSocket: () => mockSocket,
}));

// AuthContext をモック（ChannelList が useAuth でロールを参照するため）
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, role: 'user', isActive: true } }),
}));

// react-router-dom の useNavigate をモック
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => vi.fn() };
});

import { api } from '../api/client';
const mockChannels = api.channels as unknown as {
  list: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  read: ReturnType<typeof vi.fn>;
};
const mockList = mockChannels.list;
const mockCreate = mockChannels.create;
const mockRead = mockChannels.read;

beforeEach(() => {
  vi.resetAllMocks();
  // モジュールレベルのチャンネルPromiseキャッシュをリセット
  resetChannelsCache();
  // ハンドラキャッシュをリセット
  for (const key of Object.keys(capturedHandlers)) {
    delete capturedHandlers[key];
  }
  mockRead.mockResolvedValue(undefined);
});

/**
 * ChannelList を Suspense ごとレンダリングし、use() による Suspense を
 * await act(async) でフラッシュしてから返す。
 */
async function renderChannelList(props: {
  activeChannelId: number | null;
  onSelect: (id: number) => void;
}) {
  await act(async () => {
    render(<ChannelList {...props} />);
  });
}

describe('ChannelList', () => {
  describe('チャンネル一覧の表示', () => {
    it('マウント時に API からチャンネル一覧を取得して "# チャンネル名" 形式で表示する', async () => {
      mockList.mockResolvedValue({
        channels: [makeChannel(1, 'general'), makeChannel(2, 'random')],
      });

      await renderChannelList({ activeChannelId: null, onSelect: vi.fn() });

      expect(screen.getByText('# general')).toBeInTheDocument();
      expect(screen.getByText('# random')).toBeInTheDocument();
    });

    it('activeChannelId に一致するチャンネルが selected 状態になる', async () => {
      mockList.mockResolvedValue({
        channels: [makeChannel(1, 'general'), makeChannel(2, 'random')],
      });

      await renderChannelList({ activeChannelId: 1, onSelect: vi.fn() });

      // MUI の ListItemButton は selected=true のとき Mui-selected クラスを付与する
      const generalBtn = screen.getByText('# general').closest('[role="button"]');
      expect(generalBtn).toHaveClass('Mui-selected');

      const randomBtn = screen.getByText('# random').closest('[role="button"]');
      expect(randomBtn).not.toHaveClass('Mui-selected');
    });
  });

  describe('チャンネル選択', () => {
    it('チャンネルをクリックすると onSelect がそのチャンネルの id を引数に呼ばれる', async () => {
      mockList.mockResolvedValue({ channels: [makeChannel(3, 'dev')] });
      const onSelect = vi.fn();

      await renderChannelList({ activeChannelId: null, onSelect });

      await userEvent.click(screen.getByText('# dev'));

      expect(onSelect).toHaveBeenCalledWith(3, 'dev', expect.objectContaining({ id: 3 }));
    });
  });

  describe('チャンネル作成ダイアログ', () => {
    it('+ ボタンをクリックすると CreateChannelDialog が開く', async () => {
      mockList.mockResolvedValue({ channels: [] });

      await renderChannelList({ activeChannelId: null, onSelect: vi.fn() });

      await userEvent.click(screen.getByRole('button', { name: /create channel/i }));

      expect(screen.getByText('Create Channel')).toBeInTheDocument();
    });

    it('新しいチャンネルが作成されるとリストに追加され、名前のアルファベット順にソートされる', async () => {
      mockList.mockResolvedValue({ channels: [makeChannel(1, 'general')] });
      mockCreate.mockResolvedValue({ channel: makeChannel(2, 'announce') });

      await renderChannelList({ activeChannelId: null, onSelect: vi.fn() });

      // + ボタン → ダイアログ表示 → チャンネル名入力 → 送信
      await userEvent.click(screen.getByRole('button', { name: /create channel/i }));
      await userEvent.type(screen.getByLabelText(/channel name/i), 'announce');
      await userEvent.click(screen.getByRole('button', { name: /^create$/i }));

      await waitFor(() => expect(screen.getByText('# announce')).toBeInTheDocument());

      // アルファベット順: announce < general
      const items = screen.getAllByText(/^# /);
      expect(items[0].textContent).toBe('# announce');
      expect(items[1].textContent).toBe('# general');
    });

    it('新しいチャンネルが作成されると onSelect がその id を引数に呼ばれる', async () => {
      mockList.mockResolvedValue({ channels: [] });
      mockCreate.mockResolvedValue({ channel: makeChannel(5, 'newch') });
      const onSelect = vi.fn();

      await renderChannelList({ activeChannelId: null, onSelect });

      await userEvent.click(screen.getByRole('button', { name: /create channel/i }));
      await userEvent.type(screen.getByLabelText(/channel name/i), 'newch');
      await userEvent.click(screen.getByRole('button', { name: /^create$/i }));

      await waitFor(() => expect(onSelect).toHaveBeenCalledWith(5, 'newch', expect.objectContaining({ id: 5 })));
    });
  });

  describe('プライベートチャンネルの鍵アイコン表示', () => {
    it('isPrivate=true のチャンネルに鍵アイコン（LockIcon）が表示される', async () => {
      mockList.mockResolvedValue({
        channels: [makeChannel(1, 'secret', true)],
      });

      await renderChannelList({ activeChannelId: null, onSelect: vi.fn() });

      expect(screen.getByLabelText('private channel')).toBeInTheDocument();
    });

    it('isPrivate=false のチャンネルに鍵アイコンは表示されない', async () => {
      mockList.mockResolvedValue({
        channels: [makeChannel(1, 'general', false)],
      });

      await renderChannelList({ activeChannelId: null, onSelect: vi.fn() });

      expect(screen.queryByLabelText('private channel')).not.toBeInTheDocument();
    });
  });

  describe('チャンネルピン留め', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('チャンネル行にホバーするとピン留めボタンが表示される', async () => {
      mockList.mockResolvedValue({ channels: [makeChannel(1, 'general')] });
      await renderChannelList({ activeChannelId: null, onSelect: vi.fn() });

      const row = screen.getByText('# general').closest('li')!;
      await userEvent.hover(row);

      expect(screen.getByRole('button', { name: /ピン留め/i })).toBeInTheDocument();
    });

    it('ピン留め済みチャンネルのピン留め解除ボタンをクリックすると通常リストに戻る', async () => {
      mockList.mockResolvedValue({ channels: [makeChannel(1, 'general')] });
      await renderChannelList({ activeChannelId: null, onSelect: vi.fn() });

      // まずピン留め
      const row = screen.getByText('# general').closest('li')!;
      await userEvent.hover(row);
      await userEvent.click(screen.getByRole('button', { name: /ピン留め/i }));

      await waitFor(() => screen.getByTestId('pinned-channels'));

      // ピン留め解除
      const pinnedRow = screen.getByTestId('pinned-channels').querySelector('li')!;
      await userEvent.hover(pinnedRow);
      await waitFor(() => screen.getByRole('button', { name: /ピン留めを解除/i }));
      await userEvent.click(screen.getByRole('button', { name: /ピン留めを解除/i }));

      await waitFor(() => {
        expect(screen.queryByTestId('pinned-channels')).not.toBeInTheDocument();
      });
    });

  });

  describe('未読バッジ', () => {
    it('unreadCount > 0 のチャンネルに未読数バッジが表示される', async () => {
      mockList.mockResolvedValue({ channels: [makeChannel(1, 'random', false, 3)] });
      await renderChannelList({ activeChannelId: null, onSelect: vi.fn() });

      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('unreadCount === 0 のチャンネルにバッジは表示されない', async () => {
      mockList.mockResolvedValue({ channels: [makeChannel(1, 'general', false, 0)] });
      await renderChannelList({ activeChannelId: null, onSelect: vi.fn() });

      // バッジは存在しない（数値テキストが表示されていない）
      expect(screen.queryByText('0')).not.toBeInTheDocument();
    });

    it('unreadCount が 9 以下のとき実数が表示される', async () => {
      mockList.mockResolvedValue({ channels: [makeChannel(1, 'random', false, 5)] });
      await renderChannelList({ activeChannelId: null, onSelect: vi.fn() });

      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('unreadCount が 10 以上のとき「9+」と表示される', async () => {
      mockList.mockResolvedValue({ channels: [makeChannel(1, 'random', false, 10)] });
      await renderChannelList({ activeChannelId: null, onSelect: vi.fn() });

      expect(screen.getByText('9+')).toBeInTheDocument();
      expect(screen.queryByText('10')).not.toBeInTheDocument();
    });

    it('unreadCount > 0 のチャンネル名が太字表示される', async () => {
      mockList.mockResolvedValue({ channels: [makeChannel(1, 'random', false, 3)] });
      await renderChannelList({ activeChannelId: null, onSelect: vi.fn() });

      const nameEl = screen.getByText('# random');
      expect(nameEl).toHaveStyle({ fontWeight: 'bold' });
    });
  });

  describe('チャンネル選択時の既読処理', () => {
    it('チャンネルをクリックすると POST /api/channels/:id/read が呼ばれる', async () => {
      mockList.mockResolvedValue({ channels: [makeChannel(3, 'dev', false, 2)] });
      await renderChannelList({ activeChannelId: null, onSelect: vi.fn() });

      await userEvent.click(screen.getByText('# dev'));

      expect(mockRead).toHaveBeenCalledWith(3);
    });

    it('チャンネルをクリックすると対象チャンネルの unreadCount が即座に 0 にリセットされる', async () => {
      mockList.mockResolvedValue({ channels: [makeChannel(3, 'dev', false, 4)] });
      await renderChannelList({ activeChannelId: null, onSelect: vi.fn() });

      expect(screen.getByText('4')).toBeInTheDocument();

      await userEvent.click(screen.getByText('# dev'));

      expect(screen.queryByText('4')).not.toBeInTheDocument();
    });
  });

  describe('new_message 受信時の未読インクリメント', () => {
    it('非アクティブチャンネルに new_message が届くと unreadCount がインクリメントされる', async () => {
      mockList.mockResolvedValue({
        channels: [makeChannel(1, 'general', false, 0), makeChannel(2, 'random', false, 0)],
      });
      // activeChannelId=1: general がアクティブ、random が非アクティブ
      await renderChannelList({ activeChannelId: 1, onSelect: vi.fn() });

      // random チャンネル (id=2) に new_message が届く
      act(() => {
        capturedHandlers['new_message']?.(makeChannelMessage(10, 2));
      });

      await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument());
    });

    it('アクティブチャンネル（現在表示中）に new_message が届いても unreadCount はインクリメントされない', async () => {
      mockList.mockResolvedValue({
        channels: [makeChannel(1, 'general', false, 0)],
      });
      // activeChannelId=1: general がアクティブ
      await renderChannelList({ activeChannelId: 1, onSelect: vi.fn() });

      act(() => {
        capturedHandlers['new_message']?.(makeChannelMessage(10, 1));
      });

      // バッジ (1) は表示されない
      expect(screen.queryByText('1')).not.toBeInTheDocument();
    });
  });

  describe('チャンネル検索', () => {
    it('検索ボックスが表示される', async () => {
      mockList.mockResolvedValue({ channels: [makeChannel(1, 'general')] });
      await renderChannelList({ activeChannelId: null, onSelect: vi.fn() });

      expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
    });

    it('検索ボックスに入力するとチャンネルが部分一致で絞り込まれる', async () => {
      mockList.mockResolvedValue({
        channels: [makeChannel(1, 'general'), makeChannel(2, 'random'), makeChannel(3, 'dev')],
      });
      await renderChannelList({ activeChannelId: null, onSelect: vi.fn() });

      await userEvent.type(screen.getByPlaceholderText(/search/i), 'gen');

      expect(screen.getByText('# general')).toBeInTheDocument();
      expect(screen.queryByText('# random')).not.toBeInTheDocument();
      expect(screen.queryByText('# dev')).not.toBeInTheDocument();
    });

    it('検索ボックスをクリアすると全チャンネルが表示される', async () => {
      mockList.mockResolvedValue({
        channels: [makeChannel(1, 'general'), makeChannel(2, 'random')],
      });
      await renderChannelList({ activeChannelId: null, onSelect: vi.fn() });

      const searchBox = screen.getByPlaceholderText(/search/i);
      await userEvent.type(searchBox, 'gen');
      expect(screen.queryByText('# random')).not.toBeInTheDocument();

      await userEvent.clear(searchBox);
      expect(screen.getByText('# general')).toBeInTheDocument();
      expect(screen.getByText('# random')).toBeInTheDocument();
    });

    it('どのチャンネルにも一致しない文字列を入力すると表示が 0 件になる', async () => {
      mockList.mockResolvedValue({
        channels: [makeChannel(1, 'general'), makeChannel(2, 'random')],
      });
      await renderChannelList({ activeChannelId: null, onSelect: vi.fn() });

      await userEvent.type(screen.getByPlaceholderText(/search/i), 'xyz');

      expect(screen.queryByText(/^# /)).not.toBeInTheDocument();
    });
  });

  describe('アーカイブ済みチャンネルの非表示', () => {
    it('isArchived=true のチャンネルはサイドバー一覧に表示されない', async () => {
      // TODO
    });

    it('isArchived=false のチャンネルは通常通りサイドバー一覧に表示される', async () => {
      // TODO
    });

    it('アーカイブ済みチャンネルとそうでないチャンネルが混在する場合、アーカイブ済みのみ非表示になる', async () => {
      // TODO
    });

    it('ピン留め済みかつアーカイブ済みのチャンネルはピン留めセクションにも表示されない', async () => {
      // TODO
    });

    it('アーカイブ済みチャンネルは検索結果にも表示されない', async () => {
      // TODO
    });

    it('Socket経由でチャンネルがアーカイブされた場合、リアルタイムでサイドバーから消える', async () => {
      // TODO
    });
  });
});
