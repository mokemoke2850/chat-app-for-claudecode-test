/**
 * AuthService のユニットテスト
 *
 * テスト対象: packages/server/src/services/authService.ts
 * - register: ユーザー登録（bcrypt ハッシュ化 + DB 挿入）
 * - login: メール・パスワードによる認証
 * - getUserById: ID でユーザーを取得
 * - getAllUsers: 全ユーザーを一覧取得
 *
 * DB 戦略: pg-mem のインメモリ PostgreSQL 互換 DB を使用し、
 * 本番 DB に影響を与えずに各テストを独立して実行できるようにしている。
 */

import { createTestDatabase } from '../__fixtures__/pgTestHelper';

const testDb = createTestDatabase();

jest.mock('../../db/database', () => testDb);

import { register, login, getUserById } from '../../services/authService';

describe('AuthService', () => {
  describe('register', () => {
    it('新規ユーザーを作成し、password_hash を含まないユーザーオブジェクトを返す', async () => {
      const user = await register('alice', 'alice@example.com', 'password123');

      expect(user.id).toBeDefined();
      expect(user.username).toBe('alice');
      expect(user.email).toBe('alice@example.com');
      expect((user as unknown as Record<string, unknown>)['password_hash']).toBeUndefined();
    });

    it('同じユーザー名で登録しようとすると 409 を投げる', async () => {
      await register('bob', 'bob@example.com', 'password123');

      await expect(register('bob', 'other@example.com', 'password123')).rejects.toMatchObject({
        statusCode: 409,
      });
    });

    it('同じメールアドレスで登録しようとすると 409 を投げる', async () => {
      await register('charlie', 'charlie@example.com', 'password123');

      await expect(
        register('charlie2', 'charlie@example.com', 'password123'),
      ).rejects.toMatchObject({
        statusCode: 409,
      });
    });
  });

  describe('login', () => {
    beforeAll(async () => {
      await register('loginuser', 'loginuser@example.com', 'correct-password');
    });

    it('正しい認証情報でログインするとユーザーを返す', async () => {
      const user = await login('loginuser@example.com', 'correct-password');
      expect(user.username).toBe('loginuser');
    });

    it('パスワードが間違っている場合は 401 を投げる', async () => {
      await expect(login('loginuser@example.com', 'wrong-password')).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it('存在しないメールアドレスで認証しようとすると 401 を投げる', async () => {
      await expect(login('nobody@example.com', 'password')).rejects.toMatchObject({
        statusCode: 401,
      });
    });
  });

  describe('getUserById', () => {
    it('存在する ID を渡すとユーザーを返す', async () => {
      const created = await register('dave', 'dave@example.com', 'password');
      const found = await getUserById(created.id);
      expect(found?.username).toBe('dave');
    });

    it('存在しない ID を渡すと null を返す', async () => {
      expect(await getUserById(99999)).toBeNull();
    });
  });
});
