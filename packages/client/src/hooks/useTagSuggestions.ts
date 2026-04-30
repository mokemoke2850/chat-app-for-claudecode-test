import { use, useMemo } from 'react';
import type { TagSuggestion } from '@chat-app/shared';
import { api } from '../api/client';

// prefix:limit → Promise のキャッシュ。
// 同一キーは同じ Promise を返し、レンダリングごとに Promise を再生成しない
// （CLAUDE.md「Promise は useState または useMemo で安定化」準拠）。
const promiseCache = new Map<string, Promise<TagSuggestion[]>>();

function getSuggestionsPromise(prefix: string, limit: number): Promise<TagSuggestion[]> {
  const key = `${prefix}:${limit}`;
  let p = promiseCache.get(key);
  if (!p) {
    p = api.tags
      .suggestions(prefix, limit)
      .then((r) => r.suggestions)
      .catch(() => [] as TagSuggestion[]);
    promiseCache.set(key, p);
  }
  return p;
}

/**
 * タグ候補を取得するフック（React 19 use() + Suspense）。
 * 呼び出し側コンポーネントは <Suspense> でラップする必要がある。
 *
 * - 同一 prefix:limit は内部 promiseCache から返す（API 二重呼び出しを防ぐ）
 * - API エラー時は空配列にフォールバック
 *
 * NOTE: 入力デバウンスは呼び出し側で行う。Suspense 内で useState を持つと
 * suspend → unmount → remount で初期値が再評価されるため、フック内での
 * 自前デバウンスは機能しない（#177）。
 */
export function useTagSuggestions(prefix: string, limit = 10): TagSuggestion[] {
  const promise = useMemo(() => getSuggestionsPromise(prefix, limit), [prefix, limit]);
  return use(promise);
}

/** テスト用: 内部 promise キャッシュを初期化する */
export function _resetSuggestionsCacheForTest(): void {
  promiseCache.clear();
}
