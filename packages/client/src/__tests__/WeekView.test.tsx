/**
 * テスト対象: components/Calendar/WeekView.tsx — カレンダー週表示（#152）
 *
 * 戦略:
 *   - cursor が含まれる週（日曜起点）の 7 日 × 時刻軸でイベントブロックの絶対配置を検証
 *   - now-line の表示有無は「当日が週内に含まれるか」で判定
 *
 * 関連 Issue: #152
 */

describe('WeekView', () => {
  describe('週グリッド', () => {
    it.todo('cursor を含む週（日曜起点）の 7 日分のカラムを描画する');
    it.todo('時刻ラベル列に 07:00〜22:00 が表示される');
    it.todo('当日のカラムは背景色で強調される');
  });

  describe('イベント配置', () => {
    it.todo('イベントの top は (starts_at の時刻 - 開始時刻) × HOUR_HEIGHT で計算される');
    it.todo('イベントの height は (ends_at - starts_at) × HOUR_HEIGHT で計算される（最小 22px）');
    it.todo('チャンネル色がブロック背景色として使われる');
    it.todo('クリックで onEventClick が呼ばれる');
  });

  describe('now-line', () => {
    it.todo('当日が表示中の週に含まれるとき、当日カラムに横線が描画される');
    it.todo('当日が表示中の週外なら描画されない');
  });
});
