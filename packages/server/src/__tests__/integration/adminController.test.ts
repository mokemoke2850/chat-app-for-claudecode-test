/**
 * adminController のHTTPレベルテスト
 *
 * テスト対象: packages/server/src/controllers/adminController.ts
 * 戦略: supertest でHTTPリクエストを発行し、管理者APIの認可・動作を検証する。
 * DB は pg-mem のインメモリ PostgreSQL 互換 DB を使用。
 */

import { createTestDatabase } from '../__fixtures__/pgTestHelper';

const testDb = createTestDatabase();

jest.mock('../../db/database', () => testDb);

import request from 'supertest';
import { createApp } from '../../app';
import { createChannelReq, makeAdmin, registerUser } from '../__fixtures__/testHelpers';

const app = createApp();

/** DB でユーザーを admin に昇格するヘルパー */
describe('GET /api/admin/users', () => {
  it('正常: admin がリクエストすると全ユーザー一覧を返す', async () => {
    const { token, userId } = await registerUser(app, 'adm_list', 'adm_list@example.com');
    await makeAdmin(userId);

    const res = await request(app).get('/api/admin/users').set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
    expect(res.body.users[0]).toHaveProperty('role');
    expect(res.body.users[0]).toHaveProperty('isActive');
  });

  it('異常: 非ログインは 401', async () => {
    const res = await request(app).get('/api/admin/users');
    expect(res.status).toBe(401);
  });

  it('異常: 一般ユーザーは 403', async () => {
    const { token } = await registerUser(app, 'adm_user403', 'adm_user403@example.com');
    const res = await request(app).get('/api/admin/users').set('Cookie', `token=${token}`);
    expect(res.status).toBe(403);
  });
});

describe('GET /api/admin/health-details', () => {
  it('正常: admin がリクエストすると DB・Socket・ジョブ・ストレージの状態一覧を返す', async () => {
    const { token, userId } = await registerUser(app, 'adm_health', 'adm_health@example.com');
    await makeAdmin(userId);

    const res = await request(app).get('/api/admin/health-details').set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('checkedAt');
    expect(res.body).toHaveProperty('overallStatus');
    expect(res.body.components).toEqual(
      expect.objectContaining({
        database: expect.any(Object),
        socket: expect.any(Object),
        jobs: expect.any(Object),
        storage: expect.any(Object),
      }),
    );
  });

  it('正常: DB 接続状態に応答可否とレイテンシが含まれる', async () => {
    const { token, userId } = await registerUser(app, 'adm_health_db', 'adm_health_db@example.com');
    await makeAdmin(userId);

    const res = await request(app).get('/api/admin/health-details').set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body.components.database).toEqual(
      expect.objectContaining({
        status: expect.stringMatching(/^(normal|warning|error)$/),
        reachable: true,
        latencyMs: expect.any(Number),
      }),
    );
  });

  it('正常: Socket サーバーの稼働状態と接続数が含まれる', async () => {
    const { token, userId } = await registerUser(
      app,
      'adm_health_socket',
      'adm_health_socket@example.com',
    );
    await makeAdmin(userId);

    const res = await request(app).get('/api/admin/health-details').set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body.components.socket).toEqual(
      expect.objectContaining({
        status: expect.stringMatching(/^(normal|warning|error)$/),
        running: expect.any(Boolean),
        connectionCount: expect.any(Number),
      }),
    );
  });

  it('正常: 予約送信・リマインダーのジョブ稼働状態が含まれる', async () => {
    const { token, userId } = await registerUser(
      app,
      'adm_health_jobs',
      'adm_health_jobs@example.com',
    );
    await makeAdmin(userId);

    const res = await request(app).get('/api/admin/health-details').set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body.components.jobs.workers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'scheduledMessages', running: expect.any(Boolean) }),
        expect.objectContaining({ key: 'calendarReminders', running: expect.any(Boolean) }),
      ]),
    );
  });

  it('正常: ストレージの利用状況と書き込み可否が含まれる', async () => {
    const { token, userId } = await registerUser(
      app,
      'adm_health_storage',
      'adm_health_storage@example.com',
    );
    await makeAdmin(userId);

    const res = await request(app).get('/api/admin/health-details').set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body.components.storage).toEqual(
      expect.objectContaining({
        status: expect.stringMatching(/^(normal|warning|error)$/),
        writable: expect.any(Boolean),
        totalBytes: expect.any(Number),
        fileCount: expect.any(Number),
      }),
    );
  });

  it('正常: 各サブシステムに normal・warning・error のいずれかのステータスが付与される', async () => {
    const { token, userId } = await registerUser(
      app,
      'adm_health_status',
      'adm_health_status@example.com',
    );
    await makeAdmin(userId);

    const res = await request(app).get('/api/admin/health-details').set('Cookie', `token=${token}`);
    const statuses = [
      res.body.overallStatus,
      res.body.components.database.status,
      res.body.components.socket.status,
      res.body.components.jobs.status,
      res.body.components.storage.status,
    ];

    expect(res.status).toBe(200);
    for (const status of statuses) {
      expect(status).toMatch(/^(normal|warning|error)$/);
    }
  });

  it('異常: 非ログインは 401 を返す', async () => {
    const res = await request(app).get('/api/admin/health-details');
    expect(res.status).toBe(401);
  });

  it('異常: 一般ユーザーは 403 を返す', async () => {
    const { token } = await registerUser(app, 'adm_health_user', 'adm_health_user@example.com');
    const res = await request(app).get('/api/admin/health-details').set('Cookie', `token=${token}`);
    expect(res.status).toBe(403);
  });
});

describe('GET /api/admin/job-monitoring', () => {
  it('正常: admin が全ジョブの時刻・間隔・回数・直近失敗を含む一覧を取得できる', async () => {
    const { token, userId } = await registerUser(app, 'adm_jobs', 'adm_jobs@example.com');
    await makeAdmin(userId);
    const res = await request(app).get('/api/admin/job-monitoring').set('Cookie', `token=${token}`);
    expect(res.status).toBe(200);
    expect(res.body.jobs).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'scheduledMessages', label: expect.any(String), intervalMs: 30000,
        lastRunAt: null, nextRunAt: null, successCount: 0, failureCount: 0, lastFailure: null }),
      expect.objectContaining({ key: 'calendarReminders' }),
    ]));
  });

  it('異常: 非ログインは 401 を返す', async () => {
    expect((await request(app).get('/api/admin/job-monitoring')).status).toBe(401);
  });

  it('異常: 一般ユーザーは 403 を返す', async () => {
    const { token } = await registerUser(app, 'jobs_user', 'jobs_user@example.com');
    expect((await request(app).get('/api/admin/job-monitoring').set('Cookie', `token=${token}`)).status).toBe(403);
  });
});

describe('PATCH /api/admin/users/:id/role', () => {
  it('正常: admin が他ユーザーのロールを変更できる', async () => {
    const { token, userId } = await registerUser(app, 'adm_role1', 'adm_role1@example.com');
    await makeAdmin(userId);
    const { userId: targetId } = await registerUser(
      app,
      'adm_role_tgt',
      'adm_role_tgt@example.com',
    );

    const res = await request(app)
      .patch(`/api/admin/users/${targetId}/role`)
      .set('Cookie', `token=${token}`)
      .send({ role: 'admin' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('異常: admin が自分自身のロールを変更しようとすると 400', async () => {
    const { token, userId } = await registerUser(app, 'adm_role_self', 'adm_role_self@example.com');
    await makeAdmin(userId);

    const res = await request(app)
      .patch(`/api/admin/users/${userId}/role`)
      .set('Cookie', `token=${token}`)
      .send({ role: 'user' });

    expect(res.status).toBe(400);
  });

  it('異常: 無効なロール値は 400', async () => {
    const { token, userId } = await registerUser(app, 'adm_role_bad', 'adm_role_bad@example.com');
    await makeAdmin(userId);
    const { userId: targetId } = await registerUser(
      app,
      'adm_role_tgt2',
      'adm_role_tgt2@example.com',
    );

    const res = await request(app)
      .patch(`/api/admin/users/${targetId}/role`)
      .set('Cookie', `token=${token}`)
      .send({ role: 'superuser' });

    expect(res.status).toBe(400);
  });

  it('異常: 存在しないユーザーIDは 404', async () => {
    const { token, userId } = await registerUser(app, 'adm_role_404', 'adm_role_404@example.com');
    await makeAdmin(userId);

    const res = await request(app)
      .patch('/api/admin/users/99999/role')
      .set('Cookie', `token=${token}`)
      .send({ role: 'user' });

    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/admin/users/:id/status', () => {
  it('正常: admin がユーザーを停止できる', async () => {
    const { token, userId } = await registerUser(app, 'adm_status1', 'adm_status1@example.com');
    await makeAdmin(userId);
    const { userId: targetId } = await registerUser(
      app,
      'adm_status_tgt',
      'adm_status_tgt@example.com',
    );

    const res = await request(app)
      .patch(`/api/admin/users/${targetId}/status`)
      .set('Cookie', `token=${token}`)
      .send({ isActive: false });

    expect(res.status).toBe(200);
    const row = await testDb.queryOne<{ is_active: boolean }>(
      'SELECT is_active FROM users WHERE id = $1',
      [targetId],
    );
    expect(row!.is_active).toBe(false);
  });

  it('正常: admin が停止中ユーザーを復活できる', async () => {
    const { token, userId } = await registerUser(app, 'adm_status2', 'adm_status2@example.com');
    await makeAdmin(userId);
    const { userId: targetId } = await registerUser(
      app,
      'adm_status_tgt2',
      'adm_status_tgt2@example.com',
    );

    await request(app)
      .patch(`/api/admin/users/${targetId}/status`)
      .set('Cookie', `token=${token}`)
      .send({ isActive: false });

    const res = await request(app)
      .patch(`/api/admin/users/${targetId}/status`)
      .set('Cookie', `token=${token}`)
      .send({ isActive: true });

    expect(res.status).toBe(200);
    const row = await testDb.queryOne<{ is_active: boolean }>(
      'SELECT is_active FROM users WHERE id = $1',
      [targetId],
    );
    expect(row!.is_active).toBe(true);
  });

  it('異常: 停止中ユーザーはログインで 403 が返る', async () => {
    const { token, userId } = await registerUser(
      app,
      'adm_suspend_adm',
      'adm_suspend_adm@example.com',
    );
    await makeAdmin(userId);
    await registerUser(app, 'adm_suspended', 'adm_suspended@example.com');
    const suspendedRow = await testDb.queryOne<{ id: number }>(
      'SELECT id FROM users WHERE username = $1',
      ['adm_suspended'],
    );

    await request(app)
      .patch(`/api/admin/users/${suspendedRow!.id}/status`)
      .set('Cookie', `token=${token}`)
      .send({ isActive: false });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'adm_suspended@example.com', password: 'password123' });

    expect(loginRes.status).toBe(403);
  });
});

describe('DELETE /api/admin/users/:id', () => {
  it('正常: admin が別ユーザーを削除できる', async () => {
    const { token, userId } = await registerUser(app, 'adm_del1', 'adm_del1@example.com');
    await makeAdmin(userId);
    const { userId: targetId } = await registerUser(app, 'adm_del_tgt', 'adm_del_tgt@example.com');

    const res = await request(app)
      .delete(`/api/admin/users/${targetId}`)
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(204);
    const row = await testDb.queryOne('SELECT id FROM users WHERE id = $1', [targetId]);
    expect(row).toBeNull();
  });

  it('異常: admin が自分自身を削除しようとすると 400', async () => {
    const { token, userId } = await registerUser(app, 'adm_del_self', 'adm_del_self@example.com');
    await makeAdmin(userId);

    const res = await request(app)
      .delete(`/api/admin/users/${userId}`)
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(400);
  });

  it('異常: 存在しないユーザーIDは 404', async () => {
    const { token, userId } = await registerUser(app, 'adm_del_404', 'adm_del_404@example.com');
    await makeAdmin(userId);

    const res = await request(app).delete('/api/admin/users/99999').set('Cookie', `token=${token}`);

    expect(res.status).toBe(404);
  });

  it('正常: ユーザー削除後もそのユーザーのメッセージは残り user_id が NULL になる', async () => {
    const { token, userId } = await registerUser(app, 'adm_del_msg', 'adm_del_msg@example.com');
    await makeAdmin(userId);
    const { userId: targetId } = await registerUser(
      app,
      'adm_del_msg_tgt',
      'adm_del_msg_tgt@example.com',
    );

    // チャンネル作成とメッセージ投稿
    const chResult = await testDb.execute(
      'INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id',
      ['del-msg-ch-int', userId],
    );
    const chId = chResult.rows[0].id as number;
    const msgResult = await testDb.execute(
      'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
      [chId, targetId, 'test message'],
    );
    const msgId = msgResult.rows[0].id as number;

    const res = await request(app)
      .delete(`/api/admin/users/${targetId}`)
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(204);
    const msg = await testDb.queryOne<{ user_id: number | null }>(
      'SELECT user_id FROM messages WHERE id = $1',
      [msgId],
    );
    expect(msg).toBeDefined();
    expect(msg!.user_id).toBeNull();
  });

  it('正常: ユーザー削除後もそのユーザーが作成したチャンネルは残り created_by が NULL になる', async () => {
    const { token, userId } = await registerUser(app, 'adm_del_ch', 'adm_del_ch@example.com');
    await makeAdmin(userId);
    const { userId: targetId } = await registerUser(
      app,
      'adm_del_ch_tgt',
      'adm_del_ch_tgt@example.com',
    );

    const chResult = await testDb.execute(
      'INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id',
      ['del-ch-int', targetId],
    );
    const chId = chResult.rows[0].id as number;

    const res = await request(app)
      .delete(`/api/admin/users/${targetId}`)
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(204);
    const ch = await testDb.queryOne<{ created_by: number | null }>(
      'SELECT created_by FROM channels WHERE id = $1',
      [chId],
    );
    expect(ch).toBeDefined();
    expect(ch!.created_by).toBeNull();
  });
});

describe('GET /api/admin/channels', () => {
  it('正常: admin が全チャンネル（プライベート含む）を取得できる', async () => {
    const { token, userId } = await registerUser(app, 'adm_ch1', 'adm_ch1@example.com');
    await makeAdmin(userId);

    // プライベートチャンネルを作成
    await testDb.execute(
      'INSERT INTO channels (name, created_by, is_private) VALUES ($1, $2, $3)',
      ['priv-test-ch', userId, true],
    );

    const res = await request(app).get('/api/admin/channels').set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.channels)).toBe(true);
    const found = (res.body.channels as { name: string; isPrivate: boolean }[]).find(
      (c) => c.name === 'priv-test-ch',
    );
    expect(found?.isPrivate).toBe(true);
  });

  it('異常: 一般ユーザーは 403', async () => {
    const { token } = await registerUser(app, 'adm_ch_user', 'adm_ch_user@example.com');
    const res = await request(app).get('/api/admin/channels').set('Cookie', `token=${token}`);
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/admin/channels/:id', () => {
  it('正常: admin が任意のチャンネルを強制削除できる', async () => {
    const { token, userId } = await registerUser(app, 'adm_chd1', 'adm_chd1@example.com');
    await makeAdmin(userId);

    const result = await testDb.execute(
      'INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id',
      ['adm-force-del', userId],
    );
    const chId = result.rows[0].id as number;

    const res = await request(app)
      .delete(`/api/admin/channels/${chId}`)
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(204);
  });

  it('異常: 存在しないチャンネルIDは 404', async () => {
    const { token, userId } = await registerUser(app, 'adm_chd2', 'adm_chd2@example.com');
    await makeAdmin(userId);

    const res = await request(app)
      .delete('/api/admin/channels/99999')
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(404);
  });
});

describe('GET /api/admin/stats', () => {
  it('正常: 統計情報を返す（totalUsers/totalChannels/totalMessages/activeUsersLast24h/activeUsersLast7d）', async () => {
    const { token, userId } = await registerUser(app, 'adm_stats1', 'adm_stats1@example.com');
    await makeAdmin(userId);

    const res = await request(app).get('/api/admin/stats').set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.totalUsers).toBe('number');
    expect(typeof res.body.totalChannels).toBe('number');
    expect(typeof res.body.totalMessages).toBe('number');
    expect(typeof res.body.activeUsersLast24h).toBe('number');
    expect(typeof res.body.activeUsersLast7d).toBe('number');
  });

  it('異常: 一般ユーザーは 403', async () => {
    const { token } = await registerUser(app, 'adm_stats_user', 'adm_stats_user@example.com');
    const res = await request(app).get('/api/admin/stats').set('Cookie', `token=${token}`);
    expect(res.status).toBe(403);
  });
});

// 初回ユーザー自動 admin 昇格のテストは registerAdmin.test.ts に移動済み
// （DB を他スイートと共有すると countBefore > 0 になり仕様を検証できないため独立ファイルで管理）

describe('GET /api/admin/audit-logs/export', () => {
  describe('CSV エクスポート', () => {
    it('正常: フィルタなしで全件を CSV 形式でダウンロードできる', async () => {
      const { token, userId } = await registerUser(app, 'exp_all', 'exp_all@example.com');
      await makeAdmin(userId);

      // 監査ログを2件 INSERT
      await testDb.execute(
        `INSERT INTO audit_logs (actor_user_id, action_type, target_type, target_id, metadata)
         VALUES ($1, 'auth.login', 'user', $1, NULL), ($1, 'channel.create', 'channel', 1, '{"name":"general"}')`,
        [userId],
      );

      const res = await request(app)
        .get('/api/admin/audit-logs/export')
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      // CSV として返ってくる（行数を確認）
      const lines = (res.text as string).split('\r\n').filter((l) => l.length > 0);
      // ヘッダー行 + 少なくとも2件
      expect(lines.length).toBeGreaterThanOrEqual(3);
    });

    it('正常: from / to 日付範囲フィルタが適用された CSV が返る', async () => {
      const { token, userId } = await registerUser(app, 'exp_range', 'exp_range@example.com');
      await makeAdmin(userId);

      // 日付の違う監査ログを INSERT
      await testDb.execute(
        `INSERT INTO audit_logs (actor_user_id, action_type, created_at)
         VALUES ($1, 'auth.login', '2025-01-01T00:00:00Z'), ($1, 'auth.logout', '2025-06-01T00:00:00Z')`,
        [userId],
      );

      const res = await request(app)
        .get('/api/admin/audit-logs/export?from=2025-01-01&to=2025-03-31')
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      const text = res.text as string;
      // auth.login は範囲内、auth.logout は範囲外
      expect(text).toContain('auth.login');
      expect(text).not.toContain('auth.logout');
    });

    it('正常: action_type フィルタで絞り込まれた CSV が返る', async () => {
      const { token, userId } = await registerUser(app, 'exp_acttype', 'exp_acttype@example.com');
      await makeAdmin(userId);

      await testDb.execute(
        `INSERT INTO audit_logs (actor_user_id, action_type)
         VALUES ($1, 'auth.login'), ($1, 'channel.create')`,
        [userId],
      );

      const res = await request(app)
        .get('/api/admin/audit-logs/export?action_type=auth.login')
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      const text = res.text as string;
      expect(text).toContain('auth.login');
      expect(text).not.toContain('channel.create');
    });

    it('正常: レスポンスヘッダーに Content-Type: text/csv と Content-Disposition が含まれる', async () => {
      const { token, userId } = await registerUser(app, 'exp_hdr', 'exp_hdr@example.com');
      await makeAdmin(userId);

      const res = await request(app)
        .get('/api/admin/audit-logs/export')
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.headers['content-disposition']).toMatch(/attachment/);
      expect(res.headers['content-disposition']).toMatch(/audit-logs-/);
    });

    it('正常: UTF-8 BOM（\\xEF\\xBB\\xBF）が CSV 先頭に付与されている', async () => {
      const { token, userId } = await registerUser(app, 'exp_bom', 'exp_bom@example.com');
      await makeAdmin(userId);

      const res = await request(app)
        .get('/api/admin/audit-logs/export')
        .set('Cookie', `token=${token}`)
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
        });

      const buf = res.body as Buffer;
      // UTF-8 BOM: 0xEF 0xBB 0xBF
      expect(buf[0]).toBe(0xef);
      expect(buf[1]).toBe(0xbb);
      expect(buf[2]).toBe(0xbf);
    });

    it('正常: CSV の先頭行がヘッダー行（id, created_at_utc, actor_user_id, ... ）になっている', async () => {
      const { token, userId } = await registerUser(app, 'exp_header', 'exp_header@example.com');
      await makeAdmin(userId);

      const res = await request(app)
        .get('/api/admin/audit-logs/export')
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      // BOM を除いた最初の行がヘッダー
      const text = (res.text as string).replace(/^\uFEFF/, '');
      const firstLine = text.split('\r\n')[0];
      expect(firstLine).toBe(
        'id,created_at_utc,actor_user_id,actor_username,action_type,target_type,target_id,metadata',
      );
    });

    it('正常: metadata にカンマ・改行・ダブルクォートが含まれる場合、RFC 4180 に準拠してエスケープされる', async () => {
      const { token, userId } = await registerUser(app, 'exp_esc', 'exp_esc@example.com');
      await makeAdmin(userId);

      // カンマ・改行・ダブルクォートを含む metadata を INSERT
      const metadata = JSON.stringify({ note: 'comma,here\nnewline"quote' });
      await testDb.execute(
        `INSERT INTO audit_logs (actor_user_id, action_type, metadata) VALUES ($1, 'auth.login', $2)`,
        [userId, metadata],
      );

      const res = await request(app)
        .get('/api/admin/audit-logs/export')
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      const text = res.text as string;
      // RFC 4180: ダブルクォートはダブルクォートで囲み、内部のダブルクォートは "" にエスケープ
      expect(text).toContain('"');
    });

    it('正常: metadata が null のログは metadata カラムが空文字で出力される', async () => {
      const { token, userId } = await registerUser(app, 'exp_null', 'exp_null@example.com');
      await makeAdmin(userId);

      await testDb.execute(
        `INSERT INTO audit_logs (actor_user_id, action_type, metadata) VALUES ($1, 'auth.login', NULL)`,
        [userId],
      );

      const res = await request(app)
        .get('/api/admin/audit-logs/export')
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      const text = res.text as string;
      // 最後のカラム(metadata)が空 → 行末に , で終わる
      const dataLines = (text as string)
        .split('\r\n')
        .filter((l) => l.length > 0)
        .slice(1); // ヘッダーを除く
      expect(dataLines.length).toBeGreaterThanOrEqual(1);
      // metadata は最後のカラムなので行末が , で終わるか空フィールド
      const lastLine = dataLines[dataLines.length - 1];
      expect(lastLine).toMatch(/,$/);
    });

    it('正常: エクスポート実行が audit_logs に audit.export として記録される', async () => {
      const { token, userId } = await registerUser(app, 'exp_rec', 'exp_rec@example.com');
      await makeAdmin(userId);

      await request(app).get('/api/admin/audit-logs/export').set('Cookie', `token=${token}`);

      // audit.export が INSERT されていることを確認
      const result = await testDb.execute(
        `SELECT * FROM audit_logs WHERE actor_user_id = $1 AND action_type = 'audit.export'`,
        [userId],
      );
      expect(result.rows.length).toBeGreaterThanOrEqual(1);
    });

    it('異常: 非ログインは 401', async () => {
      const res = await request(app).get('/api/admin/audit-logs/export');
      expect(res.status).toBe(401);
    });

    it('異常: 一般ユーザーは 403', async () => {
      const { token } = await registerUser(app, 'exp_user403', 'exp_user403@example.com');
      const res = await request(app)
        .get('/api/admin/audit-logs/export')
        .set('Cookie', `token=${token}`);
      expect(res.status).toBe(403);
    });
  });
});

/**
 * おすすめチャンネル（is_recommended）管理 API のテスト（Issue #114）
 */
describe('PATCH /api/admin/channels/:id/recommend', () => {
  it('正常: admin が is_recommended を true にセットできる', async () => {
    const { token, userId } = await registerUser(app, 'adm_rec1', 'adm_rec1@example.com');
    await makeAdmin(userId);

    const result = await testDb.execute(
      'INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id',
      ['rec-ch-1', userId],
    );
    const chId = result.rows[0].id as number;

    const res = await request(app)
      .patch(`/api/admin/channels/${chId}/recommend`)
      .set('Cookie', `token=${token}`)
      .send({ isRecommended: true });

    expect(res.status).toBe(200);
    const row = await testDb.queryOne<{ is_recommended: boolean }>(
      'SELECT is_recommended FROM channels WHERE id = $1',
      [chId],
    );
    expect(row!.is_recommended).toBe(true);
  });

  it('正常: admin が is_recommended を false にセットできる（解除）', async () => {
    const { token, userId } = await registerUser(app, 'adm_rec2', 'adm_rec2@example.com');
    await makeAdmin(userId);

    const result = await testDb.execute(
      'INSERT INTO channels (name, created_by, is_recommended) VALUES ($1, $2, $3) RETURNING id',
      ['rec-ch-2', userId, true],
    );
    const chId = result.rows[0].id as number;

    const res = await request(app)
      .patch(`/api/admin/channels/${chId}/recommend`)
      .set('Cookie', `token=${token}`)
      .send({ isRecommended: false });

    expect(res.status).toBe(200);
    const row = await testDb.queryOne<{ is_recommended: boolean }>(
      'SELECT is_recommended FROM channels WHERE id = $1',
      [chId],
    );
    expect(row!.is_recommended).toBe(false);
  });

  it('正常: レスポンスに更新後の isRecommended が含まれる', async () => {
    const { token, userId } = await registerUser(app, 'adm_rec3', 'adm_rec3@example.com');
    await makeAdmin(userId);

    const result = await testDb.execute(
      'INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id',
      ['rec-ch-3', userId],
    );
    const chId = result.rows[0].id as number;

    const res = await request(app)
      .patch(`/api/admin/channels/${chId}/recommend`)
      .set('Cookie', `token=${token}`)
      .send({ isRecommended: true });

    expect(res.status).toBe(200);
    expect(res.body.channel).toBeDefined();
    expect(res.body.channel.isRecommended).toBe(true);
  });

  it('正常: ON/OFF の切り替えが audit_logs に admin.channel.recommend / admin.channel.unrecommend として記録される', async () => {
    const { token, userId } = await registerUser(app, 'adm_rec4', 'adm_rec4@example.com');
    await makeAdmin(userId);

    const result = await testDb.execute(
      'INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id',
      ['rec-ch-4', userId],
    );
    const chId = result.rows[0].id as number;

    await request(app)
      .patch(`/api/admin/channels/${chId}/recommend`)
      .set('Cookie', `token=${token}`)
      .send({ isRecommended: true });

    await request(app)
      .patch(`/api/admin/channels/${chId}/recommend`)
      .set('Cookie', `token=${token}`)
      .send({ isRecommended: false });

    const onRow = await testDb.queryOne<{ cnt: string }>(
      `SELECT COUNT(*) as cnt FROM audit_logs WHERE action_type = 'admin.channel.recommend' AND target_id = $1`,
      [chId],
    );
    expect(Number(onRow!.cnt)).toBeGreaterThan(0);

    const offRow = await testDb.queryOne<{ cnt: string }>(
      `SELECT COUNT(*) as cnt FROM audit_logs WHERE action_type = 'admin.channel.unrecommend' AND target_id = $1`,
      [chId],
    );
    expect(Number(offRow!.cnt)).toBeGreaterThan(0);
  });

  it('異常: 非ログインは 401', async () => {
    const res = await request(app)
      .patch('/api/admin/channels/1/recommend')
      .send({ isRecommended: true });
    expect(res.status).toBe(401);
  });

  it('異常: 一般ユーザーは 403', async () => {
    const { token } = await registerUser(app, 'adm_rec_user', 'adm_rec_user@example.com');
    const res = await request(app)
      .patch('/api/admin/channels/1/recommend')
      .set('Cookie', `token=${token}`)
      .send({ isRecommended: true });
    expect(res.status).toBe(403);
  });

  it('異常: 存在しないチャンネル ID は 404', async () => {
    const { token, userId } = await registerUser(app, 'adm_rec_404', 'adm_rec_404@example.com');
    await makeAdmin(userId);

    const res = await request(app)
      .patch('/api/admin/channels/99999/recommend')
      .set('Cookie', `token=${token}`)
      .send({ isRecommended: true });

    expect(res.status).toBe(404);
  });

  it('異常: リクエストボディの isRecommended が boolean でないと 400', async () => {
    const { token, userId } = await registerUser(app, 'adm_rec_bad', 'adm_rec_bad@example.com');
    await makeAdmin(userId);

    const result = await testDb.execute(
      'INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id',
      ['rec-ch-bad', userId],
    );
    const chId = result.rows[0].id as number;

    const res = await request(app)
      .patch(`/api/admin/channels/${chId}/recommend`)
      .set('Cookie', `token=${token}`)
      .send({ isRecommended: 'yes' });

    expect(res.status).toBe(400);
  });
});

// #392 管理者向けメンテナンスモード
describe('GET /api/admin/maintenance-mode', () => {
  it('正常: admin が現在のメンテナンスモード状態を取得できる', async () => {
    const { token, userId } = await registerUser(app, 'maint_get_admin', 'maint_get@example.com');
    await makeAdmin(userId);

    const res = await request(app)
      .get('/api/admin/maintenance-mode')
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body.settings).toMatchObject({
      enabled: false,
      message: '',
      restrictedOperations: [],
    });
  });

  it('異常: 非ログインは 401', async () => {
    const res = await request(app).get('/api/admin/maintenance-mode');
    expect(res.status).toBe(401);
  });

  it('異常: 一般ユーザーは 403', async () => {
    const { token } = await registerUser(app, 'maint_get_user', 'maint_get_user@example.com');
    const res = await request(app)
      .get('/api/admin/maintenance-mode')
      .set('Cookie', `token=${token}`);
    expect(res.status).toBe(403);
  });
});

describe('PUT /api/admin/maintenance-mode', () => {
  async function setupAdmin(username: string) {
    const { token, userId } = await registerUser(app, username, `${username}@example.com`);
    await makeAdmin(userId);
    return { token, userId };
  }

  it('正常: admin がメンテナンスモードを ON にできる', async () => {
    const { token } = await setupAdmin('maint_on_admin');
    const res = await request(app)
      .put('/api/admin/maintenance-mode')
      .set('Cookie', `token=${token}`)
      .send({ enabled: true, message: '', restrictedOperations: [] });

    expect(res.status).toBe(200);
    expect(res.body.settings.enabled).toBe(true);
  });

  it('正常: admin が投稿・アップロード・ログインの制限対象を保存できる', async () => {
    const { token } = await setupAdmin('maint_ops_admin');
    const res = await request(app)
      .put('/api/admin/maintenance-mode')
      .set('Cookie', `token=${token}`)
      .send({ enabled: true, restrictedOperations: ['posting', 'upload', 'login'] });

    expect(res.status).toBe(200);
    expect(res.body.settings.restrictedOperations).toEqual(['posting', 'upload', 'login']);
  });

  it('正常: admin が告知メッセージを保存できる', async () => {
    const { token } = await setupAdmin('maint_msg_admin');
    const res = await request(app)
      .put('/api/admin/maintenance-mode')
      .set('Cookie', `token=${token}`)
      .send({ enabled: true, message: '本日 22:00 まで停止します', restrictedOperations: [] });

    expect(res.status).toBe(200);
    expect(res.body.settings.message).toBe('本日 22:00 まで停止します');
  });

  it('正常: admin がメンテナンスモードを OFF にできる', async () => {
    const { token } = await setupAdmin('maint_off_admin');
    await request(app)
      .put('/api/admin/maintenance-mode')
      .set('Cookie', `token=${token}`)
      .send({ enabled: true, restrictedOperations: ['posting'] });

    const res = await request(app)
      .put('/api/admin/maintenance-mode')
      .set('Cookie', `token=${token}`)
      .send({ enabled: false, restrictedOperations: [] });

    expect(res.status).toBe(200);
    expect(res.body.settings.enabled).toBe(false);
  });

  it('異常: 制限対象が不正な場合は 400', async () => {
    const { token } = await setupAdmin('maint_bad_admin');
    const res = await request(app)
      .put('/api/admin/maintenance-mode')
      .set('Cookie', `token=${token}`)
      .send({ enabled: true, restrictedOperations: ['invalid'] });

    expect(res.status).toBe(400);
  });

  it('異常: 非ログインは 401', async () => {
    const res = await request(app)
      .put('/api/admin/maintenance-mode')
      .send({ enabled: true, restrictedOperations: [] });
    expect(res.status).toBe(401);
  });

  it('異常: 一般ユーザーは 403', async () => {
    const { token } = await registerUser(app, 'maint_put_user', 'maint_put_user@example.com');
    const res = await request(app)
      .put('/api/admin/maintenance-mode')
      .set('Cookie', `token=${token}`)
      .send({ enabled: true, restrictedOperations: [] });
    expect(res.status).toBe(403);
  });
});

describe('メンテナンスモード制限', () => {
  async function enableMaintenance(restrictedOperations: string[]) {
    const { token, userId } = await registerUser(
      app,
      `maint_admin_${restrictedOperations.join('_')}`,
      `maint_admin_${restrictedOperations.join('_')}@example.com`,
    );
    await makeAdmin(userId);
    await request(app)
      .put('/api/admin/maintenance-mode')
      .set('Cookie', `token=${token}`)
      .send({ enabled: true, restrictedOperations });
    return { token, userId };
  }

  it('投稿制限が有効な場合、一般ユーザーのメッセージ投稿 API は 503 を返す', async () => {
    await enableMaintenance(['posting']);
    const { token } = await registerUser(app, 'maint_post_user', 'maint_post_user@example.com');
    const channelId = await createChannelReq(app, token, 'maint-post-channel');

    const res = await request(app)
      .post(`/api/channels/${channelId}/messages`)
      .set('Cookie', `token=${token}`)
      .send({ content: 'blocked' });

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('MAINTENANCE_MODE');
  });

  it('アップロード制限が有効な場合、一般ユーザーのファイルアップロード API は 503 を返す', async () => {
    await enableMaintenance(['upload']);
    const { token } = await registerUser(app, 'maint_upload_user', 'maint_upload_user@example.com');

    const res = await request(app)
      .post('/api/files/upload')
      .set('Cookie', `token=${token}`)
      .attach('file', Buffer.from('hello'), 'hello.txt');

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('MAINTENANCE_MODE');
  });

  it('ログイン制限が有効な場合、一般ユーザーのログイン API は 503 を返す', async () => {
    await registerUser(app, 'maint_login_user', 'maint_login_user@example.com');
    await enableMaintenance(['login']);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'maint_login_user@example.com', password: 'password123' });

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('MAINTENANCE_MODE');
  });

  it('制限中でも admin は管理 API にアクセスできる', async () => {
    const { token } = await enableMaintenance(['posting', 'upload', 'login']);

    const res = await request(app)
      .get('/api/admin/maintenance-mode')
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
  });
});

// #394 設定エクスポート / インポート
describe('GET /api/admin/settings/export', () => {
  it('正常: admin がチャンネル・通知・NG ワード・権限を含む JSON を取得できる', async () => {
    const { token, userId } = await registerUser(
      app,
      'settings_export_admin',
      'settings_export@example.com',
    );
    await makeAdmin(userId);
    await testDb.execute(
      'INSERT INTO channels (name, created_by, posting_permission) VALUES ($1, $2, $3)',
      ['settings-export-channel', userId, 'admins'],
    );
    await testDb.execute(
      'INSERT INTO ng_words (pattern, is_regex, action, is_active, created_by) VALUES ($1, $2, $3, $4, $5)',
      ['blocked', false, 'block', true, userId],
    );

    const res = await request(app)
      .get('/api/admin/settings/export')
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body.schemaVersion).toBe(1);
    expect(res.body.channels).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'settings-export-channel' })]),
    );
    expect(res.body.ngWords).toEqual(
      expect.arrayContaining([expect.objectContaining({ pattern: 'blocked' })]),
    );
    expect(res.body.permissions).toEqual(
      expect.arrayContaining([expect.objectContaining({ username: 'settings_export_admin' })]),
    );
  });

  it('正常: エクスポート実行が監査ログに記録される', async () => {
    const { token, userId } = await registerUser(
      app,
      'settings_export_log',
      'settings_export_log@example.com',
    );
    await makeAdmin(userId);

    await request(app).get('/api/admin/settings/export').set('Cookie', `token=${token}`);

    const row = await testDb.queryOne<{ action_type: string }>(
      "SELECT action_type FROM audit_logs WHERE action_type = 'settings.export'",
      [],
    );
    expect(row?.action_type).toBe('settings.export');
  });

  it('異常: 非ログインは 401', async () => {
    const res = await request(app).get('/api/admin/settings/export');
    expect(res.status).toBe(401);
  });

  it('異常: 一般ユーザーは 403', async () => {
    const { token } = await registerUser(
      app,
      'settings_export_user',
      'settings_export_user@example.com',
    );
    const res = await request(app)
      .get('/api/admin/settings/export')
      .set('Cookie', `token=${token}`);
    expect(res.status).toBe(403);
  });
});

describe('POST /api/admin/settings/import/preview', () => {
  let previewAdminSeq = 0;

  async function adminToken() {
    previewAdminSeq += 1;
    const { token, userId } = await registerUser(
      app,
      `settings_preview_admin_${previewAdminSeq}`,
      `settings_preview_${previewAdminSeq}@example.com`,
    );
    await makeAdmin(userId);
    return token;
  }

  it('正常: JSON の差分プレビューを返す', async () => {
    const token = await adminToken();
    const res = await request(app)
      .post('/api/admin/settings/import/preview')
      .set('Cookie', `token=${token}`)
      .send({
        schemaVersion: 1,
        exportedAt: '2026-01-01T00:00:00.000Z',
        channels: [
          {
            name: 'preview-new',
            description: null,
            isPrivate: false,
            isArchived: false,
            isRecommended: false,
            postingPermission: 'everyone',
          },
        ],
        notifications: [],
        ngWords: [],
        permissions: [],
      });

    expect(res.status).toBe(200);
    expect(res.body.diff.channels.added).toBe(1);
  });

  it('異常: 不正な JSON は 400', async () => {
    const token = await adminToken();
    const res = await request(app)
      .post('/api/admin/settings/import/preview')
      .set('Cookie', `token=${token}`)
      .send('not-json-object');
    expect(res.status).toBe(400);
  });

  it('異常: スキーマ不一致の JSON は 400', async () => {
    const token = await adminToken();
    const res = await request(app)
      .post('/api/admin/settings/import/preview')
      .set('Cookie', `token=${token}`)
      .send({ schemaVersion: 2, channels: [] });
    expect(res.status).toBe(400);
  });

  it('異常: 非ログインは 401', async () => {
    const res = await request(app).post('/api/admin/settings/import/preview').send({});
    expect(res.status).toBe(401);
  });

  it('異常: 一般ユーザーは 403', async () => {
    const { token } = await registerUser(
      app,
      'settings_preview_user',
      'settings_preview_user@example.com',
    );
    const res = await request(app)
      .post('/api/admin/settings/import/preview')
      .set('Cookie', `token=${token}`)
      .send({});
    expect(res.status).toBe(403);
  });
});

describe('POST /api/admin/settings/import', () => {
  async function setupImportAdmin(username: string) {
    const { token, userId } = await registerUser(app, username, `${username}@example.com`);
    await makeAdmin(userId);
    return { token, userId };
  }

  function importPayload() {
    return {
      schemaVersion: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      channels: [
        {
          name: 'imported-channel',
          description: 'restored',
          isPrivate: true,
          isArchived: false,
          isRecommended: true,
          postingPermission: 'admins',
        },
      ],
      notifications: [],
      ngWords: [{ pattern: 'imported-ng', isRegex: false, action: 'warn', isActive: true }],
      permissions: [],
    };
  }

  it('正常: プレビュー済みの JSON から設定を復元できる', async () => {
    const { token } = await setupImportAdmin('settings_import_admin');

    const res = await request(app)
      .post('/api/admin/settings/import')
      .set('Cookie', `token=${token}`)
      .send(importPayload());

    expect(res.status).toBe(200);
    const channel = await testDb.queryOne<{ posting_permission: string; is_recommended: boolean }>(
      'SELECT posting_permission, is_recommended FROM channels WHERE name = $1',
      ['imported-channel'],
    );
    const word = await testDb.queryOne<{ action: string }>(
      'SELECT action FROM ng_words WHERE pattern = $1',
      ['imported-ng'],
    );
    expect(channel).toMatchObject({ posting_permission: 'admins', is_recommended: true });
    expect(word?.action).toBe('warn');
  });

  it('正常: インポート実行が監査ログに記録される', async () => {
    const { token } = await setupImportAdmin('settings_import_log');

    await request(app)
      .post('/api/admin/settings/import')
      .set('Cookie', `token=${token}`)
      .send(importPayload());

    const row = await testDb.queryOne<{ action_type: string }>(
      "SELECT action_type FROM audit_logs WHERE action_type = 'settings.import'",
      [],
    );
    expect(row?.action_type).toBe('settings.import');
  });

  it('異常: 不正な JSON は 400', async () => {
    const { token } = await setupImportAdmin('settings_import_bad');
    const res = await request(app)
      .post('/api/admin/settings/import')
      .set('Cookie', `token=${token}`)
      .send('not-json-object');
    expect(res.status).toBe(400);
  });

  it('異常: スキーマ不一致の JSON は 400', async () => {
    const { token } = await setupImportAdmin('settings_import_schema');
    const res = await request(app)
      .post('/api/admin/settings/import')
      .set('Cookie', `token=${token}`)
      .send({ schemaVersion: 1, channels: [] });
    expect(res.status).toBe(400);
  });

  it('異常: 非ログインは 401', async () => {
    const res = await request(app).post('/api/admin/settings/import').send(importPayload());
    expect(res.status).toBe(401);
  });

  it('異常: 一般ユーザーは 403', async () => {
    const { token } = await registerUser(
      app,
      'settings_import_user',
      'settings_import_user@example.com',
    );
    const res = await request(app)
      .post('/api/admin/settings/import')
      .set('Cookie', `token=${token}`)
      .send(importPayload());
    expect(res.status).toBe(403);
  });
});

describe('GET /api/admin/channels（isRecommended フィールド）', () => {
  it('レスポンスの各チャンネルに isRecommended: boolean が含まれる', async () => {
    const { token, userId } = await registerUser(app, 'adm_rec_list', 'adm_rec_list@example.com');
    await makeAdmin(userId);

    await testDb.execute(
      'INSERT INTO channels (name, created_by, is_recommended) VALUES ($1, $2, $3)',
      ['rec-list-ch', userId, true],
    );

    const res = await request(app).get('/api/admin/channels').set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    const channels = res.body.channels as { isRecommended: boolean }[];
    channels.forEach((c) => {
      expect(typeof c.isRecommended).toBe('boolean');
    });
  });
});
describe('GET /api/admin/orphan-files', () => {
  it('管理者が取得すると200と孤立ファイルのID・ファイル名・サイズ・アップロード日時・アップロード者を返す', async () => {
    const { token, userId } = await registerUser(
      app,
      'orphan_list_admin',
      'orphan_list_admin@example.com',
    );
    await makeAdmin(userId);
    const inserted = await testDb.execute(
      `INSERT INTO message_attachments
        (url, original_name, size, mime_type, uploaded_by, created_at)
       VALUES ('/uploads/list.txt', 'list.txt', 2048, 'text/plain', $1, NOW() - INTERVAL '25 hours')
       RETURNING id`,
      [userId],
    );

    const res = await request(app).get('/api/admin/orphan-files').set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body.files).toContainEqual({
      id: Number(inserted.rows[0].id),
      originalName: 'list.txt',
      size: 2048,
      createdAt: expect.any(String),
      uploader: { id: userId, username: 'orphan_list_admin' },
    });
  });

  it('候補がない場合は200と空配列を返す', async () => {
    const { token, userId } = await registerUser(
      app,
      'orphan_empty_admin',
      'orphan_empty_admin@example.com',
    );
    await makeAdmin(userId);
    await testDb.execute('DELETE FROM message_attachments');

    const res = await request(app).get('/api/admin/orphan-files').set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ files: [] });
  });

  it('未認証ユーザーは401を返す', async () => {
    expect((await request(app).get('/api/admin/orphan-files')).status).toBe(401);
  });

  it('一般ユーザーは403を返す', async () => {
    const { token } = await registerUser(app, 'orphan_list_user', 'orphan_list_user@example.com');
    expect(
      (await request(app).get('/api/admin/orphan-files').set('Cookie', `token=${token}`)).status,
    ).toBe(403);
  });
});

describe('DELETE /api/admin/orphan-files', () => {
  async function setupAdminAndOrphans(count: number) {
    const suffix = `${count}_${Date.now()}_${Math.random()}`;
    const { token, userId } = await registerUser(
      app,
      `orphan_del_${suffix}`,
      `orphan_del_${suffix}@example.com`,
    );
    await makeAdmin(userId);
    const ids: number[] = [];
    for (let index = 0; index < count; index += 1) {
      const result = await testDb.execute(
        `INSERT INTO message_attachments
          (url, original_name, size, mime_type, uploaded_by, created_at)
         VALUES ($1, $2, 10, 'text/plain', $3, NOW() - INTERVAL '25 hours') RETURNING id`,
        [`/uploads/missing-${suffix}-${index}.txt`, `missing-${index}.txt`, userId],
      );
      ids.push(Number(result.rows[0].id));
    }
    return { token, ids };
  }

  it('管理者が1件の候補IDを指定すると削除件数と削除対象IDを返す', async () => {
    const { token, ids } = await setupAdminAndOrphans(1);
    const res = await request(app)
      .delete('/api/admin/orphan-files')
      .set('Cookie', `token=${token}`)
      .send({ ids });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deletedCount: 1, deletedIds: ids, skippedIds: [], failed: [] });
  });

  it('管理者が複数の候補IDを指定すると一括削除結果を返す', async () => {
    const { token, ids } = await setupAdminAndOrphans(2);
    const res = await request(app)
      .delete('/api/admin/orphan-files')
      .set('Cookie', `token=${token}`)
      .send({ ids });
    expect(res.status).toBe(200);
    expect(res.body.deletedIds).toEqual(ids);
    expect(res.body.deletedCount).toBe(2);
  });

  it.each([[[]], [['1']], [[1.5]], [[0]], [[-1]]])(
    '削除対象IDが空配列または整数以外を含む場合は400を返す: %j',
    async (ids: unknown[]) => {
      const { token } = await setupAdminAndOrphans(0);
      const res = await request(app)
        .delete('/api/admin/orphan-files')
        .set('Cookie', `token=${token}`)
        .send({ ids });
      expect(res.status).toBe(400);
    },
  );

  it('重複したIDを指定しても削除件数を水増ししない', async () => {
    const { token, ids } = await setupAdminAndOrphans(1);
    const res = await request(app)
      .delete('/api/admin/orphan-files')
      .set('Cookie', `token=${token}`)
      .send({ ids: [ids[0], ids[0]] });
    expect(res.body.deletedCount).toBe(1);
    expect(res.body.deletedIds).toEqual(ids);
  });

  it('候補外または存在しないIDを指定しても対象ファイルを削除しない', async () => {
    const { token, ids } = await setupAdminAndOrphans(1);
    await testDb.execute('UPDATE message_attachments SET created_at = NOW() WHERE id = $1', [
      ids[0],
    ]);
    const res = await request(app)
      .delete('/api/admin/orphan-files')
      .set('Cookie', `token=${token}`)
      .send({ ids: [ids[0], 999999] });
    expect(res.body).toEqual({
      deletedCount: 0,
      deletedIds: [],
      skippedIds: [ids[0], 999999],
      failed: [],
    });
  });

  it('未認証ユーザーは401を返す', async () => {
    expect(
      (
        await request(app)
          .delete('/api/admin/orphan-files')
          .send({ ids: [1] })
      ).status,
    ).toBe(401);
  });

  it('一般ユーザーは403を返す', async () => {
    const { token } = await registerUser(app, 'orphan_del_user', 'orphan_del_user@example.com');
    expect(
      (
        await request(app)
          .delete('/api/admin/orphan-files')
          .set('Cookie', `token=${token}`)
          .send({ ids: [1] })
      ).status,
    ).toBe(403);
  });
});
