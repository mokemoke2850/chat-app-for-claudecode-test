/**
 * テスト対象: components/User/StatusEditDialog.tsx（新規）
 *
 * 戦略:
 *   - api.users.updateStatus を vi.mock で差し替える
 *   - 絵文字選択・テキスト入力・有効期限プルダウンの各操作を検証する
 *   - 仕様: 絵文字のみ / テキストのみ / 両方空でクリア のケースを網羅する
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, vi, expect, beforeEach } from 'vitest';

vi.mock('../api/client', () => ({
  api: {
    auth: {
      updateStatus: vi.fn(),
    },
  },
}));

import { api } from '../api/client';
const mockUpdateStatus = api.auth.updateStatus as ReturnType<typeof vi.fn>;

// EmojiPicker は Popper を使っているが jsdom 環境では動作が不安定なため差し替え
vi.mock('../components/Chat/EmojiPicker', () => ({
  default: ({
    onSelect,
    onClose,
  }: {
    anchorEl: HTMLElement | null;
    onSelect: (emoji: string) => void;
    onClose: () => void;
  }) => (
    <div data-testid="emoji-picker">
      <button
        onClick={() => {
          onSelect('🎉');
          onClose();
        }}
      >
        🎉
      </button>
      <button
        onClick={() => {
          onSelect('🚀');
          onClose();
        }}
      >
        🚀
      </button>
    </div>
  ),
}));

import StatusEditDialog from '../components/User/StatusEditDialog';
import type { UserStatus } from '@chat-app/shared';

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  onSaved: vi.fn(),
  currentStatus: null as UserStatus | null,
};

describe('StatusEditDialog', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockUpdateStatus.mockResolvedValue({ user: { status: null } });
  });

  describe('ダイアログの表示', () => {
    it('open=true のときダイアログが表示される', () => {
      render(<StatusEditDialog {...defaultProps} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('open=false のときダイアログが表示されない', () => {
      render(<StatusEditDialog {...defaultProps} open={false} />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('既存ステータスがある場合、絵文字とテキストが初期値として表示される', () => {
      const currentStatus: UserStatus = { emoji: '🎯', text: '集中モード', expiresAt: null };
      render(<StatusEditDialog {...defaultProps} currentStatus={currentStatus} />);
      expect(screen.getByDisplayValue('集中モード')).toBeInTheDocument();
    });
  });

  describe('絵文字選択', () => {
    it('絵文字ボタンをクリックすると絵文字ピッカーが開く', async () => {
      render(<StatusEditDialog {...defaultProps} />);
      await userEvent.click(screen.getByRole('button', { name: /絵文字を選択/ }));
      expect(screen.getByTestId('emoji-picker')).toBeInTheDocument();
    });

    it('絵文字ピッカーで絵文字を選択すると入力欄に反映される', async () => {
      render(<StatusEditDialog {...defaultProps} />);
      await userEvent.click(screen.getByRole('button', { name: /絵文字を選択/ }));
      await userEvent.click(screen.getByText('🎉'));
      // ピッカーが閉じて絵文字ボタンに選択した絵文字が表示される
      expect(screen.getByRole('button', { name: /絵文字/ })).toHaveTextContent('🎉');
    });

    it('選択済みの絵文字をクリアできる', async () => {
      const currentStatus: UserStatus = { emoji: '🎯', text: null, expiresAt: null };
      render(<StatusEditDialog {...defaultProps} currentStatus={currentStatus} />);
      await userEvent.click(screen.getByRole('button', { name: /絵文字をクリア/ }));
      // クリア後はデフォルト表示（絵文字なし）に戻る
      expect(screen.queryByText('🎯')).not.toBeInTheDocument();
    });
  });

  describe('テキスト入力', () => {
    it('ステータステキストを入力できる', async () => {
      render(<StatusEditDialog {...defaultProps} />);
      const input = screen.getByRole('textbox', { name: /ステータステキスト/ });
      await userEvent.type(input, '会議中');
      expect(input).toHaveValue('会議中');
    });

    it('テキストが空でも保存できる（絵文字のみ設定）', async () => {
      render(<StatusEditDialog {...defaultProps} />);
      await userEvent.click(screen.getByRole('button', { name: /絵文字を選択/ }));
      await userEvent.click(screen.getByText('🚀'));
      await userEvent.click(screen.getByRole('button', { name: '保存' }));
      await waitFor(() => {
        expect(mockUpdateStatus).toHaveBeenCalledWith(
          expect.objectContaining({ emoji: '🚀', text: null }),
        );
      });
    });
  });

  describe('有効期限プルダウン', () => {
    it('有効期限のプリセット（期限なし・1時間後・今日中・明日まで・1週間）が選択できる', async () => {
      render(<StatusEditDialog {...defaultProps} />);
      const select = screen.getByRole('combobox', { name: /有効期限/ });
      expect(select).toBeInTheDocument();
      // MUI Select: オプションを開いて確認
      await userEvent.click(select);
      expect(screen.getByRole('option', { name: '期限なし' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '1時間後' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '今日中' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '明日まで' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '1週間' })).toBeInTheDocument();
    });

    it('「期限なし」を選択すると expires_at に null が渡される', async () => {
      render(<StatusEditDialog {...defaultProps} />);
      const select = screen.getByRole('combobox', { name: /有効期限/ });
      await userEvent.click(select);
      await userEvent.click(screen.getByRole('option', { name: '期限なし' }));

      const textInput = screen.getByRole('textbox', { name: /ステータステキスト/ });
      await userEvent.type(textInput, 'test');
      await userEvent.click(screen.getByRole('button', { name: '保存' }));

      await waitFor(() => {
        expect(mockUpdateStatus).toHaveBeenCalledWith(expect.objectContaining({ expiresAt: null }));
      });
    });

    it('「1時間後」を選択すると現在時刻から1時間後の UTC 日時が渡される', async () => {
      const before = Date.now();
      render(<StatusEditDialog {...defaultProps} />);
      const select = screen.getByRole('combobox', { name: /有効期限/ });
      await userEvent.click(select);
      await userEvent.click(screen.getByRole('option', { name: '1時間後' }));

      const textInput = screen.getByRole('textbox', { name: /ステータステキスト/ });
      await userEvent.type(textInput, 'test');
      await userEvent.click(screen.getByRole('button', { name: '保存' }));

      await waitFor(() => {
        const call = mockUpdateStatus.mock.calls[0][0] as { expiresAt: string };
        const expiresAt = new Date(call.expiresAt).getTime();
        const after = Date.now();
        // 1時間後 ± 60秒の誤差を許容
        expect(expiresAt).toBeGreaterThanOrEqual(before + 60 * 60 * 1000 - 60 * 1000);
        expect(expiresAt).toBeLessThanOrEqual(after + 60 * 60 * 1000 + 60 * 1000);
      });
    });

    it('「今日中」を選択するとクライアントのローカルタイムゾーンの 23:59:59 UTC が渡される', async () => {
      render(<StatusEditDialog {...defaultProps} />);
      const select = screen.getByRole('combobox', { name: /有効期限/ });
      await userEvent.click(select);
      await userEvent.click(screen.getByRole('option', { name: '今日中' }));

      const textInput = screen.getByRole('textbox', { name: /ステータステキスト/ });
      await userEvent.type(textInput, 'test');
      await userEvent.click(screen.getByRole('button', { name: '保存' }));

      await waitFor(() => {
        const call = mockUpdateStatus.mock.calls[0][0] as { expiresAt: string };
        const expiresAt = new Date(call.expiresAt);
        // ローカルタイムで 23:59:59 であることを確認
        expect(expiresAt.getHours()).toBe(23);
        expect(expiresAt.getMinutes()).toBe(59);
        expect(expiresAt.getSeconds()).toBe(59);
      });
    });
  });

  describe('保存処理', () => {
    it('絵文字とテキストと期限を入力して「保存」すると api.auth.updateStatus が呼ばれる', async () => {
      render(<StatusEditDialog {...defaultProps} />);
      await userEvent.click(screen.getByRole('button', { name: /絵文字を選択/ }));
      await userEvent.click(screen.getByText('🎉'));
      await userEvent.type(screen.getByRole('textbox', { name: /ステータステキスト/ }), '祝い');
      await userEvent.click(screen.getByRole('button', { name: '保存' }));

      await waitFor(() => {
        expect(mockUpdateStatus).toHaveBeenCalledWith(
          expect.objectContaining({ emoji: '🎉', text: '祝い' }),
        );
      });
    });

    it('絵文字のみ入力して「保存」するとステータスが設定される', async () => {
      render(<StatusEditDialog {...defaultProps} />);
      await userEvent.click(screen.getByRole('button', { name: /絵文字を選択/ }));
      await userEvent.click(screen.getByText('🚀'));
      await userEvent.click(screen.getByRole('button', { name: '保存' }));

      await waitFor(() => {
        expect(mockUpdateStatus).toHaveBeenCalledWith(
          expect.objectContaining({ emoji: '🚀', text: null }),
        );
      });
    });

    it('テキストのみ入力して「保存」するとステータスが設定される', async () => {
      render(<StatusEditDialog {...defaultProps} />);
      await userEvent.type(screen.getByRole('textbox', { name: /ステータステキスト/ }), '集中中');
      await userEvent.click(screen.getByRole('button', { name: '保存' }));

      await waitFor(() => {
        expect(mockUpdateStatus).toHaveBeenCalledWith(
          expect.objectContaining({ emoji: null, text: '集中中' }),
        );
      });
    });

    it('絵文字もテキストも空で「保存」するとステータスがクリアされる（emoji=null, text=null）', async () => {
      render(<StatusEditDialog {...defaultProps} />);
      await userEvent.click(screen.getByRole('button', { name: '保存' }));

      await waitFor(() => {
        expect(mockUpdateStatus).toHaveBeenCalledWith({ emoji: null, text: null, expiresAt: null });
      });
    });

    it('保存成功後に onClose が呼ばれる', async () => {
      const onClose = vi.fn();
      render(<StatusEditDialog {...defaultProps} onClose={onClose} />);
      await userEvent.click(screen.getByRole('button', { name: '保存' }));

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('保存に失敗するとエラーメッセージが表示される', async () => {
      mockUpdateStatus.mockRejectedValue(new Error('サーバーエラー'));
      render(<StatusEditDialog {...defaultProps} />);
      await userEvent.type(screen.getByRole('textbox', { name: /ステータステキスト/ }), 'test');
      await userEvent.click(screen.getByRole('button', { name: '保存' }));

      await waitFor(() => {
        expect(screen.getByText('サーバーエラー')).toBeInTheDocument();
      });
    });
  });

  describe('キャンセル処理', () => {
    it('「キャンセル」ボタンをクリックすると onClose が呼ばれる', async () => {
      const onClose = vi.fn();
      render(<StatusEditDialog {...defaultProps} onClose={onClose} />);
      await userEvent.click(screen.getByRole('button', { name: 'キャンセル' }));
      expect(onClose).toHaveBeenCalled();
    });
  });
});
