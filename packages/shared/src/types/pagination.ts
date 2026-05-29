/**
 * ページング共通レスポンス形式（#375 検索・一覧 API のページング仕様統一）
 *
 * 一覧・検索系 API のページング方式を 2 種類に標準化する。
 * 返却キーはドメイン名ではなく汎用の `items` に統一し、フロントの一覧取得ロジックを共通化する。
 *
 *   - オフセット系: ページャ・総件数表示が必要な一覧（管理画面の監査ログ、検索結果など）
 *   - カーソル系  : 時系列で前方へ遡る無限スクロール（チャンネル/DM のメッセージタイムライン）
 *
 * 用途別の使い分けは doc/api-pagination-guide.md を正本とする。
 */

/**
 * オフセットベースのページングレスポンス。
 * - total : フィルタ適用後の総件数（limit で切られても全件数を表す）
 * - limit : 1 ページあたりの件数（サーバ側でクランプ済みの実効値）
 * - offset: 先頭からのスキップ件数
 */
export interface OffsetPaged<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * カーソルベースのページングレスポンス。
 * - nextCursor: 次ページ取得に渡す不透明なカーソル文字列。続きが無い場合は null
 * - hasMore   : 続きが存在するか
 */
export interface CursorPaged<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}
