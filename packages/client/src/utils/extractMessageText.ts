/**
 * メッセージ本文 (Message.content) からプレーンテキストを抽出する。
 *
 * 想定フォーマット:
 *   1. Quill Delta JSON  — RichEditor が `JSON.stringify(quill.getContents())` で保存する形式。
 *      `{ ops: [{ insert: "..." | { mention: { value: "..." } } }, ...] }`
 *   2. TipTap JSON       — 旧データ・将来の互換用。`{ type: "doc", content: [{ type, text, content }, ...] }`
 *   3. プレーンテキスト   — JSON で parse できない場合（古いデータや単純な文字列）。
 *
 * 重要な振る舞い:
 *   - 判別不能な JSON（構造不明 / 想定外フォーマット）のときは **空文字を返す**。
 *     これにより、生 JSON 文字列が UI に透けて表示される事故を防ぐ。
 *   - null / undefined / 空文字は空文字を返す。
 */

interface QuillDelta {
  ops?: Array<{ insert?: unknown }>;
}

interface TipTapNode {
  type?: string;
  text?: string;
  content?: TipTapNode[];
}

function isQuillDelta(value: unknown): value is QuillDelta {
  return typeof value === 'object' && value !== null && Array.isArray((value as QuillDelta).ops);
}

function isTipTapDoc(value: unknown): value is TipTapNode {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as TipTapNode;
  return v.type === 'doc' && Array.isArray(v.content);
}

function extractFromQuill(delta: QuillDelta): string {
  return (
    delta.ops
      ?.map((op) => (typeof op.insert === 'string' ? op.insert : ''))
      .join('')
      .replace(/\n+$/, '') ?? ''
  );
}

function extractFromTipTap(node: TipTapNode): string {
  if (typeof node.text === 'string') return node.text;
  if (Array.isArray(node.content)) {
    return node.content.map(extractFromTipTap).join('');
  }
  return '';
}

export function extractMessageText(raw: string | null | undefined): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (trimmed === '') return '';

  // JSON parse に成功した場合のみフォーマット判別を試みる
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (isQuillDelta(parsed)) return extractFromQuill(parsed);
    if (isTipTapDoc(parsed)) return extractFromTipTap(parsed).trim();
    // 構造不明な JSON は空文字 (生 JSON を表示しない)
    return '';
  } catch {
    // JSON でない場合はプレーンテキストとしてそのまま返す
    return trimmed;
  }
}
