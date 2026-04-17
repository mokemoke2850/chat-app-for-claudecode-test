/**
 * authController のHTTPレベルテスト
 *
 * テスト対象: packages/server/src/controllers/authController.ts
 * 戦略: supertest でHTTPリクエストを発行し、レスポンスのステータスコードと
 * レスポンスボディを検証する。DB は pg-mem のインメモリ PostgreSQL 互換 DB を使用。
 */

import { createTestDatabase } from '../__fixtures__/pgTestHelper';

const testDb = createTestDatabase();

jest.mock('../../db/database', () => testDb);

import request from 'supertest';
import { createApp } from '../../app';
import { generateToken } from '../../middleware/auth';
import { registerAndGetCookie } from '../__fixtures__/testHelpers';

const app = createApp();

describe('POST /api/auth/register', () => {
  it('正常: 必須フィールドを渡すと201でユーザーが返る', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'user_reg1', email: 'reg1@example.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.user.username).toBe('user_reg1');
    expect(res.body.user.email).toBe('reg1@example.com');
  });

  it('異常: username が欠けていると400が返る', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'reg2@example.com', password: 'password123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('異常: email が欠けていると400が返る', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'user_reg3', password: 'password123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('異常: password が欠けていると400が返る', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'user_reg4', email: 'reg4@example.com' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('異常: 同じメールアドレスで2回登録すると409が返る', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'user_reg5a', email: 'reg5@example.com', password: 'password123' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'user_reg5b', email: 'reg5@example.com', password: 'password123' });

    expect(res.status).toBe(409);
  });

  it('正常: レスポンスに token クッキーがセットされる', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'user_reg6', email: 'reg6@example.com', password: 'password123' });

    const setCookie = res.headers['set-cookie'] as string[] | string;
    const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    expect(cookieStr).toMatch(/token=/);
  });
});

describe('POST /api/auth/login', () => {
  beforeAll(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'loginuser', email: 'login@example.com', password: 'correct-password' });
  });

  it('正常: 正しい認証情報で200とユーザーが返る', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: 'correct-password' });

    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('loginuser');
  });

  it('異常: email が欠けていると400が返る', async () => {
    const res = await request(app).post('/api/auth/login').send({ password: 'correct-password' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('異常: password が欠けていると400が返る', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'login@example.com' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('異常: パスワードが間違っていると401が返る', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: 'wrong-password' });

    expect(res.status).toBe(401);
  });

  it('異常: 存在しないメールアドレスで401が返る', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'password123' });

    expect(res.status).toBe(401);
  });

  it('正常: レスポンスに token クッキーがセットされる', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: 'correct-password' });

    const setCookie = res.headers['set-cookie'] as string[] | string;
    const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    expect(cookieStr).toMatch(/token=/);
  });
});

describe('POST /api/auth/logout', () => {
  it('正常: 200と message が返り token クッキーが削除される', async () => {
    const res = await request(app).post('/api/auth/logout');

    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();
    const setCookie = res.headers['set-cookie'] as string[] | string | undefined;
    if (setCookie) {
      const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
      // Expires=Thu, 01 Jan 1970 のように過去日付がセットされて削除される
      expect(cookieStr).toMatch(/token=/);
    }
  });
});

describe('GET /api/auth/me', () => {
  it('正常: 認証済みユーザー情報が返る', async () => {
    const { cookie, userId } = await registerAndGetCookie(app, 'user_me1', 'me1@example.com');
    const token = generateToken(userId, 'user_me1');

    const res = await request(app).get('/api/auth/me').set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(userId);
  });

  it('異常: トークンなしで401が返る', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/auth/profile', () => {
  let token: string;
  let userId: number;

  beforeAll(async () => {
    const result = await registerAndGetCookie(app, 'user_prof1', 'prof1@example.com');
    userId = result.userId;
    token = generateToken(userId, 'user_prof1');
  });

  it('正常: displayName を更新すると更新後のユーザーが返る', async () => {
    const res = await request(app)
      .patch('/api/auth/profile')
      .set('Cookie', `token=${token}`)
      .send({ displayName: '表示名テスト' });

    expect(res.status).toBe(200);
    expect(res.body.user.displayName).toBe('表示名テスト');
  });

  it('正常: location を更新すると更新後のユーザーが返る', async () => {
    const res = await request(app)
      .patch('/api/auth/profile')
      .set('Cookie', `token=${token}`)
      .send({ location: '東京' });

    expect(res.status).toBe(200);
    expect(res.body.user.location).toBe('東京');
  });

  it('正常: avatarUrl を更新すると更新後のユーザーが返る', async () => {
    const res = await request(app)
      .patch('/api/auth/profile')
      .set('Cookie', `token=${token}`)
      .send({ avatarUrl: 'https://example.com/avatar.png' });

    expect(res.status).toBe(200);
    expect(res.body.user.avatarUrl).toBe('https://example.com/avatar.png');
  });

  it('異常: トークンなしで401が返る', async () => {
    const res = await request(app).patch('/api/auth/profile').send({ displayName: '無効' });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/users', () => {
  it('正常: 全ユーザーのリストが返る', async () => {
    const { userId } = await registerAndGetCookie(app, 'user_list1', 'list1@example.com');
    const token = generateToken(userId, 'user_list1');

    const res = await request(app).get('/api/auth/users').set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
    expect(res.body.users.length).toBeGreaterThan(0);
  });

  it('異常: トークンなしで401が返る', async () => {
    const res = await request(app).get('/api/auth/users');

    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/users?channelId=:id（メンション候補絞り込み）', () => {
  it('正常: 公開チャンネルの channelId を指定すると全ユーザーが返る', async () => {
    const { cookie: ownerCookie, userId: ownerId } = await registerAndGetCookie(
      app,
      'mention_pub_owner',
      'mention_pub_owner@example.com',
    );
    const { userId: otherId } = await registerAndGetCookie(
      app,
      'mention_pub_other',
      'mention_pub_other@example.com',
    );

    // 公開チャンネル作成
    const chRes = await request(app)
      .post('/api/channels')
      .set('Cookie', ownerCookie)
      .send({ name: 'mention-pub-ch' });
    const channelId = (chRes.body as { channel: { id: number } }).channel.id;

    const res = await request(app)
      .get(`/api/auth/users?channelId=${channelId}`)
      .set('Cookie', ownerCookie);

    expect(res.status).toBe(200);
    const ids = (res.body as { users: { id: number }[] }).users.map((u) => u.id);
    expect(ids).toContain(ownerId);
    expect(ids).toContain(otherId);
  });

  it('正常: プライベートチャンネルの channelId を指定するとそのチャンネルのメンバーのみ返る', async () => {
    const { cookie: ownerCookie, userId: ownerId } = await registerAndGetCookie(
      app,
      'mention_priv_owner',
      'mention_priv_owner@example.com',
    );
    const { userId: memberId } = await registerAndGetCookie(
      app,
      'mention_priv_member',
      'mention_priv_member@example.com',
    );
    const { userId: nonMemberId } = await registerAndGetCookie(
      app,
      'mention_priv_nonmember',
      'mention_priv_nonmember@example.com',
    );

    // プライベートチャンネル作成（member を初期メンバーに追加）
    const chRes = await request(app)
      .post('/api/channels')
      .set('Cookie', ownerCookie)
      .send({ name: 'mention-priv-ch', is_private: true, memberIds: [memberId] });
    const channelId = (chRes.body as { channel: { id: number } }).channel.id;

    const res = await request(app)
      .get(`/api/auth/users?channelId=${channelId}`)
      .set('Cookie', ownerCookie);

    expect(res.status).toBe(200);
    const ids = (res.body as { users: { id: number }[] }).users.map((u) => u.id);
    expect(ids).toContain(ownerId);
    expect(ids).toContain(memberId);
    expect(ids).not.toContain(nonMemberId);
  });

  it('正常: channelId を指定しないと全ユーザーが返る', async () => {
    const { cookie, userId } = await registerAndGetCookie(
      app,
      'mention_nofilter',
      'mention_nofilter@example.com',
    );

    const res = await request(app).get('/api/auth/users').set('Cookie', cookie);

    expect(res.status).toBe(200);
    const ids = (res.body as { users: { id: number }[] }).users.map((u) => u.id);
    expect(ids).toContain(userId);
  });

  it('異常: 存在しない channelId を指定すると 404 が返る', async () => {
    const { cookie } = await registerAndGetCookie(app, 'mention_404', 'mention_404@example.com');

    const res = await request(app).get('/api/auth/users?channelId=99999').set('Cookie', cookie);

    expect(res.status).toBe(404);
  });
});
