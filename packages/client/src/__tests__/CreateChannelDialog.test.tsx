/**
 * components/Channel/CreateChannelDialog.tsx のユニットテスト
 *
 * テスト対象: ダイアログの表示制御、フォームバリデーション、送信フロー
 * 戦略:
 *   - api.channels.create を vi.mock で差し替える
 *   - userEvent でフォーム入力・送信をシミュレートする
 *   - MUI の Dialog は open prop で描画制御される
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
  },
}));

import { api } from '../api/client';
const mockCreate = api.channels.create as ReturnType<typeof vi.fn>;

function makeChannel(id: number, name: string): Channel {
  return { id, name, description: null, createdBy: 1, createdAt: '2024-01-01T00:00:00Z' };
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

      // MUI の Dialog は open=false のとき DOM に存在しないかロールが非表示
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

      // 初期状態（入力なし）は disabled
      expect(screen.getByRole('button', { name: /^create$/i })).toBeDisabled();
    });

    it('チャンネル名を入力すると Create ボタンが有効になる', async () => {
      render(<CreateChannelDialog {...defaultProps} />);

      await userEvent.type(screen.getByLabelText(/channel name/i), 'general');

      expect(screen.getByRole('button', { name: /^create$/i })).toBeEnabled();
    });
  });

  describe('送信フロー', () => {
    it('フォームを送信すると api.channels.create が呼ばれる', async () => {
      mockCreate.mockResolvedValue({ channel: makeChannel(1, 'general') });

      render(<CreateChannelDialog {...defaultProps} />);
      await userEvent.type(screen.getByLabelText(/channel name/i), 'general');
      await userEvent.click(screen.getByRole('button', { name: /^create$/i }));

      await waitFor(() =>
        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'general' }),
        ),
      );
    });

    it('送信中は Create ボタンが disabled になる', async () => {
      // never resolve させて「送信中」状態を維持する
      mockCreate.mockReturnValue(new Promise(() => {}));

      render(<CreateChannelDialog {...defaultProps} />);
      await userEvent.type(screen.getByLabelText(/channel name/i), 'general');
      await userEvent.click(screen.getByRole('button', { name: /^create$/i }));

      // ボタンが disabled に変わること（loading 中）
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
});
