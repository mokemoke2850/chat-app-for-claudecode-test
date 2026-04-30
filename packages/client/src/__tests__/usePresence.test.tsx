/**
 * テスト対象: usePresence（新規フック）
 *
 * 戦略:
 *   - Socket は手動モック（イベントハンドラを保持するオブジェクト）を注入する
 *   - @testing-library/react の renderHook でフックの戻り値を検証する
 *   - mousemove / keydown のユーザー操作でクライアント側 heartbeat が送信されることを fake timer で検証する
 *
 * 仕様前提（ユーザー承認済み）:
 *   - フックは現在の在席ユーザー Map<userId, state> を返す
 *   - presence:bulk / presence:state を購読してマップを更新する
 *   - 自分自身の操作（mousemove / keydown）を検知して socket.emit('presence:heartbeat') を送る
 *   - 自分自身の状態が away → online に復帰したら UI に即時反映する
 */

describe('usePresence', () => {
  describe('購読', () => {
    it('マウント時に presence:bulk と presence:state を購読する', () => {
      // TODO
    });

    it('アンマウント時に購読を解除する', () => {
      // TODO
    });
  });

  describe('状態マップの更新', () => {
    it('presence:bulk を受信すると state マップが初期化される', () => {
      // TODO
    });

    it('presence:state を受信すると対象ユーザーの state が更新される', () => {
      // TODO
    });

    it('未知のユーザー ID の presence:state を受信した場合、新しいエントリとして追加される', () => {
      // TODO
    });
  });

  describe('ハートビート送信', () => {
    it('mousemove イベントで socket.emit("presence:heartbeat") が呼ばれる', () => {
      // TODO
    });

    it('keydown イベントで socket.emit("presence:heartbeat") が呼ばれる', () => {
      // TODO
    });

    it('短時間に連続発火するイベントは throttle され、heartbeat は過剰に送られない', () => {
      // TODO
    });
  });

  describe('自分の状態復帰', () => {
    it('away だった自分自身が操作すると、自分の state が online に切り替わって反映される', () => {
      // TODO
    });
  });
});
