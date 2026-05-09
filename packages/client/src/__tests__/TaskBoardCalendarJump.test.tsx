/**
 * テスト対象: TaskBoardPage からカレンダーへのジャンプ動線（Issue #267）
 *
 * 戦略:
 *   - タスクカードに新しく追加するカレンダーアイコンボタンが表示されることを確認
 *   - クリックで `/calendar?date=YYYY-MM-DD` (タスクの dueAt の日付) に navigate されることを検証
 *   - dueAt が null のタスクではアイコンが表示されない（または無効化される）ことを確認
 *   - CalendarPage 側で ?date クエリを受け取って cursor が該当日に設定されることを検証
 */

import { describe, it } from 'vitest';

describe('タスクボード→カレンダーのジャンプ機能（Issue #267）', () => {
  describe('カレンダーアイコンの表示', () => {
    it.todo('dueAt が設定されているタスクカードにカレンダーアイコンが表示される');
    it.todo('dueAt が null のタスクカードにはカレンダーアイコンが表示されない');
    it.todo('カレンダーアイコンは「カレンダーで表示」aria-label を持つ');
  });

  describe('ジャンプ動作', () => {
    it.todo('カレンダーアイコンをクリックすると /calendar?date=YYYY-MM-DD に navigate される');
    it.todo('ジャンプ時の date クエリは dueAt のローカル日付（YYYY-MM-DD）でフォーマットされる');
    it.todo('カレンダーアイコンクリックで他の親イベントが発火しない（stopPropagation）');
  });

  describe('CalendarPage 側の受け取り', () => {
    it.todo('?date=YYYY-MM-DD があるとカーソルがその日付の月にセットされる');
    it.todo('?date=today（既存仕様）は引き続き今日にカーソルがセットされる');
    it.todo('?date=invalid のような不正な値は無視され、デフォルトの今日に設定される');
  });
});
