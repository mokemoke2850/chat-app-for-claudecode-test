/**
 * 初回ユーザー自動 admin 昇格の統合テスト
 *
 * テスト対象: packages/server/src/services/authService.ts register()
 * 戦略: このファイル専用の pg-mem インメモリ DB を使い、ユーザー 0 人の状態から
 * 登録を行うことで「最初のユーザーが admin になる」仕様を確定的に検証する。
 * 他テストスイートと DB を共有すると countBefore > 0 になり検証できないため分離している。
 */

import { createTestDatabase } from '../__fixtures__/pgTestHelper';

const testDb = createTestDatabase();

jest.mock('../../db/database', () => testDb);

import request from 'supertest';
import { createApp } from '../../app';

const app = createApp();

describe('register: 初回ユーザーが自動で admin になる', () => {
  it('DBにユーザーが0人の時、最初に登録したユーザーのroleがadminになる', async () => {
    // このファイル専用 DB はテスト開始時点でユーザーが 0 人であることを確認
    const countRow = await testDb.queryOne<{ cnt: string }>('SELECT COUNT(*) as cnt FROM users');
    expect(Number(countRow!.cnt)).toBe(0);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'first_admin', email: 'first_admin@example.com', password: 'password123' });

    expect(res.status).toBe(201);
    const row = await testDb.queryOne<{ role: string }>(
      "SELECT role FROM users WHERE username = $1",
      ['first_admin'],
    );
    expect(row?.role).toBe('admin');
  });

  it('2人目以降に登録したユーザーのroleはuserになる', async () => {
    // 前テストで first_admin が登録済み → 2人目は user になる
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'second_user', email: 'second_user@example.com', password: 'password123' });

    expect(res.status).toBe(201);
    const row = await testDb.queryOne<{ role: string }>(
      "SELECT role FROM users WHERE username = $1",
      ['second_user'],
    );
    expect(row?.role).toBe('user');
  });
});
