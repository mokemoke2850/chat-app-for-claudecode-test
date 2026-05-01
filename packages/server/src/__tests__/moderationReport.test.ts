/**
 * テスト対象: #116 通報 / モデレーションキュー
 *
 * 戦略:
 *   - moderationReportService の単体テスト: 通報・却下・メッセージ削除アクションのビジネスロジック
 *   - HTTP 統合テスト: POST /api/messages/:id/report, GET/POST /api/admin/reports/*
 *   - 監査ログ記録の検証
 *   - pg-mem のインメモリ PostgreSQL 互換 DB を使用
 */

import { createTestDatabase, resetTestData } from './__fixtures__/pgTestHelper';

const testDb = createTestDatabase();
jest.mock('../db/database', () => testDb);

import request from 'supertest';
import { createApp } from '../app';
import { registerUser, createChannelReq, insertMessage } from './__fixtures__/testHelpers';
import * as moderationReportService from '../services/moderationReportService';
import { listAuditLogs } from '../services/auditLogService';

const app = createApp();

async function promoteToAdmin(userId: number): Promise<void> {
  await testDb.execute('UPDATE users SET role = $1 WHERE id = $2', ['admin', userId]);
}

/** テストデータ作成ヘルパー: ユーザー・チャンネル・メッセージを一括作成 */
async function setupReportScenario() {
  const { token: reporterToken, userId: reporterId } = await registerUser(
    app,
    'reporter',
    'reporter@example.com',
  );
  const { token: authorToken, userId: authorId } = await registerUser(
    app,
    'author',
    'author@example.com',
  );
  const channelId = await createChannelReq(app, authorToken, 'test-channel');
  const messageId = await insertMessage(channelId, authorId, 'test message content');
  return { reporterToken, reporterId, authorToken, authorId, channelId, messageId };
}

/** 通報レコードを直接 INSERT して ID を返す */
async function insertReport(
  messageId: number,
  reporterId: number,
  status = 'pending',
  actionTaken: string | null = null,
): Promise<number> {
  const row = await testDb.queryOne<{ id: number }>(
    `INSERT INTO message_reports (message_id, reporter_id, reason, status, action_taken)
     VALUES ($1, $2, 'spam', $3, $4) RETURNING id`,
    [messageId, reporterId, status, actionTaken],
  );
  return row!.id;
}

beforeEach(async () => {
  await resetTestData(testDb);
});

// ─── moderationReportService ユニットテスト ────────────────────

describe('moderationReportService.report', () => {
  it('メッセージを通報できる', async () => {
    const { reporterId, authorId, channelId } = await setupReportScenario();
    const msgId = await insertMessage(channelId, authorId, 'reportable');
    const result = await moderationReportService.report(reporterId, msgId, { reason: 'spam' });
    expect(result.messageId).toBe(msgId);
    expect(result.channelId).toBe(channelId);
    expect(result.reporterId).toBe(reporterId);
    expect(result.reason).toBe('spam');
    expect(result.status).toBe('pending');
  });

  it('自分のメッセージを通報すると 400 になる', async () => {
    const { authorId, messageId } = await setupReportScenario();
    await expect(
      moderationReportService.report(authorId, messageId, { reason: 'spam' }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('同一ユーザーが同一メッセージを二重通報すると 409 になる', async () => {
    const { reporterId, messageId } = await setupReportScenario();
    await moderationReportService.report(reporterId, messageId, { reason: 'spam' });
    await expect(
      moderationReportService.report(reporterId, messageId, { reason: 'harassment' }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('存在しないメッセージを通報すると 404 になる', async () => {
    const { reporterId } = await setupReportScenario();
    await expect(
      moderationReportService.report(reporterId, 99999, { reason: 'spam' }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  // 追加仕様 1: 削除済みメッセージへの通報は不可
  it('is_deleted = true のメッセージを通報すると 404 になる', async () => {
    const { reporterId, messageId } = await setupReportScenario();
    await testDb.execute('UPDATE messages SET is_deleted = true WHERE id = $1', [messageId]);
    await expect(
      moderationReportService.report(reporterId, messageId, { reason: 'spam' }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('moderationReportService.listQueue', () => {
  it('pending ステータスの通報一覧を返す', async () => {
    const { reporterId, messageId } = await setupReportScenario();
    await insertReport(messageId, reporterId, 'pending');
    const reports = await moderationReportService.listQueue({ status: 'pending' });
    expect(reports.length).toBeGreaterThanOrEqual(1);
    expect(reports.every((r) => r.status === 'pending')).toBe(true);
  });

  it('status フィルタで dismissed も取得できる', async () => {
    const { reporterId, messageId } = await setupReportScenario();
    await insertReport(messageId, reporterId, 'dismissed');
    const reports = await moderationReportService.listQueue({ status: 'dismissed' });
    expect(reports.some((r) => r.status === 'dismissed')).toBe(true);
  });
});

describe('moderationReportService.dismiss', () => {
  it('pending の通報を dismissed にできる', async () => {
    const { reporterId, authorId, messageId } = await setupReportScenario();
    const reportId = await insertReport(messageId, reporterId, 'pending');
    const result = await moderationReportService.dismiss(reportId, authorId);
    expect(result.status).toBe('dismissed');
    expect(result.handledBy).toBe(authorId);
  });

  it('存在しない通報を却下すると 404 になる', async () => {
    const { authorId } = await setupReportScenario();
    await expect(moderationReportService.dismiss(99999, authorId)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  // 追加仕様 3: 冪等
  it('既に dismissed の通報を再度却下しても 200 で同じ結果を返す（冪等）', async () => {
    const { reporterId, authorId, messageId } = await setupReportScenario();
    const reportId = await insertReport(messageId, reporterId, 'dismissed');
    const result = await moderationReportService.dismiss(reportId, authorId);
    expect(result.status).toBe('dismissed');
  });

  it('既に actioned の通報を却下しても 200 で同じ結果を返す（冪等）', async () => {
    const { reporterId, authorId, messageId } = await setupReportScenario();
    const reportId = await insertReport(messageId, reporterId, 'actioned', 'delete_message');
    const result = await moderationReportService.dismiss(reportId, authorId);
    expect(result.status).toBe('actioned');
  });

  it('冪等ケースでは監査ログが重複記録されない', async () => {
    const { reporterId, authorId, messageId } = await setupReportScenario();
    const reportId = await insertReport(messageId, reporterId, 'dismissed');
    await moderationReportService.dismiss(reportId, authorId);
    await moderationReportService.dismiss(reportId, authorId);
    const { logs } = await listAuditLogs({ actionType: 'report.dismiss' });
    // 冪等ケースなので新規ログは記録されない（0件）
    expect(logs.length).toBe(0);
  });
});

describe('moderationReportService.actionDeleteMessage', () => {
  it('通報に対して delete_message アクションを取るとメッセージが is_deleted = true になる', async () => {
    const { reporterId, authorId, messageId } = await setupReportScenario();
    const reportId = await insertReport(messageId, reporterId, 'pending');
    await moderationReportService.actionDeleteMessage(reportId, authorId);
    const msg = await testDb.queryOne<{ is_deleted: boolean }>(
      'SELECT is_deleted FROM messages WHERE id = $1',
      [messageId],
    );
    expect(msg!.is_deleted).toBe(true);
  });

  it('通報の status が actioned、action_taken が delete_message になる', async () => {
    const { reporterId, authorId, messageId } = await setupReportScenario();
    const reportId = await insertReport(messageId, reporterId, 'pending');
    const result = await moderationReportService.actionDeleteMessage(reportId, authorId);
    expect(result.status).toBe('actioned');
    expect(result.actionTaken).toBe('delete_message');
  });

  it('存在しない通報に対してアクションを取ると 404 になる', async () => {
    const { authorId } = await setupReportScenario();
    await expect(
      moderationReportService.actionDeleteMessage(99999, authorId),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  // 追加仕様 3: 冪等
  it('既に actioned の通報に再度アクションを取っても 200 で同じ結果を返す（冪等）', async () => {
    const { reporterId, authorId, messageId } = await setupReportScenario();
    const reportId = await insertReport(messageId, reporterId, 'actioned', 'delete_message');
    const result = await moderationReportService.actionDeleteMessage(reportId, authorId);
    expect(result.status).toBe('actioned');
  });

  it('冪等ケースでは監査ログが重複記録されない', async () => {
    const { reporterId, authorId, messageId } = await setupReportScenario();
    const reportId = await insertReport(messageId, reporterId, 'actioned', 'delete_message');
    await moderationReportService.actionDeleteMessage(reportId, authorId);
    await moderationReportService.actionDeleteMessage(reportId, authorId);
    const { logs } = await listAuditLogs({ actionType: 'report.action.delete_message' });
    // 冪等ケースなので新規ログは記録されない（0件）
    expect(logs.length).toBe(0);
  });
});

// ─── POST /api/messages/:id/report ───────────────────────────

describe('POST /api/messages/:id/report', () => {
  it('認証ユーザーがメッセージを通報できる（201）', async () => {
    const { reporterToken, messageId } = await setupReportScenario();
    const res = await request(app)
      .post(`/api/messages/${messageId}/report`)
      .set('Cookie', `token=${reporterToken}`)
      .send({ reason: 'spam' });
    expect(res.status).toBe(201);
    expect(res.body.report).toBeDefined();
    expect(res.body.report.reason).toBe('spam');
  });

  it('未認証のリクエストは 401 を返す', async () => {
    const { messageId } = await setupReportScenario();
    const res = await request(app)
      .post(`/api/messages/${messageId}/report`)
      .send({ reason: 'spam' });
    expect(res.status).toBe(401);
  });

  it('自分のメッセージを通報すると 400 を返す', async () => {
    const { authorToken, messageId } = await setupReportScenario();
    const res = await request(app)
      .post(`/api/messages/${messageId}/report`)
      .set('Cookie', `token=${authorToken}`)
      .send({ reason: 'spam' });
    expect(res.status).toBe(400);
  });

  it('同一メッセージへの二重通報は 409 を返す', async () => {
    const { reporterToken, messageId } = await setupReportScenario();
    await request(app)
      .post(`/api/messages/${messageId}/report`)
      .set('Cookie', `token=${reporterToken}`)
      .send({ reason: 'spam' });
    const res = await request(app)
      .post(`/api/messages/${messageId}/report`)
      .set('Cookie', `token=${reporterToken}`)
      .send({ reason: 'harassment' });
    expect(res.status).toBe(409);
  });

  it('reason が不正値の場合は 400 を返す', async () => {
    const { reporterToken, messageId } = await setupReportScenario();
    const res = await request(app)
      .post(`/api/messages/${messageId}/report`)
      .set('Cookie', `token=${reporterToken}`)
      .send({ reason: 'invalid_reason' });
    expect(res.status).toBe(400);
  });

  // 追加仕様 1: 削除済みメッセージへの通報は不可
  it('is_deleted = true のメッセージを通報すると 404 を返す', async () => {
    const { reporterToken, messageId } = await setupReportScenario();
    await testDb.execute('UPDATE messages SET is_deleted = true WHERE id = $1', [messageId]);
    const res = await request(app)
      .post(`/api/messages/${messageId}/report`)
      .set('Cookie', `token=${reporterToken}`)
      .send({ reason: 'spam' });
    expect(res.status).toBe(404);
  });

  // 追加仕様 2: 通報完了レスポンスには通報者情報を含めない
  it('201 レスポンスに reporterId / reporterUsername が含まれない', async () => {
    const { reporterToken, messageId } = await setupReportScenario();
    const res = await request(app)
      .post(`/api/messages/${messageId}/report`)
      .set('Cookie', `token=${reporterToken}`)
      .send({ reason: 'spam' });
    expect(res.status).toBe(201);
    expect(res.body.report.reporterId).toBeUndefined();
    expect(res.body.report.reporterUsername).toBeUndefined();
  });
});

// ─── GET /api/admin/reports ───────────────────────────────────

describe('GET /api/admin/reports', () => {
  it('管理者は通報一覧を取得できる（200）', async () => {
    const { token, userId } = await registerUser(app, 'admin1', 'admin1@example.com');
    await promoteToAdmin(userId);
    const res = await request(app).get('/api/admin/reports').set('Cookie', `token=${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.reports)).toBe(true);
  });

  it('一般ユーザーは 403 を返す', async () => {
    // 先にダミー admin を作って 2 人目は一般ユーザーになるようにする
    await registerUser(app, 'dummy_admin', 'dummy_admin@example.com');
    const { token } = await registerUser(app, 'user1', 'user1@example.com');
    const res = await request(app).get('/api/admin/reports').set('Cookie', `token=${token}`);
    expect(res.status).toBe(403);
  });

  it('status クエリで絞り込みができる', async () => {
    const { token: adminToken, userId: adminId } = await registerUser(
      app,
      'admin2',
      'admin2@example.com',
    );
    await promoteToAdmin(adminId);
    const { token: authorToken, userId: authorId } = await registerUser(
      app,
      'author2',
      'author2@example.com',
    );
    const { userId: reporterId } = await registerUser(app, 'reporter2', 'reporter2@example.com');
    const channelId = await createChannelReq(app, authorToken, 'ch-filter');
    const msgId = await insertMessage(channelId, authorId, 'filter test');
    await insertReport(msgId, reporterId, 'dismissed');

    const res = await request(app)
      .get('/api/admin/reports?status=dismissed')
      .set('Cookie', `token=${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.reports.every((r: { status: string }) => r.status === 'dismissed')).toBe(true);
  });

  // 追加仕様 2: 管理者レスポンスには通報者情報が含まれる
  it('管理者向けレスポンスには reporterId と reporterUsername が含まれる', async () => {
    const { token: adminToken, userId: adminId } = await registerUser(
      app,
      'admin3',
      'admin3@example.com',
    );
    await promoteToAdmin(adminId);
    const { token: authorToken, userId: authorId } = await registerUser(
      app,
      'author3',
      'author3@example.com',
    );
    const { userId: reporterId } = await registerUser(app, 'reporter3', 'reporter3@example.com');
    const channelId = await createChannelReq(app, authorToken, 'ch-privacy');
    const msgId = await insertMessage(channelId, authorId, 'privacy test');
    await insertReport(msgId, reporterId, 'pending');

    const res = await request(app).get('/api/admin/reports').set('Cookie', `token=${adminToken}`);
    expect(res.status).toBe(200);
    const rep = res.body.reports.find((r: { reporterId: number }) => r.reporterId === reporterId);
    expect(rep).toBeDefined();
    expect(rep.reporterId).toBe(reporterId);
    expect(rep.reporterUsername).toBe('reporter3');
  });
});

// ─── POST /api/admin/reports/:id/dismiss ──────────────────────

describe('POST /api/admin/reports/:id/dismiss', () => {
  it('管理者が通報を却下できる（200）', async () => {
    const { token: adminToken, userId: adminId } = await registerUser(
      app,
      'adm_d1',
      'adm_d1@example.com',
    );
    await promoteToAdmin(adminId);
    const { token: authorToken, userId: authorId } = await registerUser(
      app,
      'aut_d1',
      'aut_d1@example.com',
    );
    const { userId: reporterId } = await registerUser(app, 'rep_d1', 'rep_d1@example.com');
    const channelId = await createChannelReq(app, authorToken, 'ch-dismiss1');
    const msgId = await insertMessage(channelId, authorId, 'msg-dismiss');
    const reportId = await insertReport(msgId, reporterId, 'pending');

    const res = await request(app)
      .post(`/api/admin/reports/${reportId}/dismiss`)
      .set('Cookie', `token=${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.report.status).toBe('dismissed');
  });

  it('一般ユーザーは 403 を返す', async () => {
    await registerUser(app, 'dummy_adm_d', 'dummy_adm_d@example.com');
    const { token } = await registerUser(app, 'usr_d1', 'usr_d1@example.com');
    const res = await request(app)
      .post('/api/admin/reports/1/dismiss')
      .set('Cookie', `token=${token}`);
    expect(res.status).toBe(403);
  });

  it('存在しない通報は 404 を返す', async () => {
    const { token, userId } = await registerUser(app, 'adm_d2', 'adm_d2@example.com');
    await promoteToAdmin(userId);
    const res = await request(app)
      .post('/api/admin/reports/99999/dismiss')
      .set('Cookie', `token=${token}`);
    expect(res.status).toBe(404);
  });

  // 追加仕様 3: 冪等
  it('既に dismissed の通報への再却下は 200 で冪等に成功する', async () => {
    const { token: adminToken, userId: adminId } = await registerUser(
      app,
      'adm_d3',
      'adm_d3@example.com',
    );
    await promoteToAdmin(adminId);
    const { token: authorToken, userId: authorId } = await registerUser(
      app,
      'aut_d3',
      'aut_d3@example.com',
    );
    const { userId: reporterId } = await registerUser(app, 'rep_d3', 'rep_d3@example.com');
    const channelId = await createChannelReq(app, authorToken, 'ch-idem-d');
    const msgId = await insertMessage(channelId, authorId, 'idem-dismiss');
    const reportId = await insertReport(msgId, reporterId, 'dismissed');

    const res = await request(app)
      .post(`/api/admin/reports/${reportId}/dismiss`)
      .set('Cookie', `token=${adminToken}`);
    expect(res.status).toBe(200);
  });
});

// ─── POST /api/admin/reports/:id/action ──────────────────────

describe('POST /api/admin/reports/:id/action', () => {
  it('管理者が delete_message アクションを実行できる（200）', async () => {
    const { token: adminToken, userId: adminId } = await registerUser(
      app,
      'adm_a1',
      'adm_a1@example.com',
    );
    await promoteToAdmin(adminId);
    const { token: authorToken, userId: authorId } = await registerUser(
      app,
      'aut_a1',
      'aut_a1@example.com',
    );
    const { userId: reporterId } = await registerUser(app, 'rep_a1', 'rep_a1@example.com');
    const channelId = await createChannelReq(app, authorToken, 'ch-action1');
    const msgId = await insertMessage(channelId, authorId, 'action msg');
    const reportId = await insertReport(msgId, reporterId, 'pending');

    const res = await request(app)
      .post(`/api/admin/reports/${reportId}/action`)
      .set('Cookie', `token=${adminToken}`)
      .send({ actionType: 'delete_message' });
    expect(res.status).toBe(200);
    expect(res.body.report.status).toBe('actioned');
    expect(res.body.report.actionTaken).toBe('delete_message');
  });

  it('一般ユーザーは 403 を返す', async () => {
    await registerUser(app, 'dummy_adm_a', 'dummy_adm_a@example.com');
    const { token } = await registerUser(app, 'usr_a1', 'usr_a1@example.com');
    const res = await request(app)
      .post('/api/admin/reports/1/action')
      .set('Cookie', `token=${token}`)
      .send({ actionType: 'delete_message' });
    expect(res.status).toBe(403);
  });

  it('不正なアクション種別は 400 を返す', async () => {
    const { token, userId } = await registerUser(app, 'adm_a2', 'adm_a2@example.com');
    await promoteToAdmin(userId);
    const res = await request(app)
      .post('/api/admin/reports/1/action')
      .set('Cookie', `token=${token}`)
      .send({ actionType: 'warn_user' });
    expect(res.status).toBe(400);
  });

  it('存在しない通報は 404 を返す', async () => {
    const { token, userId } = await registerUser(app, 'adm_a3', 'adm_a3@example.com');
    await promoteToAdmin(userId);
    const res = await request(app)
      .post('/api/admin/reports/99999/action')
      .set('Cookie', `token=${token}`)
      .send({ actionType: 'delete_message' });
    expect(res.status).toBe(404);
  });

  // 追加仕様 3: 冪等
  it('既に actioned の通報への再アクションは 200 で冪等に成功する', async () => {
    const { token: adminToken, userId: adminId } = await registerUser(
      app,
      'adm_a4',
      'adm_a4@example.com',
    );
    await promoteToAdmin(adminId);
    const { token: authorToken, userId: authorId } = await registerUser(
      app,
      'aut_a4',
      'aut_a4@example.com',
    );
    const { userId: reporterId } = await registerUser(app, 'rep_a4', 'rep_a4@example.com');
    const channelId = await createChannelReq(app, authorToken, 'ch-idem-a');
    const msgId = await insertMessage(channelId, authorId, 'idem-action');
    const reportId = await insertReport(msgId, reporterId, 'actioned', 'delete_message');

    const res = await request(app)
      .post(`/api/admin/reports/${reportId}/action`)
      .set('Cookie', `token=${adminToken}`)
      .send({ actionType: 'delete_message' });
    expect(res.status).toBe(200);
  });
});

// ─── 監査ログ ─────────────────────────────────────────────────

describe('監査ログ', () => {
  it('通報作成時に "report.create" が記録される', async () => {
    const { token: adminToken, userId: adminId } = await registerUser(
      app,
      'al_rc',
      'al_rc@example.com',
    );
    await promoteToAdmin(adminId);
    const { token: authorToken, userId: authorId } = await registerUser(
      app,
      'al_aut_rc',
      'al_aut_rc@example.com',
    );
    const { token: reporterToken, userId: reporterId } = await registerUser(
      app,
      'al_rep_rc',
      'al_rep_rc@example.com',
    );
    void adminToken;
    const channelId = await createChannelReq(app, authorToken, 'ch-al-rc');
    const msgId = await insertMessage(channelId, authorId, 'audit msg');

    await request(app)
      .post(`/api/messages/${msgId}/report`)
      .set('Cookie', `token=${reporterToken}`)
      .send({ reason: 'spam' });

    const { logs } = await listAuditLogs({ actionType: 'report.create' });
    expect(logs.find((l) => l.actorUserId === reporterId)).toBeDefined();
  });

  it('通報却下時に "report.dismiss" が記録される', async () => {
    const { token: adminToken, userId: adminId } = await registerUser(
      app,
      'al_rd',
      'al_rd@example.com',
    );
    await promoteToAdmin(adminId);
    const { token: authorToken, userId: authorId } = await registerUser(
      app,
      'al_aut_rd',
      'al_aut_rd@example.com',
    );
    const { userId: reporterId } = await registerUser(app, 'al_rep_rd', 'al_rep_rd@example.com');
    const channelId = await createChannelReq(app, authorToken, 'ch-al-rd');
    const msgId = await insertMessage(channelId, authorId, 'dismiss msg');
    const reportId = await insertReport(msgId, reporterId, 'pending');

    await request(app)
      .post(`/api/admin/reports/${reportId}/dismiss`)
      .set('Cookie', `token=${adminToken}`);

    const { logs } = await listAuditLogs({ actionType: 'report.dismiss' });
    expect(logs.find((l) => l.actorUserId === adminId)).toBeDefined();
  });

  it('delete_message アクション実行時に "report.action.delete_message" が記録される', async () => {
    const { token: adminToken, userId: adminId } = await registerUser(
      app,
      'al_ra',
      'al_ra@example.com',
    );
    await promoteToAdmin(adminId);
    const { token: authorToken, userId: authorId } = await registerUser(
      app,
      'al_aut_ra',
      'al_aut_ra@example.com',
    );
    const { userId: reporterId } = await registerUser(app, 'al_rep_ra', 'al_rep_ra@example.com');
    const channelId = await createChannelReq(app, authorToken, 'ch-al-ra');
    const msgId = await insertMessage(channelId, authorId, 'action msg');
    const reportId = await insertReport(msgId, reporterId, 'pending');

    await request(app)
      .post(`/api/admin/reports/${reportId}/action`)
      .set('Cookie', `token=${adminToken}`)
      .send({ actionType: 'delete_message' });

    const { logs } = await listAuditLogs({ actionType: 'report.action.delete_message' });
    expect(logs.find((l) => l.actorUserId === adminId)).toBeDefined();
  });
});
