/**
 * テスト対象: pages/CalendarPage.tsx — /calendar ルートで表示するグローバルカレンダー画面（#152）
 *
 * 戦略:
 *   - api.calendar.events.list / polls.list を vi.mock で差し替え
 *   - React 19 use() + Suspense パターン前提（CLAUDE.md フロントエンド開発ルール）
 *   - act(async) で Suspense をフラッシュしてからアサーション
 *   - UI の細かなスタイル検証は省略し、ビューの切替・期間ナビ・イベント反映の振る舞いに絞る
 *
 * 関連 Issue: #152
 */

describe('CalendarPage', () => {
  describe('初期表示', () => {
    it.todo('マウント時に api.calendar.events.list が当月の from/to で呼ばれる');
    it.todo('Suspense fallback が一時的に表示される');
    it.todo('events を読み込み完了するとデフォルトの月ビューがレンダーされる');
  });

  describe('期間ナビゲーション', () => {
    it.todo(
      '「次月」クリックで cursor が翌月に進み、events.list が新しい from/to で再フェッチされる',
    );
    it.todo('「前月」クリックで cursor が前月に戻る');
    it.todo('「今日」クリックで cursor が当月に戻る');
  });

  describe('ビュー切替', () => {
    it.todo('月 / 週 / アジェンダの ToggleButtonGroup でビューが切り替わる');
    it.todo('週ビューに切り替えても events のキャッシュは流用される（無駄な再フェッチがない）');
  });

  describe('チャンネル絞り込み', () => {
    it.todo('左サイドバーのチェックボックスを外すとそのチャンネルのイベントは表示されない');
    it.todo('全部チェックを外すとイベントが 0 件になる');
  });

  describe('イベント作成', () => {
    it.todo('日付セルをクリックすると EventDialog が開き、その日付がデフォルトの startsAt に入る');
    it.todo('TopBar の「新しい予定」ボタンで EventDialog が日付未指定で開く');
    it.todo('EventDialog で作成成功するとカレンダーにイベントが反映される');
  });

  describe('イベント詳細', () => {
    it.todo('イベントクリックで EventDetailDrawer が開き、対応イベントが渡される');
    it.todo('Drawer 内の RSVP ボタンで api.calendar.events.rsvp が呼ばれる');
  });

  describe('日程調整', () => {
    it.todo('チャンネルを選んで「日程調整」タブを開くと polls 一覧が PollHeatmap で表示される');
    it.todo('confirm すると新規イベントがカレンダーに反映される');
  });
});
