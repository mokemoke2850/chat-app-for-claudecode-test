/** タグ名を正規化する（前後空白除去・小文字化）。サーバー側の normalizeTagName と同一ロジック。 */
export function normalizeTagName(name: string): string {
  return name.trim().toLowerCase();
}
