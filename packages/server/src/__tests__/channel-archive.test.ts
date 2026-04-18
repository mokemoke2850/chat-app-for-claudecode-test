/**
 * チャンネルアーカイブ機能のサーバーサイドテスト
 *
 * テスト対象:
 *   - channelService: archiveChannel / unarchiveChannel / getArchivedChannels
 *   - channelController: PATCH /api/channels/:id/archive, DELETE /api/channels/:id/archive
 *                        GET /api/channels/archived
 *   - messageController / socket handler: アーカイブ済みチャンネルへのメッセージ送信禁止
 *
 * 戦略: pg-mem のインメモリ PostgreSQL 互換 DB を使い、
 *       サービス層直接呼び出しと supertest HTTP テストを組み合わせて検証する。
 *       channels テーブルに is_archived カラムが追加されることを前提とする。
 */

import { getSharedTestDatabase, resetTestData } from './__fixtures__/pgTestHelper';

const testDb = getSharedTestDatabase();

jest.mock('../db/database', () => testDb);

import request from 'supertest';
import { createApp } from '../app';
import { registerUser, createChannelReq, insertMessage } from './__fixtures__/testHelpers';

const app = createApp();

// ---------------------------------------------------------------------------
// サービス層テスト
// ---------------------------------------------------------------------------

describe('チャンネルアーカイブ: サービス層', () => {
  beforeEach(async () => {
    await resetTestData(testDb);
  });

  describe('archiveChannel', () => {
    it('チャンネルをアーカイブすると is_archived が true になる', async () => {
      // TODO
    });

    it('存在しないチャンネルのアーカイブはエラーになる（404相当）', async () => {
      // TODO
    });

    it('作成者以外によるアーカイブはエラーになる（403相当）', async () => {
      // TODO
    });

    it('既にアーカイブ済みのチャンネルを再度アーカイブしようとするとエラーになる', async () => {
      // TODO
    });

    it('管理者（admin）は他者が作成したチャンネルもアーカイブできる', async () => {
      // TODO
    });
  });

  describe('unarchiveChannel（アーカイブ解除）', () => {
    it('アーカイブ済みチャンネルを解除すると is_archived が false になる', async () => {
      // TODO
    });

    it('アーカイブされていないチャンネルの解除はエラーになる', async () => {
      // TODO
    });

    it('作成者以外によるアーカイブ解除はエラーになる（403相当）', async () => {
      // TODO
    });

    it('管理者（admin）は他者が作成したチャンネルもアーカイブ解除できる', async () => {
      // TODO
    });
  });

  describe('getChannelsForUser（アーカイブ済みの除外）', () => {
    it('アーカイブ済みチャンネルは通常の一覧に含まれない', async () => {
      // TODO
    });

    it('アーカイブされていないチャンネルは通常の一覧に含まれる', async () => {
      // TODO
    });

    it('複数チャンネルが混在する場合、アーカイブ済みのみが除外される', async () => {
      // TODO
    });
  });

  describe('getArchivedChannels（アーカイブ一覧取得）', () => {
    it('アーカイブ済みチャンネルの一覧を返す', async () => {
      // TODO
    });

    it('アーカイブ済みが存在しない場合は空配列を返す', async () => {
      // TODO
    });

    it('非アーカイブのチャンネルはアーカイブ一覧に含まれない', async () => {
      // TODO
    });

    it('アーカイブ一覧は名前の昇順で返される', async () => {
      // TODO
    });

    it('プライベートチャンネルはメンバーのみがアーカイブ一覧で参照できる', async () => {
      // TODO
    });
  });
});

// ---------------------------------------------------------------------------
// REST API 統合テスト: アーカイブ操作エンドポイント
// ---------------------------------------------------------------------------

describe('REST API: PATCH /api/channels/:id/archive（アーカイブ）', () => {
  beforeEach(async () => {
    await resetTestData(testDb);
  });

  it('チャンネル作成者がアーカイブすると 200 とアーカイブ済みチャンネルが返る', async () => {
    // TODO
  });

  it('認証なしで 401 を返す', async () => {
    // TODO
  });

  it('存在しないチャンネルIDで 404 を返す', async () => {
    // TODO
  });

  it('作成者以外がアーカイブしようとすると 403 を返す', async () => {
    // TODO
  });

  it('既にアーカイブ済みのチャンネルを再度アーカイブすると 409 を返す', async () => {
    // TODO
  });

  it('管理者（admin）は他者のチャンネルをアーカイブできる（200が返る）', async () => {
    // TODO
  });
});

describe('REST API: DELETE /api/channels/:id/archive（アーカイブ解除）', () => {
  beforeEach(async () => {
    await resetTestData(testDb);
  });

  it('チャンネル作成者がアーカイブ解除すると 200 と解除済みチャンネルが返る', async () => {
    // TODO
  });

  it('認証なしで 401 を返す', async () => {
    // TODO
  });

  it('存在しないチャンネルIDで 404 を返す', async () => {
    // TODO
  });

  it('作成者以外がアーカイブ解除しようとすると 403 を返す', async () => {
    // TODO
  });

  it('アーカイブされていないチャンネルの解除は 409 を返す', async () => {
    // TODO
  });
});

describe('REST API: GET /api/channels/archived（アーカイブ一覧）', () => {
  beforeEach(async () => {
    await resetTestData(testDb);
  });

  it('認証済みユーザーにアーカイブ済みチャンネル一覧を返す（200）', async () => {
    // TODO
  });

  it('認証なしで 401 を返す', async () => {
    // TODO
  });

  it('レスポンスに is_archived=true のチャンネルのみ含まれる', async () => {
    // TODO
  });

  it('プライベートかつアーカイブ済みのチャンネルはメンバーにのみ返る', async () => {
    // TODO
  });

  it('プライベートかつアーカイブ済みのチャンネルは非メンバーには返らない', async () => {
    // TODO
  });
});

// ---------------------------------------------------------------------------
// REST API 統合テスト: アーカイブ済みチャンネルへのメッセージ送信禁止
// ---------------------------------------------------------------------------

describe('REST API: アーカイブ済みチャンネルへのメッセージ送信禁止', () => {
  beforeEach(async () => {
    await resetTestData(testDb);
  });

  it('アーカイブ済みチャンネルへの GET /api/channels/:id/messages は 200 で返る（読み取りは可能）', async () => {
    // TODO
  });

  it('アーカイブ済みチャンネルへのメッセージ送信（HTTP POST）は 403 を返す', async () => {
    // TODO
  });

  it('非アーカイブのチャンネルへのメッセージ送信は通常通り成功する', async () => {
    // TODO
  });
});

// ---------------------------------------------------------------------------
// 型・スキーマの境界条件
// ---------------------------------------------------------------------------

describe('Channel 型: is_archived フィールド境界条件', () => {
  beforeEach(async () => {
    await resetTestData(testDb);
  });

  it('GET /api/channels レスポンスの各チャンネルに isArchived フィールドが含まれる', async () => {
    // TODO
  });

  it('GET /api/channels/archived レスポンスの各チャンネルの isArchived が true である', async () => {
    // TODO
  });

  it('新規作成チャンネルの isArchived はデフォルトで false である', async () => {
    // TODO
  });
});
