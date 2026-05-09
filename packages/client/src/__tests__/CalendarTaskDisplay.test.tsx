/**
 * テスト対象: カレンダー（月/週/アジェンダ）における期限付きタスクの表示（Issue #267）
 *
 * 戦略:
 *   - MonthView / WeekView / AgendaView に新しい props として `tasks` を渡し、
 *     期限ありタスクをイベントとは別色のブロック・行として描画することを検証する
 *   - タスクのキー（data-testid）はイベントと衝突しないように `task-block-{id}` 等で表現する
 *   - ホバー時のタイトル/担当/期限の詳細テキスト、クリック時のコールバック、
 *     dueAt が null のタスクは表示されないこと、を中心に検証する
 *   - スタイル（色値）はイベントブロックとは別の固定色（タスク用）であることを style から確認する
 */

import { describe, it } from 'vitest';

describe('カレンダーへのタスク表示（Issue #267）', () => {
  describe('MonthView', () => {
    describe('期限付きタスクの描画', () => {
      it.todo('dueAt がある日付セルに task-block-{id} としてタスクが描画される');
      it.todo('dueAt が null のタスクはどのセルにも描画されない');
      it.todo('同日にイベントとタスクが両方ある場合、両方とも描画される');
      it.todo(
        '同日に上限超過（イベント+タスク合計が表示上限を超える）の場合、+N 件表示が更新される',
      );
    });

    describe('色分け', () => {
      it.todo('タスクブロックの背景色がイベントとは異なるタスク用カラーで描画される');
      it.todo(
        'タスクブロックは status に応じてアイコンまたは装飾差を持つ（todo / in_progress / done）',
      );
    });

    describe('ホバー詳細', () => {
      it.todo('タスクブロックの title 属性に「タイトル / 担当者 / 期限」が含まれる');
    });

    describe('クリック動作', () => {
      it.todo('タスクブロックをクリックすると onTaskClick が該当タスクで呼ばれる');
      it.todo('タスクブロックのクリックでは onDayClick が呼ばれない（stopPropagation）');
    });
  });

  describe('WeekView', () => {
    describe('期限付きタスクの描画', () => {
      it.todo('dueAt の日付・時刻に対応する位置に task-week-block-{id} が描画される');
      it.todo('時刻指定なし（00:00 等）のタスクは終日エリアまたは固定位置に描画される');
      it.todo('週外のタスクは描画されない');
    });

    describe('色分け', () => {
      it.todo('タスクブロックはイベントとは異なる色で描画される');
    });

    describe('クリック動作', () => {
      it.todo('タスクブロックをクリックすると onTaskClick が該当タスクで呼ばれる');
    });
  });

  describe('AgendaView', () => {
    describe('期限付きタスクの描画', () => {
      it.todo('期限日のグループにタスク行（agenda-task-{id}）が混在表示される');
      it.todo(
        '日付グループはイベント＋タスクをまとめてソート（時刻昇順、時刻なしタスクは末尾）して並ぶ',
      );
      it.todo('cursor 月外の期限タスクはグルーピング対象外');
    });

    describe('表示内容', () => {
      it.todo('タスク行にはタイトル・担当者・「タスク」種別ラベル（チップ等）が表示される');
      it.todo('タスク行のサイドバー色はタスク用カラーで描画される');
    });

    describe('クリック動作', () => {
      it.todo('タスク行をクリックすると onTaskClick が呼ばれる');
    });
  });

  describe('CalendarPage 統合', () => {
    describe('タスクのフェッチ', () => {
      it.todo('カレンダー描画時に api.tasks.list が呼ばれて期限ありタスクが取得される');
      it.todo('タスク取得失敗時もイベントは正常に表示される（エラーで全体クラッシュしない）');
    });

    describe('チャンネルフィルタ連携', () => {
      it.todo('チャンネルフィルタ適用時、sourceChannelId が一致するタスクのみ表示される');
      it.todo('未操作（全選択）時は sourceChannelId が null のタスクも表示される');
    });

    describe('タスククリック時の挙動', () => {
      it.todo('カレンダー上のタスククリックで EditTaskDialog が開く');
    });
  });
});
