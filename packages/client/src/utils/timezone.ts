/**
 * #306 タイムゾーン関連ユーティリティ。
 *
 * - getLocalTimeParts: 指定 IANA timezone における Date の "HH:mm" / 時/分 を返す。
 * - isLateNight: 22:00〜翌 6:59 を深夜帯とみなす。
 * - isLateNightInTimezone: 現在時刻 (もしくは渡された now) を timezone に変換して深夜帯か判定。
 *
 * いずれも timezone が null/undefined/空文字、もしくは Intl.DateTimeFormat で
 * RangeError になる不正値のときは null/false を返してスローしない。
 */

export interface LocalTimeParts {
  /** 0-23 */
  hour: number;
  /** 0-59 */
  minute: number;
  /** "HH:mm" 形式 */
  formatted: string;
}

/** 22:00〜翌 6:59 を深夜帯とみなす（hour ベース） */
export function isLateNight(hour: number): boolean {
  return hour >= 22 || hour < 7;
}

/**
 * timezone の値が利用可能な形式か簡易チェックする。
 * 空文字や null/undefined を弾くだけのガード。実際の妥当性検証は
 * Intl.DateTimeFormat 側に任せ、失敗したら null を返す。
 */
function isMaybeValidTimezone(tz: string | null | undefined): tz is string {
  return typeof tz === 'string' && tz.trim().length > 0;
}

/**
 * 指定 timezone と date における時刻情報を返す。
 * 不正な timezone のときは null を返す（スローしない）。
 */
export function getLocalTimeParts(
  timezone: string | null | undefined,
  date: Date = new Date(),
): LocalTimeParts | null {
  if (!isMaybeValidTimezone(timezone)) return null;

  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const hourStr = parts.find((p) => p.type === 'hour')?.value ?? '';
    const minuteStr = parts.find((p) => p.type === 'minute')?.value ?? '';
    // en-GB の hour は 24h 表記だが、稀に "24" を返す環境があるので 0 に正規化
    let hour = Number.parseInt(hourStr, 10);
    const minute = Number.parseInt(minuteStr, 10);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    if (hour === 24) hour = 0;
    const formatted = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    return { hour, minute, formatted };
  } catch {
    return null;
  }
}

/**
 * 現在時刻 (now) が timezone において深夜帯 (22:00〜翌 6:59) かを判定する。
 * timezone 未設定 / 不正値の場合は false を返す。
 */
export function isLateNightInTimezone(
  timezone: string | null | undefined,
  now: Date = new Date(),
): boolean {
  const parts = getLocalTimeParts(timezone, now);
  if (!parts) return false;
  return isLateNight(parts.hour);
}
