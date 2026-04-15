/**
 * チャンネル添付ファイル一覧エンドポイントのHTTPレベルテスト
 *
 * テスト対象: GET /api/channels/:id/attachments
 * 戦略: supertest でHTTPリクエストを発行し、レスポンスのステータスコードと
 * レスポンスボディを検証する。DB は better-sqlite3 のインメモリ DBを使用。
 */

import request from 'supertest';
import { createApp } from '../../app';
import { registerUser, createChannelReq } from '../__fixtures__/testHelpers';

jest.mock('../../db/database', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const DatabaseLib = require('better-sqlite3') as typeof import('better-sqlite3');
  const db = new DatabaseLib(':memory:');
  db.pragma('foreign_keys = ON');
  const { initializeSchema: init } =
    jest.requireActual<typeof import('../../db/database')>('../../db/database');
  init(db);
  return {
    getDatabase: () => db,
    initializeSchema: init,
    closeDatabase: jest.fn(),
  };
});

const app = createApp();

describe('GET /api/channels/:id/attachments', () => {
  it('正常: 認証済みユーザーが添付ファイル一覧を取得すると200と配列が返る', async () => {
    // TODO: implement
  });

  it('正常: ファイルタイプ（mime_type）パラメータでフィルタリングできる（例: image/*）', async () => {
    // TODO: implement
  });

  it('正常: ファイルタイプ（mime_type）パラメータでフィルタリングできる（例: application/pdf）', async () => {
    // TODO: implement
  });

  it('正常: ファイルタイプ（mime_type）パラメータでフィルタリングできる（例: other）', async () => {
    // TODO: implement
  });

  it('正常: 各添付ファイルにファイル名・アップロード者・日時・サイズが含まれる', async () => {
    // TODO: implement
  });

  it('正常: 添付ファイルが0件の場合は空配列が返る', async () => {
    // TODO: implement
  });

  it('異常: 存在しないチャンネルIDを指定すると404が返る', async () => {
    // TODO: implement
  });

  it('異常: 認証なしで401が返る', async () => {
    const res = await request(app).get('/api/channels/1/attachments');
    // TODO: implement
    void res;
  });
});
