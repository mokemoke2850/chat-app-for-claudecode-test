/**
 * テスト対象: utils/extractMessageText.ts
 *
 * Inbox / Thread / Search で使うメッセージ本文のテキスト抽出関数。
 * Quill Delta JSON / TipTap JSON / プレーンテキストの 3 形式を判別して
 * 純粋テキストを返す。判別不能なときは空文字を返す（生 JSON を透けさせない）。
 */

import { describe, it, expect } from 'vitest';
import { extractMessageText } from '../extractMessageText';

describe('extractMessageText', () => {
  describe('Quill Delta 形式', () => {
    it('{ ops: [{ insert: "hello" }] } から "hello" を返す', () => {
      const raw = JSON.stringify({ ops: [{ insert: 'hello' }] });
      expect(extractMessageText(raw)).toBe('hello');
    });

    it('複数の insert を結合して返す', () => {
      const raw = JSON.stringify({
        ops: [{ insert: 'foo ' }, { insert: 'bar' }, { insert: ' baz' }],
      });
      expect(extractMessageText(raw)).toBe('foo bar baz');
    });

    it('object insert (mention / image 等) は無視して文字列 insert のみ抽出する', () => {
      const raw = JSON.stringify({
        ops: [
          { insert: 'こんにちは ' },
          { insert: { mention: { value: 'alice' } } },
          { insert: ' さん' },
        ],
      });
      expect(extractMessageText(raw)).toBe('こんにちは  さん');
    });

    it('末尾の連続改行を trim して返す', () => {
      const raw = JSON.stringify({ ops: [{ insert: 'message\n\n\n' }] });
      expect(extractMessageText(raw)).toBe('message');
    });
  });

  describe('TipTap JSON 形式', () => {
    it('{ type: "doc", content: [...] } を再帰的にたどって text を結合する', () => {
      const raw = JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'hello tiptap' }],
          },
        ],
      });
      expect(extractMessageText(raw)).toBe('hello tiptap');
    });

    it('複数の paragraph を改行ではなく単純結合（または空白挟み）で連結する', () => {
      const raw = JSON.stringify({
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: '一段目' }] },
          { type: 'paragraph', content: [{ type: 'text', text: '二段目' }] },
        ],
      });
      expect(extractMessageText(raw)).toBe('一段目二段目');
    });

    it('text プロパティを持たないノードは無視する', () => {
      const raw = JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'before' },
              { type: 'image', src: 'http://example.com/x.png' },
              { type: 'text', text: 'after' },
            ],
          },
        ],
      });
      expect(extractMessageText(raw)).toBe('beforeafter');
    });
  });

  describe('プレーンテキスト / フォールバック', () => {
    it('JSON でない文字列はそのまま返す（trim 済み）', () => {
      expect(extractMessageText('  普通の文字列  ')).toBe('普通の文字列');
    });

    it('空文字列は空文字を返す', () => {
      expect(extractMessageText('')).toBe('');
    });

    it('null / undefined は空文字を返す', () => {
      expect(extractMessageText(null)).toBe('');
      expect(extractMessageText(undefined)).toBe('');
    });

    it('構造不明な JSON ({ foo: "bar" } 等) は空文字を返す（生 JSON を透けさせない）', () => {
      expect(extractMessageText(JSON.stringify({ foo: 'bar' }))).toBe('');
      expect(extractMessageText(JSON.stringify([1, 2, 3]))).toBe('');
    });
  });
});
