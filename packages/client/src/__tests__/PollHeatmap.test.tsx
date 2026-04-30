/**
 * テスト対象: components/Calendar/PollHeatmap.tsx — 日程調整のヒートマップ表示 + 投票（#152）
 *
 * 戦略:
 *   - api.calendar.polls.castVote / confirm を vi.mock
 *   - 集計ロジック（yes/maybe/no カウント、最多得票候補ハイライト、参加可能率バー）
 *   - 自分のセルクリックで yes → maybe → no → null（解除）→ yes の循環ロジック
 *
 * 関連 Issue: #152
 */

describe('PollHeatmap', () => {
  describe('集計', () => {
    it.todo('各候補の yes / maybe / no の人数がヘッダーに表示される');
    it.todo('yes 件数が最多の候補が success カラーでハイライトされる');
    it.todo('参加可能率バーは yes 件数 / 最多 yes 件数の比率で長さが決まる');
    it.todo('全候補で yes 件数が同じ場合は最初に到達した候補がハイライトされる（決定論）');
  });

  describe('投票表示', () => {
    it.todo('既に投票済みのユーザー行に対応する vote 値（◯/△/×）が色分けで表示される');
    it.todo('未投票のセルは灰色背景で空ラベル');
    it.todo('自分の行には「(あなた)」ラベルが付く');
    it.todo('自分の行のセルには破線アウトラインが描画される（ホバー誘導）');
  });

  describe('投票循環', () => {
    it.todo('未投票セル（null）のクリックで yes が送信される');
    it.todo('yes セルのクリックで maybe が送信される');
    it.todo('maybe セルのクリックで no が送信される');
    it.todo('no セルのクリックで null（投票削除）が送信される');
    it.todo('他人のセルをクリックしても api.calendar.polls.castVote は呼ばれない');
  });

  describe('確定操作', () => {
    it.todo(
      '「最多回答で確定」クリックで最多得票の candidateId が api.calendar.polls.confirm に渡る',
    );
    it.todo(
      'confirm 成功時に onConfirmed コールバックが呼ばれて親側でカレンダー再フェッチをトリガーする',
    );
    it.todo('confirmedEventId が既にセットされている poll では確定ボタンが disable される');
  });

  describe('権限', () => {
    it.todo('organizer 以外のユーザーには確定ボタンが表示されない');
  });
});
