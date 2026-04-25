// テスト対象: components/Chat/ScheduledMessagesDialog.tsx (#110)
// 戦略:
//   - 予約一覧の表示・編集・キャンセル操作の結合動作を検証する
//   - api/client.scheduledMessages.list/update/cancel をモックし、呼び出し引数と再フェッチを確認する
//   - React 19 の use() + Suspense 構成でレンダリングされる前提で、テストは <Suspense fallback> でラップする
//   - 日付表示はローカル TZ 基準、送信済み・キャンセル済みはステータスバッジで区別する

describe('ScheduledMessagesDialog', () => {
  describe('一覧表示', () => {
    it('取得した予約が scheduled_at 昇順で表示される', () => {
      // TODO
    });

    it('空状態: 予約が 0 件なら「予約された送信はありません」と表示される', () => {
      // TODO
    });

    it('各行にチャンネル名 / 本文プレビュー / 予約日時 / ステータスが表示される', () => {
      // TODO
    });

    it('pending / sent / failed / canceled のそれぞれに対応したバッジが表示される', () => {
      // TODO
    });
  });

  describe('編集', () => {
    it('pending の予約の「編集」を押すとインライン or サブダイアログで編集フォームが開く', () => {
      // TODO
    });

    it('編集保存で api.scheduledMessages.update が呼ばれ、成功後に一覧が更新される', () => {
      // TODO
    });

    it('pending 以外（sent / canceled）には編集ボタンが表示されない', () => {
      // TODO
    });
  });

  describe('キャンセル', () => {
    it('「キャンセル」ボタンで確認ダイアログ → api.scheduledMessages.cancel が呼ばれる', () => {
      // TODO
    });

    it('キャンセル成功時にスナックバーで通知が出る', () => {
      // TODO
    });

    it('キャンセル後、該当行のステータスが canceled になる（or 非表示）', () => {
      // TODO
    });
  });

  describe('タイムゾーン表示', () => {
    it('予約日時は端末のローカル TZ で表示される', () => {
      // TODO
    });
  });

  describe('エラーハンドリング', () => {
    it('一覧取得に失敗したときはエラーメッセージとリトライボタンが表示される', () => {
      // TODO
    });

    it('キャンセル API がエラーを返したらスナックバーでエラー通知される', () => {
      // TODO
    });
  });
});
