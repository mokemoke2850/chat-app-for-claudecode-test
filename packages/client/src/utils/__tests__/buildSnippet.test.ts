/**
 * テスト対象: utils/buildSnippet.ts (Step 7c-2)
 *
 * 検索結果に表示するスニペット (前後 N 文字を抜粋 + マッチ部分を分離) を生成する純粋関数。
 *
 * 出力形式:
 *   { before: string, match: string, after: string }
 *   - before: マッチ部分の前のテキスト (必要に応じて先頭省略記号 …)
 *   - match : マッチ部分の本体
 *   - after : マッチ部分の後のテキスト (必要に応じて末尾省略記号 …)
 *
 * keyword が空 / マッチしない場合は match='', before=テキスト先頭抜粋, after='' を返す。
 *
 * 戦略: 同期関数なので props/state なし、純粋に文字列入出力を検証する。
 */

import { describe, it, expect } from 'vitest';
import { buildSnippet } from '../buildSnippet';

describe('buildSnippet (Step 7c-2)', () => {
  describe('キーワードなし / 未マッチ', () => {
    it('keyword が空文字のとき、本文の先頭抜粋を before に返し match / after は空文字', () => {
      const r = buildSnippet('hello world', '');
      expect(r.before).toBe('hello world');
      expect(r.match).toBe('');
      expect(r.after).toBe('');
    });

    it('keyword がテキストに含まれないとき、本文の先頭抜粋を before に返し match は空文字', () => {
      const r = buildSnippet('hello world', 'xyz');
      expect(r.match).toBe('');
      expect(r.before).toBe('hello world');
    });

    it('テキストが maxLength より短いときは省略記号を付けない', () => {
      const r = buildSnippet('short', '', { maxLength: 80 });
      expect(r.before).toBe('short');
      expect(r.before.endsWith('…')).toBe(false);
    });

    it('テキストが maxLength より長いときは末尾に省略記号を付ける', () => {
      const long = 'あ'.repeat(100);
      const r = buildSnippet(long, '', { maxLength: 50 });
      expect(r.before.endsWith('…')).toBe(true);
      // 抜粋本体は 50 文字 + 省略記号 1 文字
      expect(r.before.length).toBe(51);
    });
  });

  describe('マッチあり', () => {
    it('テキスト中央でマッチするとき、前後 N 文字を抜粋し before に先頭省略 / after に末尾省略を付ける', () => {
      const text = 'A'.repeat(50) + 'TARGET' + 'B'.repeat(50);
      const r = buildSnippet(text, 'TARGET', { contextLength: 10 });
      expect(r.match).toBe('TARGET');
      expect(r.before.startsWith('…')).toBe(true);
      expect(r.before.endsWith('A'.repeat(10))).toBe(true);
      expect(r.after.startsWith('B'.repeat(10))).toBe(true);
      expect(r.after.endsWith('…')).toBe(true);
    });

    it('テキスト先頭でマッチするとき、before に先頭省略は付かない', () => {
      const text = 'TARGET' + 'B'.repeat(50);
      const r = buildSnippet(text, 'TARGET', { contextLength: 10 });
      expect(r.before).toBe('');
      expect(r.match).toBe('TARGET');
      expect(r.after.startsWith('B'.repeat(10))).toBe(true);
      expect(r.after.endsWith('…')).toBe(true);
    });

    it('テキスト末尾でマッチするとき、after に末尾省略は付かない', () => {
      const text = 'A'.repeat(50) + 'TARGET';
      const r = buildSnippet(text, 'TARGET', { contextLength: 10 });
      expect(r.match).toBe('TARGET');
      expect(r.after).toBe('');
      expect(r.before.startsWith('…')).toBe(true);
      expect(r.before.endsWith('A'.repeat(10))).toBe(true);
    });

    it('大文字小文字を無視してマッチする (HELLO で hello を検索)', () => {
      const r = buildSnippet('Hello WORLD', 'hello');
      expect(r.match).toBe('Hello'); // 元のケースを保持
    });

    it('複数マッチがある場合は最初のマッチを基準にする', () => {
      const text = 'first FOO middle FOO last';
      const r = buildSnippet(text, 'foo', { contextLength: 100 });
      // 最初のマッチ (位置 6) が match に
      expect(r.match).toBe('FOO');
      // before に "first " (6 文字), 末尾省略なし (after にもう一つの FOO が含まれる)
      expect(r.before).toBe('first ');
      expect(r.after).toBe(' middle FOO last');
    });

    it('マッチ部分は元の大文字小文字を保持する (検索が小文字でも match は大文字のまま)', () => {
      const r = buildSnippet('TARGET word', 'target');
      expect(r.match).toBe('TARGET');
    });
  });

  describe('エッジケース', () => {
    it('text が空文字のとき、すべて空文字で返る', () => {
      const r = buildSnippet('', 'foo');
      expect(r.before).toBe('');
      expect(r.match).toBe('');
      expect(r.after).toBe('');
    });

    it('text と keyword が完全一致のとき、match 全体 / before / after が空', () => {
      const r = buildSnippet('hello', 'hello');
      expect(r.match).toBe('hello');
      expect(r.before).toBe('');
      expect(r.after).toBe('');
    });
  });
});
