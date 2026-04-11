/**
 * utils/avatarColor.ts のユニットテスト
 *
 * テスト対象: メールアドレスからアバター背景色を生成するユーティリティ
 * 戦略:
 *   - 純粋関数のため DOM 不要、入出力のみを検証する
 */

import { describe, it, expect } from 'vitest';
import { getAvatarColor } from '../utils/avatarColor';

describe('getAvatarColor', () => {
  describe('戻り値の形式', () => {
    it('有効な CSS カラー文字列（# 始まりの16進数）を返す', () => {
      const color = getAvatarColor('alice@example.com');
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });

  describe('決定論的な動作', () => {
    it('同じメールアドレスを渡すと常に同じ色を返す', () => {
      const email = 'alice@example.com';
      expect(getAvatarColor(email)).toBe(getAvatarColor(email));
    });

    it('異なるメールアドレスは異なる色を返す可能性がある', () => {
      const color1 = getAvatarColor('alice@example.com');
      const color2 = getAvatarColor('bob@example.com');
      // 全ての異なるメールが必ず違う色とは限らないが、この2つは違う色であることを確認する
      expect(color1).not.toBe(color2);
    });
  });

  describe('エッジケース', () => {
    it('空文字列を渡してもエラーが起きず文字列を返す', () => {
      expect(() => getAvatarColor('')).not.toThrow();
      expect(typeof getAvatarColor('')).toBe('string');
    });
  });
});
