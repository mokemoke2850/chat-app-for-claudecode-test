/**
 * テスト対象: components/Calendar/EventDialog.tsx — カレンダー用イベント作成・編集ダイアログ（#152）
 *
 * 注意: 既存 components/Chat/CreateEventDialog.tsx (#108 用) とは別ファイル。
 *
 * 戦略:
 *   - api.calendar.events.create / polls.create / events.update を vi.mock
 *   - 「予定」「日程調整」のタブ切替でフォーム内容が変わる
 *   - バリデーション（タイトル空・時刻順序・候補日 0 件）
 *
 * 関連 Issue: #152
 */

describe('EventDialog', () => {
  describe('タブ切替', () => {
    it.todo('初期は「予定」タブ');
    it.todo('「日程調整」タブに切り替えると候補日リストと締切が表示される');
    it.todo('「予定」タブでは startsAt / endsAt / location が表示される');
  });

  describe('予定モードのバリデーション', () => {
    it.todo('タイトル空のまま送信するとエラーが出て api.calendar.events.create が呼ばれない');
    it.todo('startsAt >= endsAt で送信するとエラーが出る');
    it.todo('正常入力で api.calendar.events.create が呼ばれ、onCreated と onClose が呼ばれる');
  });

  describe('予定モードのオプション', () => {
    it.todo(
      'リマインダー offset を選択して送信するとリクエスト body に reminderOffsetMinutes が乗る',
    );
    it.todo('参加者 Autocomplete で選んだユーザーが attendeeUserIds として送信される');
    it.todo('initialDate を渡すと startsAt の初期値がその日付の 00 分にセットされる');
  });

  describe('日程調整モードのバリデーション', () => {
    it.todo('タイトル空のまま送信するとエラー');
    it.todo('候補日が 0 件のまま送信するとエラー');
    it.todo('候補日の date / from / to がすべて入力済みなら api.calendar.polls.create が呼ばれる');
  });

  describe('編集モード', () => {
    it.todo('既存 event を渡すと初期値がフォームに展開される');
    it.todo('保存で api.calendar.events.update が呼ばれる');
  });
});
