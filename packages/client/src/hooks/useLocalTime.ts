/**
 * #306 useLocalTime
 *
 * 指定 IANA timezone における現在のローカル時刻を返す。
 *
 * - timezone 未設定（null/undefined/空文字）: { localTime: null, formatted: null, isLateNight: false }
 * - 不正な timezone: 同上（スローしない）
 * - 1分ごとに setInterval で再計算する
 * - hours が >=22 || <7 のとき isLateNight = true
 */

import { useEffect, useState } from 'react';
import { getLocalTimeParts, isLateNight } from '../utils/timezone';

export interface UseLocalTimeResult {
  /** 計算に用いた基準 Date（timezone 不正/未設定なら null） */
  localTime: Date | null;
  /** "HH:mm" 形式（timezone 不正/未設定なら null） */
  formatted: string | null;
  /** 22:00〜翌 6:59 のとき true */
  isLateNight: boolean;
}

const TICK_INTERVAL_MS = 60_000; // 1 分

function compute(timezone: string | null | undefined): UseLocalTimeResult {
  const now = new Date();
  const parts = getLocalTimeParts(timezone, now);
  if (!parts) {
    return { localTime: null, formatted: null, isLateNight: false };
  }
  return {
    localTime: now,
    formatted: parts.formatted,
    isLateNight: isLateNight(parts.hour),
  };
}

export function useLocalTime(timezone: string | null | undefined): UseLocalTimeResult {
  // timezone 変更時に即座に新しい値へ切り替える: useState のイニシャライザでも
  // 計算するが、依存配列に timezone を入れた useEffect で再計算をかける。
  const [result, setResult] = useState<UseLocalTimeResult>(() => compute(timezone));

  useEffect(() => {
    // timezone が変わったら即座に再計算
    setResult(compute(timezone));

    const id = setInterval(() => {
      setResult(compute(timezone));
    }, TICK_INTERVAL_MS);

    return () => {
      clearInterval(id);
    };
  }, [timezone]);

  return result;
}
