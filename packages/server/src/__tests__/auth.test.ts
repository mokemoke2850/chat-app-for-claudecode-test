/**
 * AuthService のユニットテスト
 *
 * テスト対象: packages/server/src/services/authService.ts
 * - register: ユーザー登録（bcrypt ハッシュ化 + DB 挿入）
 * - login: メール・パスワードによる認証
 * - getUserById: ID でユーザーを取得
 * - getAllUsers: 全ユーザーを一覧取得
 *
 * DB 戦略: better-sqlite3 のインメモリ DB を使用し、
 * 本番 DB に影響を与えずに各テストを独立して実行できるようにしている。
 */

import { register, login, getUserById, getAllUsers } from '../services/authService';
import { initializeSchema } from '../db/database';

// 本番 DB モジュールをインメモリ SQLite に差し替える
// jest.requireActual で実際のスキーマ初期化ロジックを流用し、
// テスト用 DB を本番と同じ構造で構築する
jest.mock('../db/database', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const DatabaseLib = require('better-sqlite3') as typeof import('better-sqlite3');
  const db = new DatabaseLib(':memory:');
  db.pragma('foreign_keys = ON');
  const { initializeSchema: init } = jest.requireActual<typeof import('../db/database')>('../db/database');
  init(db);
  return {
    getDatabase: () => db,
    initializeSchema: init,
    closeDatabase: jest.fn(),
  };
});

describe('AuthService', () => {
  describe('register', () => {
    it('新規ユーザーを作成し、password_hash を含まないユーザーオブジェクトを返す', async () => {
      const user = await register('alice', 'alice@example.com', 'password123');

      // id が自動採番されていること
      expect(user.id).toBeDefined();
      expect(user.username).toBe('alice');
      expect(user.email).toBe('alice@example.com');
      // パスワードハッシュはセキュリティ上レスポンスに含めない
      expect((user as unknown as Record<string, unknown>)['password_hash']).toBeUndefined();
    });

    it('同じユーザー名で登録しようとすると 409 を投げる', async () => {
      await register('bob', 'bob@example.com', 'password123');

      // ユーザー名の一意制約違反 → 409 Conflict
      await expect(register('bob', 'other@example.com', 'password123')).rejects.toMatchObject({
        statusCode: 409,
      });
    });

    it('同じメールアドレスで登録しようとすると 409 を投げる', async () => {
      await register('charlie', 'charlie@example.com', 'password123');

      // メールの一意制約違反 → 409 Conflict
      await expect(register('charlie2', 'charlie@example.com', 'password123')).rejects.toMatchObject({
        statusCode: 409,
      });
    });
  });

  describe('login', () => {
    // login テスト全体で使用するユーザーを事前に登録する
    beforeAll(async () => {
      await register('loginuser', 'loginuser@example.com', 'correct-password');
    });

    it('正しい認証情報でログインするとユーザーを返す', async () => {
      const user = await login('loginuser@example.com', 'correct-password');
      expect(user.username).toBe('loginuser');
    });

    it('パスワードが間違っている場合は 401 を投げる', async () => {
      // bcrypt.compare が false を返すケース
      await expect(login('loginuser@example.com', 'wrong-password')).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it('存在しないメールアドレスで認証しようとすると 401 を投げる', async () => {
      // ユーザーが見つからないケース（情報漏洩防止のため 404 ではなく 401 を返す）
      await expect(login('nobody@example.com', 'password')).rejects.toMatchObject({
        statusCode: 401,
      });
    });
  });

  describe('getUserById', () => {
    it('存在する ID を渡すとユーザーを返す', async () => {
      const created = await register('dave', 'dave@example.com', 'password');
      const found = getUserById(created.id);
      expect(found?.username).toBe('dave');
    });

    it('存在しない ID を渡すと null を返す', () => {
      expect(getUserById(99999)).toBeNull();
    });
  });

  describe('getAllUsers', () => {
    it('ユーザー一覧を配列で返す', () => {
      const users = getAllUsers();
      expect(Array.isArray(users)).toBe(true);
    });
  });
});

// initializeSchema は jest.requireActual 経由でのみ使用しているため、
// TypeScript の未使用インポートエラーを抑制するための参照
void initializeSchema;
