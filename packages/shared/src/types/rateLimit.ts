/**
 * レート制限関連の共有型定義 (#153)
 */

/** HTTP 429 レスポンスのボディ */
export interface RateLimitErrorBody {
  error: string;
  retryAfterSec: number;
  limit: number;
  windowSec: number;
}

/** Socket error: rate_limit イベントのペイロード */
export interface RateLimitSocketError {
  type: 'rate_limit';
  retryAfterSec: number;
  limit: number;
  windowSec: number;
  message: string;
}
