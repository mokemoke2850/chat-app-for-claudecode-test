/**
 * テスト対象: POST /api/channels/:id/read（markAsRead コントローラー）の Socket.IO 配信
 *
 * 修正 Issue #240: markChannelAsRead 成功時に対象ユーザーへ mention_updated を emit する。
 *
 * 戦略:
 *   - pg-mem のインメモリ DB を使用
 *   - getSocketServer を jest.mock で差し替え、mention_updated emit を検証する
 *   - supertest で HTTP リクエストを発行し、204 レスポンスと Socket emit を確認する
 */

import { createTestDatabase, resetTestData } from './__fixtures__/pgTestHelper';

const testDb = createTestDatabase();
jest.mock('../db/database', () => testDb);

// Socket.IO サーバーモック
const mockEmit = jest.fn();
const mockSocketTo = jest.fn().mockReturnValue({ emit: mockEmit });
const mockSocketServer = { to: mockSocketTo };

jest.mock('../socket', () => ({
  getSocketServer: jest.fn(() => mockSocketServer),
}));

import request from 'supertest';
import { createApp } from '../app';
import { registerUser, createChannelReq } from './__fixtures__/testHelpers';
import { createMessage } from '../services/messageService';

const app = createApp();

beforeEach(async () => {
  jest.clearAllMocks();
  mockSocketTo.mockReturnValue({ emit: mockEmit });
  await resetTestData(testDb);
});

describe('POST /api/channels/:id/read — Socket.IO mention_updated 配信', () => {
  it('既読化成功時に user:${userId} ルームへ mention_updated が emit される', async () => {
    const { token, userId } = await registerUser(app, 'read_emit1', 'read_emit1@t.com');
    const channelId = await createChannelReq(app, token, 'read-emit-ch1');

    // メンションメッセージを作成してから既読化する
    await createMessage(channelId, userId, 'hello @read_emit1', [userId]);

    const res = await request(app)
      .post(`/api/channels/${channelId}/read`)
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(204);

    // user:{userId} ルームへ emit されたこと
    expect(mockSocketTo).toHaveBeenCalledWith(`user:${userId}`);
    expect(mockEmit).toHaveBeenCalledWith(
      'mention_updated',
      expect.objectContaining({ channelId }),
    );
  });

  it('既読化後の mention_updated の mentionCount は 0 になる', async () => {
    const { token, userId } = await registerUser(app, 'read_emit2', 'read_emit2@t.com');
    const channelId = await createChannelReq(app, token, 'read-emit-ch2');

    // メンションメッセージを作成
    await createMessage(channelId, userId, 'hello @me', [userId]);

    await request(app).post(`/api/channels/${channelId}/read`).set('Cookie', `token=${token}`);

    const emitCall = mockEmit.mock.calls.find(([event]: [string]) => event === 'mention_updated');
    expect(emitCall).toBeDefined();
    const payload = emitCall![1] as { channelId: number; mentionCount: number };
    expect(payload.mentionCount).toBe(0);
  });

  it('メンションがない状態で既読化した場合も mentionCount: 0 で mention_updated が emit される', async () => {
    const { token, userId } = await registerUser(app, 'read_emit3', 'read_emit3@t.com');
    const channelId = await createChannelReq(app, token, 'read-emit-ch3');

    // メンションなし（通常メッセージのみ）
    const res = await request(app)
      .post(`/api/channels/${channelId}/read`)
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(204);
    // クライアントが再フェッチのトリガとして使うため、mentionCount: 0 でも emit する
    expect(mockSocketTo).toHaveBeenCalledWith(`user:${userId}`);
    expect(mockEmit).toHaveBeenCalledWith('mention_updated', {
      channelId,
      mentionCount: 0,
    });
  });

  it('存在しないチャンネルへの既読化リクエストは 404 を返し emit しない', async () => {
    const { token } = await registerUser(app, 'read_emit4', 'read_emit4@t.com');

    const res = await request(app).post('/api/channels/99999/read').set('Cookie', `token=${token}`);

    expect(res.status).toBe(404);
    expect(mockEmit).not.toHaveBeenCalled();
  });
});
