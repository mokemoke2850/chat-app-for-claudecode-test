/**
 * カレンダー機能のサービス層テスト（中間粒度）
 *
 * テスト対象:
 *  - services/calendarService.ts のイベント CRUD / RSVP / 日程調整 (Poll) / リマインダー登録ロジック
 *
 * 戦略:
 *  - pg-mem のインメモリ PostgreSQL を使った中間粒度テスト（既存 event.test.ts の流儀踏襲）
 *  - HTTP 層の検証は calendar-route.test.ts に分離
 *  - リマインダー送信ジョブの動作検証は unit/calendarReminderWorker.test.ts に分離
 *
 * 関連 Issue: #152
 */

describe('calendarService', () => {
  describe('createEvent', () => {
    it.todo(
      'title/channelId/startsAt/endsAt/organizerId を渡すとイベントが作成され、id と空の attendees が返る',
    );
    it.todo('channelId を null で渡すとワークスペース全体イベントとして作成できる');
    it.todo('attendees 配列を渡すと calendar_event_attendees に status=pending で INSERT される');
    it.todo('reminderOffsetMinutes を渡すと calendar_event_reminders に行が作成される');
    it.todo('starts_at が ends_at 以降の場合はバリデーションエラー');
    it.todo('存在しない channelId を渡すと FK エラーで作成失敗');
    it.todo('存在しない organizerId を渡すと FK エラーで作成失敗');
  });

  describe('updateEvent', () => {
    it.todo('organizer 自身は title/description/startsAt/endsAt/location を更新できる');
    it.todo('updated_at が現在時刻に更新される');
    it.todo('organizer 以外のユーザーが更新を試みると権限エラー');
    it.todo('存在しない eventId で更新を試みると NotFound エラー');
    it.todo('starts_at >= ends_at になる更新はバリデーションエラー');
  });

  describe('deleteEvent', () => {
    it.todo('organizer 自身は削除でき、calendar_event_attendees も CASCADE で消える');
    it.todo('削除に伴い calendar_event_reminders も CASCADE で消える');
    it.todo('関連する calendar_polls.confirmed_event_id は SET NULL される');
    it.todo('organizer 以外のユーザーが削除を試みると権限エラー');
    it.todo('存在しない eventId で削除を試みると NotFound エラー');
  });

  describe('getEventById', () => {
    it.todo('attendees の配列と reminder の offset リストを同梱して返す');
    it.todo('存在しない id で null を返す');
  });

  describe('listEventsInRange', () => {
    it.todo('期間 [from, to] に starts_at が含まれるイベントを starts_at 昇順で返す');
    it.todo('channelIds を指定するとそのチャンネルに属するイベントのみ返す');
    it.todo('channelIds 未指定なら全チャンネルのイベントを返す');
    it.todo('期間外のイベントは含まれない');
    it.todo('channelIds が空配列ならイベントは 0 件');
    it.todo(
      'channel_id が NULL のイベント（ワークスペース全体）は channelIds 指定時には含まれない',
    );
  });

  describe('setRsvp', () => {
    it.todo('初回呼び出しで accepted/maybe/declined/pending のいずれかで attendee 行が作成される');
    it.todo('既存の RSVP がある場合は status を更新する');
    it.todo('responded_at が更新される');
    it.todo('無効な status 値は受け付けない');
    it.todo('存在しないイベントでは NotFound エラー');
  });

  describe('createPoll', () => {
    it.todo(
      'title/channelId/organizerId/deadline/candidates[] を渡すと poll とその candidates が作成される',
    );
    it.todo('deadline は省略可能で NULL で保存できる');
    it.todo('candidates が 0 件ならバリデーションエラー');
    it.todo('candidate の starts_at >= ends_at はバリデーションエラー');
    it.todo('存在しない channelId を渡すと FK エラー');
  });

  describe('getPollWithVotes', () => {
    it.todo('poll の candidates と各候補への votes 一覧を同梱して返す');
    it.todo('confirmed_event_id が設定されていればそれも含めて返す');
    it.todo('存在しない id で null を返す');
  });

  describe('listPollsByChannel', () => {
    it.todo('指定チャンネルの poll を candidates / votes 同梱で返す');
    it.todo('confirmed 済みの poll も含めて返す');
    it.todo('別チャンネルの poll は含めない');
  });

  describe('castVote', () => {
    it.todo('未投票の候補に yes / maybe / no を新規投票できる');
    it.todo('既存投票を上書き更新できる');
    it.todo('vote=null を渡すと既存投票を削除する');
    it.todo('複数候補への一括投票が atomic に処理される（途中失敗時は全体ロールバック）');
    it.todo('無効な vote 値はバリデーションエラー');
    it.todo('confirmed 済み poll への投票は拒否される');
    it.todo('poll に属さない candidateId への投票は拒否される');
  });

  describe('confirmPoll', () => {
    it.todo('organizer が候補を選ぶと calendar_events が作成され confirmed_event_id が更新される');
    it.todo('作成されるイベントの organizer_id は poll.organizer_id と一致する');
    it.todo('作成されるイベントの channel_id は poll.channel_id と一致する');
    it.todo('candidate の starts_at と ends_at がイベントの時刻として転写される');
    it.todo('confirm はトランザクションで実行され、event 作成と confirmed_event_id 更新が atomic');
    it.todo('既に confirmed_event_id が設定されている poll への二重 confirm は拒否される');
    it.todo('organizer 以外のユーザーが confirm を試みると権限エラー');
    it.todo('poll に属さない candidateId を渡すとバリデーションエラー');
  });
});
