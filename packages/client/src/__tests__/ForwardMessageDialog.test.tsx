/**
 * テスト対象: components/Chat/ForwardMessageDialog.tsx
 * 戦略: API クライアントをモックし、ダイアログの UI 操作と API 呼び出しを検証する。
 *       チャンネル一覧は api.channels.list() をモックして提供する。
 *       Suspense 配下での ChannelPicker レンダリングは findByXxx で非同期に確認する。
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Suspense } from 'react';
import ForwardMessageDialog from '../components/Chat/ForwardMessageDialog';
import type { Channel } from '@chat-app/shared';

// API モック
const mockForward = vi.fn();
const mockChannelsList = vi.fn();
vi.mock('../api/client', () => ({
  api: {
    messages: {
      forward: (...args: unknown[]) => mockForward(...args),
    },
    channels: {
      list: () => mockChannelsList(),
    },
  },
}));

const mockChannels: Channel[] = [
  {
    id: 10,
    name: 'general',
    description: null,
    topic: null,
    createdBy: 1,
    isPrivate: false,
    isArchived: false,
    isRecommended: false,
    postingPermission: 'everyone',
    createdAt: '2024-01-01T00:00:00Z',
    unreadCount: 0,
    mentionCount: 0,
  },
  {
    id: 20,
    name: 'random',
    description: null,
    topic: null,
    createdBy: 1,
    isPrivate: false,
    isArchived: false,
    isRecommended: false,
    postingPermission: 'everyone',
    createdAt: '2024-01-01T00:00:00Z',
    unreadCount: 0,
    mentionCount: 0,
  },
];

beforeEach(() => {
  vi.resetAllMocks();
  mockForward.mockResolvedValue({ message: { id: 99 } });
  mockChannelsList.mockResolvedValue({ channels: mockChannels });
});

describe('ForwardMessageDialog', () => {
  describe('ダイアログの表示', () => {
    it('open=true のときダイアログが表示される', async () => {
      render(
        <Suspense fallback={null}>
          <ForwardMessageDialog open={true} messageId={1} onClose={vi.fn()} />
        </Suspense>,
      );
      expect(screen.getByText('転送先を選択')).toBeInTheDocument();
    });

    it('open=false のときダイアログが表示されない', () => {
      render(
        <Suspense fallback={null}>
          <ForwardMessageDialog open={false} messageId={1} onClose={vi.fn()} />
        </Suspense>,
      );
      expect(screen.queryByText('転送先を選択')).not.toBeInTheDocument();
    });

    it('転送先候補としてチャンネル一覧が表示される', async () => {
      render(
        <Suspense fallback={null}>
          <ForwardMessageDialog open={true} messageId={1} onClose={vi.fn()} />
        </Suspense>,
      );
      expect(await screen.findByText('#general')).toBeInTheDocument();
      expect(screen.getByText('#random')).toBeInTheDocument();
    });
  });

  describe('転送先の選択', () => {
    it('チャンネルを選択できる', async () => {
      render(
        <Suspense fallback={null}>
          <ForwardMessageDialog open={true} messageId={1} onClose={vi.fn()} />
        </Suspense>,
      );
      await userEvent.click(await screen.findByTestId('channel-item-10'));
      // 選択後は送信ボタンが有効になる
      expect(screen.getByTestId('forward-submit')).not.toBeDisabled();
    });

    it('チャンネルを選択すると選択状態が視覚的に示される', async () => {
      render(
        <Suspense fallback={null}>
          <ForwardMessageDialog open={true} messageId={1} onClose={vi.fn()} />
        </Suspense>,
      );
      const channelItem = await screen.findByTestId('channel-item-10');
      await userEvent.click(channelItem);
      // MUI ListItemButton は selected 時に Mui-selected クラスが付与される
      expect(channelItem).toHaveClass('Mui-selected');
    });
  });

  describe('コメント入力', () => {
    it('コメント入力欄にテキストを入力できる', async () => {
      render(
        <Suspense fallback={null}>
          <ForwardMessageDialog open={true} messageId={1} onClose={vi.fn()} />
        </Suspense>,
      );
      // チャンネル一覧が表示されるまで待つ（Suspense 解決を確認）
      await screen.findByText('#general');
      const commentInput = screen.getByRole('textbox', { name: 'コメント' });
      await userEvent.type(commentInput, 'テストコメント');
      expect(commentInput).toHaveValue('テストコメント');
    });
  });

  describe('送信', () => {
    it('チャンネルを選択して送信ボタンをクリックすると api.messages.forward が呼ばれる', async () => {
      render(
        <Suspense fallback={null}>
          <ForwardMessageDialog open={true} messageId={5} onClose={vi.fn()} />
        </Suspense>,
      );
      await userEvent.click(await screen.findByTestId('channel-item-10'));
      await userEvent.click(screen.getByTestId('forward-submit'));
      await waitFor(() => {
        expect(mockForward).toHaveBeenCalledWith(5, {
          targetChannelId: 10,
          comment: undefined,
        });
      });
    });

    it('コメントを入力して送信すると comment が API に渡される', async () => {
      render(
        <Suspense fallback={null}>
          <ForwardMessageDialog open={true} messageId={5} onClose={vi.fn()} />
        </Suspense>,
      );
      await userEvent.click(await screen.findByTestId('channel-item-10'));
      const commentInput = screen.getByRole('textbox', { name: 'コメント' });
      await userEvent.type(commentInput, 'コメントです');
      await userEvent.click(screen.getByTestId('forward-submit'));
      await waitFor(() => {
        expect(mockForward).toHaveBeenCalledWith(5, {
          targetChannelId: 10,
          comment: 'コメントです',
        });
      });
    });

    it('転送先が未選択のとき送信ボタンが無効化されている', async () => {
      render(
        <Suspense fallback={null}>
          <ForwardMessageDialog open={true} messageId={1} onClose={vi.fn()} />
        </Suspense>,
      );
      // チャンネル一覧が表示されるまで待つ
      await screen.findByText('#general');
      expect(screen.getByTestId('forward-submit')).toBeDisabled();
    });

    it('送信成功後に onClose が呼ばれる', async () => {
      const onClose = vi.fn();
      render(
        <Suspense fallback={null}>
          <ForwardMessageDialog open={true} messageId={1} onClose={onClose} />
        </Suspense>,
      );
      await userEvent.click(await screen.findByTestId('channel-item-10'));
      await userEvent.click(screen.getByTestId('forward-submit'));
      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
    });

    it('送信失敗時にエラーメッセージが表示される', async () => {
      mockForward.mockRejectedValue(new Error('転送に失敗しました'));
      render(
        <Suspense fallback={null}>
          <ForwardMessageDialog open={true} messageId={1} onClose={vi.fn()} />
        </Suspense>,
      );
      await userEvent.click(await screen.findByTestId('channel-item-10'));
      await userEvent.click(screen.getByTestId('forward-submit'));
      await waitFor(() => {
        expect(screen.getByTestId('forward-error')).toBeInTheDocument();
        expect(screen.getByTestId('forward-error')).toHaveTextContent('転送に失敗しました');
      });
    });
  });

  describe('キャンセル', () => {
    it('キャンセルボタンをクリックすると onClose が呼ばれる', async () => {
      const onClose = vi.fn();
      render(
        <Suspense fallback={null}>
          <ForwardMessageDialog open={true} messageId={1} onClose={onClose} />
        </Suspense>,
      );
      // チャンネル一覧が表示されるまで待つ
      await screen.findByText('#general');
      await userEvent.click(screen.getByRole('button', { name: 'キャンセル' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
