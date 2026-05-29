/**
 * API 共通レスポンス形式（#372 APIレスポンス形式の統一）
 *
 * エラーレスポンスは全ルートで以下の形式に統一する。
 *   { error: { code, message, details? } }
 *
 * - code: フロントが機械的に分岐するためのエラーコード（HTTP ステータスから導出）
 * - message: ユーザー向け/開発者向けのメッセージ
 * - details: zod バリデーション issues など補足情報（任意）
 */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/** よく使うエラーコード。HTTP ステータスコードから導出される既定値を含む。 */
export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'INTERNAL'
  | 'ERROR';
