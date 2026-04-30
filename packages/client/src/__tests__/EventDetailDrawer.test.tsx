/**
 * テスト対象: components/Calendar/EventDetailDrawer.tsx — イベント詳細右ドロワー（#152）
 *
 * 戦略:
 *   - api.calendar.events.rsvp / events.delete を vi.mock
 *   - イベント情報・参加者一覧・RSVP ボタン群の表示と操作を検証
 *
 * 関連 Issue: #152
 */

describe('EventDetailDrawer', () => {
  describe('表示', () => {
    it.todo('event を渡すとタイトル・日時・場所・主催者・説明・参加者一覧が表示される');
    it.todo('event=null のとき何も描画されない');
    it.todo('チャンネル名が左上のヘッダーに「# name」形式で表示される');
  });

  describe('参加者一覧', () => {
    it.todo(
      '参加者の総数と accepted / maybe / declined / pending それぞれのカウントチップが表示される',
    );
    it.todo('各参加者行にステータスアイコンが表示される');
    it.todo('主催者行に「主催者」サブテキストが表示される');
  });

  describe('RSVP', () => {
    it.todo('「参加」クリックで api.calendar.events.rsvp が status=accepted で呼ばれる');
    it.todo('「未定」クリックで status=maybe で呼ばれる');
    it.todo('「不参加」クリックで status=declined で呼ばれる');
    it.todo('現在の myStatus に応じて該当ボタンが contained variant で強調される');
    it.todo('RSVP 成功時に親へ更新通知（onRsvpUpdated）が伝播する');
  });

  describe('編集 / 削除', () => {
    it.todo('編集アイコンクリックで onEdit コールバックが呼ばれる（ダイアログを開く責務は親）');
    it.todo('削除アイコンクリックで確認後に api.calendar.events.delete が呼ばれる');
    it.todo('閉じるアイコンで onClose が呼ばれる');
  });
});
