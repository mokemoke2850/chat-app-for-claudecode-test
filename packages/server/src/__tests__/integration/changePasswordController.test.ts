/**
 * PATCH /api/auth/password エンドポイントの統合テスト
 *
 * テスト対象: パスワード変更機能
 * 戦略: supertest で HTTP リクエストを発行し、レスポンスのステータスコードと
 * レスポンスボディを検証する。DB は pg-mem のインメモリ PostgreSQL 互換 DB を使用。
 */

import { createTestDatabase } from '../__fixtures__/pgTestHelper';

const testDb = createTestDatabase();

jest.mock('../../db/database', () => testDb);

import request from 'supertest';
import { createApp } from '../../app';
import { registerAndGetCookie } from '../__fixtures__/testHelpers';
import { generateToken } from '../../middleware/auth';

const app = createApp();

describe('PATCH /api/auth/password（パスワード変更）', () => {
  let token: string;
  let userId: number;
  const currentPassword = 'current-password123';

  beforeAll(async () => {
    const result = await registerAndGetCookie(app, 'pw_change_user', 'pw_change@example.com', currentPassword);
    userId = result.userId;
    token = generateToken(userId, 'pw_change_user');
  });

  describe('認証チェック', () => {
    it('未認証（トークンなし）の場合は 401 が返る', async () => {
      // TODO
    });
  });

  describe('バリデーション', () => {
    it('currentPassword が欠けている場合は 400 が返る', async () => {
      // TODO
    });

    it('newPassword が欠けている場合は 400 が返る', async () => {
      // TODO
    });

    it('newPassword が最小文字数（8文字）未満の場合は 400 が返る', async () => {
      // TODO
    });

    it('newPassword と confirmPassword が一致しない場合は 400 が返る', async () => {
      // TODO
    });
  });

  describe('パスワード検証', () => {
    it('currentPassword が現在のパスワードと一致しない場合は 401 が返る', async () => {
      // TODO
    });
  });

  describe('正常系', () => {
    it('正しい currentPassword と有効な newPassword を渡すと 200 が返る', async () => {
      // TODO
    });

    it('パスワード変更後、新しいパスワードでログインできる', async () => {
      // TODO
    });

    it('パスワード変更後、古いパスワードではログインできない', async () => {
      // TODO
    });
  });
});
