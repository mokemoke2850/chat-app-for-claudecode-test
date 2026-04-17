/**
 * components/Channel/CreateChannelDialog.tsx のユニットテスト
 *
 * テスト対象: ダイアログの表示制御、フォームバリデーション、送信フロー
 * 戦略:
 *   - api.channels.create を vi.mock で差し替える
 *   - userEvent でフォーム入力・送信をシミュレートする
 *   - MUI の Dialog は open prop で描画制御される
 *
 * React 19 移行後の変更点:
 *   - isPrivate=true 時に UsersList が use() + Suspense を使うため、
 *     private トグルをオンにした後に await act(async () => {}) で
 *     Suspense をフラッシュする
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Channel } from '@chat-app/shared';
import CreateChannelDialog from '../components/Channel/CreateChannelDialog';

vi.mock('../api/client', () => ({
  api: {
    channels: {
      create: vi.fn(),
    },
    auth: {
      users: vi.fn(),
    },
  },
}));

import { api } from '../api/client';
const mockCreate = api.channels.create as ReturnType<typeof vi.fn>;
const mockUsers = api.auth.users as ReturnType<typeof vi.fn>;

function makeChannel(id: number, name: string, isPrivate = false): Channel {
  return {
    id,
    name,
    description: null,
    topic: null,
    createdBy: 1,
    createdAt: '2024-01-01T00:00:00Z',
    isPrivate,
    unreadCount: 0,
  };
}

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  onCreate: vi.fn(),
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('CreateChannelDialog', () => {
  describe('表示制御', () => {
    it('open=false のとき Dialog が非表示である', () => {
      render(<CreateChannelDialog open={false} onClose={vi.fn()} onCreate={vi.fn()} />);

      expect(screen.queryByText('Create Channel')).not.toBeInTheDocument();
    });

    it('open=true のとき Dialog が表示される', () => {
      render(<CreateChannelDialog {...defaultProps} />);

      expect(screen.getByText('Create Channel')).toBeInTheDocument();
    });
  });

  describe('フォームバリデーション', () => {
    it('チャンネル名が空のとき Create ボタンが disabled になる', () => {
      render(<CreateChannelDialog {...defaultProps} />);

      expect(screen.getByRole('button', { name: /^create$/i })).toBeDisabled();
    });

    it('チャンネル名を入力すると Create ボタンが有効になる', async () => {
      render(<CreateChannelDialog {...defaultProps} />);

      await userEvent.type(screen.getByLabelText(/channel name/i), 'general');

      expect(screen.getByRole('button', { name: /^create$/i })).toBeEnabled();
    });
  });

  describe('プライベートチャンネル', () => {
    it('プライベートチャンネルのトグルスイッチが表示される', () => {
      render(<CreateChannelDialog {...defaultProps} />);

      expect(screen.getByLabelText(/private/i)).toBeInTheDocument();
    });

    it('トグルをオンにすると isPrivate=true で API が呼ばれる', async () => {
      mockUsers.mockResolvedValue({ users: [] });
      mockCreate.mockResolvedValue({ channel: { ...makeChannel(1, 'secret'), isPrivate: true } });

      render(<CreateChannelDialog {...defaultProps} />);
      await userEvent.type(screen.getByLabelText(/channel name/i), 'secret');
      await userEvent.click(screen.getByLabelText(/private/i));
      // use() の Suspense が解決するまで待つ
      await screen.findByRole('list', { name: /members/i });
      await userEvent.click(screen.getByRole('button', { name: /^create$/i }));

      await waitFor(() =>
        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'secret', isPrivate: true }),
        ),
      );
    });

    it('トグルがオフのとき isPrivate=false で API が呼ばれる', async () => {
      mockCreate.mockResolvedValue({ channel: makeChannel(1, 'public') });

      render(<CreateChannelDialog {...defaultProps} />);
      await userEvent.type(screen.getByLabelText(/channel name/i), 'public');
      await userEvent.click(screen.getByRole('button', { name: /^create$/i }));

      await waitFor(() =>
        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'public', isPrivate: false }),
        ),
      );
    });
  });

  describe('送信フロー', () => {
    it('フォームを送信すると api.channels.create が呼ばれる', async () => {
      mockCreate.mockResolvedValue({ channel: makeChannel(1, 'general') });

      render(<CreateChannelDialog {...defaultProps} />);
      await userEvent.type(screen.getByLabelText(/channel name/i), 'general');
      await userEvent.click(screen.getByRole('button', { name: /^create$/i }));

      await waitFor(() =>
        expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'general' })),
      );
    });

    it('送信中は Create ボタンが disabled になる', async () => {
      mockCreate.mockReturnValue(new Promise(() => {}));

      render(<CreateChannelDialog {...defaultProps} />);
      await userEvent.type(screen.getByLabelText(/channel name/i), 'general');
      await userEvent.click(screen.getByRole('button', { name: /^create$/i }));

      expect(screen.getByRole('button', { name: /^create$/i })).toBeDisabled();
    });

    it('作成成功後に onCreate が作成されたチャンネルを引数に呼ばれる', async () => {
      const created = makeChannel(1, 'general');
      mockCreate.mockResolvedValue({ channel: created });
      const onCreate = vi.fn();

      render(<CreateChannelDialog open={true} onClose={vi.fn()} onCreate={onCreate} />);
      await userEvent.type(screen.getByLabelText(/channel name/i), 'general');
      await userEvent.click(screen.getByRole('button', { name: /^create$/i }));

      await waitFor(() => expect(onCreate).toHaveBeenCalledWith(created));
    });

    it('作成成功後にフォームがリセットされ onClose が呼ばれる', async () => {
      mockCreate.mockResolvedValue({ channel: makeChannel(1, 'general') });
      const onClose = vi.fn();

      render(<CreateChannelDialog open={true} onClose={onClose} onCreate={vi.fn()} />);
      await userEvent.type(screen.getByLabelText(/channel name/i), 'general');
      await userEvent.click(screen.getByRole('button', { name: /^create$/i }));

      await waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it('API エラー時にエラーメッセージが表示される', async () => {
      mockCreate.mockRejectedValue(new Error('Channel name already taken'));

      render(<CreateChannelDialog {...defaultProps} />);
      await userEvent.type(screen.getByLabelText(/channel name/i), 'duplicate');
      await userEvent.click(screen.getByRole('button', { name: /^create$/i }));

      await waitFor(() =>
        expect(screen.getByText('Channel name already taken')).toBeInTheDocument(),
      );
    });
  });

  describe('プライベートチャンネル作成時のメンバー選択', () => {
    it('Privateトグルがオフのときメンバー選択フィールドは表示されない', async () => {
      render(<CreateChannelDialog {...defaultProps} />);

      expect(screen.queryByLabelText(/members/i)).not.toBeInTheDocument();
    });

    it('Privateトグルをオンにするとメンバー選択フィールドが表示される', async () => {
      mockUsers.mockResolvedValue({ users: [] });

      render(<CreateChannelDialog {...defaultProps} />);
      await userEvent.click(screen.getByLabelText(/private/i));
      // use() の Suspense が解決するまで待つ
      await screen.findByRole('list', { name: /members/i });

      expect(screen.getByRole('list', { name: /members/i })).toBeInTheDocument();
    });

    it('メンバー選択フィールド表示時に api.auth.users からユーザー一覧を取得して選択肢に表示する', async () => {
      mockUsers.mockResolvedValue({
        users: [
          { id: 2, username: 'alice' },
          { id: 3, username: 'bob' },
        ],
      });

      render(<CreateChannelDialog {...defaultProps} />);
      await userEvent.click(screen.getByLabelText(/private/i));
      // use() の Suspense が解決するまで待つ
      await screen.findByText('alice');

      expect(mockUsers).toHaveBeenCalled();
      expect(screen.getByText('alice')).toBeInTheDocument();
      expect(screen.getByText('bob')).toBeInTheDocument();
    });

    it('メンバーを選択した状態でCreateすると memberIds を含めて API が呼ばれる', async () => {
      mockUsers.mockResolvedValue({
        users: [{ id: 2, username: 'alice' }],
      });
      mockCreate.mockResolvedValue({ channel: makeChannel(1, 'secret', true) });

      render(<CreateChannelDialog {...defaultProps} />);
      await userEvent.type(screen.getByLabelText(/channel name/i), 'secret');
      await userEvent.click(screen.getByLabelText(/private/i));
      // use() の Suspense が解決するまで待つ
      await screen.findByText('alice');

      // alice を選択
      await userEvent.click(screen.getByText('alice'));
      await userEvent.click(screen.getByRole('button', { name: /^create$/i }));

      await waitFor(() =>
        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({ isPrivate: true, memberIds: [2] }),
        ),
      );
    });

    it('メンバーを選択せずにCreateすると memberIds は空配列で API が呼ばれる', async () => {
      mockUsers.mockResolvedValue({ users: [] });
      mockCreate.mockResolvedValue({ channel: makeChannel(1, 'secret', true) });

      render(<CreateChannelDialog {...defaultProps} />);
      await userEvent.type(screen.getByLabelText(/channel name/i), 'secret');
      await userEvent.click(screen.getByLabelText(/private/i));
      // use() の Suspense が解決するまで待つ
      await screen.findByRole('list', { name: /members/i });
      await userEvent.click(screen.getByRole('button', { name: /^create$/i }));

      await waitFor(() =>
        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({ isPrivate: true, memberIds: [] }),
        ),
      );
    });
  });
});
