/**
 * テスト対象: components/Calendar/AgendaView.tsx — カレンダーアジェンダ表示（#152）
 *
 * 戦略:
 *   - cursor の月内のイベントを日付別にグルーピングして表示する計算ロジックを検証
 *   - 各イベント行の参加者アバター・自分の RSVP チップ・チャンネルチップの表示有無
 *
 * 関連 Issue: #152
 */

describe('AgendaView', () => {
  describe('日付グルーピング', () => {
    it.todo('cursor の月内のイベントを日付別にまとめ、日付昇順で表示する');
    it.todo('月外のイベントは表示されない');
    it.todo('イベントが 0 件のとき「この月には予定がありません」プレースホルダーを表示する');
    it.todo('当日のグループ見出しに「今日」チップが表示される');
  });

  describe('イベント行', () => {
    it.todo('starts_at / ends_at の時刻が左サイドに表示される');
    it.todo('参加者アバターは AvatarGroup で 4 件まで表示、超過は +N');
    it.todo('自分の RSVP が accepted / maybe / declined のいずれかなら対応色のチップが表示される');
    it.todo('クリックで onEventClick が呼ばれる');
  });

  describe('チャンネル絞り込み', () => {
    it.todo('channelFilter Set で許可されたチャンネルのみ表示される');
  });
});
