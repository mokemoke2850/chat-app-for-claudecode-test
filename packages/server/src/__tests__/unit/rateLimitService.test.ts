/**
 * テスト対象: packages/server/src/services/rateLimitService.ts
 * 戦略:
 *   - Node プロセスのメモリ Map を使った sliding window レート制限の
 *     ビジネスロジックをユニットテストで検証する
 *   - DB 不使用（純粋なインメモリロジックのため）
 *   - 時刻制御は jest.useFakeTimers() で行う
 */

import { rateLimitService, getRateLimitConfig } from '../../services/rateLimitService';

describe('RateLimitService', () => {
  beforeEach(() => {
    rateLimitService.reset();
    // テスト時は RATE_LIMIT_* 環境変数が未設定のため、設定値は 10 件 / 10 秒
    jest.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z').getTime() });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('check / increment', () => {
    it('ウィンドウ内の件数が上限以下のときは許可される', () => {
      for (let i = 0; i < 9; i++) {
        expect(rateLimitService.check(1, 'message').allowed).toBe(true);
      }
    });

    it('ウィンドウ内の件数が上限ちょうどのときは拒否される', () => {
      for (let i = 0; i < 10; i++) {
        expect(rateLimitService.check(1, 'message').allowed).toBe(true);
      }
      expect(rateLimitService.check(1, 'message').allowed).toBe(false);
    });

    it('上限超過後に retryAfterSec が正の整数で返される', () => {
      for (let i = 0; i < 10; i++) {
        rateLimitService.check(1, 'message');
      }
      const r = rateLimitService.check(1, 'message');
      expect(r.allowed).toBe(false);
      if (!r.allowed) {
        expect(Number.isInteger(r.retryAfterSec)).toBe(true);
        expect(r.retryAfterSec).toBeGreaterThan(0);
      }
    });
  });

  describe('sliding window の挙動', () => {
    it('ウィンドウ開始より前のタイムスタンプはカウントから除外される', () => {
      for (let i = 0; i < 10; i++) {
        rateLimitService.check(1, 'message');
      }
      // ウィンドウ秒（10 秒）を超えて経過 → 過去のタイムスタンプは除外される
      jest.advanceTimersByTime(11_000);
      expect(rateLimitService.check(1, 'message').allowed).toBe(true);
    });

    it('ウィンドウ境界ちょうどのタイムスタンプは除外される（境界値）', () => {
      for (let i = 0; i < 10; i++) {
        rateLimitService.check(1, 'message');
      }
      expect(rateLimitService.check(1, 'message').allowed).toBe(false);
      // ちょうど windowMs（10000ms）経過 → 実装は now - ts < windowMs のため等値は除外
      jest.advanceTimersByTime(10_000);
      expect(rateLimitService.check(1, 'message').allowed).toBe(true);
    });

    it('時間が経過してウィンドウが抜けたカウントはリセットされ再び送信できる', () => {
      for (let i = 0; i < 10; i++) {
        rateLimitService.check(1, 'message');
      }
      expect(rateLimitService.check(1, 'message').allowed).toBe(false);
      jest.advanceTimersByTime(11_000);
      for (let i = 0; i < 10; i++) {
        expect(rateLimitService.check(1, 'message').allowed).toBe(true);
      }
    });
  });

  describe('ユーザー独立性', () => {
    it('別ユーザーは独立してカウントされる（ユーザーAが上限に達してもユーザーBは送信できる）', () => {
      for (let i = 0; i < 10; i++) {
        rateLimitService.check(1, 'message');
      }
      expect(rateLimitService.check(1, 'message').allowed).toBe(false);
      expect(rateLimitService.check(2, 'message').allowed).toBe(true);
    });

    it('同一ユーザーでもアクション種別（message / dm）が異なれば独立してカウントされる', () => {
      for (let i = 0; i < 10; i++) {
        rateLimitService.check(1, 'message');
      }
      expect(rateLimitService.check(1, 'message').allowed).toBe(false);
      expect(rateLimitService.check(1, 'dm').allowed).toBe(true);
    });
  });

  describe('環境変数による設定', () => {
    it('RATE_LIMIT_MESSAGES_PER_WINDOW が未設定のときデフォルト値 10 が使われる', () => {
      expect(process.env.RATE_LIMIT_MESSAGES_PER_WINDOW).toBeUndefined();
      const cfg = getRateLimitConfig();
      expect(cfg.messagesPerWindow).toBe(10);
      expect(cfg.limit).toBe(10);
    });

    it('RATE_LIMIT_WINDOW_SECONDS が未設定のときデフォルト値 10 が使われる', () => {
      expect(process.env.RATE_LIMIT_WINDOW_SECONDS).toBeUndefined();
      const cfg = getRateLimitConfig();
      expect(cfg.windowSeconds).toBe(10);
      expect(cfg.windowSec).toBe(10);
    });
  });

  describe('reset', () => {
    it('reset を呼ぶとユーザーのカウントが初期化される', () => {
      for (let i = 0; i < 10; i++) {
        rateLimitService.check(1, 'message');
      }
      expect(rateLimitService.check(1, 'message').allowed).toBe(false);
      rateLimitService.reset();
      expect(rateLimitService.check(1, 'message').allowed).toBe(true);
    });
  });
});
