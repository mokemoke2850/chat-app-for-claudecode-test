/**
 * テスト対象: presenceService（新規）
 *
 * 戦略:
 *   - メモリ内に在席集合とアクティビティ時刻を保持するサービスを直接呼び出して検証する
 *   - 時間経過が絡む判定は jest.useFakeTimers() でタイマーを進めて検証する
 *   - DB アクセスはなく、純粋な単体テストとして扱う
 *
 * 仕様前提（ユーザー承認済み）:
 *   - 状態は 'online' | 'away' | 'offline' の 3 値
 *   - 離席判定は 5 分（固定）
 *   - 同一ユーザーが複数 Socket 接続中は online を維持
 *   - 全 disconnect 後 5〜10 秒の猶予を経て offline 判定
 */

describe('presenceService', () => {
  describe('connect / 単一接続', () => {
    it('1 件接続すると当該ユーザーは online になる', () => {
      // TODO
    });

    it('online のユーザーを取得すると state="online" が返る', () => {
      // TODO
    });
  });

  describe('複数タブ（複数 Socket）', () => {
    it('同一ユーザーが 2 つの Socket で接続中は online を維持する', () => {
      // TODO
    });

    it('1 本目の Socket が disconnect しても他の Socket が残っていれば online を維持する', () => {
      // TODO
    });
  });

  describe('disconnect 猶予期間', () => {
    it('全 Socket が disconnect した直後は猶予期間中のため online を維持する', () => {
      // TODO
    });

    it('全 disconnect 後、猶予期間が経過すると offline に遷移する', () => {
      // TODO
    });

    it('猶予期間中に再接続すると online に復帰し offline タイマーがキャンセルされる', () => {
      // TODO
    });
  });

  describe('離席（away）判定', () => {
    it('最終アクティビティから 5 分経過で away に遷移する', () => {
      // TODO
    });

    it('away 中に heartbeat を受けると online に復帰する', () => {
      // TODO
    });

    it('5 分未満の経過では online のままで away にならない', () => {
      // TODO
    });
  });

  describe('オフライン判定', () => {
    it('一度も接続されていないユーザーは offline を返す', () => {
      // TODO
    });

    it('全 Socket disconnect + 猶予期間経過後は offline を返す', () => {
      // TODO
    });
  });

  describe('状態変化の通知', () => {
    it('状態が変化したときだけリスナー（broadcast コールバック）に通知する', () => {
      // TODO
    });

    it('online → online のように変化がない場合はリスナーに通知しない', () => {
      // TODO
    });
  });

  describe('一覧取得 / bulk', () => {
    it('現在 online / away のユーザー一覧を取得できる', () => {
      // TODO
    });

    it('offline のユーザーは bulk 一覧に含まれない', () => {
      // TODO
    });
  });
});
