/**
 * チャンネル添付ファイル一覧エンドポイントのHTTPレベルテスト
 *
 * テスト対象: GET /api/channels/:id/attachments
 * 戦略: supertest でHTTPリクエストを発行し、レスポンスのステータスコードと
 * レスポンスボディを検証する。DB は pg-mem のインメモリ PostgreSQL 互換 DB を使用。
 */

import { createTestDatabase } from '../__fixtures__/pgTestHelper';

const testDb = createTestDatabase();

jest.mock('../../db/database', () => testDb);

import request from 'supertest';
import { createApp } from '../../app';
import { registerUser, createChannelReq, insertMessage } from '../__fixtures__/testHelpers';

const app = createApp();

/** テスト用添付ファイルをDBに直接挿入する */
async function insertAttachment(
  messageId: number,
  opts: { url?: string; originalName?: string; size?: number; mimeType?: string } = {},
): Promise<number> {
  const result = await testDb.execute(
    `INSERT INTO message_attachments (message_id, url, original_name, size, mime_type)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [
      messageId,
      opts.url ?? '/uploads/test.png',
      opts.originalName ?? 'test.png',
      opts.size ?? 1024,
      opts.mimeType ?? 'image/png',
    ],
  );
  return result.rows[0].id as number;
}

describe('GET /api/channels/:id/attachments', () => {
  it('正常: 認証済みユーザーが添付ファイル一覧を取得すると200と配列が返る', async () => {
    const { token, userId } = await registerUser(app, 'user_att1', 'user_att1@example.com');
    const channelId = await createChannelReq(app, token, 'att-channel-1');
    const msgId = await insertMessage(channelId, userId, 'hello');
    await insertAttachment(msgId);

    const res = await request(app)
      .get(`/api/channels/${channelId}/attachments`)
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('attachments');
    expect(Array.isArray(res.body.attachments)).toBe(true);
    expect(res.body.attachments).toHaveLength(1);
  });

  it('正常: ファイルタイプ（mime_type）パラメータでフィルタリングできる（例: image/*）', async () => {
    const { token, userId } = await registerUser(app, 'user_att2', 'user_att2@example.com');
    const channelId = await createChannelReq(app, token, 'att-channel-2');
    const msgId = await insertMessage(channelId, userId, 'hello');
    await insertAttachment(msgId, { mimeType: 'image/png', originalName: 'photo.png' });
    await insertAttachment(msgId, { mimeType: 'application/pdf', originalName: 'doc.pdf' });
    await insertAttachment(msgId, { mimeType: 'text/plain', originalName: 'note.txt' });

    const res = await request(app)
      .get(`/api/channels/${channelId}/attachments?type=image`)
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body.attachments).toHaveLength(1);
    expect(res.body.attachments[0].mimeType).toBe('image/png');
  });

  it('正常: ファイルタイプ（mime_type）パラメータでフィルタリングできる（例: application/pdf）', async () => {
    const { token, userId } = await registerUser(app, 'user_att3', 'user_att3@example.com');
    const channelId = await createChannelReq(app, token, 'att-channel-3');
    const msgId = await insertMessage(channelId, userId, 'hello');
    await insertAttachment(msgId, { mimeType: 'image/png', originalName: 'photo.png' });
    await insertAttachment(msgId, { mimeType: 'application/pdf', originalName: 'doc.pdf' });

    const res = await request(app)
      .get(`/api/channels/${channelId}/attachments?type=pdf`)
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body.attachments).toHaveLength(1);
    expect(res.body.attachments[0].mimeType).toBe('application/pdf');
  });

  it('正常: ファイルタイプ（mime_type）パラメータでフィルタリングできる（例: other）', async () => {
    const { token, userId } = await registerUser(app, 'user_att4', 'user_att4@example.com');
    const channelId = await createChannelReq(app, token, 'att-channel-4');
    const msgId = await insertMessage(channelId, userId, 'hello');
    await insertAttachment(msgId, { mimeType: 'image/png', originalName: 'photo.png' });
    await insertAttachment(msgId, { mimeType: 'application/pdf', originalName: 'doc.pdf' });
    await insertAttachment(msgId, { mimeType: 'text/plain', originalName: 'note.txt' });

    const res = await request(app)
      .get(`/api/channels/${channelId}/attachments?type=other`)
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body.attachments).toHaveLength(1);
    expect(res.body.attachments[0].mimeType).toBe('text/plain');
  });

  it('正常: 各添付ファイルにファイル名・アップロード者・日時・サイズが含まれる', async () => {
    const { token, userId } = await registerUser(app, 'user_att5', 'user_att5@example.com');
    const channelId = await createChannelReq(app, token, 'att-channel-5');
    const msgId = await insertMessage(channelId, userId, 'hello');
    await insertAttachment(msgId, {
      originalName: 'report.pdf',
      size: 2048,
      mimeType: 'application/pdf',
    });

    const res = await request(app)
      .get(`/api/channels/${channelId}/attachments`)
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    const att = res.body.attachments[0] as Record<string, unknown>;
    expect(att).toHaveProperty('originalName', 'report.pdf');
    expect(att).toHaveProperty('size', 2048);
    expect(att).toHaveProperty('mimeType', 'application/pdf');
    expect(att).toHaveProperty('uploaderName', 'user_att5');
    expect(att).toHaveProperty('createdAt');
  });

  it('正常: 添付ファイルが0件の場合は空配列が返る', async () => {
    const { token } = await registerUser(app, 'user_att6', 'user_att6@example.com');
    const channelId = await createChannelReq(app, token, 'att-channel-6');

    const res = await request(app)
      .get(`/api/channels/${channelId}/attachments`)
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body.attachments).toEqual([]);
  });

  it('異常: 存在しないチャンネルIDを指定すると404が返る', async () => {
    const { token } = await registerUser(app, 'user_att7', 'user_att7@example.com');

    const res = await request(app)
      .get('/api/channels/99999/attachments')
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(404);
  });

  it('異常: 認証なしで401が返る', async () => {
    const res = await request(app).get('/api/channels/1/attachments');
    expect(res.status).toBe(401);
  });
});
