/**
 * テスト対象: components/Calendar/MonthView.tsx — カレンダー月表示（#152）
 *
 * 戦略:
 *   - 純粋なプロップス駆動コンポーネントとして検証（API モックなし）
 *   - 6 週分のグリッド生成・前後月の補完日付・イベント配置の計算ロジックを中心に確認
 *   - スタイルや色の細かな検証は省略
 *
 * 関連 Issue: #152
 */

describe('MonthView', () => {
  describe('グリッド生成', () => {
    it.todo('cursor の月の 1 日を含む週から 6 週（42 日）分のセルを描画する');
    it.todo('cursor の月以外の日付（前月末・翌月頭）は薄い色で描画される');
    it.todo('日曜は赤系・土曜は青系で曜日ヘッダーが描画される');
    it.todo('当日（today）の日付セルが強調表示される');
  });

  describe('イベント配置', () => {
    it.todo('starts_at が当月内のイベントは該当日付セルに表示される');
    it.todo('1 日に 4 件以上ある場合、最初の 3 件 + 「+N 件」が表示される');
    it.todo('チャンネル色がイベントブロックの背景色として使われる');
    it.todo('starts_at の昇順でイベントが並ぶ');
  });

  describe('インタラクション', () => {
    it.todo('日付セルクリックで onDayClick が呼ばれる（その日付の Date）');
    it.todo(
      'イベントブロックのクリックでは onEventClick が呼ばれ onDayClick は呼ばれない（stopPropagation）',
    );
  });
});
