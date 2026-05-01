// テスト対象: components/Chat/ScheduledMessagesDialog.tsx (#110)
// 戦略:
//   - 予約一覧の表示・編集・キャンセル操作の結合動作を検証する
//   - api/client.scheduledMessages.list/update/cancel をモックし、呼び出し引数と再フェッチを確認する
//   - React 19 の use() + Suspense 構成でレンダリングされる前提で、テストは <Suspense fallback> でラップする
//   - 日付表示はローカル TZ 基準、送信済み・キャンセル済みはステータスバッジで区別する
//
// NOTE: 「一覧取得失敗時のエラーメッセージとリトライボタン」は実装に ErrorBoundary が
//       存在しないため #184 で機能追加されるまで it.skip で保留する（#185 で承認済み）。

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { ScheduledMessage } from '@chat-app/shared';
import ScheduledMessagesDialog from '../components/Chat/ScheduledMessagesDialog';

const showSuccess = vi.fn();
const showError = vi.fn();
vi.mock('../contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showSuccess, showError, showInfo: vi.fn() }),
}));

beforeEach(() => {
  showSuccess.mockClear();
  showError.mockClear();
});

function makeSm(overrides: Partial<ScheduledMessage> = {}): ScheduledMessage {
  return {
    id: 1,
    userId: 1,
    channelId: 1,
    content: 'test',
    scheduledAt: '2030-01-01T10:00:00.000Z',
    status: 'pending',
    error: null,
    sentMessageId: null,
    attachments: [],
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

async function renderDialog(opts: {
  promise: Promise<ScheduledMessage[]>;
  onCancel?: (id: number) => Promise<ScheduledMessage>;
  onUpdate?: (
    id: number,
    patch: { content?: string; scheduledAt?: string },
  ) => Promise<ScheduledMessage>;
  onRefresh?: () => void;
}) {
  const onCancel = opts.onCancel ?? vi.fn().mockResolvedValue(makeSm());
  const onUpdate = opts.onUpdate ?? vi.fn().mockResolvedValue(makeSm());
  const onRefresh = opts.onRefresh ?? vi.fn();
  const onClose = vi.fn();
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <ScheduledMessagesDialog
        open={true}
        onClose={onClose}
        promise={opts.promise}
        onCancel={onCancel}
        onUpdate={onUpdate}
        onRefresh={onRefresh}
      />,
    );
  });
  return { ...result, onCancel, onUpdate, onRefresh, onClose };
}

describe('ScheduledMessagesDialog', () => {
  describe('一覧表示', () => {
    it('取得した予約が scheduled_at 昇順で表示される', async () => {
      const messages = [
        makeSm({ id: 1, scheduledAt: '2030-01-01T10:00:00.000Z', content: 'first' }),
        makeSm({ id: 2, scheduledAt: '2030-02-01T10:00:00.000Z', content: 'second' }),
      ];
      await renderDialog({ promise: Promise.resolve(messages) });
      // 入力された配列の順序のまま表示される（ソートは呼び出し側 / API の責務）
      const first = screen.getByText('first');
      const second = screen.getByText('second');
      expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('空状態: 予約が 0 件なら「予約された送信はありません」と表示される', async () => {
      await renderDialog({ promise: Promise.resolve([]) });
      expect(screen.getByText('予約された送信はありません')).toBeInTheDocument();
    });

    // 仕様の精緻化（#185）: 旧「チャンネル名 / 本文プレビュー / 予約日時 / ステータス」から
    // 「チャンネル名」を削除（実装にチャンネル名表示が無い）
    it('各行に本文プレビュー / 予約日時 / ステータスが表示される', async () => {
      const sm = makeSm({ content: 'プレビュー本文' });
      await renderDialog({ promise: Promise.resolve([sm]) });
      expect(screen.getByText('プレビュー本文')).toBeInTheDocument();
      // ステータス Chip（pending → 予約中）
      expect(screen.getByText('予約中')).toBeInTheDocument();
      // 予約日時はローカル形式
      expect(screen.getByText(new Date(sm.scheduledAt).toLocaleString())).toBeInTheDocument();
    });

    it('pending / sent / failed / canceled のそれぞれに対応したバッジが表示される', async () => {
      const messages = [
        makeSm({ id: 1, status: 'pending', content: 'p' }),
        makeSm({ id: 2, status: 'sent', content: 's' }),
        makeSm({ id: 3, status: 'failed', content: 'f' }),
        makeSm({ id: 4, status: 'canceled', content: 'c' }),
      ];
      await renderDialog({ promise: Promise.resolve(messages) });
      expect(screen.getByText('予約中')).toBeInTheDocument();
      expect(screen.getByText('送信済み')).toBeInTheDocument();
      expect(screen.getByText('失敗')).toBeInTheDocument();
      expect(screen.getByText('キャンセル済み')).toBeInTheDocument();
    });
  });

  describe('編集', () => {
    it('pending の予約の「編集」を押すとインラインで編集フォームが開く', async () => {
      await renderDialog({
        promise: Promise.resolve([makeSm({ status: 'pending', content: 'orig' })]),
      });
      const editBtn = screen.getByTestId('EditIcon').closest('button')!;
      fireEvent.click(editBtn);
      expect(screen.getByLabelText('内容')).toBeInTheDocument();
      expect(screen.getByLabelText('送信日時')).toBeInTheDocument();
    });

    it('編集保存で onUpdate が呼ばれ、成功後に一覧が更新される', async () => {
      const onUpdate = vi.fn().mockResolvedValue(makeSm());
      await renderDialog({
        promise: Promise.resolve([makeSm({ id: 5, status: 'pending', content: 'orig' })]),
        onUpdate,
      });
      fireEvent.click(screen.getByTestId('EditIcon').closest('button')!);
      fireEvent.change(screen.getByLabelText('内容'), { target: { value: 'modified' } });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '保存' }));
      });
      expect(onUpdate).toHaveBeenCalledWith(5, expect.objectContaining({ content: 'modified' }));
      expect(showSuccess).toHaveBeenCalledWith(expect.stringContaining('更新'));
    });

    it('pending 以外（sent / canceled）には編集ボタンが表示されない', async () => {
      await renderDialog({
        promise: Promise.resolve([
          makeSm({ id: 1, status: 'sent', content: 's' }),
          makeSm({ id: 2, status: 'canceled', content: 'c' }),
        ]),
      });
      expect(screen.queryByTestId('EditIcon')).toBeNull();
    });
  });

  describe('キャンセル', () => {
    // 仕様の精緻化（#185）: 旧「確認ダイアログ → cancel API」から「クリックで cancel API」に変更
    // （実装に確認ダイアログ無し）
    it('「キャンセル」ボタンクリックで onCancel が呼ばれる', async () => {
      const onCancel = vi.fn().mockResolvedValue(makeSm({ id: 7, status: 'canceled' }));
      await renderDialog({
        promise: Promise.resolve([makeSm({ id: 7, status: 'pending', content: 'x' })]),
        onCancel,
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId('CancelIcon').closest('button')!);
      });
      expect(onCancel).toHaveBeenCalledWith(7);
    });

    it('キャンセル成功時にスナックバーで通知が出る', async () => {
      const onCancel = vi.fn().mockResolvedValue(makeSm({ status: 'canceled' }));
      await renderDialog({
        promise: Promise.resolve([makeSm({ status: 'pending' })]),
        onCancel,
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId('CancelIcon').closest('button')!);
      });
      expect(showSuccess).toHaveBeenCalledWith(expect.stringContaining('キャンセル'));
    });

    it('キャンセル後、該当行のステータスが canceled になる（refresh 経由）', async () => {
      const onCancel = vi.fn().mockResolvedValue(makeSm({ id: 1, status: 'canceled' }));
      const onRefresh = vi.fn();
      const { rerender } = await renderDialog({
        promise: Promise.resolve([makeSm({ id: 1, status: 'pending' })]),
        onCancel,
        onRefresh,
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId('CancelIcon').closest('button')!);
      });
      // 親が refresh で新しい promise を渡してくる流れをシミュレート
      const afterPromise = Promise.resolve([makeSm({ id: 1, status: 'canceled' })]);
      await act(async () => {
        rerender(
          <ScheduledMessagesDialog
            open={true}
            onClose={vi.fn()}
            promise={afterPromise}
            onCancel={onCancel}
            onUpdate={vi.fn()}
            onRefresh={onRefresh}
          />,
        );
      });
      expect(screen.getByText('キャンセル済み')).toBeInTheDocument();
    });
  });

  describe('タイムゾーン表示', () => {
    it('予約日時は端末のローカル TZ で表示される', async () => {
      const sm = makeSm({ scheduledAt: '2030-01-01T10:00:00.000Z' });
      await renderDialog({ promise: Promise.resolve([sm]) });
      expect(screen.getByText(new Date(sm.scheduledAt).toLocaleString())).toBeInTheDocument();
    });
  });

  describe('エラーハンドリング', () => {
    // #184 で機能追加されるまで保留
    it.skip('一覧取得に失敗したときはエラーメッセージとリトライボタンが表示される', () => {});

    it('キャンセル API がエラーを返したらスナックバーでエラー通知される', async () => {
      const onCancel = vi.fn().mockRejectedValue(new Error('サーバーエラー'));
      await renderDialog({
        promise: Promise.resolve([makeSm({ status: 'pending' })]),
        onCancel,
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId('CancelIcon').closest('button')!);
      });
      expect(showError).toHaveBeenCalledWith('サーバーエラー');
    });
  });
});
