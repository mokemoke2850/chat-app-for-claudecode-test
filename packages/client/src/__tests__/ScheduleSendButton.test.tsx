// テスト対象: components/Chat/ScheduleSendButton.tsx (#110)
// 戦略:
//   - 送信ボタン横のアイコンをクリックすると日時ピッカーが開くフローを検証
//   - api/client.scheduledMessages.create のモックで予約 API 呼び出しを確認
//   - 過去日時を選んだ際のエラー表示、スナックバー連携 (doc/snackbar-spec.md) を確認
//   - date-fns 等の日時処理はライブラリ側の動作確認はせず、props に渡される値だけ検証する

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import ScheduleSendButton from '../components/Chat/ScheduleSendButton';

const createMock = vi.fn();
vi.mock('../api/client', () => ({
  api: {
    scheduledMessages: {
      create: (input: unknown) => createMock(input),
    },
  },
}));

const showSuccess = vi.fn();
const showError = vi.fn();
vi.mock('../contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showSuccess, showError, showInfo: vi.fn() }),
}));

beforeEach(() => {
  createMock.mockReset();
  showSuccess.mockClear();
  showError.mockClear();
});

function openDialog(content = 'hello') {
  const onScheduled = vi.fn();
  render(<ScheduleSendButton channelId={5} content={content} onScheduled={onScheduled} />);
  // MUI Tooltip ラッパが span にも aria-label を伝搬するため role でボタンを取得する
  fireEvent.mouseDown(screen.getByRole('button', { name: '送信日時を予約' }));
  return { onScheduled };
}

/** 未来 / 過去日時の datetime-local 形式文字列を生成 */
function datetimeLocal(offsetMs: number): string {
  const d = new Date(Date.now() + offsetMs);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

describe('ScheduleSendButton', () => {
  describe('日時ピッカーの開閉', () => {
    it('ボタンをクリックすると日時ピッカー（ダイアログ）が開く', () => {
      openDialog();
      expect(screen.getByRole('dialog', { name: /送信日時を予約/ })).toBeInTheDocument();
      expect(screen.getByLabelText('送信日時')).toBeInTheDocument();
    });

    it('閉じるボタンでダイアログが閉じる', async () => {
      openDialog();
      fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
      // MUI Dialog の transition でアンマウントされるまで待つ
      await waitFor(() => {
        expect(screen.queryByLabelText('送信日時')).toBeNull();
      });
    });

    it('Escape キーでダイアログが閉じる', async () => {
      openDialog();
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      await waitFor(() => {
        expect(screen.queryByLabelText('送信日時')).toBeNull();
      });
    });
  });

  describe('日時選択と予約送信', () => {
    it('未来日時を選んで「予約する」ボタンを押すと api.scheduledMessages.create が呼ばれる', async () => {
      createMock.mockResolvedValue({ scheduledMessage: {} });
      openDialog();
      fireEvent.change(screen.getByLabelText('送信日時'), {
        target: { value: datetimeLocal(60 * 60 * 1000) }, // 1時間後
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '予約する' }));
      });
      expect(createMock).toHaveBeenCalled();
    });

    it('create の引数に channelId / content / scheduledAt(ISO UTC) が含まれる', async () => {
      createMock.mockResolvedValue({ scheduledMessage: {} });
      openDialog('予約本文');
      fireEvent.change(screen.getByLabelText('送信日時'), {
        target: { value: datetimeLocal(60 * 60 * 1000) },
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '予約する' }));
      });
      const arg = createMock.mock.calls[0][0];
      expect(arg.channelId).toBe(5);
      expect(arg.content).toBe('予約本文');
      // ISO UTC 形式（末尾 Z）であること
      expect(arg.scheduledAt).toMatch(/Z$/);
      expect(() => new Date(arg.scheduledAt)).not.toThrow();
    });

    it('予約成功時にスナックバー「〜に予約しました」が表示される', async () => {
      createMock.mockResolvedValue({ scheduledMessage: {} });
      openDialog();
      fireEvent.change(screen.getByLabelText('送信日時'), {
        target: { value: datetimeLocal(60 * 60 * 1000) },
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '予約する' }));
      });
      expect(showSuccess).toHaveBeenCalledWith(expect.stringContaining('予約しました'));
    });

    it('予約成功時にコンポーネント（親）の入力クリア用コールバック onScheduled が呼ばれる', async () => {
      createMock.mockResolvedValue({ scheduledMessage: {} });
      const { onScheduled } = openDialog();
      fireEvent.change(screen.getByLabelText('送信日時'), {
        target: { value: datetimeLocal(60 * 60 * 1000) },
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '予約する' }));
      });
      expect(onScheduled).toHaveBeenCalled();
    });
  });

  describe('バリデーション', () => {
    it('過去日時を選ぶと「未来の日時を指定してください」エラーが表示され、API は呼ばれない', async () => {
      openDialog();
      fireEvent.change(screen.getByLabelText('送信日時'), {
        target: { value: datetimeLocal(-60 * 60 * 1000) }, // 1時間前
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '予約する' }));
      });
      expect(screen.getByText('未来の日時を指定してください')).toBeInTheDocument();
      expect(createMock).not.toHaveBeenCalled();
    });

    it('content が空のときは予約ボタンが押せない', () => {
      openDialog('');
      const btn = screen.getByRole('button', { name: '予約する' }) as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });
  });

  describe('タイムゾーン表示', () => {
    it('ダイアログ内のデフォルト表示は端末ローカル TZ', () => {
      openDialog();
      const input = screen.getByLabelText('送信日時') as HTMLInputElement;
      // datetime-local 形式（YYYY-MM-DDTHH:MM）でローカルの値が入っている
      expect(input.value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
      // 現在時刻 +約1時間（実装で defaultDatetimeLocal が +1h）の前後で生成される
      const inputDate = new Date(input.value);
      const expectedDelta = inputDate.getTime() - Date.now();
      // 50分以上 70分未満（テスト実行のオーバーヘッドを許容）
      expect(expectedDelta).toBeGreaterThan(50 * 60 * 1000);
      expect(expectedDelta).toBeLessThan(70 * 60 * 1000);
    });

    it('create に渡す scheduledAt はローカル入力値を UTC ISO 文字列に変換した値である', async () => {
      createMock.mockResolvedValue({ scheduledMessage: {} });
      openDialog();
      const localValue = datetimeLocal(60 * 60 * 1000);
      fireEvent.change(screen.getByLabelText('送信日時'), { target: { value: localValue } });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '予約する' }));
      });
      const arg = createMock.mock.calls[0][0];
      // ローカル値 → UTC ISO は new Date(localValue).toISOString() と一致
      expect(arg.scheduledAt).toBe(new Date(localValue).toISOString());
    });
  });

  describe('エラーハンドリング', () => {
    it('API がエラーを返したらスナックバーでエラー表示する', async () => {
      createMock.mockRejectedValue(new Error('Server error'));
      openDialog();
      fireEvent.change(screen.getByLabelText('送信日時'), {
        target: { value: datetimeLocal(60 * 60 * 1000) },
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '予約する' }));
      });
      expect(showError).toHaveBeenCalledWith('Server error');
    });
  });
});
