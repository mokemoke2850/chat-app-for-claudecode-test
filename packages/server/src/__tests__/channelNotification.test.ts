/**
 * テスト対象: channelNotificationService（通知設定のビジネスロジックとDB操作）
 * 戦略: pg-mem のインメモリ PostgreSQL 互換 DB を使いサービス層を直接テストする。
 *       UPSERT の冪等性・デフォルト挙動・バリデーションを検証する。
 */

import { getSharedTestDatabase, resetTestData } from './__fixtures__/pgTestHelper';

const testDb = getSharedTestDatabase();

jest.mock('../db/database', () => testDb);

import request from 'supertest';
import { createApp } from '../app';
import { getLevel, getForUser, set } from '../services/channelNotificationService';

const app = createApp();

let userId1: number;
let userId2: number;
let channelId1: number;
let channelId2: number;

async function setupFixtures() {
  const r1 = await testDb.execute(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
    ['cn_user1', 'cn1@t.com', 'h'],
  );
  userId1 = r1.rows[0].id as number;

  const r2 = await testDb.execute(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
    ['cn_user2', 'cn2@t.com', 'h'],
  );
  userId2 = r2.rows[0].id as number;

  const rc1 = await testDb.execute(
    'INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id',
    ['cn-channel-1', userId1],
  );
  channelId1 = rc1.rows[0].id as number;

  const rc2 = await testDb.execute(
    'INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id',
    ['cn-channel-2', userId1],
  );
  channelId2 = rc2.rows[0].id as number;
}

beforeEach(async () => {
  await resetTestData(testDb);
  await setupFixtures();
});

describe('channelNotificationService', () => {
  describe('getLevel（個別チャンネルの通知レベル取得）', () => {
    it('レコードが存在しない場合はデフォルト値 "all" を返す', async () => {
      const level = await getLevel(userId1, channelId1);
      expect(level).toBe('all');
    });

    it('設定済みのレベル "mentions" を正しく返す', async () => {
      await set(userId1, channelId1, 'mentions');
      const level = await getLevel(userId1, channelId1);
      expect(level).toBe('mentions');
    });

    it('設定済みのレベル "muted" を正しく返す', async () => {
      await set(userId1, channelId1, 'muted');
      const level = await getLevel(userId1, channelId1);
      expect(level).toBe('muted');
    });
  });

  describe('getForUser（ユーザーの全通知設定取得）', () => {
    it('設定が1件もない場合は空のMapを返す', async () => {
      const map = await getForUser(userId1);
      expect(map.size).toBe(0);
    });

    it('複数チャンネルの設定をMapで返す', async () => {
      await set(userId1, channelId1, 'mentions');
      await set(userId1, channelId2, 'muted');
      const map = await getForUser(userId1);
      expect(map.size).toBe(2);
      expect(map.get(channelId1)?.level).toBe('mentions');
      expect(map.get(channelId2)?.level).toBe('muted');
    });

    it('他ユーザーの設定は含まれない', async () => {
      await set(userId1, channelId1, 'muted');
      await set(userId2, channelId1, 'mentions');
      const map = await getForUser(userId1);
      expect(map.size).toBe(1);
      expect(map.get(channelId1)?.level).toBe('muted');
    });
  });

  describe('set（通知レベルの設定・更新）', () => {
    it('新規レコードを挿入できる', async () => {
      const result = await set(userId1, channelId1, 'mentions');
      expect(result.channelId).toBe(channelId1);
      expect(result.level).toBe('mentions');
      expect(result.updatedAt).toBeDefined();
    });

    it('既存レコードがある場合はUPSERTで上書きできる（冪等性）', async () => {
      await set(userId1, channelId1, 'mentions');
      const result = await set(userId1, channelId1, 'muted');
      expect(result.level).toBe('muted');
      const level = await getLevel(userId1, channelId1);
      expect(level).toBe('muted');
    });

    it('同じ値で2回セットしても重複エラーにならない', async () => {
      await set(userId1, channelId1, 'muted');
      await expect(set(userId1, channelId1, 'muted')).resolves.not.toThrow();
    });
  });

  describe('バリデーション（APIレイヤー）', () => {
    let token: string;

    beforeEach(async () => {
      const { generateToken } = await import('../middleware/auth');
      token = generateToken(userId1, 'cn_user1');
    });

    it('"all" は有効なレベルとして受け入れられる', async () => {
      const res = await request(app)
        .put(`/api/channels/${channelId1}/notifications`)
        .set('Cookie', `token=${token}`)
        .send({ level: 'all' });
      expect(res.status).toBe(200);
    });

    it('"mentions" は有効なレベルとして受け入れられる', async () => {
      const res = await request(app)
        .put(`/api/channels/${channelId1}/notifications`)
        .set('Cookie', `token=${token}`)
        .send({ level: 'mentions' });
      expect(res.status).toBe(200);
    });

    it('"muted" は有効なレベルとして受け入れられる', async () => {
      const res = await request(app)
        .put(`/api/channels/${channelId1}/notifications`)
        .set('Cookie', `token=${token}`)
        .send({ level: 'muted' });
      expect(res.status).toBe(200);
    });

    it('"all" / "mentions" / "muted" 以外の値は 400 エラーになる', async () => {
      const res = await request(app)
        .put(`/api/channels/${channelId1}/notifications`)
        .set('Cookie', `token=${token}`)
        .send({ level: 'invalid' });
      expect(res.status).toBe(400);
    });
  });
});
