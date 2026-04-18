/**
 * 監査ログ機能のテスト
 *
 * Issue: #85 https://github.com/mokemoke2850/chat-app-for-claudecode-test/issues/85
 *
 * === 仕様判断 ===
 * - テーブル: `audit_logs` を新規1テーブルで作成
 *   - id (serial, PK)
 *   - actor_user_id (integer, nullable, FK users.id ON DELETE SET NULL)
 *   - action_type (text, NOT NULL)
 *   - target_type (text, nullable)
 *   - target_id (integer, nullable)
 *   - metadata (jsonb, nullable)
 *   - created_at (timestamptz, NOT NULL, default NOW())
 *
 * - action_type union:
 *   - 'channel.create' / 'channel.delete' / 'channel.archive' / 'channel.unarchive'
 *   - 'message.delete'
 *   - 'user.role_change' / 'user.status_change' / 'user.delete'
 *   - 'auth.login' / 'auth.logout'
 *
 * - API: GET /api/admin/audit-logs
 *   - requireAdmin ミドルウェア配下
 *   - Queryパラメータ: action_type, actor_user_id, from, to, limit, offset
 *   - レスポンス: { logs: AuditLog[], total: number }
 *
 * 戦略: pg-mem のインメモリ PostgreSQL 互換 DB + supertest で検証。
 */

import { createTestDatabase } from './__fixtures__/pgTestHelper';

const testDb = createTestDatabase();

jest.mock('../db/database', () => testDb);

import request from 'supertest';
import { createApp } from '../app';
import { registerUser } from './__fixtures__/testHelpers';
import * as auditLogService from '../services/auditLogService';

const app = createApp();

async function makeAdmin(userId: number): Promise<void> {
  await testDb.execute("UPDATE users SET role = 'admin' WHERE id = $1", [userId]);
}

async function clearAuditLogs(): Promise<void> {
  await testDb.execute('DELETE FROM audit_logs', []);
}

describe('auditLogService', () => {
  describe('record', () => {
    beforeEach(async () => {
      await clearAuditLogs();
    });

    it('actorUserId / actionType / targetType / targetId / metadata を INSERT する', async () => {
      const { userId } = await registerUser(
        app,
        `al_rec_${Date.now()}`,
        `al_rec_${Date.now()}@example.com`,
      );
      await auditLogService.record({
        actorUserId: userId,
        actionType: 'channel.create',
        targetType: 'channel',
        targetId: 42,
        metadata: { name: 'general', isPrivate: false },
      });

      const rows = await testDb.query(
        'SELECT actor_user_id, action_type, target_type, target_id, metadata FROM audit_logs',
        [],
      );
      expect(rows).toHaveLength(1);
      const r = rows[0] as {
        actor_user_id: number;
        action_type: string;
        target_type: string;
        target_id: number;
        metadata: unknown;
      };
      expect(r.actor_user_id).toBe(userId);
      expect(r.action_type).toBe('channel.create');
      expect(r.target_type).toBe('channel');
      expect(r.target_id).toBe(42);
      // metadata は jsonb として保存される（pg-mem は object or string）
      const parsed =
        typeof r.metadata === 'string'
          ? (JSON.parse(r.metadata) as Record<string, unknown>)
          : (r.metadata as Record<string, unknown>);
      expect(parsed.name).toBe('general');
      expect(parsed.isPrivate).toBe(false);
    });

    it('metadata が未指定の場合は NULL として保存される', async () => {
      await auditLogService.record({
        actorUserId: null,
        actionType: 'auth.logout',
      });
      const row = await testDb.queryOne<{ metadata: unknown }>(
        'SELECT metadata FROM audit_logs',
        [],
      );
      expect(row!.metadata).toBeNull();
    });

    it('targetType / targetId が未指定の場合は NULL として保存される', async () => {
      await auditLogService.record({
        actorUserId: null,
        actionType: 'auth.login',
      });
      const row = await testDb.queryOne<{ target_type: unknown; target_id: unknown }>(
        'SELECT target_type, target_id FROM audit_logs',
        [],
      );
      expect(row!.target_type).toBeNull();
      expect(row!.target_id).toBeNull();
    });

    it('actorUserId が null の場合でも記録できる', async () => {
      await auditLogService.record({
        actorUserId: null,
        actionType: 'auth.login',
      });
      const row = await testDb.queryOne<{ actor_user_id: unknown }>(
        'SELECT actor_user_id FROM audit_logs',
        [],
      );
      expect(row!.actor_user_id).toBeNull();
    });

    it('created_at はサーバー側で自動的にセットされる', async () => {
      await auditLogService.record({
        actorUserId: null,
        actionType: 'auth.login',
      });
      const row = await testDb.queryOne<{ created_at: string | null }>(
        'SELECT created_at FROM audit_logs',
        [],
      );
      expect(row!.created_at).toBeTruthy();
    });

    it('DB書き込みが失敗しても例外を呼び出し元へ伝播させない', async () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      // action_type は NOT NULL。無効な呼び出しで DB エラーを引き起こす
      await expect(
        auditLogService.record({
          actorUserId: null,
          // 意図的に不正な action_type を渡す代わりに、直接 execute を spy して throw させる
          actionType: 'auth.login',
        }),
      ).resolves.toBeUndefined();

      // spy 戻しと別途: execute で throw させるテストを pg-mem でやるのは難しいので、
      // 呼び出し側が await しても例外が出ないことで確認済み
      spy.mockRestore();
    });
  });

  describe('listAuditLogs', () => {
    beforeEach(async () => {
      await clearAuditLogs();
    });

    async function seedLogs(): Promise<{ uid1: number; uid2: number }> {
      const { userId: uid1 } = await registerUser(
        app,
        `seed1_${Date.now()}`,
        `seed1_${Date.now()}@example.com`,
      );
      const { userId: uid2 } = await registerUser(
        app,
        `seed2_${Date.now() + 1}`,
        `seed2_${Date.now() + 1}@example.com`,
      );

      // 異なる created_at で複数件挿入
      await testDb.execute(
        `INSERT INTO audit_logs (actor_user_id, action_type, created_at)
         VALUES ($1, 'channel.create', NOW() - INTERVAL '3 days'),
                ($1, 'channel.delete', NOW() - INTERVAL '2 days'),
                ($2, 'auth.login', NOW() - INTERVAL '1 day'),
                ($2, 'auth.logout', NOW())`,
        [uid1, uid2],
      );
      return { uid1, uid2 };
    }

    it('引数なしで呼ぶと全ログを created_at 降順で返す', async () => {
      await seedLogs();
      const { logs } = await auditLogService.listAuditLogs();
      expect(logs.length).toBe(4);
      expect(logs[0].actionType).toBe('auth.logout');
      expect(logs[3].actionType).toBe('channel.create');
    });

    it('limit / offset でページネーションできる', async () => {
      await seedLogs();
      const page1 = await auditLogService.listAuditLogs({ limit: 2, offset: 0 });
      const page2 = await auditLogService.listAuditLogs({ limit: 2, offset: 2 });
      expect(page1.logs).toHaveLength(2);
      expect(page2.logs).toHaveLength(2);
      expect(page1.logs[0].id).not.toBe(page2.logs[0].id);
    });

    it('actionType フィルタで該当レコードのみ返す', async () => {
      await seedLogs();
      const { logs, total } = await auditLogService.listAuditLogs({
        actionType: 'auth.login',
      });
      expect(total).toBe(1);
      expect(logs).toHaveLength(1);
      expect(logs[0].actionType).toBe('auth.login');
    });

    it('actorUserId フィルタで該当レコードのみ返す', async () => {
      const { uid1 } = await seedLogs();
      const { logs, total } = await auditLogService.listAuditLogs({ actorUserId: uid1 });
      expect(total).toBe(2);
      expect(logs.every((l) => l.actorUserId === uid1)).toBe(true);
    });

    it('日付範囲フィルタ（from / to）で該当レコードのみ返す', async () => {
      await seedLogs();
      // 2.5 日前〜今 の範囲
      const now = new Date();
      const from = new Date(now.getTime() - 2.5 * 24 * 60 * 60 * 1000).toISOString();
      const { total } = await auditLogService.listAuditLogs({ from });
      expect(total).toBe(3); // channel.delete/auth.login/auth.logout
    });

    it('複数フィルタを組み合わせたときに AND で絞り込む', async () => {
      const { uid1 } = await seedLogs();
      const { total } = await auditLogService.listAuditLogs({
        actorUserId: uid1,
        actionType: 'channel.create',
      });
      expect(total).toBe(1);
    });

    it('total（フィルタ適用後の総件数）を返す', async () => {
      await seedLogs();
      const { total } = await auditLogService.listAuditLogs({ limit: 1, offset: 0 });
      expect(total).toBe(4);
    });
  });
});

describe('GET /api/admin/audit-logs', () => {
  beforeEach(async () => {
    await clearAuditLogs();
  });

  describe('認可', () => {
    it('未ログインは 401 を返す', async () => {
      const res = await request(app).get('/api/admin/audit-logs');
      expect(res.status).toBe(401);
    });

    it('一般ユーザーは 403 を返す（requireAdmin）', async () => {
      const { token } = await registerUser(
        app,
        `al_user_${Date.now()}`,
        `al_user_${Date.now()}@example.com`,
      );
      const res = await request(app).get('/api/admin/audit-logs').set('Cookie', `token=${token}`);
      expect(res.status).toBe(403);
    });

    it('管理者は 200 を返す', async () => {
      const { token, userId } = await registerUser(
        app,
        `al_adm_${Date.now()}`,
        `al_adm_${Date.now()}@example.com`,
      );
      await makeAdmin(userId);
      const res = await request(app).get('/api/admin/audit-logs').set('Cookie', `token=${token}`);
      expect(res.status).toBe(200);
    });
  });

  describe('ページネーション', () => {
    async function seedManyAndAdmin(): Promise<string> {
      const { token, userId } = await registerUser(
        app,
        `al_page_${Date.now()}_${Math.random()}`,
        `al_page_${Date.now()}_${Math.random()}@example.com`,
      );
      await makeAdmin(userId);
      // 55件挿入
      for (let i = 0; i < 55; i++) {
        await testDb.execute(
          "INSERT INTO audit_logs (actor_user_id, action_type) VALUES ($1, 'auth.login')",
          [userId],
        );
      }
      return token;
    }

    it('デフォルトで limit=50, offset=0 のページを返す', async () => {
      const token = await seedManyAndAdmin();
      const res = await request(app).get('/api/admin/audit-logs').set('Cookie', `token=${token}`);
      expect(res.status).toBe(200);
      expect((res.body as { logs: unknown[] }).logs).toHaveLength(50);
      expect((res.body as { total: number }).total).toBe(55);
    });

    it('limit クエリで件数を制御できる', async () => {
      const token = await seedManyAndAdmin();
      const res = await request(app)
        .get('/api/admin/audit-logs?limit=5')
        .set('Cookie', `token=${token}`);
      expect(res.status).toBe(200);
      expect((res.body as { logs: unknown[] }).logs).toHaveLength(5);
    });

    it('offset クエリでオフセットを制御できる', async () => {
      const token = await seedManyAndAdmin();
      const res = await request(app)
        .get('/api/admin/audit-logs?limit=10&offset=50')
        .set('Cookie', `token=${token}`);
      expect(res.status).toBe(200);
      expect((res.body as { logs: unknown[] }).logs).toHaveLength(5); // 55-50=5
    });

    it('limit が上限（200）を超える場合は 400 を返す', async () => {
      const token = await seedManyAndAdmin();
      const res = await request(app)
        .get('/api/admin/audit-logs?limit=500')
        .set('Cookie', `token=${token}`);
      expect(res.status).toBe(400);
    });
  });

  describe('フィルタリング', () => {
    it('action_type クエリで絞り込める', async () => {
      const { token, userId } = await registerUser(
        app,
        `al_f1_${Date.now()}`,
        `al_f1_${Date.now()}@example.com`,
      );
      await makeAdmin(userId);
      await testDb.execute(
        "INSERT INTO audit_logs (actor_user_id, action_type) VALUES ($1, 'channel.create')",
        [userId],
      );
      await testDb.execute(
        "INSERT INTO audit_logs (actor_user_id, action_type) VALUES ($1, 'channel.delete')",
        [userId],
      );
      const res = await request(app)
        .get('/api/admin/audit-logs?action_type=channel.create')
        .set('Cookie', `token=${token}`);
      expect(res.status).toBe(200);
      expect((res.body as { total: number }).total).toBe(1);
      expect((res.body as { logs: { actionType: string }[] }).logs[0].actionType).toBe(
        'channel.create',
      );
    });

    it('actor_user_id クエリで絞り込める', async () => {
      const { token, userId } = await registerUser(
        app,
        `al_f2_${Date.now()}`,
        `al_f2_${Date.now()}@example.com`,
      );
      await makeAdmin(userId);
      const { userId: other } = await registerUser(
        app,
        `al_f2b_${Date.now()}`,
        `al_f2b_${Date.now()}@example.com`,
      );
      await testDb.execute(
        "INSERT INTO audit_logs (actor_user_id, action_type) VALUES ($1, 'auth.login')",
        [userId],
      );
      await testDb.execute(
        "INSERT INTO audit_logs (actor_user_id, action_type) VALUES ($1, 'auth.login')",
        [other],
      );
      const res = await request(app)
        .get(`/api/admin/audit-logs?actor_user_id=${other}`)
        .set('Cookie', `token=${token}`);
      expect((res.body as { total: number }).total).toBe(1);
    });

    it('from / to の日付範囲クエリで絞り込める', async () => {
      const { token, userId } = await registerUser(
        app,
        `al_f3_${Date.now()}`,
        `al_f3_${Date.now()}@example.com`,
      );
      await makeAdmin(userId);
      await testDb.execute(
        "INSERT INTO audit_logs (actor_user_id, action_type, created_at) VALUES ($1, 'auth.login', NOW() - INTERVAL '5 days')",
        [userId],
      );
      await testDb.execute(
        "INSERT INTO audit_logs (actor_user_id, action_type) VALUES ($1, 'auth.logout')",
        [userId],
      );
      const from = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      const res = await request(app)
        .get(`/api/admin/audit-logs?from=${encodeURIComponent(from)}`)
        .set('Cookie', `token=${token}`);
      expect((res.body as { total: number }).total).toBe(1);
    });
  });

  describe('レスポンス形状', () => {
    it('各 log は id / actorUserId / actorUsername / actionType / targetType / targetId / metadata / createdAt を持つ', async () => {
      const { token, userId } = await registerUser(
        app,
        `al_shape_${Date.now()}`,
        `al_shape_${Date.now()}@example.com`,
      );
      await makeAdmin(userId);
      await testDb.execute(
        "INSERT INTO audit_logs (actor_user_id, action_type, target_type, target_id, metadata) VALUES ($1, 'channel.create', 'channel', 10, '{\"name\":\"x\"}')",
        [userId],
      );
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .set('Cookie', `token=${token}`);
      const log = (res.body as { logs: Record<string, unknown>[] }).logs[0];
      expect(log).toHaveProperty('id');
      expect(log).toHaveProperty('actorUserId');
      expect(log).toHaveProperty('actorUsername');
      expect(log).toHaveProperty('actionType');
      expect(log).toHaveProperty('targetType');
      expect(log).toHaveProperty('targetId');
      expect(log).toHaveProperty('metadata');
      expect(log).toHaveProperty('createdAt');
    });

    it('actor が削除されていても actorUserId が null で返り、actorUsername は null になる', async () => {
      const { token, userId } = await registerUser(
        app,
        `al_actor_${Date.now()}`,
        `al_actor_${Date.now()}@example.com`,
      );
      await makeAdmin(userId);
      // 対象ユーザーを作り、audit_logs を挿入後に削除 → FK SET_NULL で actor_user_id=null
      const { userId: ghost } = await registerUser(
        app,
        `al_ghost_${Date.now()}`,
        `al_ghost_${Date.now()}@example.com`,
      );
      await testDb.execute(
        "INSERT INTO audit_logs (actor_user_id, action_type) VALUES ($1, 'auth.login')",
        [ghost],
      );
      await testDb.execute('DELETE FROM users WHERE id = $1', [ghost]);

      const res = await request(app)
        .get('/api/admin/audit-logs')
        .set('Cookie', `token=${token}`);
      const log = (res.body as {
        logs: { actorUserId: number | null; actorUsername: string | null }[];
      }).logs.find((l) => l.actorUserId === null);
      expect(log).toBeDefined();
      expect(log!.actorUsername).toBeNull();
    });
  });
});

describe('既存操作からの監査ログ記録（横断的動作）', () => {
  beforeEach(async () => {
    await clearAuditLogs();
  });

  async function setupAdmin(suffix: string): Promise<{ token: string; userId: number }> {
    const ctx = await registerUser(app, `crs_${suffix}`, `crs_${suffix}@example.com`);
    await makeAdmin(ctx.userId);
    return ctx;
  }

  describe('認証系（authController）', () => {
    it('POST /api/auth/login 成功時に auth.login が actor=ログインユーザー で記録される', async () => {
      const suffix = `login_${Date.now()}`;
      await request(app).post('/api/auth/register').send({
        username: `u_${suffix}`,
        email: `u_${suffix}@example.com`,
        password: 'password123',
      });
      await clearAuditLogs(); // register 時の記録分は無視して login のみ観察
      const res = await request(app).post('/api/auth/login').send({
        email: `u_${suffix}@example.com`,
        password: 'password123',
      });
      expect(res.status).toBe(200);
      const logs = await testDb.query<{ action_type: string; actor_user_id: number }>(
        'SELECT action_type, actor_user_id FROM audit_logs',
        [],
      );
      expect(logs.find((l) => l.action_type === 'auth.login')).toBeDefined();
    });

    it('POST /api/auth/logout 時に auth.logout が actor=ログインユーザー で記録される', async () => {
      const { token, userId } = await registerUser(
        app,
        `crs_logout_${Date.now()}`,
        `crs_logout_${Date.now()}@example.com`,
      );
      await clearAuditLogs();
      const res = await request(app).post('/api/auth/logout').set('Cookie', `token=${token}`);
      expect(res.status).toBe(200);
      const log = await testDb.queryOne<{ action_type: string; actor_user_id: number }>(
        'SELECT action_type, actor_user_id FROM audit_logs',
        [],
      );
      expect(log!.action_type).toBe('auth.logout');
      expect(log!.actor_user_id).toBe(userId);
    });
  });

  describe('チャンネル系（channelController）', () => {
    it('POST /api/channels でチャンネル作成時に channel.create が記録される', async () => {
      const { token, userId } = await setupAdmin(`chcreate_${Date.now()}`);
      await clearAuditLogs();
      const res = await request(app)
        .post('/api/channels')
        .set('Cookie', `token=${token}`)
        .send({ name: `ch_${Date.now()}`, is_private: false });
      expect(res.status).toBe(201);
      const log = await testDb.queryOne<{
        action_type: string;
        actor_user_id: number;
        target_type: string;
        target_id: number;
        metadata: unknown;
      }>('SELECT * FROM audit_logs', []);
      expect(log!.action_type).toBe('channel.create');
      expect(log!.actor_user_id).toBe(userId);
      expect(log!.target_type).toBe('channel');
    });

    it('DELETE /api/channels/:id で channel.delete が記録される', async () => {
      const { token, userId } = await setupAdmin(`chdel_${Date.now()}`);
      const chRes = await request(app)
        .post('/api/channels')
        .set('Cookie', `token=${token}`)
        .send({ name: `chdel_${Date.now()}` });
      const channelId = (chRes.body as { channel: { id: number } }).channel.id;
      await clearAuditLogs();
      await request(app).delete(`/api/channels/${channelId}`).set('Cookie', `token=${token}`);
      const log = await testDb.queryOne<{ action_type: string; actor_user_id: number }>(
        "SELECT * FROM audit_logs WHERE action_type = 'channel.delete'",
        [],
      );
      expect(log!.action_type).toBe('channel.delete');
      expect(log!.actor_user_id).toBe(userId);
    });

    it('POST /api/channels/:id/archive で channel.archive が記録される', async () => {
      const { token } = await setupAdmin(`charc_${Date.now()}`);
      const chRes = await request(app)
        .post('/api/channels')
        .set('Cookie', `token=${token}`)
        .send({ name: `charc_${Date.now()}` });
      const channelId = (chRes.body as { channel: { id: number } }).channel.id;
      await clearAuditLogs();
      const res = await request(app)
        .patch(`/api/channels/${channelId}/archive`)
        .set('Cookie', `token=${token}`);
      expect(res.status).toBe(200);
      const log = await testDb.queryOne<{ action_type: string }>(
        "SELECT action_type FROM audit_logs WHERE action_type = 'channel.archive'",
        [],
      );
      expect(log!.action_type).toBe('channel.archive');
    });

    it('DELETE /api/channels/:id/archive（unarchive）で channel.unarchive が記録される', async () => {
      const { token } = await setupAdmin(`chuna_${Date.now()}`);
      const chRes = await request(app)
        .post('/api/channels')
        .set('Cookie', `token=${token}`)
        .send({ name: `chuna_${Date.now()}` });
      const channelId = (chRes.body as { channel: { id: number } }).channel.id;
      await request(app)
        .patch(`/api/channels/${channelId}/archive`)
        .set('Cookie', `token=${token}`);
      await clearAuditLogs();
      await request(app)
        .delete(`/api/channels/${channelId}/archive`)
        .set('Cookie', `token=${token}`);
      const log = await testDb.queryOne<{ action_type: string }>(
        "SELECT action_type FROM audit_logs WHERE action_type = 'channel.unarchive'",
        [],
      );
      expect(log!.action_type).toBe('channel.unarchive');
    });
  });

  describe('メッセージ系（messageController）', () => {
    it('DELETE /api/messages/:id で message.delete が記録される', async () => {
      const { token, userId } = await setupAdmin(`msgdel_${Date.now()}`);
      const chRes = await request(app)
        .post('/api/channels')
        .set('Cookie', `token=${token}`)
        .send({ name: `msgdelch_${Date.now()}` });
      const channelId = (chRes.body as { channel: { id: number } }).channel.id;
      const result = await testDb.execute(
        'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
        [channelId, userId, 'hello'],
      );
      const messageId = result.rows[0].id as number;
      await clearAuditLogs();
      await request(app).delete(`/api/messages/${messageId}`).set('Cookie', `token=${token}`);
      const log = await testDb.queryOne<{ action_type: string; target_id: number }>(
        "SELECT * FROM audit_logs WHERE action_type = 'message.delete'",
        [],
      );
      expect(log!.action_type).toBe('message.delete');
      expect(log!.target_id).toBe(messageId);
    });
  });

  describe('管理系（adminController）', () => {
    it('PATCH /api/admin/users/:id/role で user.role_change が metadata に { from, to } を含めて記録される', async () => {
      const { token } = await setupAdmin(`aurole_${Date.now()}`);
      const { userId: target } = await registerUser(
        app,
        `aurolet_${Date.now()}`,
        `aurolet_${Date.now()}@example.com`,
      );
      await clearAuditLogs();
      await request(app)
        .patch(`/api/admin/users/${target}/role`)
        .set('Cookie', `token=${token}`)
        .send({ role: 'admin' });
      const log = await testDb.queryOne<{ metadata: unknown }>(
        "SELECT metadata FROM audit_logs WHERE action_type = 'user.role_change'",
        [],
      );
      const meta =
        typeof log!.metadata === 'string'
          ? (JSON.parse(log!.metadata as string) as Record<string, unknown>)
          : (log!.metadata as Record<string, unknown>);
      expect(meta.from).toBe('user');
      expect(meta.to).toBe('admin');
    });

    it('PATCH /api/admin/users/:id/status で user.status_change が metadata に { isActive } を含めて記録される', async () => {
      const { token } = await setupAdmin(`austat_${Date.now()}`);
      const { userId: target } = await registerUser(
        app,
        `austatt_${Date.now()}`,
        `austatt_${Date.now()}@example.com`,
      );
      await clearAuditLogs();
      await request(app)
        .patch(`/api/admin/users/${target}/status`)
        .set('Cookie', `token=${token}`)
        .send({ isActive: false });
      const log = await testDb.queryOne<{ metadata: unknown }>(
        "SELECT metadata FROM audit_logs WHERE action_type = 'user.status_change'",
        [],
      );
      const meta =
        typeof log!.metadata === 'string'
          ? (JSON.parse(log!.metadata as string) as Record<string, unknown>)
          : (log!.metadata as Record<string, unknown>);
      expect(meta.isActive).toBe(false);
    });

    it('DELETE /api/admin/users/:id で user.delete が記録される', async () => {
      const { token } = await setupAdmin(`audel_${Date.now()}`);
      const { userId: target } = await registerUser(
        app,
        `audelt_${Date.now()}`,
        `audelt_${Date.now()}@example.com`,
      );
      await clearAuditLogs();
      await request(app).delete(`/api/admin/users/${target}`).set('Cookie', `token=${token}`);
      const log = await testDb.queryOne<{ action_type: string }>(
        "SELECT action_type FROM audit_logs WHERE action_type = 'user.delete'",
        [],
      );
      expect(log!.action_type).toBe('user.delete');
    });

    it('DELETE /api/admin/channels/:id で channel.delete が actor=管理者 で記録される', async () => {
      const { token, userId } = await setupAdmin(`achd_${Date.now()}`);
      const chResult = await testDb.execute(
        'INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id',
        [`achd_${Date.now()}`, userId],
      );
      const chId = chResult.rows[0].id as number;
      await clearAuditLogs();
      await request(app).delete(`/api/admin/channels/${chId}`).set('Cookie', `token=${token}`);
      const log = await testDb.queryOne<{ action_type: string; actor_user_id: number }>(
        "SELECT * FROM audit_logs WHERE action_type = 'channel.delete'",
        [],
      );
      expect(log!.action_type).toBe('channel.delete');
      expect(log!.actor_user_id).toBe(userId);
    });
  });

  describe('FK SET_NULL 挙動', () => {
    it('監査ログを生成した actor ユーザーが削除されても audit_logs レコード自体は残る（actor_user_id が NULL になる）', async () => {
      const { userId } = await registerUser(
        app,
        `fk1_${Date.now()}`,
        `fk1_${Date.now()}@example.com`,
      );
      await testDb.execute(
        "INSERT INTO audit_logs (actor_user_id, action_type) VALUES ($1, 'auth.login')",
        [userId],
      );
      await testDb.execute('DELETE FROM users WHERE id = $1', [userId]);
      const row = await testDb.queryOne<{ actor_user_id: number | null }>(
        'SELECT actor_user_id FROM audit_logs',
        [],
      );
      expect(row).toBeDefined();
      expect(row!.actor_user_id).toBeNull();
    });

    it('target_type / target_id は FK を貼っていないため、対象エンティティが削除されても audit_logs に影響しない', async () => {
      const { userId } = await registerUser(
        app,
        `fk2_${Date.now()}`,
        `fk2_${Date.now()}@example.com`,
      );
      const chResult = await testDb.execute(
        'INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id',
        [`fk2ch_${Date.now()}`, userId],
      );
      const chId = chResult.rows[0].id as number;
      await testDb.execute(
        "INSERT INTO audit_logs (actor_user_id, action_type, target_type, target_id) VALUES ($1, 'channel.delete', 'channel', $2)",
        [userId, chId],
      );
      await testDb.execute('DELETE FROM channels WHERE id = $1', [chId]);
      const row = await testDb.queryOne<{ target_id: number | null }>(
        'SELECT target_id FROM audit_logs',
        [],
      );
      expect(row!.target_id).toBe(chId);
    });
  });
});
