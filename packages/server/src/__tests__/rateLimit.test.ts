/**
 * テスト対象:
 *   - packages/server/src/middleware/rateLimit.ts（Express ミドルウェア）
 *   - packages/server/src/routes/messages.ts（POST /api/messages/:channelId/send）
 *   - packages/server/src/routes/dm.ts（POST /api/dm/conversations/:id/messages）
 *   - packages/server/src/routes/scheduledMessages.ts（POST /api/scheduled-messages）
 *   - packages/server/src/socket/messageHandler.ts（send_message イベント）
 *   - packages/server/src/socket/dmHandler.ts（send_dm イベント）
 *
 * 戦略:
 *   - DB は pg-mem のインメモリ PostgreSQL 互換 DB を使用
 *   - HTTP エンドポイントは supertest で検証
 *   - Socket イベントはサービス層 + rateLimitService をモックして検証
 *   - 時刻制御は jest.useFakeTimers() で行う
 */

import { getSharedTestDatabase } from './__fixtures__/pgTestHelper';

const testDb = getSharedTestDatabase();

jest.mock('../db/database', () => testDb);

import request from 'supertest';
import { createApp } from '../app';
import { registerUser, createChannelReq } from './__fixtures__/testHelpers';

const app = createApp();

let userId: number;
let token: string;
let channelId: number;

beforeAll(async () => {
  const u = await registerUser(app, 'ratelimit_user', 'ratelimit@example.com');
  userId = u.userId;
  token = u.token;
  channelId = await createChannelReq(app, token, 'ratelimit-channel');
});

describe('HTTPレート制限ミドルウェア', () => {
  describe('POST /api/messages（チャンネルメッセージ送信）', () => {
    it('ウィンドウ内の件数が上限以下のときは 200/201 が返る', () => {
      // TODO
    });

    it('ウィンドウ内の件数が上限を超えると 429 が返る', () => {
      // TODO
    });

    it('429 レスポンスボディに retryAfterSec, limit, windowSec が含まれる', () => {
      // TODO
    });

    it('ウィンドウが経過した後は再び送信できる（429 → 201）', () => {
      // TODO
    });
  });

  describe('POST /api/dm/conversations/:id/messages（DM送信）', () => {
    it('ウィンドウ内の件数が上限を超えると 429 が返る', () => {
      // TODO
    });

    it('429 レスポンスボディに retryAfterSec, limit, windowSec が含まれる', () => {
      // TODO
    });
  });

  describe('POST /api/scheduled-messages（予約送信）', () => {
    it('ウィンドウ内の件数が上限を超えると 429 が返る', () => {
      // TODO
    });
  });

  describe('別ユーザー独立性', () => {
    it('ユーザーAが上限に達してもユーザーBは 201 で送信できる', () => {
      // TODO
    });
  });
});

describe('Socket レート制限', () => {
  describe('send_message イベント', () => {
    it('上限以下のときはメッセージが正常に処理される', () => {
      // TODO
    });

    it('上限を超えると socket.emit("error", ...) で rate_limit エラーが発行される', () => {
      // TODO
    });

    it('rate_limit エラーのペイロードに retryAfterSec, limit, windowSec が含まれる', () => {
      // TODO
    });
  });

  describe('send_dm イベント', () => {
    it('上限を超えると socket.emit("error", ...) で rate_limit エラーが発行される', () => {
      // TODO
    });
  });

  describe('HTTP と Socket のカウント共有', () => {
    it('HTTP 送信と Socket 送信は同一カウンタで集計される（合算してブロック）', () => {
      // TODO
    });
  });
});
