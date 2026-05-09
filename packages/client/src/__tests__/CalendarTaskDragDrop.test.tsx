/**
 * テスト対象: カレンダー上のタスクをドラッグして期限日を変更する（Issue #267）
 *
 * 戦略:
 *   - @dnd-kit を `vi.mock` でスタブ化し、DndContext の onDragEnd ハンドラを直接呼び出して
 *     楽観更新と PATCH /tasks/:id の dueAt 送信を検証する
 *   - 月表示では「日付セル」が DroppableContainer になっている前提で、
 *     useDroppable モックの呼び出し引数（id: 'day-YYYY-M-D' など）から登録を確認する
 *   - 週表示では「日付カラム」がドロップ対象となる
 *   - 楽観更新：UI 上のタスクがドロップ先日付セルに即座に移動すること
 *   - 失敗時ロールバック：API が reject されたら元の日付セルに戻ること
 *   - 成功時：api.tasks.update が { dueAt: <ISO of dropped day> } で呼ばれること
 */

import { describe, it } from 'vitest';

describe('カレンダー上でのタスクドラッグによる期限変更（Issue #267）', () => {
  describe('MonthView 上のドラッグ', () => {
    describe('Droppable 登録', () => {
      it.todo('各日付セルが useDroppable の id として登録される（day-YYYY-M-D 形式）');
      it.todo('タスクブロックが useDraggable の id として登録される（task-{id} 形式）');
    });

    describe('ドラッグ完了時の挙動', () => {
      it.todo('別日にドロップすると api.tasks.update が { dueAt: <ISO> } で呼ばれる');
      it.todo('同日（dueAt 変化なし）にドロップした場合は API を呼ばない');
      it.todo('ドロップ先が空（over=null）の場合は API を呼ばない');
    });

    describe('楽観更新', () => {
      it.todo('ドロップ直後にタスクがドロップ先日付セルへ即座に移動する');
      it.todo('API 成功時は楽観更新がそのまま維持される');
    });

    describe('失敗時ロールバック', () => {
      it.todo('API が reject されたらタスクが元の日付セルに戻る');
      it.todo('API エラー時はスナックバーで失敗を通知する');
    });
  });

  describe('WeekView 上のドラッグ', () => {
    describe('Droppable 登録', () => {
      it.todo('各日付カラムが useDroppable の id として登録される（week-day-YYYY-M-D 形式）');
    });

    describe('ドラッグ完了時の挙動', () => {
      it.todo('別日カラムへドロップすると dueAt が更新される');
      it.todo('同日カラムへドロップしても時刻は変更しない（日付のみ更新する仕様）');
    });
  });

  describe('PATCH /tasks/:id 連携', () => {
    describe('dueAt の送信形式', () => {
      it.todo('dueAt は ISO 8601 文字列で送信される');
      it.todo('元のタスクの時刻部分は維持される（時刻指定なしなら 00:00 のまま）');
    });

    describe('権限・エラーハンドリング', () => {
      it.todo('404（タスクなし）のときは「タスクが見つかりません」と通知する');
      it.todo('500（サーバエラー）のときは汎用エラー通知を出す');
    });
  });
});
