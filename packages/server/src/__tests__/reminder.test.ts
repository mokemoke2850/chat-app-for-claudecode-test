// テスト対象: リマインダー機能 (POST /api/reminders, GET /api/reminders, DELETE /api/reminders/:id, 通知処理)
// 戦略: Express ルートハンドラを supertest で結合テスト。DB は better-sqlite3 インメモリ、Socket.IO はモックで差し替える

describe('POST /api/reminders - リマインダー作成', () => {
  it('正常系: リマインダーを作成できる')
  it('バリデーション: messageIdが必須')
  it('バリデーション: remind_atが必須')
  it('バリデーション: remind_atは未来の日時でなければならない')
  it('認証エラー: 未認証ユーザーは作成できない')
})

describe('GET /api/reminders - リマインダー一覧', () => {
  it('正常系: 自分のリマインダー一覧を取得できる')
  it('他のユーザーのリマインダーは含まれない')
  it('済みリマインダーはデフォルトで除外される')
  it('認証エラー: 未認証ユーザーは取得できない')
})

describe('DELETE /api/reminders/:id - リマインダー削除', () => {
  it('正常系: 自分のリマインダーを削除できる')
  it('他のユーザーのリマインダーは削除できない')
  it('存在しないIDでは404を返す')
})

describe('リマインダー通知', () => {
  it('指定時刻になるとSocket.IOでnotificationイベントが送信される')
  it('送信済みリマインダーは再送されない')
})
