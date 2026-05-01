/**
 * テスト対象: components/Chat/CreateEventDialog.tsx（会話イベント投稿 #108）
 * 戦略:
 *   - api.events.create を vi.mock で差し替え、入力値の送信を検証する
 *   - 日時ピッカー・タイトル・説明の入力と submit 動作、バリデーションを検証する
 *
 * NOTE: 以下 2 件は実装と齟齬があるため項目修正済み（#180 で承認済み）:
 *   - 「タイトル未入力のとき送信ボタンが無効になる」
 *     → 「タイトル未入力で送信を押すとエラーが表示され API は呼ばれない」
 *   - 「開始日時が未入力のとき送信ボタンが無効になる」
 *     → 「開始日時未入力で送信を押すとエラーが表示され API は呼ばれない」
 *   実装はバリデーション失敗時 setError でエラー表示する方式（送信ボタンは
 *   submitting フラグでのみ disabled 制御）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import CreateEventDialog from '../CreateEventDialog';

const showError = vi.fn();
vi.mock('../../../contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showSuccess: vi.fn(), showError, showInfo: vi.fn() }),
}));

const createMock = vi.fn();
vi.mock('../../../api/client', () => ({
  api: {
    events: {
      create: (data: unknown) => createMock(data),
    },
  },
}));

beforeEach(() => {
  showError.mockClear();
  createMock.mockReset();
});

function renderDialog(opts?: { open?: boolean; onClose?: () => void; onCreated?: () => void }) {
  const onClose = opts?.onClose ?? vi.fn();
  const onCreated = opts?.onCreated ?? vi.fn();
  const result = render(
    <CreateEventDialog
      open={opts?.open ?? true}
      channelId={5}
      onClose={onClose}
      onCreated={onCreated}
    />,
  );
  return { ...result, onClose, onCreated };
}

describe('CreateEventDialog - 会話イベント投稿 (#108)', () => {
  describe('ダイアログ表示', () => {
    it('open=true のときタイトル・開始日時・終了日時・説明の入力欄が表示される', () => {
      renderDialog({ open: true });
      expect(screen.getByLabelText('event-title')).toBeInTheDocument();
      expect(screen.getByLabelText('event-starts-at')).toBeInTheDocument();
      expect(screen.getByLabelText('event-ends-at')).toBeInTheDocument();
      expect(screen.getByLabelText('event-description')).toBeInTheDocument();
    });

    it('open=false のときダイアログは表示されない', () => {
      renderDialog({ open: false });
      expect(screen.queryByLabelText('event-title')).toBeNull();
    });

    it('キャンセルボタンを押すと onClose が呼ばれる', () => {
      const { onClose } = renderDialog({ open: true });
      fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }));
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('入力バリデーション', () => {
    // 仕様の精緻化（#180）: 実装は送信ボタン disabled ではなく setError でエラー表示する方式
    it('タイトル未入力で送信を押すとエラーが表示され API は呼ばれない', () => {
      renderDialog({ open: true });
      // タイトル未入力のまま送信
      fireEvent.click(screen.getByRole('button', { name: '作成' }));
      expect(screen.getByRole('alert').textContent).toContain('タイトル');
      expect(createMock).not.toHaveBeenCalled();
    });

    // 仕様の精緻化（#180）: 同上
    it('開始日時未入力で送信を押すとエラーが表示され API は呼ばれない', () => {
      renderDialog({ open: true });
      // タイトルだけ入れて開始日時は空のまま送信
      fireEvent.change(screen.getByLabelText('event-title'), { target: { value: 'タイトル' } });
      fireEvent.click(screen.getByRole('button', { name: '作成' }));
      expect(screen.getByRole('alert').textContent).toContain('開始日時');
      expect(createMock).not.toHaveBeenCalled();
    });

    it('開始日時が終了日時より後のときエラーメッセージが表示され送信できない', () => {
      renderDialog({ open: true });
      fireEvent.change(screen.getByLabelText('event-title'), { target: { value: 'タイトル' } });
      fireEvent.change(screen.getByLabelText('event-starts-at'), {
        target: { value: '2030-01-02T10:00' },
      });
      fireEvent.change(screen.getByLabelText('event-ends-at'), {
        target: { value: '2030-01-01T10:00' },
      });
      fireEvent.click(screen.getByRole('button', { name: '作成' }));
      expect(screen.getByRole('alert').textContent).toContain('終了日時');
      expect(createMock).not.toHaveBeenCalled();
    });

    it('終了日時が未入力でも開始日時とタイトルがあれば送信できる', async () => {
      createMock.mockResolvedValue({
        event: {
          id: 1,
          messageId: 1,
          title: 'タイトル',
          description: null,
          startsAt: '2030-01-01T10:00:00.000Z',
          endsAt: null,
          createdBy: 1,
          createdAt: '',
          updatedAt: '',
          rsvpCounts: { going: 0, notGoing: 0, maybe: 0 },
          myRsvp: null,
        },
      });
      renderDialog({ open: true });
      fireEvent.change(screen.getByLabelText('event-title'), { target: { value: 'タイトル' } });
      fireEvent.change(screen.getByLabelText('event-starts-at'), {
        target: { value: '2030-01-01T10:00' },
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '作成' }));
      });
      expect(createMock).toHaveBeenCalled();
    });
  });

  describe('送信動作', () => {
    it('送信ボタンを押すと api.events.create が { channelId, title, description, startsAt, endsAt } で呼ばれる', async () => {
      createMock.mockResolvedValue({
        event: {
          id: 1,
          messageId: 1,
          title: 'ミーティング',
          description: '議題: ロードマップ',
          startsAt: '2030-01-01T10:00:00.000Z',
          endsAt: '2030-01-01T11:00:00.000Z',
          createdBy: 1,
          createdAt: '',
          updatedAt: '',
          rsvpCounts: { going: 0, notGoing: 0, maybe: 0 },
          myRsvp: null,
        },
      });
      renderDialog({ open: true });
      fireEvent.change(screen.getByLabelText('event-title'), {
        target: { value: 'ミーティング' },
      });
      fireEvent.change(screen.getByLabelText('event-starts-at'), {
        target: { value: '2030-01-01T10:00' },
      });
      fireEvent.change(screen.getByLabelText('event-ends-at'), {
        target: { value: '2030-01-01T11:00' },
      });
      fireEvent.change(screen.getByLabelText('event-description'), {
        target: { value: '議題: ロードマップ' },
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '作成' }));
      });
      expect(createMock).toHaveBeenCalledTimes(1);
      const arg = createMock.mock.calls[0][0];
      expect(arg.channelId).toBe(5);
      expect(arg.title).toBe('ミーティング');
      expect(arg.description).toBe('議題: ロードマップ');
      expect(typeof arg.startsAt).toBe('string');
      expect(typeof arg.endsAt).toBe('string');
    });

    it('送信成功後にダイアログが閉じる（onClose が呼ばれる）', async () => {
      createMock.mockResolvedValue({
        event: {
          id: 1,
          messageId: 1,
          title: 't',
          description: null,
          startsAt: '2030-01-01T10:00:00.000Z',
          endsAt: null,
          createdBy: 1,
          createdAt: '',
          updatedAt: '',
          rsvpCounts: { going: 0, notGoing: 0, maybe: 0 },
          myRsvp: null,
        },
      });
      const { onClose } = renderDialog({ open: true });
      fireEvent.change(screen.getByLabelText('event-title'), { target: { value: 't' } });
      fireEvent.change(screen.getByLabelText('event-starts-at'), {
        target: { value: '2030-01-01T10:00' },
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '作成' }));
      });
      expect(onClose).toHaveBeenCalled();
    });

    it('送信失敗時はスナックバーでエラー通知され、ダイアログは開いたままになる', async () => {
      createMock.mockRejectedValue(new Error('サーバーエラー'));
      const { onClose } = renderDialog({ open: true });
      fireEvent.change(screen.getByLabelText('event-title'), { target: { value: 't' } });
      fireEvent.change(screen.getByLabelText('event-starts-at'), {
        target: { value: '2030-01-01T10:00' },
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '作成' }));
      });
      expect(showError).toHaveBeenCalled();
      // ダイアログは開いたまま（onClose は呼ばれない）
      expect(onClose).not.toHaveBeenCalled();
      // alert にエラーメッセージが残る
      expect(screen.getByRole('alert').textContent).toContain('サーバーエラー');
    });

    it('送信中は送信ボタンが無効になり二重送信が防止される', async () => {
      // 永続的に pending するモック
      let resolveFn: (v: unknown) => void = () => {};
      createMock.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveFn = resolve;
          }),
      );
      renderDialog({ open: true });
      fireEvent.change(screen.getByLabelText('event-title'), { target: { value: 't' } });
      fireEvent.change(screen.getByLabelText('event-starts-at'), {
        target: { value: '2030-01-01T10:00' },
      });
      // 1 回目クリック → submitting=true でボタン disabled になる
      const submitBtn = screen.getByRole('button', { name: '作成' }) as HTMLButtonElement;
      fireEvent.click(submitBtn);
      expect(submitBtn.disabled).toBe(true);
      // 2 回目クリック試行（disabled だが呼ばれない）
      fireEvent.click(submitBtn);
      expect(createMock).toHaveBeenCalledTimes(1);
      // 後始末: pending を解決して unhandled rejection を回避
      await act(async () => {
        resolveFn({
          event: {
            id: 1,
            messageId: 1,
            title: 't',
            description: null,
            startsAt: '',
            endsAt: null,
            createdBy: 1,
            createdAt: '',
            updatedAt: '',
            rsvpCounts: { going: 0, notGoing: 0, maybe: 0 },
            myRsvp: null,
          },
        });
      });
    });
  });

  describe('スラッシュコマンド連携', () => {
    it('open=true / open=false の切り替えに追従してダイアログ表示が切り替わる', () => {
      const { rerender } = renderDialog({ open: false });
      expect(screen.queryByLabelText('event-title')).toBeNull();
      rerender(
        <CreateEventDialog open={true} channelId={5} onClose={vi.fn()} onCreated={vi.fn()} />,
      );
      expect(screen.getByLabelText('event-title')).toBeInTheDocument();
    });
  });
});
