/**
 * テスト対象: tagService の純粋ロジック（タグ名正規化・バリデーション）
 * 戦略:
 *   - DB を介さず、エクスポートされたユーティリティ関数（normalizeTagName / validateTagName 相当）を
 *     直接呼び出し、入力 → 期待値の対応を網羅的に検証する。
 *   - findOrCreate のロジック（同名重複排除）も pg-mem を使って単独で確認する。
 */

import { createTestDatabase } from '../__fixtures__/pgTestHelper';

const testDb = createTestDatabase();

jest.mock('../../db/database', () => testDb);

import { normalizeTagName, validateTagName, findOrCreate } from '../../services/tagService';

describe('tagService - 純粋ロジック', () => {
  describe('normalizeTagName (タグ名正規化)', () => {
    it('前後の空白を除去する', () => {
      expect(normalizeTagName('  bug  ')).toBe('bug');
    });

    it('英大文字を小文字に変換する', () => {
      expect(normalizeTagName('Bug')).toBe('bug');
      expect(normalizeTagName('BUG')).toBe('bug');
    });

    it('全角空白も前後から除去する', () => {
      expect(normalizeTagName('　bug　')).toBe('bug');
    });

    it('内部の空白はそのまま残る (中間空白は normalize しない / バリデーションで弾く)', () => {
      expect(normalizeTagName(' bu g ')).toBe('bu g');
    });

    it('日本語タグはそのまま小文字化されない (大文字小文字概念のない文字は変化しない)', () => {
      expect(normalizeTagName('バグ')).toBe('バグ');
    });

    it('絵文字を含むタグもそのまま保持される', () => {
      expect(normalizeTagName('🐛bug')).toBe('🐛bug');
    });
  });

  describe('validateTagName (タグ名バリデーション)', () => {
    it('空文字は不正として例外を投げる', () => {
      expect(() => validateTagName('')).toThrow();
    });

    it('空白のみの文字列は不正として例外を投げる', () => {
      expect(() => validateTagName('   ')).toThrow();
    });

    it('1 文字のタグ名は許可される', () => {
      expect(() => validateTagName('a')).not.toThrow();
    });

    it('50 文字ちょうどのタグ名は許可される (境界値)', () => {
      expect(() => validateTagName('a'.repeat(50))).not.toThrow();
    });

    it('51 文字以上のタグ名は不正として例外を投げる', () => {
      expect(() => validateTagName('a'.repeat(51))).toThrow();
    });

    it('"#" を含むタグ名は不正として例外を投げる (UI 側で # を切り落とす想定)', () => {
      expect(() => validateTagName('#bug')).toThrow();
    });

    it('内部に空白を含むタグ名は不正として例外を投げる', () => {
      expect(() => validateTagName('bu g')).toThrow();
    });
  });

  describe('findOrCreate - 一意性保証', () => {
    beforeEach(async () => {
      await testDb.execute('DELETE FROM tags', []);
    });

    it('同じ正規化結果になる入力 ("Bug" / "BUG" / "bug") はすべて同じ ID を返す', async () => {
      // findOrCreate は raw 入力に空白文字を許さない仕様（validateTagName で弾く）。
      // よって正規化結果が一致する大文字小文字違いのみでテストする。
      const a = await findOrCreate('Bug');
      const b = await findOrCreate('BUG');
      const c = await findOrCreate('bug');
      expect(b.id).toBe(a.id);
      expect(c.id).toBe(a.id);
      expect(a.name).toBe('bug');
    });

    it('並行に同名タグの findOrCreate が走っても unique 制約により最終的に 1 行に収束する', async () => {
      const results = await Promise.all([
        findOrCreate('parallel'),
        findOrCreate('parallel'),
        findOrCreate('parallel'),
      ]);
      const ids = new Set(results.map((r) => r.id));
      expect(ids.size).toBe(1);
      const rows = await testDb.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM tags WHERE name = 'parallel'",
        [],
      );
      expect(parseInt(rows[0].count, 10)).toBe(1);
    });
  });
});
