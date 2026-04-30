/**
 * カレンダー HTTP API 統合テスト
 *
 * テスト対象:
 *  - routes/calendar.ts の /api/calendar/events 系（CRUD + RSVP）
 *  - routes/calendar.ts の /api/calendar/polls 系（CRUD + 投票 + 確定）
 *
 * 戦略:
 *  - supertest + createApp() で実エンドポイントを叩く
 *  - 認証は authenticateToken を通すためテスト用 JWT を発行して Cookie に付与（既存 events-route.test.ts の流儀踏襲）
 *  - DB は pg-mem を共有（getSharedTestDatabase）
 *
 * 関連 Issue: #152
 */

describe('POST /api/calendar/events', () => {
  it.todo('認証なしのリクエストは 401');
  it.todo('正常な body で 201 + 作成されたイベントを返す');
  it.todo('attendees 配列を渡すと作成されたイベントの attendees に pending として含まれる');
  it.todo('reminderOffsetMinutes を渡すと作成されたイベントの reminder offset に反映される');
  it.todo('title が空の body は 400');
  it.todo('starts_at >= ends_at の body は 400');
  it.todo('存在しない channelId を渡すと 400');
});

describe('GET /api/calendar/events', () => {
  it.todo('認証なしのリクエストは 401');
  it.todo('from / to クエリで期間絞り込みできる');
  it.todo('channelIds=10,11 で複数チャンネル絞り込みできる（カンマ区切り）');
  it.todo('クエリ無指定時は当月のイベントを返す（既定の期間）');
});

describe('GET /api/calendar/events/:id', () => {
  it.todo('200 でイベント詳細（attendees / reminder offset 同梱）を返す');
  it.todo('存在しない id は 404');
});

describe('PATCH /api/calendar/events/:id', () => {
  it.todo('organizer は 200 で更新できる');
  it.todo('organizer 以外は 403');
  it.todo('存在しない id は 404');
  it.todo('starts_at >= ends_at になる更新は 400');
});

describe('DELETE /api/calendar/events/:id', () => {
  it.todo('organizer は 204 で削除できる');
  it.todo('organizer 以外は 403');
  it.todo('存在しない id は 404');
});

describe('POST /api/calendar/events/:id/rsvp', () => {
  it.todo('正常な status で 200 + 更新済み RSVP を返す');
  it.todo('無効な status は 400');
  it.todo('存在しないイベントは 404');
  it.todo('認証なしは 401');
});

describe('GET /api/calendar/polls', () => {
  it.todo('channelId クエリで poll 一覧を candidates/votes 同梱で返す');
  it.todo('channelId 未指定は 400');
  it.todo('認証なしは 401');
});

describe('POST /api/calendar/polls', () => {
  it.todo('正常な body で 201 + poll とその candidates を返す');
  it.todo('candidates が 0 件の body は 400');
  it.todo('candidate の starts_at >= ends_at は 400');
  it.todo('認証なしは 401');
});

describe('GET /api/calendar/polls/:id', () => {
  it.todo('200 で poll 詳細（candidates / votes 同梱）を返す');
  it.todo('存在しない id は 404');
});

describe('POST /api/calendar/polls/:id/votes', () => {
  it.todo('正常な投票配列で 200 + 更新後の poll を返す');
  it.todo('vote=null を含む配列で既存投票を削除できる');
  it.todo('confirmed 済み poll への投票は 409');
  it.todo('poll に属さない candidateId は 400');
  it.todo('無効な vote 値は 400');
});

describe('POST /api/calendar/polls/:id/confirm', () => {
  it.todo('organizer は 200 で confirm でき confirmed_event_id がセットされる');
  it.todo('confirm 後のレスポンスに新規作成されたイベント情報が含まれる');
  it.todo('organizer 以外は 403');
  it.todo('既 confirm の poll は 409');
  it.todo('poll に属さない candidateId は 400');
});

describe('DELETE /api/calendar/polls/:id', () => {
  it.todo('organizer は 204 で削除できる');
  it.todo('organizer 以外は 403');
  it.todo('存在しない id は 404');
});
