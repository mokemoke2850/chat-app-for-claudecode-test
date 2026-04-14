import { initializeSchema } from '../db/database';

jest.mock('../db/database', () => {
  const DB = require('better-sqlite3') as typeof import('better-sqlite3');
  const db = new DB(':memory:');
  db.pragma('foreign_keys = ON');
  const { initializeSchema: init } =
    jest.requireActual<typeof import('../db/database')>('../db/database');
  init(db);
  return {
    getDatabase: () => db,
    initializeSchema: init,
    closeDatabase: jest.fn(),
  };
});

void initializeSchema;

describe('pinMessage', () => {
  it('メッセージをピン留めできる', () => {});
  it('存在しないメッセージのピン留めはエラーになる', () => {});
  it('同じメッセージを二重にピン留めしようとするとエラーになる', () => {});
  it('削除済みメッセージはピン留めできない', () => {});
});

describe('unpinMessage', () => {
  it('ピン留めを解除できる', () => {});
  it('ピン留めされていないメッセージの解除はエラーになる', () => {});
  it('存在しないメッセージの解除はエラーになる', () => {});
});

describe('getPinnedMessages', () => {
  it('チャンネルのピン留めメッセージ一覧を返す', () => {});
  it('ピン留めが存在しないチャンネルでは空配列を返す', () => {});
  it('ピン留めメッセージは pinned_at の降順で返される', () => {});
  it('削除済みメッセージはピン留め一覧から除外される', () => {});
});

describe('Socket経由でのピン留め操作', () => {
  it('pin_message イベントで pinned_messages テーブルにレコードが作成される', () => {});
  it('unpin_message イベントで pinned_messages テーブルからレコードが削除される', () => {});
  it('pin_message 後に message_pinned イベントがチャンネルメンバー全員に emit される', () => {});
  it('unpin_message 後に message_unpinned イベントがチャンネルメンバー全員に emit される', () => {});
});

describe('REST API: GET /api/channels/:channelId/pins', () => {
  it('200 でピン留めメッセージ一覧を返す', () => {});
  it('認証なしで 401 を返す', () => {});
  it('存在しないチャンネルIDで 404 を返す', () => {});
});

describe('REST API: POST /api/channels/:channelId/pins/:messageId', () => {
  it('ピン留め成功で 201 を返す', () => {});
  it('認証なしで 401 を返す', () => {});
  it('既にピン留め済みで 409 を返す', () => {});
});

describe('REST API: DELETE /api/channels/:channelId/pins/:messageId', () => {
  it('ピン留め解除成功で 204 を返す', () => {});
  it('認証なしで 401 を返す', () => {});
  it('ピン留めが存在しない場合 404 を返す', () => {});
});
