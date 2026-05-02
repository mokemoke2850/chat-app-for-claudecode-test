/**
 * 検索結果のスニペット生成 (Step 7c-2)。
 *
 * keyword に対する text 中の最初のマッチを基準に、前後 N 文字を抜粋して返す。
 * マッチ部分は元の大文字小文字を保持して `match` フィールドに切り出す。
 *
 * 出力:
 *   - `before`: マッチ部分の前のテキスト (必要に応じて先頭省略記号 `…`)
 *   - `match` : マッチ部分の本体 (= keyword 長と同じ、元のケース)
 *   - `after` : マッチ部分の後のテキスト (必要に応じて末尾省略記号 `…`)
 *
 * keyword が空 / マッチしない場合は { before: text 先頭抜粋, match: '', after: '' }。
 *
 * 大文字小文字を無視してマッチする。複数マッチは最初のみ。
 */

export interface SnippetParts {
  before: string;
  match: string;
  after: string;
}

interface Options {
  /** マッチ前後それぞれの抜粋文字数 (デフォルト 30) */
  contextLength?: number;
  /** keyword なしのときの先頭抜粋最大長 (デフォルト 80) */
  maxLength?: number;
  /** 省略記号 (デフォルト `…`) */
  ellipsis?: string;
}

const DEFAULT_CONTEXT = 30;
const DEFAULT_MAX = 80;
const DEFAULT_ELLIPSIS = '…';

export function buildSnippet(text: string, keyword: string, options: Options = {}): SnippetParts {
  const contextLength = options.contextLength ?? DEFAULT_CONTEXT;
  const maxLength = options.maxLength ?? DEFAULT_MAX;
  const ellipsis = options.ellipsis ?? DEFAULT_ELLIPSIS;

  if (!text) return { before: '', match: '', after: '' };

  const trimmedKeyword = keyword.trim();

  // keyword なし / マッチしない → 先頭抜粋
  if (trimmedKeyword === '') {
    return buildHeadSnippet(text, maxLength, ellipsis);
  }

  const lowerText = text.toLowerCase();
  const lowerKeyword = trimmedKeyword.toLowerCase();
  const matchIdx = lowerText.indexOf(lowerKeyword);

  if (matchIdx === -1) {
    return buildHeadSnippet(text, maxLength, ellipsis);
  }

  const matchEnd = matchIdx + trimmedKeyword.length;
  const matchText = text.slice(matchIdx, matchEnd);

  // 前後抜粋
  const beforeStart = Math.max(0, matchIdx - contextLength);
  const afterEnd = Math.min(text.length, matchEnd + contextLength);

  let before = text.slice(beforeStart, matchIdx);
  let after = text.slice(matchEnd, afterEnd);

  if (beforeStart > 0) before = ellipsis + before;
  if (afterEnd < text.length) after = after + ellipsis;

  return { before, match: matchText, after };
}

function buildHeadSnippet(text: string, maxLength: number, ellipsis: string): SnippetParts {
  if (text.length <= maxLength) {
    return { before: text, match: '', after: '' };
  }
  return { before: text.slice(0, maxLength) + ellipsis, match: '', after: '' };
}
