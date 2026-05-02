/**
 * テスト対象: utils/parseSearchChips.ts (Step 7c-1)
 *
 * 検索クエリ文字列を Slack 風のチップ構文でパースする純粋関数。
 * 認識する構文:
 *   - from:username      → fromUsername
 *   - in:channelname     → inChannelName
 *   - has:file           → hasFile = true
 *   - before:YYYY-MM-DD  → beforeDate
 *   - after:YYYY-MM-DD   → afterDate
 *   - tag:tagname        → tagName (1 件のみ Step 7c-1 では対応)
 *   - それ以外           → keyword (空白区切りで結合)
 *
 * `has:link` は Step 7c スコープ外。
 *
 * 戦略: 同期関数なので props/state なし、純粋にテキスト → 構造化オブジェクトの変換テスト
 */

import { describe, it, expect } from 'vitest';
import { parseSearchChips } from '../parseSearchChips';

describe('parseSearchChips (Step 7c-1)', () => {
  describe('キーワードのみ', () => {
    it('プレーンテキストはすべて keyword に入る', () => {
      expect(parseSearchChips('hello')).toEqual({ keyword: 'hello' });
    });

    it('複数単語は空白区切りで keyword に結合される', () => {
      expect(parseSearchChips('hello world foo')).toEqual({ keyword: 'hello world foo' });
    });

    it('空文字 / 空白のみは keyword が空文字になる', () => {
      expect(parseSearchChips('').keyword).toBe('');
      expect(parseSearchChips('   ').keyword).toBe('');
    });
  });

  describe('チップ構文', () => {
    it('from:alice から fromUsername=alice を抽出する', () => {
      const r = parseSearchChips('from:alice');
      expect(r.fromUsername).toBe('alice');
      expect(r.keyword).toBe('');
    });

    it('in:general から inChannelName=general を抽出する', () => {
      const r = parseSearchChips('in:general');
      expect(r.inChannelName).toBe('general');
    });

    it('has:file から hasFile=true を抽出する', () => {
      const r = parseSearchChips('has:file');
      expect(r.hasFile).toBe(true);
    });

    it('before:2026-01-01 から beforeDate=2026-01-01 を抽出する', () => {
      const r = parseSearchChips('before:2026-01-01');
      expect(r.beforeDate).toBe('2026-01-01');
    });

    it('after:2026-01-01 から afterDate=2026-01-01 を抽出する', () => {
      const r = parseSearchChips('after:2026-01-01');
      expect(r.afterDate).toBe('2026-01-01');
    });

    it('tag:urgent から tagName=urgent を抽出する', () => {
      const r = parseSearchChips('tag:urgent');
      expect(r.tagName).toBe('urgent');
    });
  });

  describe('複数構文の組み合わせ', () => {
    it('from:alice has:file 議事録 から keyword=議事録 / fromUsername=alice / hasFile=true を抽出', () => {
      const r = parseSearchChips('from:alice has:file 議事録');
      expect(r.keyword).toBe('議事録');
      expect(r.fromUsername).toBe('alice');
      expect(r.hasFile).toBe(true);
    });

    it('構文の出現順は問わない', () => {
      const r1 = parseSearchChips('議事録 from:alice has:file');
      const r2 = parseSearchChips('has:file 議事録 from:alice');
      expect(r1.keyword).toBe('議事録');
      expect(r2.keyword).toBe('議事録');
      expect(r1.fromUsername).toBe('alice');
      expect(r2.fromUsername).toBe('alice');
      expect(r1.hasFile).toBe(true);
      expect(r2.hasFile).toBe(true);
    });

    it('構文と通常テキストが混在しても適切に分離される', () => {
      const r = parseSearchChips('リリース from:alice in:general 計画');
      expect(r.keyword).toBe('リリース 計画');
      expect(r.fromUsername).toBe('alice');
      expect(r.inChannelName).toBe('general');
    });
  });

  describe('エッジケース', () => {
    it('値が空の構文 (from:) はキーワードとして扱われる', () => {
      const r = parseSearchChips('from: hello');
      expect(r.fromUsername).toBeUndefined();
      expect(r.keyword).toBe('from: hello');
    });

    it('日付の形式が不正な before:invalid はキーワードとして扱われる', () => {
      const r = parseSearchChips('before:invalid');
      expect(r.beforeDate).toBeUndefined();
      expect(r.keyword).toBe('before:invalid');
    });

    it('has:invalid (file 以外) はキーワードとして扱われる', () => {
      const r = parseSearchChips('has:link');
      expect(r.hasFile).toBeUndefined();
      expect(r.keyword).toBe('has:link');
    });

    it('未知のプレフィックス foo:bar はキーワードとして扱われる', () => {
      const r = parseSearchChips('foo:bar');
      expect(r.keyword).toBe('foo:bar');
    });
  });
});
