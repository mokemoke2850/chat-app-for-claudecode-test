/**
 * テスト対象: 招待リンク機能（inviteService + /api/invites エンドポイント）
 * 戦略: pg-mem のインメモリ PostgreSQL 互換 DB を使いサービス層および HTTP エンドポイントを検証する。
 *       token 生成の正当性、redeem トランザクション（上限・期限・無効化・重複参加）、
 *       ワークスペース招待、監査ログ記録を重点的に検証する。
 */

import { getSharedTestDatabase, resetTestData } from './__fixtures__/pgTestHelper';

const testDb = getSharedTestDatabase();

jest.mock('../db/database', () => testDb);

import request from 'supertest';
import { createApp } from '../app';
import { registerUser } from './__fixtures__/testHelpers';
import * as inviteService from '../services/inviteService';

const app = createApp();

let userId: number;
let adminUserId: number;
let otherUserId: number;
let channelId: number;
let publicChannelId2: number;
let privateChannelId: number;
let userToken: string;
let adminToken: string;
let otherToken: string;

async function setupFixtures() {
  const user = await registerUser(app, 'inviter', 'inviter@t.com');
  userId = user.userId;
  userToken = user.token;
  // 最初の登録ユーザーは自動的に admin になるため明示的に user ロールへ変更
  await testDb.execute("UPDATE users SET role = 'user' WHERE id = $1", [userId]);

  const admin = await registerUser(app, 'adminuser', 'admin@t.com');
  adminUserId = admin.userId;
  adminToken = admin.token;
  // admin ロールに昇格
  await testDb.execute("UPDATE users SET role = 'admin' WHERE id = $1", [adminUserId]);

  const other = await registerUser(app, 'otheruser', 'other@t.com');
  otherUserId = other.userId;
  otherToken = other.token;

  const rc = await testDb.execute(
    'INSERT INTO channels (name, created_by, is_private) VALUES ($1, $2, false) RETURNING id',
    ['general', userId],
  );
  channelId = rc.rows[0].id as number;

  const rc2 = await testDb.execute(
    'INSERT INTO channels (name, created_by, is_private) VALUES ($1, $2, false) RETURNING id',
    ['random', userId],
  );
  publicChannelId2 = rc2.rows[0].id as number;

  const rcp = await testDb.execute(
    'INSERT INTO channels (name, created_by, is_private) VALUES ($1, $2, true) RETURNING id',
    ['private-ch', userId],
  );
  privateChannelId = rcp.rows[0].id as number;

  // userId をチャンネルメンバーとして登録
  await testDb.execute(
    'INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [channelId, userId],
  );
}

beforeAll(async () => {
  await setupFixtures();
});

beforeEach(async () => {
  await resetTestData(testDb);
  await setupFixtures();
});

describe('招待リンク機能', () => {
  describe('token 生成', () => {
    it('生成された token は 32 文字以上である', async () => {
      const token = inviteService.generateToken();
      expect(token.length).toBeGreaterThanOrEqual(32);
    });

    it('生成された token は URL セーフ文字（base64url）のみで構成される', async () => {
      const token = inviteService.generateToken();
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('複数回生成した token は一意である（重複しない）', async () => {
      const tokens = new Set(Array.from({ length: 20 }, () => inviteService.generateToken()));
      expect(tokens.size).toBe(20);
    });
  });

  describe('POST /api/invites — 招待リンク作成', () => {
    it('チャンネル管理者が招待リンクを作成できる', async () => {
      const res = await request(app)
        .post('/api/invites')
        .set('Cookie', `token=${userToken}`)
        .send({ channelId });
      expect(res.status).toBe(201);
      expect(res.body.invite).toBeDefined();
      expect(res.body.invite.channelId).toBe(channelId);
    });

    it('admin ロールのユーザーが招待リンクを作成できる', async () => {
      const res = await request(app)
        .post('/api/invites')
        .set('Cookie', `token=${adminToken}`)
        .send({ channelId });
      expect(res.status).toBe(201);
      expect(res.body.invite).toBeDefined();
    });

    it('maxUses と expiresInHours を指定して作成できる', async () => {
      const res = await request(app)
        .post('/api/invites')
        .set('Cookie', `token=${userToken}`)
        .send({ channelId, maxUses: 10, expiresInHours: 24 });
      expect(res.status).toBe(201);
      expect(res.body.invite.maxUses).toBe(10);
      expect(res.body.invite.expiresAt).not.toBeNull();
    });

    it('channelId を省略するとワークスペース全体招待リンクになる（channelId = null）', async () => {
      const res = await request(app)
        .post('/api/invites')
        .set('Cookie', `token=${adminToken}`)
        .send({});
      expect(res.status).toBe(201);
      expect(res.body.invite.channelId).toBeNull();
    });

    it('チャンネルメンバーでない一般ユーザーが作成しようとすると 403 になる', async () => {
      const res = await request(app)
        .post('/api/invites')
        .set('Cookie', `token=${otherToken}`)
        .send({ channelId });
      expect(res.status).toBe(403);
    });

    it('認証なしでは 401 になる', async () => {
      const res = await request(app).post('/api/invites').send({ channelId });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/invites/:token — token 情報取得', () => {
    it('有効なトークンの情報（チャンネル名・期限等）を返す', async () => {
      const invite = await inviteService.create(userId, { channelId });
      const res = await request(app).get(`/api/invites/${invite.token}`);
      expect(res.status).toBe(200);
      expect(res.body.invite.token).toBe(invite.token);
      expect(res.body.invite.channelId).toBe(channelId);
      expect(res.body.invite.isExpired).toBe(false);
      expect(res.body.invite.isRevoked).toBe(false);
    });

    it('存在しないトークンは 404 になる', async () => {
      const res = await request(app).get('/api/invites/nonexistent-token-xyz');
      expect(res.status).toBe(404);
    });

    it('期限切れトークンでも情報を返す（isExpired: true）', async () => {
      await testDb.execute(
        `INSERT INTO invite_links (token, channel_id, created_by, expires_at)
         VALUES ($1, $2, $3, $4)`,
        ['expired-tok', channelId, userId, new Date(Date.now() - 1000).toISOString()],
      );
      const res = await request(app).get('/api/invites/expired-tok');
      expect(res.status).toBe(200);
      expect(res.body.invite.isExpired).toBe(true);
    });

    it('revoke 済みトークンでも情報を返す（isRevoked: true）', async () => {
      const invite = await inviteService.create(userId, { channelId });
      await inviteService.revoke(userId, invite.id, false);
      const res = await request(app).get(`/api/invites/${invite.token}`);
      expect(res.status).toBe(200);
      expect(res.body.invite.isRevoked).toBe(true);
    });

    it('認証なしでもアクセスできる（未ログインでのプレビュー用）', async () => {
      const invite = await inviteService.create(userId, { channelId });
      const res = await request(app).get(`/api/invites/${invite.token}`);
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/invites — 招待リンク一覧', () => {
    it('channelId を指定するとそのチャンネルの招待リンク一覧が返る', async () => {
      await inviteService.create(userId, { channelId });
      await inviteService.create(userId, { channelId });
      const res = await request(app)
        .get(`/api/invites?channelId=${channelId}`)
        .set('Cookie', `token=${userToken}`);
      expect(res.status).toBe(200);
      expect(res.body.invites).toHaveLength(2);
    });

    it('channelId を省略すると管理者は全招待リンクを取得できる', async () => {
      await inviteService.create(userId, { channelId });
      await inviteService.create(userId, { channelId: publicChannelId2 });
      const res = await request(app).get('/api/invites').set('Cookie', `token=${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.invites.length).toBeGreaterThanOrEqual(2);
    });

    it('一般ユーザーが channelId なしで全リスト取得しようとすると 403 になる', async () => {
      const res = await request(app).get('/api/invites').set('Cookie', `token=${userToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/invites/:token/redeem — 招待リンク使用（チャンネル招待）', () => {
    it('有効なトークンで redeem するとチャンネルメンバーになる', async () => {
      const invite = await inviteService.create(userId, { channelId });
      const res = await request(app)
        .post(`/api/invites/${invite.token}/redeem`)
        .set('Cookie', `token=${otherToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const member = await testDb.execute(
        'SELECT 1 FROM channel_members WHERE channel_id = $1 AND user_id = $2',
        [channelId, otherUserId],
      );
      expect(member.rowCount).toBe(1);
    });

    it('redeem 後に invite_link_uses にレコードが挿入される', async () => {
      const invite = await inviteService.create(userId, { channelId });
      await request(app)
        .post(`/api/invites/${invite.token}/redeem`)
        .set('Cookie', `token=${otherToken}`);
      const uses = await testDb.execute(
        'SELECT 1 FROM invite_link_uses WHERE invite_id = $1 AND user_id = $2',
        [invite.id, otherUserId],
      );
      expect(uses.rowCount).toBe(1);
    });

    it('redeem 後に used_count が 1 増加する', async () => {
      const invite = await inviteService.create(userId, { channelId, maxUses: 5 });
      await request(app)
        .post(`/api/invites/${invite.token}/redeem`)
        .set('Cookie', `token=${otherToken}`);
      const row = await testDb.execute('SELECT used_count FROM invite_links WHERE id = $1', [
        invite.id,
      ]);
      expect(Number(row.rows[0].used_count)).toBe(1);
    });

    describe('上限到達', () => {
      it('maxUses に達した後の redeem は 410 Gone になる', async () => {
        await testDb.execute(
          `INSERT INTO invite_links (token, channel_id, created_by, max_uses, used_count)
           VALUES ($1, $2, $3, $4, $5)`,
          ['full-tok', channelId, userId, 1, 1],
        );
        const res = await request(app)
          .post('/api/invites/full-tok/redeem')
          .set('Cookie', `token=${otherToken}`);
        expect(res.status).toBe(410);
      });

      it('maxUses が null（無制限）の場合は何度でも redeem できる', async () => {
        const invite = await inviteService.create(userId, { channelId });
        const r3 = await testDb.execute(
          'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
          ['u3', 'u3@t.com', 'h'],
        );
        const u3Id = r3.rows[0].id as number;
        const r3Token = (await import('../middleware/auth')).generateToken(u3Id, 'u3');

        const r4 = await testDb.execute(
          'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
          ['u4', 'u4@t.com', 'h'],
        );
        const u4Id = r4.rows[0].id as number;
        const r4Token = (await import('../middleware/auth')).generateToken(u4Id, 'u4');

        const res1 = await request(app)
          .post(`/api/invites/${invite.token}/redeem`)
          .set('Cookie', `token=${r3Token}`);
        const res2 = await request(app)
          .post(`/api/invites/${invite.token}/redeem`)
          .set('Cookie', `token=${r4Token}`);
        expect(res1.status).toBe(200);
        expect(res2.status).toBe(200);
      });
    });

    describe('期限切れ', () => {
      it('expiresAt が過去のトークンで redeem すると 410 Gone になる', async () => {
        await testDb.execute(
          `INSERT INTO invite_links (token, channel_id, created_by, expires_at)
           VALUES ($1, $2, $3, $4)`,
          ['past-tok', channelId, userId, new Date(Date.now() - 1000).toISOString()],
        );
        const res = await request(app)
          .post('/api/invites/past-tok/redeem')
          .set('Cookie', `token=${otherToken}`);
        expect(res.status).toBe(410);
      });

      it('expiresAt が null（無期限）のトークンは期限なしに有効', async () => {
        const invite = await inviteService.create(userId, { channelId });
        const res = await request(app)
          .post(`/api/invites/${invite.token}/redeem`)
          .set('Cookie', `token=${otherToken}`);
        expect(res.status).toBe(200);
      });
    });

    describe('revoke 済み', () => {
      it('is_revoked = true のトークンで redeem すると 410 Gone になる', async () => {
        const invite = await inviteService.create(userId, { channelId });
        await inviteService.revoke(userId, invite.id, false);
        const res = await request(app)
          .post(`/api/invites/${invite.token}/redeem`)
          .set('Cookie', `token=${otherToken}`);
        expect(res.status).toBe(410);
      });
    });

    describe('重複参加', () => {
      it('既にチャンネルメンバーのユーザーが redeem しても 200 で成功扱いになる', async () => {
        await testDb.execute(
          'INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [channelId, otherUserId],
        );
        const invite = await inviteService.create(userId, { channelId });
        const res = await request(app)
          .post(`/api/invites/${invite.token}/redeem`)
          .set('Cookie', `token=${otherToken}`);
        expect(res.status).toBe(200);
      });

      it('既にメンバーの場合は used_count を増やさない', async () => {
        await testDb.execute(
          'INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [channelId, otherUserId],
        );
        const invite = await inviteService.create(userId, { channelId, maxUses: 5 });
        await request(app)
          .post(`/api/invites/${invite.token}/redeem`)
          .set('Cookie', `token=${otherToken}`);
        const row = await testDb.execute('SELECT used_count FROM invite_links WHERE id = $1', [
          invite.id,
        ]);
        expect(Number(row.rows[0].used_count)).toBe(0);
      });
    });

    describe('レースコンディション', () => {
      it('同時に複数回 redeem しても used_count が max_uses を超えない', async () => {
        const invite = await inviteService.create(userId, { channelId, maxUses: 2 });

        const userIds: { id: number; token: string }[] = [];
        for (let i = 0; i < 3; i++) {
          const r = await testDb.execute(
            'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
            [`race${i}`, `race${i}@t.com`, 'h'],
          );
          const uid = r.rows[0].id as number;
          const { generateToken } = await import('../middleware/auth');
          userIds.push({ id: uid, token: generateToken(uid, `race${i}`) });
        }

        await Promise.allSettled(
          userIds.map(({ token }) =>
            request(app)
              .post(`/api/invites/${invite.token}/redeem`)
              .set('Cookie', `token=${token}`),
          ),
        );

        const row = await testDb.execute('SELECT used_count FROM invite_links WHERE id = $1', [
          invite.id,
        ]);
        expect(Number(row.rows[0].used_count)).toBeLessThanOrEqual(2);
      });
    });

    it('認証なしでは 401 になる', async () => {
      const invite = await inviteService.create(userId, { channelId });
      const res = await request(app).post(`/api/invites/${invite.token}/redeem`);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/invites/:token/redeem — ワークスペース招待', () => {
    it('channelId = null のトークンで redeem すると全公開チャンネルに参加する', async () => {
      const invite = await inviteService.create(userId, {});
      const res = await request(app)
        .post(`/api/invites/${invite.token}/redeem`)
        .set('Cookie', `token=${otherToken}`);
      expect(res.status).toBe(200);

      const m1 = await testDb.execute(
        'SELECT 1 FROM channel_members WHERE channel_id = $1 AND user_id = $2',
        [channelId, otherUserId],
      );
      expect(m1.rowCount).toBe(1);

      const m2 = await testDb.execute(
        'SELECT 1 FROM channel_members WHERE channel_id = $1 AND user_id = $2',
        [publicChannelId2, otherUserId],
      );
      expect(m2.rowCount).toBe(1);
    });

    it('既に参加している公開チャンネルはスキップされる（エラーにならない）', async () => {
      await testDb.execute(
        'INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [channelId, otherUserId],
      );
      const invite = await inviteService.create(userId, {});
      const res = await request(app)
        .post(`/api/invites/${invite.token}/redeem`)
        .set('Cookie', `token=${otherToken}`);
      expect(res.status).toBe(200);
    });

    it('プライベートチャンネルはワークスペース招待に含まれない', async () => {
      const invite = await inviteService.create(userId, {});
      await request(app)
        .post(`/api/invites/${invite.token}/redeem`)
        .set('Cookie', `token=${otherToken}`);

      const mp = await testDb.execute(
        'SELECT 1 FROM channel_members WHERE channel_id = $1 AND user_id = $2',
        [privateChannelId, otherUserId],
      );
      expect(mp.rowCount).toBe(0);
    });
  });

  describe('DELETE /api/invites/:id — 招待リンク無効化（revoke）', () => {
    it('作成者が自分のリンクを無効化できる', async () => {
      const invite = await inviteService.create(userId, { channelId });
      const res = await request(app)
        .delete(`/api/invites/${invite.id}`)
        .set('Cookie', `token=${userToken}`);
      expect(res.status).toBe(200);
      expect(res.body.invite.isRevoked).toBe(true);
    });

    it('admin は他ユーザーのリンクも無効化できる', async () => {
      const invite = await inviteService.create(userId, { channelId });
      const res = await request(app)
        .delete(`/api/invites/${invite.id}`)
        .set('Cookie', `token=${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.invite.isRevoked).toBe(true);
    });

    it('他ユーザーのリンクを一般ユーザーが無効化しようとすると 403 になる', async () => {
      const invite = await inviteService.create(userId, { channelId });
      const res = await request(app)
        .delete(`/api/invites/${invite.id}`)
        .set('Cookie', `token=${otherToken}`);
      expect(res.status).toBe(403);
    });

    it('無効化後に is_revoked が true になる', async () => {
      const invite = await inviteService.create(userId, { channelId });
      await request(app).delete(`/api/invites/${invite.id}`).set('Cookie', `token=${userToken}`);
      const row = await testDb.execute('SELECT is_revoked FROM invite_links WHERE id = $1', [
        invite.id,
      ]);
      expect(row.rows[0].is_revoked).toBe(true);
    });
  });

  describe('監査ログ', () => {
    it('招待リンク作成時に invite.create が記録される', async () => {
      await request(app)
        .post('/api/invites')
        .set('Cookie', `token=${userToken}`)
        .send({ channelId });
      const log = await testDb.execute(
        "SELECT 1 FROM audit_logs WHERE action_type = 'invite.create' AND actor_user_id = $1",
        [userId],
      );
      expect(log.rowCount).toBe(1);
    });

    it('招待リンク revoke 時に invite.revoke が記録される', async () => {
      const invite = await inviteService.create(userId, { channelId });
      await request(app).delete(`/api/invites/${invite.id}`).set('Cookie', `token=${userToken}`);
      const log = await testDb.execute(
        "SELECT 1 FROM audit_logs WHERE action_type = 'invite.revoke' AND actor_user_id = $1",
        [userId],
      );
      expect(log.rowCount).toBe(1);
    });

    it('招待リンク redeem 時に invite.redeem が記録される', async () => {
      const invite = await inviteService.create(userId, { channelId });
      await request(app)
        .post(`/api/invites/${invite.token}/redeem`)
        .set('Cookie', `token=${otherToken}`);
      const log = await testDb.execute(
        "SELECT 1 FROM audit_logs WHERE action_type = 'invite.redeem' AND actor_user_id = $1",
        [otherUserId],
      );
      expect(log.rowCount).toBe(1);
    });
  });
});
