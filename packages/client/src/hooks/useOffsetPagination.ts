import { useEffect, useMemo, useState } from 'react';
import type { OffsetPaged } from '@chat-app/shared';

/**
 * オフセット系ページング（#375）の共通フック。
 *
 * 一覧/検索 UI のページャ実装を共通化する。React 19 の `use()` + `<Suspense>` 構成に合わせ、
 * データそのものではなく安定化済みの `fetchPromise` を返す。呼び出し側は子コンポーネントで
 * `use(fetchPromise)` して `{ items }` を読み取り、本フックが返す `total` / `hasNext` /
 * `hasPrev` / `nextPage` / `prevPage` でページャ UI を制御する。
 *
 * - offset は本フックが state として保持し、nextPage / prevPage で limit 単位に増減する。
 * - フィルタ（filters）が変わると offset を 0 にリセットして 1 ページ目から取得し直す。
 * - total はレスポンスから取得して保持し、hasNext = offset + limit < total で算出する。
 *
 * @param fetchPage  limit / offset とフィルタを受け取り OffsetPaged を返すフェッチ関数
 * @param filters    フェッチに渡すフィルタ条件（変化で offset リセット）
 * @param options    limit（既定 50）
 */
export function useOffsetPagination<T, F extends Record<string, unknown>>(
  fetchPage: (args: F & { limit: number; offset: number }) => Promise<OffsetPaged<T>>,
  filters: F,
  options?: { limit?: number },
) {
  const limit = options?.limit ?? 50;
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);

  // フィルタ条件の同一性は内容ベースで判定する（参照は毎レンダリングで変わりうるため）
  const filtersKey = JSON.stringify(filters);

  // フィルタが変わったら 1 ページ目に戻す
  useEffect(() => {
    setOffset(0);
  }, [filtersKey]);

  const fetchPromise = useMemo(() => {
    return fetchPage({ ...filters, limit, offset }).then((res) => {
      setTotal(res.total);
      return res;
    });
    // filters は filtersKey で同一性を判定する（filters 直接参照は毎回変化しうる）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchPage, filtersKey, limit, offset]);

  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;

  return {
    fetchPromise,
    offset,
    limit,
    total,
    hasPrev,
    hasNext,
    nextPage: () => setOffset((o) => o + limit),
    prevPage: () => setOffset((o) => Math.max(0, o - limit)),
  };
}
