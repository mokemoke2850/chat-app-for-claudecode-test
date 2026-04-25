/**
 * テスト対象: components/Chat/ForwardMessageDialog.tsx
 * 戦略: API クライアントをモックし、ダイアログの UI 操作と API 呼び出しを検証する。
 *       チャンネル一覧・コメント入力・送信フローを中心にテストする。
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ForwardMessageDialog from '../components/Chat/ForwardMessageDialog';
import type { Channel } from '@chat-app/shared';

// API モック
const mockForward = vi.fn();
vi.mock('../api/client', () => ({
  api: {
    messages: {
      forward: (...args: unknown[]) => mockForward(...args),
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
});

describe('ForwardMessageDialog', () => {
  describe('ダイアログの表示', () => {
    it('open=true のときダイアログが表示される', () => {
      render(
        <ForwardMessageDialog
          open={true}
          messageId={1}
          channels={mockChannels}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByText('転送先を選択')).toBeInTheDocument();
    });

    it('open=false のときダイアログが表示されない', () => {
      render(
        <ForwardMessageDialog
          open={false}
          messageId={1}
          channels={mockChannels}
          onClose={vi.fn()}
        />,
      );
      expect(screen.queryByText('転送先を選択')).not.toBeInTheDocument();
    });

    it('転送先候補としてチャンネル一覧が表示される', () => {
      render(
        <ForwardMessageDialog
          open={true}
          messageId={1}
          channels={mockChannels}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByText('#general')).toBeInTheDocument();
      expect(screen.getByText('#random')).toBeInTheDocument();
    });
  });

  describe('転送先の選択', () => {
    it('チャンネルを選択できる', async () => {
      render(
        <ForwardMessageDialog
          open={true}
          messageId={1}
          channels={mockChannels}
          onClose={vi.fn()}
        />,
      );
      await userEvent.click(screen.getByTestId('channel-item-10'));
      // 選択後は送信ボタンが有効になる
      expect(screen.getByTestId('forward-submit')).not.toBeDisabled();
    });

    it('チャンネルを選択すると選択状態が視覚的に示される', async () => {
      render(
        <ForwardMessageDialog
          open={true}
          messageId={1}
          channels={mockChannels}
          onClose={vi.fn()}
        />,
      );
      const channelItem = screen.getByTestId('channel-item-10');
      await userEvent.click(channelItem);
      // MUI ListItemButton は selected 時に Mui-selected クラスが付与される
      expect(channelItem).toHaveClass('Mui-selected');
    });
  });

  describe('コメント入力', () => {
    it('コメント入力欄にテキストを入力できる', async () => {
      render(
        <ForwardMessageDialog
          open={true}
          messageId={1}
          channels={mockChannels}
          onClose={vi.fn()}
        />,
      );
      const commentInput = screen.getByRole('textbox', { name: 'コメント' });
      await userEvent.type(commentInput, 'テストコメント');
      expect(commentInput).toHaveValue('テストコメント');
    });
  });

  describe('送信', () => {
    it('チャンネルを選択して送信ボタンをクリックすると api.messages.forward が呼ばれる', async () => {
      render(
        <ForwardMessageDialog
          open={true}
          messageId={5}
          channels={mockChannels}
          onClose={vi.fn()}
        />,
      );
      await userEvent.click(screen.getByTestId('channel-item-10'));
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
        <ForwardMessageDialog
          open={true}
          messageId={5}
          channels={mockChannels}
          onClose={vi.fn()}
        />,
      );
      await userEvent.click(screen.getByTestId('channel-item-10'));
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

    it('転送先が未選択のとき送信ボタンが無効化されている', () => {
      render(
        <ForwardMessageDialog
          open={true}
          messageId={1}
          channels={mockChannels}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByTestId('forward-submit')).toBeDisabled();
    });

    it('送信成功後に onClose が呼ばれる', async () => {
      const onClose = vi.fn();
      render(
        <ForwardMessageDialog
          open={true}
          messageId={1}
          channels={mockChannels}
          onClose={onClose}
        />,
      );
      await userEvent.click(screen.getByTestId('channel-item-10'));
      await userEvent.click(screen.getByTestId('forward-submit'));
      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
    });

    it('送信失敗時にエラーメッセージが表示される', async () => {
      mockForward.mockRejectedValue(new Error('転送に失敗しました'));
      render(
        <ForwardMessageDialog
          open={true}
          messageId={1}
          channels={mockChannels}
          onClose={vi.fn()}
        />,
      );
      await userEvent.click(screen.getByTestId('channel-item-10'));
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
        <ForwardMessageDialog
          open={true}
          messageId={1}
          channels={mockChannels}
          onClose={onClose}
        />,
      );
      await userEvent.click(screen.getByRole('button', { name: 'キャンセル' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
