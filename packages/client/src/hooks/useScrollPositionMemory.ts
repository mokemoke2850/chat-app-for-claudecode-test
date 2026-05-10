import { useRef, useCallback } from 'react';

/**
 * チャンネル・DM会話・スレッドなどのスクロール位置をセッション内でインメモリ管理するフック。
 *
 * キー（channelId / conversationId など）ごとの scrollTop を Map で保持し、
 * save(key) でコンテナの現在 scrollTop を記録、
 * restore(key) で保存済み scrollTop をコンテナに適用する。
 *
 * タブリロード後はリセットされる（localStorage 永続化は対象外）。
 */
export function useScrollPositionMemory(containerRef: React.RefObject<HTMLDivElement | null>) {
  // key -> scrollTop のインメモリマップ
  const positionMap = useRef<Map<string | number, number>>(new Map());

  /**
   * 現在の containerRef.scrollTop を key に対応する位置として保存する。
   * コンテナが存在しない場合は何もしない。
   */
  const save = useCallback(
    (key: string | number) => {
      const container = containerRef.current;
      if (!container) return;
      positionMap.current.set(key, container.scrollTop);
    },
    [containerRef],
  );

  /**
   * key に対応する保存済み scrollTop をコンテナに適用する。
   * 保存されていない場合は false を返す（呼び出し元が最下部移動などのフォールバックを行える）。
   */
  const restore = useCallback(
    (key: string | number): boolean => {
      const container = containerRef.current;
      if (!container) return false;
      const saved = positionMap.current.get(key);
      if (saved === undefined) return false;
      container.scrollTop = saved;
      return true;
    },
    [containerRef],
  );

  /**
   * key に対応する保存済みスクロール位置を取得する（存在しない場合 undefined）。
   * テストや条件判定に使用する。
   */
  const getSaved = useCallback((key: string | number): number | undefined => {
    return positionMap.current.get(key);
  }, []);

  return { save, restore, getSaved };
}
