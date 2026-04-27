/**
 * テスト対象: components/Chat/ReportMessageDialog.tsx
 *
 * 戦略:
 *   - vi.mock('../api/client') でAPIをモック化
 *   - 通報ダイアログの理由選択・コメント入力・送信フローを検証する
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ReportMessageDialog from '../components/Chat/ReportMessageDialog';

const mockReportMessage = vi.fn();

vi.mock('../api/client', () => ({
  api: {
    messages: {
      report: (id: number, input: unknown) => mockReportMessage(id, input),
    },
  },
}));

beforeEach(() => {
  vi.resetAllMocks();
  mockReportMessage.mockResolvedValue({ report: { id: 1 } });
});

describe('ReportMessageDialog', () => {
  describe('表示・非表示', () => {
    it('open=true のときダイアログが表示される', () => {
      render(<ReportMessageDialog open={true} messageId={1} onClose={vi.fn()} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('メッセージを通報')).toBeInTheDocument();
    });

    it('open=false のときダイアログが表示されない', () => {
      render(<ReportMessageDialog open={false} messageId={1} onClose={vi.fn()} />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('理由選択', () => {
    it('spam / harassment / other の選択肢がある', () => {
      render(<ReportMessageDialog open={true} messageId={1} onClose={vi.fn()} />);
      expect(screen.getByRole('radio', { name: 'スパム' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'ハラスメント' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'その他' })).toBeInTheDocument();
    });

    it('理由を選択できる', async () => {
      render(<ReportMessageDialog open={true} messageId={1} onClose={vi.fn()} />);
      await userEvent.click(screen.getByRole('radio', { name: 'スパム' }));
      expect(screen.getByRole('radio', { name: 'スパム' })).toBeChecked();
    });
  });

  describe('コメント入力', () => {
    it('任意コメントの入力フィールドが存在する', () => {
      render(<ReportMessageDialog open={true} messageId={1} onClose={vi.fn()} />);
      expect(screen.getByLabelText('通報コメント')).toBeInTheDocument();
    });
  });

  describe('送信', () => {
    it('理由を選択して送信すると api.messages.report が呼ばれる', async () => {
      render(<ReportMessageDialog open={true} messageId={5} onClose={vi.fn()} />);
      await userEvent.click(screen.getByRole('radio', { name: 'スパム' }));
      await userEvent.click(screen.getByRole('button', { name: '通報する' }));
      await waitFor(() =>
        expect(mockReportMessage).toHaveBeenCalledWith(
          5,
          expect.objectContaining({ reason: 'spam' }),
        ),
      );
    });

    it('送信成功後に onClose コールバックが呼ばれる', async () => {
      const onClose = vi.fn();
      render(<ReportMessageDialog open={true} messageId={1} onClose={onClose} />);
      await userEvent.click(screen.getByRole('radio', { name: 'ハラスメント' }));
      await userEvent.click(screen.getByRole('button', { name: '通報する' }));
      await waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it('理由未選択の状態では送信ボタンが無効化される', () => {
      render(<ReportMessageDialog open={true} messageId={1} onClose={vi.fn()} />);
      expect(screen.getByRole('button', { name: '通報する' })).toBeDisabled();
    });

    it('API エラー時はエラーメッセージが表示される', async () => {
      mockReportMessage.mockRejectedValue(new Error('通報に失敗しました'));
      render(<ReportMessageDialog open={true} messageId={1} onClose={vi.fn()} />);
      await userEvent.click(screen.getByRole('radio', { name: 'その他' }));
      await userEvent.click(screen.getByRole('button', { name: '通報する' }));
      await waitFor(() => expect(screen.getByText('通報に失敗しました')).toBeInTheDocument());
    });
  });

  describe('キャンセル', () => {
    it('キャンセルボタンをクリックすると onClose が呼ばれる', async () => {
      const onClose = vi.fn();
      render(<ReportMessageDialog open={true} messageId={1} onClose={onClose} />);
      await userEvent.click(screen.getByRole('button', { name: 'キャンセル' }));
      expect(onClose).toHaveBeenCalled();
    });
  });
});
