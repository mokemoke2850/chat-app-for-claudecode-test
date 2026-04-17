/**
 * チャンネルトピック・説明機能のテスト
 *
 * テスト対象:
 *   - PATCH /api/channels/:id/topic (バックエンドAPI)
 *   - channelService.updateChannelTopic
 *
 * 戦略: pg-mem のインメモリ PostgreSQL 互換 DB を使用。
 * 権限チェック（admin / moderator / 一般ユーザー）と
 * システムメッセージ送信を重点的にテストする。
 */

import { createTestDatabase } from './__fixtures__/pgTestHelper';

const testDb = createTestDatabase();
jest.mock('../../db/database', () => testDb);

import request from 'supertest';
import { createApp } from '../../app';
import { registerUser, createChannelReq } from './__fixtures__/testHelpers';

const app = createApp();

describe('PATCH /api/channels/:id/topic', () => {
  describe('正常系', () => {
    it('管理者はチャンネルのトピックを更新できる', async () => {
      // TODO
    });

    it('チャンネル作成者はトピックを更新できる', async () => {
      // TODO
    });

    it('トピックをnullにするとトピックが削除される', async () => {
      // TODO
    });

    it('説明（description）も同時に更新できる', async () => {
      // TODO
    });
  });

  describe('システムメッセージ', () => {
    it('トピック更新後にシステムメッセージがチャンネルに投稿される', async () => {
      // TODO
    });
  });

  describe('権限チェック', () => {
    it('一般ユーザー（作成者以外）がトピックを更新しようとすると403が返る', async () => {
      // TODO
    });

    it('未認証ユーザーがトピックを更新しようとすると401が返る', async () => {
      // TODO
    });

    it('存在しないチャンネルIDを指定すると404が返る', async () => {
      // TODO
    });
  });
});

describe('updateChannelTopic（channelService）', () => {
  it('topic と description が DB に保存される', async () => {
    // TODO
  });

  it('topic のみ更新すると description は変更されない', async () => {
    // TODO
  });
});
