/**
 * レート制限サービス (#153)
 *
 * 将来 Redis 化を見据えてインターフェースを抽象化したうえで、
 * Node プロセスのメモリ Map を使った実装を提供する。
 *
 * - user_id + action 種別をキーとして HTTP / Socket 共通カウンタを管理する
 * - sliding window 方式でタイムスタンプを保持して判定する
 */

import { query, queryOne } from '../db/database';

/** レート制限サービスのインターフェース（将来 Redis 実装に差し替え可能） */
export interface IRateLimitService {
  /** 送信可否をチェックし、カウントを加算する。超過時は null でなく超過情報を返す */
  check(userId: number, action: string): RateLimitResult;
  /** カウンタをリセットする（テスト用） */
  reset(): void;
}

/** レート制限チェックの結果 */
export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSec: number; limit: number; windowSec: number };

/** レート制限設定 */
interface RateLimitConfig {
  messagesPerWindow: number;
  windowSeconds: number;
}

/** 起動時に DB または環境変数から読み込んだ設定 */
let config: RateLimitConfig = {
  messagesPerWindow: parseInt(process.env.RATE_LIMIT_MESSAGES_PER_WINDOW ?? '10', 10),
  windowSeconds: parseInt(process.env.RATE_LIMIT_WINDOW_SECONDS ?? '10', 10),
};

/**
 * 起動時に設定を初期化する。
 * DB に rate_limit_settings 行がなければ環境変数の値で INSERT する。
 * 行があれば DB の値を採用する。
 */
export async function initRateLimitConfig(): Promise<void> {
  try {
    const row = await queryOne<{
      messages_per_window: number;
      window_seconds: number;
    }>('SELECT messages_per_window, window_seconds FROM rate_limit_settings WHERE id = 1');

    if (row) {
      config = {
        messagesPerWindow: row.messages_per_window,
        windowSeconds: row.window_seconds,
      };
    } else {
      // 行がなければ環境変数の値で INSERT
      await query(
        `INSERT INTO rate_limit_settings (id, messages_per_window, window_seconds)
         VALUES (1, $1, $2)
         ON CONFLICT (id) DO NOTHING`,
        [config.messagesPerWindow, config.windowSeconds],
      );
    }
  } catch {
    // DB が利用できない場合は環境変数のデフォルト値で続行
  }
}

/** 現在有効な設定を返す（Socket ハンドラで利用しやすいよう alias も含む） */
export function getRateLimitConfig(): RateLimitConfig & { windowSec: number; limit: number } {
  return {
    ...config,
    windowSec: config.windowSeconds,
    limit: config.messagesPerWindow,
  };
}

/**
 * メモリ Map を使ったレート制限サービス実装
 *
 * キー: `${userId}:${action}`
 * 値:   送信タイムスタンプ（ミリ秒）の配列
 */
class MemoryRateLimitService implements IRateLimitService {
  private readonly store = new Map<string, number[]>();

  check(userId: number, action: string): RateLimitResult {
    const { messagesPerWindow, windowSeconds } = config;
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const key = `${userId}:${action}`;

    // 現在のウィンドウ内のタイムスタンプだけ残す
    const timestamps = (this.store.get(key) ?? []).filter((ts) => now - ts < windowMs);

    if (timestamps.length >= messagesPerWindow) {
      // 最も古いタイムスタンプからウィンドウ終了まで待てばよい
      const oldest = timestamps[0];
      const retryAfterMs = windowMs - (now - oldest);
      const retryAfterSec = Math.ceil(retryAfterMs / 1000);
      return { allowed: false, retryAfterSec, limit: messagesPerWindow, windowSec: windowSeconds };
    }

    timestamps.push(now);
    this.store.set(key, timestamps);
    return { allowed: true };
  }

  reset(): void {
    this.store.clear();
  }
}

/** シングルトンインスタンス */
export const rateLimitService: IRateLimitService = new MemoryRateLimitService();
