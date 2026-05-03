/**
 * 検索クエリ文字列を Slack 風のチップ構文でパースする。
 *
 * 認識する構文:
 *   - from:username      → fromUsername
 *   - in:channelname     → inChannelName
 *   - has:file           → hasFile = true
 *   - before:YYYY-MM-DD  → beforeDate
 *   - after:YYYY-MM-DD   → afterDate
 *   - tag:tagname        → tagName (1 件のみ)
 *   - それ以外           → keyword (空白区切りで結合)
 *
 * `has:link` は未対応。
 *
 * パース結果はマスタデータ照合前の文字列ベース。
 * 親 (ChipFilterInput / SearchPage) で users / channels / tags 配列と照合して ID に変換する。
 */

export interface ParsedSearchChips {
  keyword: string;
  fromUsername?: string;
  inChannelName?: string;
  hasFile?: boolean;
  beforeDate?: string;
  afterDate?: string;
  tagName?: string;
}

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(text: string): boolean {
  if (!ISO_DATE_REGEX.test(text)) return false;
  const d = new Date(text);
  return !isNaN(d.getTime());
}

export function parseSearchChips(text: string): ParsedSearchChips {
  const result: ParsedSearchChips = { keyword: '' };
  const keywordParts: string[] = [];

  if (!text || text.trim() === '') {
    return result;
  }

  // 空白区切りでトークン分割
  const tokens = text.trim().split(/\s+/);

  for (const token of tokens) {
    const colonIdx = token.indexOf(':');
    if (colonIdx <= 0 || colonIdx === token.length - 1) {
      // プレフィックスなし or 値が空 → キーワード扱い
      keywordParts.push(token);
      continue;
    }
    const prefix = token.slice(0, colonIdx);
    const value = token.slice(colonIdx + 1);

    switch (prefix) {
      case 'from':
        if (result.fromUsername === undefined) result.fromUsername = value;
        else keywordParts.push(token);
        break;
      case 'in':
        if (result.inChannelName === undefined) result.inChannelName = value;
        else keywordParts.push(token);
        break;
      case 'has':
        if (value === 'file' && result.hasFile === undefined) {
          result.hasFile = true;
        } else {
          // has:link や has:invalid はキーワードとして扱う
          keywordParts.push(token);
        }
        break;
      case 'before':
        if (isValidDate(value) && result.beforeDate === undefined) {
          result.beforeDate = value;
        } else {
          keywordParts.push(token);
        }
        break;
      case 'after':
        if (isValidDate(value) && result.afterDate === undefined) {
          result.afterDate = value;
        } else {
          keywordParts.push(token);
        }
        break;
      case 'tag':
        if (result.tagName === undefined) result.tagName = value;
        else keywordParts.push(token);
        break;
      default:
        // 未知のプレフィックスはキーワード扱い
        keywordParts.push(token);
        break;
    }
  }

  result.keyword = keywordParts.join(' ');
  return result;
}
