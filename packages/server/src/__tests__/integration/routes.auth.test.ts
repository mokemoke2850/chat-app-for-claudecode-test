/**
 * 認証ルートのインテグレーションテスト
 *
 * テスト対象: /api/auth/* のHTTPルート層全体
 * - authenticateToken ミドルウェアの適用確認
 * - Cookie パース → JWT検証 → req.userId 注入フロー
 * - next(err) → errorHandler → 適切なHTTPステータスコードへの変換
 *
 * DB 戦略: better-sqlite3 のインメモリ DB を使用
 */

import request from 'supertest';
import { createApp } from '../../app';

jest.mock('../../db/database', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const DatabaseLib = require('better-sqlite3') as typeof import('better-sqlite3');
  const db = new DatabaseLib(':memory:');
  db.pragma('foreign_keys = ON');
  const { initializeSchema } =
    jest.requireActual<typeof import('../../db/database')>('../../db/database');
  initializeSchema(db);
  return {
    getDatabase: () => db,
    initializeSchema,
    closeDatabase: jest.fn(),
  };
});

const app = createApp();

describe('POST /api/auth/register', () => {
  it('正常登録で201とユーザーオブジェクトを返す', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', email: 'alice@example.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ username: 'alice', email: 'alice@example.com' });
    expect(res.body.user.password_hash).toBeUndefined();
  });

  it('ボディ欠損で400を返す', async () => {
    const res = await request(app).post('/api/auth/register').send({ username: 'bob' }); // email, password 欠損

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('重複ユーザー名で409を返す', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'charlie', email: 'charlie@example.com', password: 'password123' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'charlie', email: 'other@example.com', password: 'password123' });

    expect(res.status).toBe(409);
  });

  it('重複メールアドレスで409を返す', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'dave', email: 'dave@example.com', password: 'password123' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'dave2', email: 'dave@example.com', password: 'password123' });

    expect(res.status).toBe(409);
  });

  it('登録成功時にSet-Cookieヘッダーが付与される', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'eve', email: 'eve@example.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.headers['set-cookie']).toBeDefined();
  });
});

describe('POST /api/auth/login', () => {
  beforeAll(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({
        username: 'logintest',
        email: 'logintest@example.com',
        password: 'correct-password',
      });
  });

  it('正しい認証情報で200とユーザーを返し、Set-Cookieが付与される', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'logintest@example.com', password: 'correct-password' });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ username: 'logintest' });
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('パスワード誤りで401を返す', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'logintest@example.com', password: 'wrong-password' });

    expect(res.status).toBe(401);
  });

  it('存在しないメールアドレスで401を返す', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'password' });

    expect(res.status).toBe(401);
  });

  it('ボディ欠損で400を返す', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'logintest@example.com' }); // password 欠損

    expect(res.status).toBe(400);
  });
});

describe('GET /api/auth/me', () => {
  let authCookie: string;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'meuser', email: 'meuser@example.com', password: 'password123' });
    authCookie = res.headers['set-cookie'][0] as string;
  });

  it('認証済みリクエストで200とユーザーを返す', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ username: 'meuser' });
  });

  it('トークンなしで401を返す（認証ガード適用確認）', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/users', () => {
  let authCookie: string;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'userstest', email: 'userstest@example.com', password: 'password123' });
    authCookie = res.headers['set-cookie'][0] as string;
  });

  it('認証済みリクエストで200とユーザー一覧を返す', async () => {
    const res = await request(app).get('/api/auth/users').set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
  });

  it('トークンなしで401を返す（認証ガード適用確認）', async () => {
    const res = await request(app).get('/api/auth/users');

    expect(res.status).toBe(401);
  });
});
