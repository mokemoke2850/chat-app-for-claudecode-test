import { useState, useEffect, useRef } from 'react';
import type { TagSuggestion } from '@chat-app/shared';
import { api } from '../api/client';

const DEBOUNCE_MS = 200;

/**
 * タグ候補を取得するフック。
 * - prefix の変更をデバウンスして API を呼び出す
 * - 同一 prefix は内部キャッシュから返す（API 二重呼び出しを防ぐ）
 * - API エラー時は空配列にフォールバック
 */
export function useTagSuggestions(prefix: string, limit = 10): TagSuggestion[] {
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([]);
  // prefix → 結果のシンプルなキャッシュ
  const cache = useRef<Map<string, TagSuggestion[]>>(new Map());

  useEffect(() => {
    const key = `${prefix}:${limit}`;
    if (cache.current.has(key)) {
      setSuggestions(cache.current.get(key)!);
      return;
    }

    const timer = setTimeout(() => {
      api.tags
        .suggestions(prefix, limit)
        .then(({ suggestions: s }) => {
          cache.current.set(key, s);
          setSuggestions(s);
        })
        .catch(() => {
          setSuggestions([]);
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [prefix, limit]);

  return suggestions;
}
