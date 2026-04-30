/**
 * テスト対象: packages/server/src/services/rateLimitService.ts
 * 戦略:
 *   - Node プロセスのメモリ Map を使った sliding window レート制限の
 *     ビジネスロジックをユニットテストで検証する
 *   - DB 不使用（純粋なインメモリロジックのため）
 *   - 時刻制御は jest.useFakeTimers() で行う
 */

describe('RateLimitService', () => {
  describe('check / increment', () => {
    it('ウィンドウ内の件数が上限以下のときは許可される', () => {
      // TODO
    });

    it('ウィンドウ内の件数が上限ちょうどのときは拒否される', () => {
      // TODO
    });

    it('上限超過後に retryAfterSec が正の整数で返される', () => {
      // TODO
    });
  });

  describe('sliding window の挙動', () => {
    it('ウィンドウ開始より前のタイムスタンプはカウントから除外される', () => {
      // TODO
    });

    it('ウィンドウ境界ちょうどのタイムスタンプは除外される（境界値）', () => {
      // TODO
    });

    it('時間が経過してウィンドウが抜けたカウントはリセットされ再び送信できる', () => {
      // TODO
    });
  });

  describe('ユーザー独立性', () => {
    it('別ユーザーは独立してカウントされる（ユーザーAが上限に達してもユーザーBは送信できる）', () => {
      // TODO
    });

    it('同一ユーザーでもアクション種別（message / dm）が異なれば独立してカウントされる', () => {
      // TODO
    });
  });

  describe('環境変数による設定', () => {
    it('RATE_LIMIT_MESSAGES_PER_WINDOW が未設定のときデフォルト値 10 が使われる', () => {
      // TODO
    });

    it('RATE_LIMIT_WINDOW_SECONDS が未設定のときデフォルト値 10 が使われる', () => {
      // TODO
    });
  });

  describe('reset', () => {
    it('reset を呼ぶとユーザーのカウントが初期化される', () => {
      // TODO
    });
  });
});
