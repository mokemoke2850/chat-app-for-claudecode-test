/**
 * components/Channel/ChannelList.tsx のユニットテスト
 *
 * テスト対象: チャンネル一覧の表示・選択・チャンネル作成ダイアログ連携
 * 戦略:
 *   - api.channels.list を vi.mock で差し替えてネットワーク通信を排除
 *   - CreateChannelDialog は子コンポーネントごと描画する（統合寄りのユニットテスト）
 *   - userEvent でクリック操作をシミュレートする
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Channel } from '@chat-app/shared';
import ChannelList from '../components/Channel/ChannelList';

// api モジュールをモック
vi.mock('../api/client', () => ({
  api: {
    channels: {
      list: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { api } from '../api/client';
const mockList = api.channels.list as ReturnType<typeof vi.fn>;
const mockCreate = api.channels.create as ReturnType<typeof vi.fn>;

function makeChannel(id: number, name: string, isPrivate = false): Channel {
  return {
    id,
    name,
    description: null,
    createdBy: 1,
    createdAt: '2024-01-01T00:00:00Z',
    isPrivate,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('ChannelList', () => {
  describe('チャンネル一覧の表示', () => {
    it('マウント時に API からチャンネル一覧を取得して "# チャンネル名" 形式で表示する', async () => {
      mockList.mockResolvedValue({
        channels: [makeChannel(1, 'general'), makeChannel(2, 'random')],
      });

      render(<ChannelList activeChannelId={null} onSelect={vi.fn()} />);

      // API レスポンスが描画されるまで待機
      await waitFor(() => expect(screen.getByText('# general')).toBeInTheDocument());
      expect(screen.getByText('# random')).toBeInTheDocument();
    });

    it('activeChannelId に一致するチャンネルが selected 状態になる', async () => {
      mockList.mockResolvedValue({
        channels: [makeChannel(1, 'general'), makeChannel(2, 'random')],
      });

      render(<ChannelList activeChannelId={1} onSelect={vi.fn()} />);

      await waitFor(() => screen.getByText('# general'));

      // MUI の ListItemButton は selected=true のとき Mui-selected クラスを付与する
      // role="button" で描画されるため、テキストから最近傍の button ロール要素を取得する
      const generalBtn = screen.getByText('# general').closest('[role="button"]');
      expect(generalBtn).toHaveClass('Mui-selected');

      // 非選択のチャンネルには Mui-selected クラスがないこと
      const randomBtn = screen.getByText('# random').closest('[role="button"]');
      expect(randomBtn).not.toHaveClass('Mui-selected');
    });
  });

  describe('チャンネル選択', () => {
    it('チャンネルをクリックすると onSelect がそのチャンネルの id を引数に呼ばれる', async () => {
      mockList.mockResolvedValue({ channels: [makeChannel(3, 'dev')] });
      const onSelect = vi.fn();

      render(<ChannelList activeChannelId={null} onSelect={onSelect} />);
      await waitFor(() => screen.getByText('# dev'));

      await userEvent.click(screen.getByText('# dev'));

      expect(onSelect).toHaveBeenCalledWith(3);
    });
  });

  describe('チャンネル作成ダイアログ', () => {
    it('+ ボタンをクリックすると CreateChannelDialog が開く', async () => {
      mockList.mockResolvedValue({ channels: [] });

      render(<ChannelList activeChannelId={null} onSelect={vi.fn()} />);

      await userEvent.click(screen.getByRole('button', { name: /create channel/i }));

      // Dialog のタイトルが表示されること
      expect(screen.getByText('Create Channel')).toBeInTheDocument();
    });

    it('新しいチャンネルが作成されるとリストに追加され、名前のアルファベット順にソートされる', async () => {
      mockList.mockResolvedValue({ channels: [makeChannel(1, 'general')] });
      mockCreate.mockResolvedValue({ channel: makeChannel(2, 'announce') });

      render(<ChannelList activeChannelId={null} onSelect={vi.fn()} />);
      await waitFor(() => screen.getByText('# general'));

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

      render(<ChannelList activeChannelId={null} onSelect={onSelect} />);

      await userEvent.click(screen.getByRole('button', { name: /create channel/i }));
      await userEvent.type(screen.getByLabelText(/channel name/i), 'newch');
      await userEvent.click(screen.getByRole('button', { name: /^create$/i }));

      await waitFor(() => expect(onSelect).toHaveBeenCalledWith(5));
    });
  });

  describe('プライベートチャンネルの鍵アイコン表示', () => {
    it('isPrivate=true のチャンネルに鍵アイコン（LockIcon）が表示される', async () => {
      mockList.mockResolvedValue({
        channels: [makeChannel(1, 'secret', true)],
      });

      render(<ChannelList activeChannelId={null} onSelect={vi.fn()} />);
      await waitFor(() => screen.getByText('# secret'));

      // aria-label="private channel" で鍵アイコンを識別する
      expect(screen.getByLabelText('private channel')).toBeInTheDocument();
    });

    it('isPrivate=false のチャンネルに鍵アイコンは表示されない', async () => {
      mockList.mockResolvedValue({
        channels: [makeChannel(1, 'general', false)],
      });

      render(<ChannelList activeChannelId={null} onSelect={vi.fn()} />);
      await waitFor(() => screen.getByText('# general'));

      expect(screen.queryByLabelText('private channel')).not.toBeInTheDocument();
    });
  });

  describe('チャンネルピン留め', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('チャンネル行にホバーするとピン留めボタンが表示される', async () => {
      mockList.mockResolvedValue({ channels: [makeChannel(1, 'general')] });
      render(<ChannelList activeChannelId={null} onSelect={vi.fn()} />);
      await waitFor(() => screen.getByText('# general'));

      const row = screen.getByText('# general').closest('li')!;
      await userEvent.hover(row);

      expect(screen.getByRole('button', { name: /ピン留め/i })).toBeInTheDocument();
    });

    it('ピン留めボタンをクリックするとそのチャンネルがリストの上部（ピン留めセクション）に表示される', async () => {
      mockList.mockResolvedValue({
        channels: [makeChannel(1, 'general'), makeChannel(2, 'random')],
      });
      render(<ChannelList activeChannelId={null} onSelect={vi.fn()} />);
      await waitFor(() => screen.getByText('# general'));

      const row = screen.getByText('# random').closest('li')!;
      await userEvent.hover(row);
      await userEvent.click(screen.getByRole('button', { name: /ピン留め/i }));

      // ピン留めセクションに "# random" が表示される
      const pinSection = screen.getByTestId('pinned-channels');
      expect(pinSection).toHaveTextContent('random');
    });

    it('ピン留め済みチャンネルのピン留め解除ボタンをクリックすると通常リストに戻る', async () => {
      mockList.mockResolvedValue({ channels: [makeChannel(1, 'general')] });
      render(<ChannelList activeChannelId={null} onSelect={vi.fn()} />);
      await waitFor(() => screen.getByText('# general'));

      // まずピン留め
      const row = screen.getByText('# general').closest('li')!;
      await userEvent.hover(row);
      await userEvent.click(screen.getByRole('button', { name: /ピン留め/i }));

      // ピン留めセクションが表示されるのを待つ
      await waitFor(() => screen.getByTestId('pinned-channels'));

      // ピン留め解除
      const pinnedRow = screen.getByTestId('pinned-channels').querySelector('li')!;
      await userEvent.hover(pinnedRow);
      await waitFor(() => screen.getByRole('button', { name: /ピン留めを解除/i }));
      await userEvent.click(screen.getByRole('button', { name: /ピン留めを解除/i }));

      // ピン留めセクションは空になる（チャンネルなしなら非表示）
      await waitFor(() => {
        expect(screen.queryByTestId('pinned-channels')).not.toBeInTheDocument();
      });
    });

    it('ピン留め状態が localStorage に保存されており、再マウント後も維持される', async () => {
      mockList.mockResolvedValue({ channels: [makeChannel(1, 'general')] });
      const { unmount } = render(<ChannelList activeChannelId={null} onSelect={vi.fn()} />);
      await waitFor(() => screen.getByText('# general'));

      const row = screen.getByText('# general').closest('li')!;
      await userEvent.hover(row);
      await userEvent.click(screen.getByRole('button', { name: /ピン留め/i }));

      // アンマウントして再マウント
      unmount();
      render(<ChannelList activeChannelId={null} onSelect={vi.fn()} />);
      await waitFor(() => screen.getByTestId('pinned-channels'));

      expect(screen.getByTestId('pinned-channels')).toHaveTextContent('general');
    });

    it('ピン留めセクションと通常チャンネルセクションが視覚的に区別できる', async () => {
      mockList.mockResolvedValue({ channels: [makeChannel(1, 'general')] });
      render(<ChannelList activeChannelId={null} onSelect={vi.fn()} />);
      await waitFor(() => screen.getByText('# general'));

      const row = screen.getByText('# general').closest('li')!;
      await userEvent.hover(row);
      await userEvent.click(screen.getByRole('button', { name: /ピン留め/i }));

      // ピン留めセクションと通常セクションの見出しが存在する
      expect(screen.getByTestId('pinned-channels')).toBeInTheDocument();
      expect(screen.getByTestId('all-channels')).toBeInTheDocument();
    });
  });

  describe('チャンネル検索', () => {
    it('検索ボックスが表示される', async () => {
      mockList.mockResolvedValue({ channels: [makeChannel(1, 'general')] });
      render(<ChannelList activeChannelId={null} onSelect={vi.fn()} />);
      await waitFor(() => screen.getByText('# general'));

      expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
    });

    it('検索ボックスに入力するとチャンネルが部分一致で絞り込まれる', async () => {
      mockList.mockResolvedValue({
        channels: [makeChannel(1, 'general'), makeChannel(2, 'random'), makeChannel(3, 'dev')],
      });
      render(<ChannelList activeChannelId={null} onSelect={vi.fn()} />);
      await waitFor(() => screen.getByText('# general'));

      await userEvent.type(screen.getByPlaceholderText(/search/i), 'gen');

      expect(screen.getByText('# general')).toBeInTheDocument();
      expect(screen.queryByText('# random')).not.toBeInTheDocument();
      expect(screen.queryByText('# dev')).not.toBeInTheDocument();
    });

    it('検索ボックスをクリアすると全チャンネルが表示される', async () => {
      mockList.mockResolvedValue({
        channels: [makeChannel(1, 'general'), makeChannel(2, 'random')],
      });
      render(<ChannelList activeChannelId={null} onSelect={vi.fn()} />);
      await waitFor(() => screen.getByText('# general'));

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
      render(<ChannelList activeChannelId={null} onSelect={vi.fn()} />);
      await waitFor(() => screen.getByText('# general'));

      await userEvent.type(screen.getByPlaceholderText(/search/i), 'xyz');

      expect(screen.queryByText(/^# /)).not.toBeInTheDocument();
    });
  });
});
