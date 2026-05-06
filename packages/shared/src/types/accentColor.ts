/**
 * アクセントカラー機能（#274）の共有型定義。
 * users.accent_color に保存するプリセット名と、各プリセットの hex 値マップ。
 */

/** プリセットの名前 */
export type AccentColor = 'blue' | 'purple' | 'green' | 'orange' | 'red';

/** 利用可能なプリセット一覧（バリデーションで使う） */
export const ACCENT_COLORS: readonly AccentColor[] = [
  'blue',
  'purple',
  'green',
  'orange',
  'red',
] as const;

/** プリセット → hex カラーのマッピング（MUI palette.primary に使う） */
export const ACCENT_COLOR_HEX: Record<AccentColor, string> = {
  blue: '#1976d2',
  purple: '#7b1fa2',
  green: '#2e7d32',
  orange: '#ed6c02',
  red: '#d32f2f',
};

/** デフォルトアクセントカラー（user.accentColor が null の場合に使う） */
export const DEFAULT_ACCENT_COLOR: AccentColor = 'blue';

/** 任意の値が AccentColor プリセットかどうかを判定する */
export function isAccentColor(value: unknown): value is AccentColor {
  return typeof value === 'string' && (ACCENT_COLORS as readonly string[]).includes(value);
}
