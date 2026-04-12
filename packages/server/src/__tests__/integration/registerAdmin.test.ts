/**
 * 初回ユーザー自動 admin 昇格の統合テスト
 *
 * テスト対象: packages/server/src/services/authService.ts register()
 * 戦略: このファイル専用のインメモリ DB を使い、ユーザー 0 人の状態から
 * 登録を行うことで「最初のユーザーが admin になる」仕様を確定的に検証する。
 * 他テストスイートと DB を共有すると countBefore > 0 になり検証できないため分離している。
 *
 * DB をファクトリ内で生成するのは jest.mock がホイスティングされるため。
 * let/const は TDZ（一時的デッドゾーン）があり、ホイスティングされたファクトリから
 * 代入できないため var を使う（var はホイスティング後も undefined で初期化済み扱いになる）。
 */

import request from 'supertest';
import type Database from 'better-sqlite3';
import { createApp } from '../../app';

// jest.mock ファクトリがホイスティングされるため var で宣言（TDZ 回避）
 
var isolatedDb: Database.Database;

jest.mock('../../db/database', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const DatabaseLib = require('better-sqlite3') as typeof import('better-sqlite3');
  isolatedDb = new DatabaseLib(':memory:');
  isolatedDb.pragma('foreign_keys = ON');
  const { initializeSchema: init } =
    jest.requireActual<typeof import('../../db/database')>('../../db/database');
  init(isolatedDb);
  return {
    getDatabase: () => isolatedDb,
    initializeSchema: init,
    closeDatabase: jest.fn(),
  };
});

const app = createApp();

describe('register: 初回ユーザーが自動で admin になる', () => {
  it('DBにユーザーが0人の時、最初に登録したユーザーのroleがadminになる', async () => {
    // このファイル専用 DB はテスト開始時点でユーザーが 0 人であることを確認
    const count = (isolatedDb.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number })
      .cnt;
    expect(count).toBe(0);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'first_admin', email: 'first_admin@example.com', password: 'password123' });

    expect(res.status).toBe(201);
    const row = isolatedDb
      .prepare('SELECT role FROM users WHERE username = ?')
      .get('first_admin') as { role: string } | undefined;
    expect(row?.role).toBe('admin');
  });

  it('2人目以降に登録したユーザーのroleはuserになる', async () => {
    // 前テストで first_admin が登録済み → 2人目は user になる
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'second_user', email: 'second_user@example.com', password: 'password123' });

    expect(res.status).toBe(201);
    const row = isolatedDb
      .prepare('SELECT role FROM users WHERE username = ?')
      .get('second_user') as { role: string } | undefined;
    expect(row?.role).toBe('user');
  });
});
