// Issue #152 — カレンダー画面で共有する日時計算ユーティリティ

export const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'] as const;

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

/** 月表示の 6 週グリッドの起点（cursor の月の 1 日を含む週の日曜） */
export function startOfMonthGrid(d: Date): Date {
  const first = startOfMonth(d);
  const offset = first.getDay();
  const start = new Date(first);
  start.setDate(first.getDate() - offset);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function startOfWeek(d: Date): Date {
  const r = new Date(d);
  r.setDate(d.getDate() - d.getDay());
  r.setHours(0, 0, 0, 0);
  return r;
}

export function endOfWeek(d: Date): Date {
  const start = startOfWeek(d);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function fmtTime(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  return `${h}:${m.toString().padStart(2, '0')}`;
}

export function fmtDateShort(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()} (${WEEKDAYS_JA[d.getDay()]})`;
}

export function fmtDateLong(d: Date): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 (${WEEKDAYS_JA[d.getDay()]})`;
}

/** datetime-local 入力フォーマット */
export function toDateTimeInputValue(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/** datetime-local 入力値（ローカル時刻）を ISO8601 (UTC) に変換 */
export function fromDateTimeInputValue(value: string): string {
  return new Date(value).toISOString();
}

/** イベントカラーをチャンネル色から導出（チャンネル未指定なら primary 色） */
export function colorFromChannelId(
  channelId: number | null,
  channelColors: Map<number, string>,
  fallback = '#1976d2',
): string {
  if (channelId === null) return fallback;
  return channelColors.get(channelId) ?? fallback;
}

import { hashString } from './avatarColor';

const CHANNEL_PALETTE = [
  '#1976d2',
  '#d81b60',
  '#388e3c',
  '#f57c00',
  '#7b1fa2',
  '#0097a7',
  '#5d4037',
  '#455a64',
];

/** チャンネル名から決定論的に色を生成（モック準拠の色味を踏襲） */
export function channelColorFromName(name: string): string {
  if (!name) return CHANNEL_PALETTE[0];
  return CHANNEL_PALETTE[Math.abs(hashString(name)) % CHANNEL_PALETTE.length];
}
