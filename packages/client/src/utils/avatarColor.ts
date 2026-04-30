/**
 * メールアドレスから決定論的なアバター背景色を生成する
 * 同じメールアドレスに対して常に同じ色を返す
 */

const PALETTE = [
  '#e53935',
  '#d81b60',
  '#8e24aa',
  '#5e35b1',
  '#3949ab',
  '#1e88e5',
  '#039be5',
  '#00897b',
  '#43a047',
  '#7cb342',
  '#f4511e',
  '#fb8c00',
  '#f6bf26',
  '#33691e',
  '#00695c',
  '#4527a0',
];

/** 文字列からの djb2 風ハッシュ。決定論的な色割当て等で利用する */
export function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = s.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  return hash;
}

export function getAvatarColor(email: string): string {
  if (!email) return PALETTE[0];
  return PALETTE[Math.abs(hashString(email)) % PALETTE.length];
}
