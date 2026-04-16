/**
 * テスト対象: メッセージ引用返信機能
 * 戦略: better-sqlite3 のインメモリ DB を使いサービス層を直接テストする。
 * 外部キー制約を満たすため beforeAll でユーザー・チャンネルを挿入する。
 */

import type { Message } from '@chat-app/shared';

let userId1: number;
let userId2: number;
let channelId: number;
let baseMessageId: number;

jest.mock('../db/database', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
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

describe('引用返信機能', () => {
  describe('引用返信メッセージの送信', () => {
    it('引用返信メッセージを送信できる');

    it('引用元メッセージIDを含むメッセージが保存される');

    it('存在しないメッセージIDを引用元に指定した場合はエラーになる');

    it('削除済みメッセージを引用元に指定した場合はエラーになる');
  });

  describe('引用元メッセージ情報の取得', () => {
    it('引用元メッセージの内容が取得できる');

    it('引用元メッセージの送信者情報が取得できる');

    it('引用元メッセージのタイムスタンプが取得できる');

    it('引用返信を含むメッセージ一覧取得時に引用元情報がネストして返される');
  });

  describe('引用返信の表示データ', () => {
    it('引用元メッセージが後から削除された場合も引用返信は表示される');

    it('同一チャンネル内のメッセージのみ引用できる');
  });
});
