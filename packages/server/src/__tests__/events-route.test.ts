/**
 * テスト対象: POST /api/events（events.ts ルート）の Socket.IO 配信
 * 戦略:
 *   - pg-mem のインメモリ DB を使用
 *   - getSocketServer を jest.mock で差し替え、new_message emit を検証する
 *   - supertest で HTTP リクエストを発行し、201 レスポンスと Socket emit を確認する
 */

import { getSharedTestDatabase, resetTestData } from './__fixtures__/pgTestHelper';

const testDb = getSharedTestDatabase();
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

const app = createApp();

beforeEach(async () => {
  jest.clearAllMocks();
  mockSocketTo.mockReturnValue({ emit: mockEmit });
  await resetTestData(testDb);
});

describe('POST /api/events — Socket.IO 配信', () => {
  it('イベント作成後に new_message イベントがチャンネル参加者全員に emit される', async () => {
    const { token } = await registerUser(app, 'ev_route1', 'ev_route1@t.com');
    const channelId = await createChannelReq(app, token, 'ev-route-ch1');

    const res = await request(app).post('/api/events').set('Cookie', `token=${token}`).send({
      channelId,
      title: 'Socket テストイベント',
      startsAt: '2030-06-01T10:00:00.000Z',
    });

    expect(res.status).toBe(201);
    expect(res.body.event.title).toBe('Socket テストイベント');

    // channel:{channelId} ルームへ to() が呼ばれたこと
    expect(mockSocketTo).toHaveBeenCalledWith(`channel:${channelId}`);
    // new_message イベントが emit されたこと
    expect(mockEmit).toHaveBeenCalledWith(
      'new_message',
      expect.objectContaining({
        channelId,
        event: expect.objectContaining({ title: 'Socket テストイベント' }),
      }),
    );
  });

  it('イベント作成成功時に new_message の payload に event フィールドが含まれる', async () => {
    const { token } = await registerUser(app, 'ev_route2', 'ev_route2@t.com');
    const channelId = await createChannelReq(app, token, 'ev-route-ch2');

    await request(app).post('/api/events').set('Cookie', `token=${token}`).send({
      channelId,
      title: 'Payload 確認',
      startsAt: '2030-06-01T10:00:00.000Z',
      endsAt: '2030-06-01T12:00:00.000Z',
    });

    const emitArgs = mockEmit.mock.calls[0] as [string, unknown];
    const [eventName, payload] = emitArgs;
    expect(eventName).toBe('new_message');
    const msg = payload as Record<string, unknown>;
    expect(typeof msg.id).toBe('number');
    expect(msg.channelId).toBe(channelId);
    const ev = msg.event as Record<string, unknown>;
    expect(ev.title).toBe('Payload 確認');
    // startsAt は文字列または Date オブジェクトとして返る（pg-mem の型挙動に依存）
    expect(ev.startsAt).toBeTruthy();
  });

  it('バリデーションエラー（400）時は new_message が emit されない', async () => {
    const { token } = await registerUser(app, 'ev_route3', 'ev_route3@t.com');
    const channelId = await createChannelReq(app, token, 'ev-route-ch3');

    const res = await request(app).post('/api/events').set('Cookie', `token=${token}`).send({
      channelId,
      title: '   ', // 空タイトル
      startsAt: '2030-06-01T10:00:00.000Z',
    });

    expect(res.status).toBe(400);
    expect(mockEmit).not.toHaveBeenCalledWith('new_message', expect.anything());
  });
});
