import type { Request } from 'express';
import type { CursorPaged } from '@chat-app/shared';

/**
 * カーソル系ページング（#375 / #386）の共通ユーティリティ。
 *
 * 一覧系エンドポイント（チャンネル / DM / ゲスト / スレッド返信のメッセージ）で共用する。
 * サービス層は「時系列昇順で limit+1 件」取得し、本ヘルパーで封筒 { items, nextCursor, hasMore } を導出する。
 */

/** カーソル系のデフォルト・上限 limit */
export const CURSOR_DEFAULT_LIMIT = 50;
export const CURSOR_MAX_LIMIT = 100;

/**
 * クエリから limit / before を取り出す。
 * - limit: 1〜CURSOR_MAX_LIMIT にクランプ（未指定は CURSOR_DEFAULT_LIMIT）
 * - before: 直前ページの nextCursor（数値 ID 文字列）。未指定は undefined
 */
export function parseCursorParams(req: Request): { limit: number; before?: number } {
  const rawLimit = req.query.limit ? Number(req.query.limit) : CURSOR_DEFAULT_LIMIT;
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.trunc(rawLimit), 1), CURSOR_MAX_LIMIT)
    : CURSOR_DEFAULT_LIMIT;
  const before = req.query.before ? Number(req.query.before) : undefined;
  return { limit, before: before !== undefined && Number.isFinite(before) ? before : undefined };
}

/**
 * 時系列昇順で limit+1 件取得済みの配列から、カーソル封筒を導出する。
 *
 * - hasMore: 取得件数が limit を超えたか（= さらに古いメッセージが存在する）
 * - items  : 超過時は最古の余剰 1 件を切り落とした最新 limit 件（昇順を維持）
 * - nextCursor: 次に遡る際の before に渡す「現在表示中の最古メッセージ ID」の文字列。続きが無ければ null
 */
export function buildCursorPage<T extends { id: number }>(
  fetched: T[],
  limit: number,
): CursorPaged<T> {
  const hasMore = fetched.length > limit;
  const items = hasMore ? fetched.slice(fetched.length - limit) : fetched;
  const nextCursor = hasMore && items.length > 0 ? String(items[0].id) : null;
  return { items, nextCursor, hasMore };
}
