/**
 * カレンダーリマインダーワーカーのユニットテスト
 *
 * テスト対象:
 *  - jobs/calendarReminderWorker.ts の runOnce / 起動・停止管理
 *
 * 戦略:
 *  - pg-mem インメモリ DB + 時刻を固定（jest fake timers / Date.now のモック）して対象抽出条件を検証
 *  - messageService.createMessage はモックして送信内容（content にイベントタイトル含むか等）を検証
 *  - 既存 unit/scheduledMessageWorker.test.ts のパターンを踏襲
 *
 * 関連 Issue: #152
 */

describe('calendarReminderWorker.runOnce', () => {
  it.todo(
    'starts_at - remind_offset_minutes <= now() かつ sent_at IS NULL のリマインダーを抽出する',
  );
  it.todo('対象リマインダーごとに channel にメッセージを投稿する');
  it.todo('投稿されるメッセージの content にイベントタイトルと残り時間（分）が含まれる');
  it.todo('送信完了後は sent_at が現在時刻に更新される');
  it.todo('既に sent_at が設定済みのリマインダーは送信対象から除外される（冪等性）');
  it.todo('event.channel_id が NULL のリマインダーはスキップされ sent_at は更新されない');
  it.todo('starts_at が未来かつ remind_offset_minutes 以上先のリマインダーは抽出されない');
  it.todo('メッセージ投稿が失敗してもワーカー全体は止まらず、他のリマインダーは処理を続ける');
  it.todo('メッセージ投稿が失敗したリマインダーの sent_at は更新されない（次回再試行される）');
});

describe('calendarReminderWorker のライフサイクル', () => {
  it.todo('startCalendarReminderWorker は setInterval ハンドルを返す');
  it.todo('startCalendarReminderWorker の interval は 30 秒');
  it.todo(
    'NODE_ENV=test では startCalendarReminderWorker を呼ばないガードが index.ts 側に存在する',
  );
  it.todo('stopCalendarReminderWorker で interval が停止する');
});
