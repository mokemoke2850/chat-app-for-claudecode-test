/**
 * テスト対象: イベント詳細のロケーション／会議リンク機能 (#303)
 *
 * 対象:
 *   - routes/calendar.ts — POST /api/calendar/events, PATCH /api/calendar/events/:id
 *   - services/calendarService.ts — createEvent, updateEvent
 *   - DB: calendar_events テーブルの location カラム（既存）と meeting_url カラム（新規追加）
 *
 * 戦略:
 *   - supertest + createApp() で実エンドポイントを叩く
 *   - DB は pg-mem を共有（createTestDatabase）
 */

import { describe, it } from 'vitest';

describe('POST /api/calendar/events — location と meeting_url', () => {
  describe('location フィールド（既存カラム）', () => {
    it.todo('location を指定してイベントを作成すると DB に保存される');
    it.todo('location を省略してイベントを作成すると null で保存される');
    it.todo('location が null のイベント作成リクエストが 201 を返す');
    it.todo('作成したイベントのレスポンスに location が含まれる');
  });

  describe('meeting_url フィールド（新規カラム）', () => {
    it.todo('meeting_url を指定してイベントを作成すると DB に保存される');
    it.todo('meeting_url を省略してイベントを作成すると null で保存される');
    it.todo('meeting_url が null のイベント作成リクエストが 201 を返す');
    it.todo('作成したイベントのレスポンスに meeting_url が含まれる');
  });

  describe('location と meeting_url の組み合わせ', () => {
    it.todo('location と meeting_url の両方を指定してイベントを作成できる');
    it.todo('両方省略してもイベントが正常に作成される');
  });
});

describe('PATCH /api/calendar/events/:id — location と meeting_url の更新', () => {
  describe('location フィールドの更新', () => {
    it.todo('location を新しい値に更新できる');
    it.todo('location を null に更新（削除）できる');
    it.todo('location を更新したレスポンスに新しい location が含まれる');
  });

  describe('meeting_url フィールドの更新', () => {
    it.todo('meeting_url を新しい値に更新できる');
    it.todo('meeting_url を null に更新（削除）できる');
    it.todo('meeting_url を更新したレスポンスに新しい meeting_url が含まれる');
  });

  describe('権限チェック', () => {
    it.todo('主催者以外のユーザーが meeting_url を更新しようとすると 403 を返す');
  });
});

describe('GET /api/calendar/events/:id — location と meeting_url の取得', () => {
  it.todo('location が設定されたイベントを取得するとレスポンスに location が含まれる');
  it.todo('meeting_url が設定されたイベントを取得するとレスポンスに meeting_url が含まれる');
  it.todo('location と meeting_url が両方 null のイベントを正常に取得できる');
});

describe('GET /api/calendar/events — イベント一覧と location・meeting_url', () => {
  it.todo('一覧取得レスポンスの各イベントに location が含まれる');
  it.todo('一覧取得レスポンスの各イベントに meeting_url が含まれる');
});
