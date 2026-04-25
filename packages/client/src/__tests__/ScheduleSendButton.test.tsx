// テスト対象: components/Chat/ScheduleSendButton.tsx (#110)
// 戦略:
//   - 送信ボタン横のアイコンをクリックすると日時ピッカーが開くフローを検証
//   - api/client.scheduledMessages.create のモックで予約 API 呼び出しを確認
//   - 過去日時を選んだ際のエラー表示、スナックバー連携 (doc/snackbar-spec.md) を確認
//   - date-fns 等の日時処理はライブラリ側の動作確認はせず、props に渡される値だけ検証する

describe('ScheduleSendButton', () => {
  describe('日時ピッカーの開閉', () => {
    it('ボタンをクリックすると日時ピッカー（ダイアログ）が開く', () => {
      // TODO
    });

    it('閉じるボタンでダイアログが閉じる', () => {
      // TODO
    });

    it('Escape キーでダイアログが閉じる', () => {
      // TODO
    });
  });

  describe('日時選択と予約送信', () => {
    it('未来日時を選んで「予約」ボタンを押すと api.scheduledMessages.create が呼ばれる', () => {
      // TODO
    });

    it('create の引数に channelId / content / scheduledAt(ISO UTC) が含まれる', () => {
      // TODO
    });

    it('予約成功時にスナックバー「〜に予約しました」が表示される', () => {
      // TODO
    });

    it('予約成功時にコンポーネント（親）の入力クリア用コールバック onScheduled が呼ばれる', () => {
      // TODO
    });
  });

  describe('バリデーション', () => {
    it('過去日時を選ぶと「未来の日時を指定してください」エラーが表示され、API は呼ばれない', () => {
      // TODO
    });

    it('content が空のときは予約ボタンが押せない', () => {
      // TODO
    });
  });

  describe('タイムゾーン表示', () => {
    it('ダイアログ内のデフォルト表示は端末ローカル TZ', () => {
      // TODO
    });

    it('create に渡す scheduledAt はローカル入力値を UTC ISO 文字列に変換した値である', () => {
      // TODO
    });
  });

  describe('エラーハンドリング', () => {
    it('API がエラーを返したらスナックバーでエラー表示する', () => {
      // TODO
    });
  });
});
