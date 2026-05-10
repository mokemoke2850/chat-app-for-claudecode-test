// Issue #302 — イベントの繰り返し設定（バックエンド API / サービス）
// テスト項目のみを定義する。実装後に各 it.todo を it に置き換えてアサーションを記述する。

import { describe, it } from 'vitest';

describe('イベントの繰り返し設定（サーバー）', () => {
  describe('スキーマ / マイグレーション', () => {
    it.todo('calendar_events テーブルに recurrence_rule_id 列が追加されている');
    it.todo(
      'calendar_event_recurrences テーブルが存在し、freq・interval・byweekday・until・count 等を保持できる',
    );
    it.todo('calendar_event_overrides テーブルが存在し、1件編集時のインスタンス上書きを保持できる');
    it.todo('recurrence_rule_id の外部キー制約が ON DELETE CASCADE で設定されている');
  });

  describe('型定義', () => {
    it.todo('CreateCalendarEventInput に recurrence フィールドが追加されている');
    it.todo(
      'UpdateCalendarEventInput に editScope フィールド（single / following / all）が追加されている',
    );
    it.todo('CalendarEvent に recurrence と recurrenceInstanceDate が含まれる');
  });

  describe('POST /api/calendar/events: 繰り返しイベントの作成', () => {
    it.todo('recurrence なしで作成すると単発イベントが返る');
    it.todo('recurrence: { freq: "DAILY" } で作成すると親イベントが返る');
    it.todo('recurrence: { freq: "WEEKLY", byweekday: ["MO","WE","FR"] } で作成できる');
    it.todo('recurrence: { freq: "MONTHLY" } で作成できる');
    it.todo('recurrence: { freq: "YEARLY" } で作成できる');
    it.todo('終了条件 until を指定して作成できる');
    it.todo('終了条件 count を指定して作成できる');
    it.todo('until と count を同時指定した場合は 400 を返す');
    it.todo('count に 0 以下を指定した場合は 400 を返す');
    it.todo('byweekday に不正な値を指定した場合は 400 を返す');
    it.todo('freq に不正な値を指定した場合は 400 を返す');
  });

  describe('GET /api/calendar/events: 繰り返しイベントの展開', () => {
    it.todo('指定範囲内に該当する毎日繰り返しの全インスタンスが展開して返される');
    it.todo('毎週 月・水・金の繰り返しが該当曜日のみのインスタンスとして返される');
    it.todo('毎月繰り返しの該当日インスタンスが返される');
    it.todo('毎年繰り返しの該当日インスタンスが返される');
    it.todo('until を超える日付のインスタンスは返らない');
    it.todo('count 上限を超えるインスタンスは返らない');
    it.todo('範囲外の親イベントでも、範囲内に展開されるインスタンスは返される');
    it.todo('展開されたインスタンスには recurrenceInstanceDate が含まれる');
    it.todo('オーバーライドされた回はオーバーライド内容で返される');
    it.todo('削除フラグ付きのインスタンスは返らない（1件削除）');
  });

  describe('PATCH /api/calendar/events/:id: 編集スコープ', () => {
    describe('editScope=single (1件だけ編集)', () => {
      it.todo('指定インスタンスのオーバーライドレコードが作成される');
      it.todo('親イベントの recurrence ルールは変更されない');
      it.todo('他のインスタンスは影響を受けない');
      it.todo('recurrenceInstanceDate を指定しないと 400 を返す');
    });

    describe('editScope=following (以降すべて編集)', () => {
      it.todo('指定日以降が新しいルールで再生成される');
      it.todo('指定日より前のインスタンスは元のルールのまま残る');
      it.todo('元の繰り返しの until が指定日の前日に書き換わる');
      it.todo('新しい親イベントが指定日以降のルールで作成される');
    });

    describe('editScope=all (すべて編集)', () => {
      it.todo('親イベントの recurrence ルールが更新される');
      it.todo('既存のオーバーライドは保持される');
      it.todo('全インスタンスに新ルールが反映される');
    });

    it.todo('editScope が不正な値の場合は 400 を返す');
    it.todo('組織者でないユーザーが編集すると 403 を返す');
  });

  describe('DELETE /api/calendar/events/:id: 削除スコープ', () => {
    it.todo('editScope=single でその回のみ削除フラグが立つ');
    it.todo('editScope=following で当該日以降が削除される（until が前日に書き換わる）');
    it.todo('editScope=all で繰り返しイベント全体が削除される');
    it.todo('単発イベントの削除は editScope を無視して全削除する');
    it.todo('組織者でないユーザーが削除すると 403 を返す');
  });

  describe('calendarService: 繰り返しルール展開', () => {
    it.todo('expandRecurrence(rule, range) が範囲内のインスタンス日付配列を返す');
    it.todo('DAILY interval=2 で 1日おきのインスタンスを返す');
    it.todo('WEEKLY byweekday=[MO,WE,FR] で月水金のインスタンスのみ返す');
    it.todo('MONTHLY で各月の同日インスタンスを返す');
    it.todo('MONTHLY で月末日（31日）が無い月はスキップされる');
    it.todo('YEARLY で各年の同日インスタンスを返す');
    it.todo('count を超えたインスタンスは返らない');
    it.todo('until を超えた日付のインスタンスは返らない');
    it.todo('範囲外の日付は返らない');
  });

  describe('オーバーライド管理', () => {
    it.todo('createOverride で 1件編集の上書きレコードが作成される');
    it.todo('同じ recurrenceInstanceDate に対して複数回オーバーライドすると最新で上書きされる');
    it.todo('listEventsInRange でオーバーライドが適用された結果が返る');
    it.todo('親イベント削除でオーバーライドも CASCADE で削除される');
  });

  describe('RSVP / リマインダーとの連携', () => {
    it.todo('1件オーバーライドした回への RSVP は親イベントの RSVP と独立して保存される');
    it.todo('リマインダーは親イベントの設定を全インスタンスで共有する');
  });
});
