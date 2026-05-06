/**
 * テスト対象: アクセントカラー機能（サーバサイド / #274）
 *
 * 戦略:
 *   - pg-mem のインメモリ PostgreSQL 互換 DB を使い HTTP エンドポイントを検証する
 *   - GET /api/auth/me で users.accent_color が camelCase（accentColor）で返ることを確認する
 *   - PUT /api/users/me/accent-color または PATCH /api/auth/profile で accentColor を更新できることを確認する
 *   - プリセット外の値（任意 hex / 不正文字列 / 空文字）は 400 を返すバリデーションを確認する
 *   - 認証なしのアクセスは 401 を返すことを確認する
 *
 *   プリセット値は 'blue' / 'purple' / 'green' / 'orange' / 'red' の 5 種類を想定する。
 */

import { describe, it } from '@jest/globals';

describe('アクセントカラー機能', () => {
  describe('GET /api/auth/me で accent_color が返る', () => {
    it.todo('未設定ユーザーの GET /api/auth/me レスポンスに accentColor: null が含まれる');
    it.todo(
      'accent_color を設定済みのユーザーの GET /api/auth/me レスポンスに保存値（例: "purple"）が含まれる',
    );
  });

  describe('accentColor の更新', () => {
    it.todo('プリセット値（例: "purple"）で更新リクエストを送ると 200 が返り DB に保存される');
    it.todo('更新後の GET /api/auth/me で新しい accentColor が返る');
    it.todo('null を送ると accentColor をクリアできる（DB 値が NULL になる）');
  });

  describe('プリセット外の値の拒否', () => {
    it.todo('任意の hex 値（例: "#FF00AA"）を送ると 400 が返る');
    it.todo('プリセット外の文字列（例: "rainbow"）を送ると 400 が返る');
  });

  describe('認証チェック', () => {
    it.todo('認証 Cookie なしで accentColor 更新エンドポイントを叩くと 401 が返る');
  });
});
