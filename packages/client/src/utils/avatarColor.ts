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

export function getAvatarColor(email: string): string {
  if (!email) return PALETTE[0];
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
