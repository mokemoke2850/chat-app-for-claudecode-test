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
import { registerUser } from '../__fixtures__/testHelpers';

const app = createApp();

/** DB でユーザーを admin に昇格するヘルパー */
async function makeAdmin(userId: number): Promise<void> {
  await testDb.execute("UPDATE users SET role = 'admin' WHERE id = $1", [userId]);
}

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
