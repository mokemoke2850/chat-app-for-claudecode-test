/**
 * テスト対象: Socket.IO のプレゼンス連携（presenceService + handler 統合）
 *
 * 戦略:
 *   - http サーバ + socket.io Server + socket.io-client でインメモリ接続テストを行う
 *   - 既存の socket-handler.test.ts と同じパターンに従う
 *   - JWT で認証したクライアントを 2 本立てて、A 接続→B が presence:state を受信することを検証する
 *
 * 仕様前提（ユーザー承認済み）:
 *   - 接続時に presence:bulk で現在の在席集合がクライアントに送られる
 *   - state 変化時は presence:state でワークスペース内の他クライアントに broadcast される
 *   - broadcast はワークスペース内（接続中ユーザー集合）に絞る
 *   - 複数タブ接続中は online を維持し、余計な状態変化通知は出さない
 */

describe('Socket.IO プレゼンス連携', () => {
  describe('接続直後の bulk 送信', () => {
    it('クライアント接続直後に presence:bulk で現在の在席ユーザー一覧を受信する', () => {
      // TODO
    });
  });

  describe('presence:state ブロードキャスト', () => {
    it('クライアント A が接続すると、既に接続済みのクライアント B が presence:state ({state:"online"}) を受信する', () => {
      // TODO
    });

    it('クライアント A が disconnect し猶予期間が経過すると、B が presence:state ({state:"offline"}) を受信する', () => {
      // TODO
    });

    it('A と B が同一ユーザーの複数タブの場合、片方の disconnect では state 変化が broadcast されない', () => {
      // TODO
    });
  });

  describe('presence:heartbeat の受信', () => {
    it('クライアントから presence:heartbeat を受信すると最終アクティビティが更新される', () => {
      // TODO
    });

    it('away 状態のユーザーが heartbeat を送ると online に復帰し、他クライアントが presence:state を受信する', () => {
      // TODO
    });
  });

  describe('broadcast の対象', () => {
    it('presence:state は接続中ユーザー集合（同一ワークスペース）にだけ broadcast される', () => {
      // TODO
    });
  });
});
